/**
 * Maestria Social — Servidor WhatsApp Multi-Instância
 * ─────────────────────────────────────────────────────
 * Suporta múltiplos números WhatsApp simultaneamente.
 * Configure as instâncias em config.json.
 *
 * 1ª vez: npm install → node server.js → escaneie o QR no terminal ou no Maestria
 * Próximas vezes: node server.js (sessão salva automaticamente por instância)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcodeTerminal = require('qrcode-terminal')
const QRCode = require('qrcode')
const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())

// ── Config ─────────────────────────────────────────────────────────────────────
let config = { instances: [{ id: '1', label: 'Número 1' }] }
try {
  const configPath = path.join(__dirname, 'config.json')
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  }
} catch (e) {
  console.warn('⚠️  config.json não encontrado — usando instância padrão (1 número)')
}

// ── Estado das instâncias ──────────────────────────────────────────────────────
const instances = {}
// estrutura: { client, status, phone, qrDataUrl, label }

// ── Utilitários ────────────────────────────────────────────────────────────────
function formatarTelefone(phone) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `${normalized}@c.us`
}

async function baixarMidia(url) {
  return await MessageMedia.fromUrl(url, {
    unsafeMime: true,
    reqheaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
}

async function resolverChatId(client, phone) {
  const formatted = formatarTelefone(phone)
  const numberId = await client.getNumberId(formatted)
  if (!numberId) throw new Error(`Número ${phone} não encontrado no WhatsApp`)
  return numberId._serialized
}

async function enviarMensagem(inst, type, phone, content, caption, filename) {
  const chatId = await resolverChatId(inst.client, phone)

  if (type === 'text') {
    await inst.client.sendMessage(chatId, content || '')
  } else if (type === 'image') {
    const media = await baixarMidia(content)
    await inst.client.sendMessage(chatId, media, { caption: caption || '' })
  } else if (type === 'audio') {
    const media = await baixarMidia(content)
    await inst.client.sendMessage(chatId, media, { sendAudioAsVoice: false })
  } else if (type === 'video') {
    const media = await baixarMidia(content)
    await inst.client.sendMessage(chatId, media, { caption: caption || '' })
  } else if (type === 'document') {
    const media = await baixarMidia(content)
    if (filename) media.filename = filename
    await inst.client.sendMessage(chatId, media)
  } else {
    throw new Error(`Tipo "${type}" não suportado`)
  }
}

// ── Criar instância ────────────────────────────────────────────────────────────
function criarInstancia(id, label) {
  const sessaoDir = path.join(__dirname, 'sessoes', `instancia_${id}`)

  instances[id] = {
    client: null,
    status: 'iniciando',
    phone: null,
    qrDataUrl: null,
    label: label || `Número ${id}`,
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessaoDir }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })
  instances[id].client = client

  client.on('qr', async (qr) => {
    console.log(`\n📱 [Instância ${id} — ${instances[id].label}] Escaneie o QR:`)
    qrcodeTerminal.generate(qr, { small: true })
    try {
      instances[id].qrDataUrl = await QRCode.toDataURL(qr)
    } catch (e) {
      console.error(`[${id}] Erro ao gerar QR base64:`, e.message)
    }
    instances[id].status = 'aguardando_qr'
  })

  client.on('ready', async () => {
    instances[id].status = 'conectado'
    instances[id].qrDataUrl = null
    try {
      const info = client.info
      instances[id].phone = info?.wid?.user || null
    } catch (e) {}
    console.log(`\n✅ [Instância ${id} — ${instances[id].label}] Conectado! Número: +${instances[id].phone}`)
  })

  client.on('authenticated', () => {
    instances[id].status = 'autenticando'
    console.log(`🔐 [Instância ${id}] Autenticado — salvando sessão...`)
  })

  client.on('auth_failure', () => {
    instances[id].status = 'erro_auth'
    instances[id].phone = null
    console.log(`❌ [Instância ${id}] Falha na autenticação. Delete a pasta sessoes/instancia_${id} e reinicie.`)
  })

  client.on('disconnected', (reason) => {
    instances[id].status = 'desconectado'
    instances[id].phone = null
    instances[id].qrDataUrl = null
    console.log(`🔌 [Instância ${id}] Desconectado: ${reason}. Reiniciando em 5s...`)
    setTimeout(() => client.initialize(), 5000)
  })

  client.initialize()
}

// ── Salva config.json ──────────────────────────────────────────────────────────
function salvarConfig() {
  const configPath = path.join(__dirname, 'config.json')
  const data = {
    instances: Object.entries(instances).map(([id, inst]) => ({
      id,
      label: inst.label,
      phone: inst.phone || undefined,
    }))
  }
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8')
}

// ── Rotas multi-instância ──────────────────────────────────────────────────────

// Lista todas as instâncias
app.get('/instancias', (req, res) => {
  const lista = Object.entries(instances).map(([id, inst]) => ({
    id,
    label: inst.label,
    status: inst.status,
    phone: inst.phone,
    connected: inst.status === 'conectado',
    temQr: !!inst.qrDataUrl,
  }))
  res.json(lista)
})

// Adiciona nova instância dinamicamente
app.post('/instancias', (req, res) => {
  const { label, phone } = req.body
  if (!label || !label.trim()) return res.status(400).json({ error: '"label" é obrigatório' })

  // Gera próximo ID disponível
  const ids = Object.keys(instances).map(Number).filter(n => !isNaN(n))
  const novoId = String((ids.length > 0 ? Math.max(...ids) : 0) + 1)

  if (instances[novoId]) return res.status(409).json({ error: `Instância ${novoId} já existe` })

  criarInstancia(novoId, label.trim())
  if (phone) instances[novoId].phone = phone.trim()
  salvarConfig()

  console.log(`\n➕ Nova instância adicionada: [${novoId}] ${label.trim()}`)
  res.json({ ok: true, id: novoId, label: label.trim() })
})

// Remove instância
app.delete('/instancia/:id', async (req, res) => {
  const inst = instances[req.params.id]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (req.params.id === '1') return res.status(400).json({ error: 'Instância principal não pode ser removida' })

  try { await inst.client.destroy() } catch {}
  delete instances[req.params.id]
  salvarConfig()

  console.log(`\n➖ Instância removida: [${req.params.id}]`)
  res.json({ ok: true })
})

// Status de uma instância
app.get('/instancia/:id/status', (req, res) => {
  const inst = instances[req.params.id]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  res.json({
    id: req.params.id,
    label: inst.label,
    status: inst.status,
    phone: inst.phone,
    connected: inst.status === 'conectado',
    temQr: !!inst.qrDataUrl,
  })
})

// QR code de uma instância (como data URL base64 PNG)
app.get('/instancia/:id/qr', (req, res) => {
  const inst = instances[req.params.id]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (!inst.qrDataUrl) return res.status(204).end()
  res.json({ qr: inst.qrDataUrl })
})

// Disparar mensagem por instância específica
app.post('/instancia/:id/disparar', async (req, res) => {
  const inst = instances[req.params.id]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (inst.status !== 'conectado') {
    return res.status(503).json({ error: `Instância ${req.params.id} não conectada (${inst.status})` })
  }

  const { phone, type, content, caption, filename } = req.body
  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })

  try {
    await enviarMensagem(inst, type, phone, content, caption, filename)
    res.json({ ok: true })
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`❌ [Instância ${req.params.id}] Erro ao enviar [${type}] para ${phone}:`, msg)
    res.status(500).json({ error: msg })
  }
})

// ── Rotas de compatibilidade (usa instância "1") ───────────────────────────────
app.get('/', (req, res) => {
  const inst = instances['1']
  res.json({
    status: inst?.status === 'conectado' ? 'conectado' : 'aguardando QR',
    servidor: 'Maestria WhatsApp Multi-Instância',
    instancias: Object.keys(instances).length,
  })
})

app.get('/status', (req, res) => {
  const inst = instances['1']
  res.json({ connected: inst?.status === 'conectado', phone: inst?.phone || null })
})

app.post('/disparar', async (req, res) => {
  const inst = instances['1']
  if (!inst || inst.status !== 'conectado') {
    return res.status(503).json({ error: 'WhatsApp não conectado. Escaneie o QR code.' })
  }
  const { phone, type, content, caption, filename } = req.body
  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })
  try {
    await enviarMensagem(inst, type, phone, content, caption, filename)
    res.json({ ok: true })
  } catch (err) {
    const msg = err?.message || String(err)
    res.status(500).json({ error: msg })
  }
})

// ── Inicia servidor ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════════')
  console.log('   Maestria Social — WhatsApp Multi-Instância')
  console.log('══════════════════════════════════════════════')
  console.log(`\n🌐 API rodando em: http://localhost:${PORT}`)
  console.log(`📱 Iniciando ${config.instances.length} instância(s):\n`)

  for (const inst of config.instances) {
    console.log(`   • [${inst.id}] ${inst.label}`)
    criarInstancia(String(inst.id), inst.label)
  }

  console.log('\n(QR codes aparecerão abaixo quando prontos)\n')
})