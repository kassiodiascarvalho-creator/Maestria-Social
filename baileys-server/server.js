/**
 * Maestria Social — Servidor WhatsApp Multi-Instância
 * ─────────────────────────────────────────────────────
 * Suporta múltiplos números WhatsApp simultaneamente.
 * Configure as instâncias em config.json.
 *
 * 1ª vez: npm install → node server.js → escaneie o QR no terminal ou no Maestria
 * Próximas vezes: node server.js (sessão salva automaticamente por instância)
 */

const { Client, LocalAuth, MessageMedia, WAState } = require('whatsapp-web.js')
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

// ── Debounce de mensagens ──────────────────────────────────────────────────────
// Acumula mensagens picadas do mesmo lead e aguarda ele terminar de escrever
const DEBOUNCE_MS = 4000 // aguarda 4s sem nova mensagem antes de responder
const pendingMessages = {}
// estrutura: { [instanceId:phone]: { timer, textos: [], lastMessageId, lastMsg } }

// ── Dedup de mensagens já processadas ─────────────────────────────────────────
// Evita duplicatas quando whatsapp-web.js dispara o evento 'message' duas vezes
// para a mesma mensagem (reconexão, multi-device, etc.)
const processedMsgIds = new Set()
function jaProcessado(msgId) {
  if (!msgId) return false
  if (processedMsgIds.has(msgId)) return true
  processedMsgIds.add(msgId)
  // Remove após 5 minutos para não acumular memória indefinidamente
  setTimeout(() => processedMsgIds.delete(msgId), 5 * 60 * 1000)
  return false
}

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
  // Verifica se a sessão realmente está conectada (evita zombie sessions)
  let state = null
  try {
    state = await client.getState()
  } catch (e) {
    throw new Error(`Sessão WhatsApp inacessível (getState falhou: ${e.message})`)
  }
  if (state !== WAState.CONNECTED) {
    throw new Error(`WhatsApp não está conectado (estado: ${state ?? 'desconhecido'}) — reescaneie o QR`)
  }

  const formatted = formatarTelefone(phone)
  console.log(`  → getNumberId: ${formatted}`)
  const numberId = await client.getNumberId(formatted)
  if (!numberId) throw new Error(`Número ${phone} não encontrado no WhatsApp (não é uma conta WA válida)`)
  // Usa sempre @c.us para envio — @lid (multi-device) pode impedir entrega
  const chatId = numberId._serialized.endsWith('@lid') ? formatted : numberId._serialized
  console.log(`  → chatId resolvido: ${chatId} (raw: ${numberId._serialized})`)
  return chatId
}

async function enviarMensagem(inst, type, phone, content, caption, filename, mimeType, ptt) {
  const chatId = await resolverChatId(inst.client, phone)

  // content pode ser URL pública ou base64 raw (quando mimeType está presente)
  async function resolverMidia() {
    if (mimeType && content && !content.startsWith('http')) {
      return new MessageMedia(mimeType, content, filename || 'arquivo')
    }
    return baixarMidia(content)
  }

  if (type === 'text') {
    const sent = await inst.client.sendMessage(chatId, content || '')
    console.log(`  → sendMessage OK — id: ${sent?.id?._serialized ?? 'N/A'}`)
  } else if (type === 'image') {
    const media = await resolverMidia()
    await inst.client.sendMessage(chatId, media, { caption: caption || '' })
  } else if (type === 'audio') {
    const media = await resolverMidia()
    await inst.client.sendMessage(chatId, media, { sendAudioAsVoice: ptt ?? true })
  } else if (type === 'video') {
    const media = await resolverMidia()
    await inst.client.sendMessage(chatId, media, { caption: caption || '' })
  } else if (type === 'document') {
    const media = await resolverMidia()
    if (filename) media.filename = filename
    await inst.client.sendMessage(chatId, media)
  } else {
    throw new Error(`Tipo "${type}" não suportado`)
  }
}

// Processa mensagens acumuladas após o debounce
async function processarMensagensPendentes(id, phone) {
  const key = `${id}:${phone}`
  const pending = pendingMessages[key]
  if (!pending) return

  // Verifica se o lead ainda está digitando ou gravando
  try {
    const chat = await pending.lastMsg.getChat()
    const state = await chat.getState()
    if (state === 'composing' || state === 'recording') {
      // Ainda digitando — adia mais 2s e verifica de novo
      console.log(`[${id}] ⌛ Lead ${phone} ainda está ${state === 'composing' ? 'digitando' : 'gravando'} — aguardando...`)
      pending.timer = setTimeout(() => processarMensagensPendentes(id, phone), 2000)
      return
    }
  } catch (_) {
    // getState pode falhar em algumas versões — ignora e processa normalmente
  }

  // Coleta os textos acumulados e limpa o buffer
  const textos = pending.textos.splice(0)
  const messageId = pending.lastMessageId
  delete pendingMessages[key]

  if (!textos.length) return

  const textoFinal = textos.join('\n')
  console.log(`[${id}] 📨 Enviando ${textos.length > 1 ? `${textos.length} mensagens agrupadas` : 'mensagem'} de ${phone} para o agente`)

  try {
    await fetch(config.agentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-baileys-secret': config.agentWebhookSecret || '',
      },
      body: JSON.stringify({ instanceId: id, phone, texto: textoFinal, messageId }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.error(`[${id}] Erro ao encaminhar mensagem para agente:`, err.message)
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
    setTimeout(() => inicializar(), 5000)
  })

  // Encaminha mensagens recebidas para o agente SDR (se configurado)
  client.on('message', async (msg) => {
    if (msg.fromMe) return
    if (!config.agentWebhookUrl) return

    // Dedup: ignora se já processamos essa mensagem (reconexão / double-fire)
    const msgId = msg.id?._serialized || msg.id?.id
    if (jaProcessado(msgId)) {
      console.log(`[${id}] ⚠️ Mensagem duplicada ignorada: ${msgId}`)
      return
    }

    // Extrai número real do JID. @lid é ID interno do multi-device — usa getContact() para resolver.
    let phone = msg.from
    if (phone.includes('@lid')) {
      try {
        const contact = await msg.getContact()
        phone = contact.number || contact.id?.user || phone.split('@')[0]
        console.log(`[${id}] @lid resolvido para: ${phone}`)
      } catch {
        phone = phone.split('@')[0]
        console.warn(`[${id}] Não foi possível resolver @lid — usando: ${phone}`)
      }
    } else {
      phone = phone.replace(/@c\.us$|@s\.whatsapp\.net$/, '')
    }

    let texto = msg.body || ''

    // Transcreve áudio/voz via Whisper quando não há texto
    if (!texto && msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
      console.log(`[${id}] Áudio recebido (${msg.type}), baixando mídia...`)
      try {
        const media = await msg.downloadMedia()
        if (media?.data) {
          console.log(`[${id}] Mídia baixada (${media.mimetype}), enviando para transcrição...`)
          const appUrl = config.agentWebhookUrl.replace(/\/api\/webhook\/baileys.*$/, '')
          const res = await fetch(`${appUrl}/api/admin/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-baileys-secret': config.agentWebhookSecret || '',
            },
            body: JSON.stringify({ audio: media.data, mimetype: media.mimetype || 'audio/ogg' }),
            signal: AbortSignal.timeout(30000),
          })
          if (res.ok) {
            const data = await res.json()
            texto = data.texto || ''
            if (texto) console.log(`[${id}] ✅ Transcrito: "${texto.slice(0, 80)}"`)
            else console.warn(`[${id}] ⚠️ Transcrição retornou vazio`)
          } else {
            const err = await res.text()
            console.error(`[${id}] ❌ Erro na transcrição (${res.status}):`, err)
          }
        } else {
          console.warn(`[${id}] downloadMedia() não retornou dados`)
        }
      } catch (err) {
        console.error(`[${id}] Erro ao transcrever áudio:`, err.message)
      }
    }

    if (!texto) return

    // ── Debounce: acumula mensagens e aguarda o lead terminar de escrever ──────
    const key = `${id}:${phone}`
    if (!pendingMessages[key]) {
      pendingMessages[key] = { timer: null, textos: [], lastMessageId: null, lastMsg: null }
    }
    pendingMessages[key].textos.push(texto)
    pendingMessages[key].lastMessageId = msg.id?.id || msg.id?._serialized
    pendingMessages[key].lastMsg = msg

    // Reinicia o timer a cada nova mensagem
    if (pendingMessages[key].timer) clearTimeout(pendingMessages[key].timer)
    pendingMessages[key].timer = setTimeout(() => processarMensagensPendentes(id, phone), DEBOUNCE_MS)
  })

  function limparLocks() {
    // Remove arquivos de lock deixados por Chrome que crashou
    const lockFiles = [
      path.join(sessaoDir, 'session', 'SingletonLock'),
      path.join(sessaoDir, 'session', 'SingletonSocket'),
      path.join(sessaoDir, 'session', 'SingletonCookies'),
    ]
    for (const f of lockFiles) {
      try { if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`[${id}] 🧹 Lock removido: ${path.basename(f)}`) } } catch (_) {}
    }
  }

  async function inicializar(tentativa = 1) {
    limparLocks()
    try {
      await client.initialize()
    } catch (err) {
      const MAX = 5
      console.error(`[${id}] ❌ Erro ao inicializar (tentativa ${tentativa}/${MAX}): ${err.message}`)
      if (tentativa < MAX) {
        const delay = tentativa * 6000
        console.log(`[${id}] 🔄 Tentando novamente em ${delay / 1000}s...`)
        instances[id].status = 'reconectando'
        setTimeout(() => inicializar(tentativa + 1), delay)
      } else {
        console.error(`[${id}] ⛔ Instância ${id} falhou após ${MAX} tentativas. Tente deletar sessoes/instancia_${id} e reiniciar.`)
        instances[id].status = 'erro'
      }
    }
  }

  inicializar()
}

// ── Salva config.json ──────────────────────────────────────────────────────────
function salvarConfig() {
  const configPath = path.join(__dirname, 'config.json')
  const data = {
    instances: Object.entries(instances).map(([id, inst]) => ({
      id,
      label: inst.label,
      phone: inst.phone || undefined,
    })),
    ...(config.agentWebhookUrl ? { agentWebhookUrl: config.agentWebhookUrl } : {}),
    ...(config.agentWebhookSecret ? { agentWebhookSecret: config.agentWebhookSecret } : {}),
    ...(config.agentInstances ? { agentInstances: config.agentInstances } : {}),
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

  const { phone, type, content, caption, filename, mimeType, ptt } = req.body
  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })

  console.log(`\n📤 [Instância ${req.params.id}] Disparando ${type} → ${phone}`)
  try {
    await enviarMensagem(inst, type, phone, content, caption, filename, mimeType, ptt)
    console.log(`✅ [Instância ${req.params.id}] Enviado com sucesso → ${phone}`)
    res.json({ ok: true })
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`❌ [Instância ${req.params.id}] Falha ao enviar [${type}] para ${phone}: ${msg}`)
    res.status(500).json({ error: msg })
  }
})

// ── Disparo em lote com jobs ───────────────────────────────────────────────────
// Estrutura de um job:
// { total, enviados, falhas, erros: [{phone, msg}], status: 'rodando'|'concluido'|'erro', iniciadoEm }

const jobs = {}

// Limpa jobs com mais de 2h para não acumular memória
setInterval(() => {
  const limite = Date.now() - 2 * 60 * 60 * 1000
  for (const id of Object.keys(jobs)) {
    if (jobs[id].iniciadoEm < limite) delete jobs[id]
  }
}, 30 * 60 * 1000)

// POST /disparar-lista — recebe lista já personalizada, processa em background
app.post('/disparar-lista', (req, res) => {
  // contatos: [{ phone, mensagens: [{ type, content, caption, filename }] }]
  const { instanceId, contatos, delayMs, delayMsMax, pausaACada, pausaDuracaoMs } = req.body

  const instId = String(instanceId || '1')
  const inst = instances[instId]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (inst.status !== 'conectado') {
    return res.status(503).json({ error: `Instância ${instId} não conectada (${inst.status})` })
  }
  if (!Array.isArray(contatos) || contatos.length === 0) {
    return res.status(400).json({ error: '"contatos" obrigatório e não pode estar vazio' })
  }

  const intervaloMin = typeof delayMs === 'number' && delayMs >= 1000 ? delayMs : 10000
  const intervaloMax = typeof delayMsMax === 'number' && delayMsMax > intervaloMin ? delayMsMax : null
  // Função que sorteia delay entre min e max (ou usa fixo se não há max)
  const sortearDelay = () => intervaloMax
    ? Math.floor(intervaloMin + Math.random() * (intervaloMax - intervaloMin))
    : intervaloMin
  const intervalo = intervaloMin

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  const pausaACadaVal   = typeof pausaACada === 'number' && pausaACada > 0 ? pausaACada : 0
  const pausaDuracaoVal = typeof pausaDuracaoMs === 'number' && pausaDuracaoMs > 0 ? pausaDuracaoMs : 0

  jobs[jobId] = {
    total: contatos.length,
    enviados: 0,
    falhas: 0,
    erros: [],
    status: 'rodando',
    iniciadoEm: Date.now(),
    delayMs: intervalo,
    pausaACada: pausaACadaVal,
    pausaDuracaoMs: pausaDuracaoVal,
    pausandoEm: null,
  }

  // Responde imediatamente com o jobId
  res.json({ ok: true, jobId, total: contatos.length })

  // Processa em background (sem await na resposta)
  processarLista(jobId, instId, contatos, sortearDelay, pausaACadaVal, pausaDuracaoVal).catch(err => {
    if (jobs[jobId]) {
      jobs[jobId].status = 'erro'
      jobs[jobId].erroGeral = err.message
    }
  })
})

// POST /instancia/:id/validar-numeros — verifica se cada número existe no WhatsApp
// body: { numeros: string[] }  (até 500 por chamada; 200ms de delay entre checks)
app.post('/instancia/:id/validar-numeros', async (req, res) => {
  const instId = req.params.id
  const inst = instances[instId]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (inst.status !== 'conectado') {
    return res.status(503).json({ error: `Instância ${instId} não conectada (${inst.status})` })
  }
  const { numeros } = req.body
  if (!Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: '"numeros" deve ser array não vazio' })
  }

  const validos   = []
  const invalidos = []
  const erros     = []

  for (const num of numeros) {
    try {
      const formatted = formatarTelefone(num)
      const numberId  = await inst.client.getNumberId(formatted)
      if (numberId) {
        validos.push(num)
      } else {
        invalidos.push(num)
      }
    } catch (e) {
      erros.push({ numero: num, msg: e.message })
    }
    await new Promise(r => setTimeout(r, 200))
  }

  res.json({ ok: true, validos, invalidos, erros, total: numeros.length })
})

// POST /instancia/:id/validar-numeros-job — inicia validação em background, retorna jobId
// body: { numeros: string[] }  (qualquer quantidade; 200ms entre checks)
app.post('/instancia/:id/validar-numeros-job', (req, res) => {
  const instId = req.params.id
  const inst = instances[instId]
  if (!inst) return res.status(404).json({ error: 'Instância não encontrada' })
  if (inst.status !== 'conectado') {
    return res.status(503).json({ error: `Instância ${instId} não conectada (${inst.status})` })
  }
  const { numeros } = req.body
  if (!Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: '"numeros" deve ser array não vazio' })
  }

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  jobs[jobId] = {
    tipo: 'validacao',
    total: numeros.length,
    processados: 0,
    validos: [],
    invalidos: [],
    erros: [],
    status: 'rodando',
    iniciadoEm: Date.now(),
  }

  // Responde imediatamente com o jobId
  res.json({ ok: true, jobId, total: numeros.length })

  // Processa em background (sem bloquear a resposta HTTP)
  ;(async () => {
    for (const num of numeros) {
      const job = jobs[jobId]
      if (!job || job.status === 'cancelado') break
      try {
        const formatted = formatarTelefone(num)
        const numberId  = await inst.client.getNumberId(formatted)
        if (numberId) {
          job.validos.push(num)
        } else {
          job.invalidos.push(num)
        }
      } catch (e) {
        jobs[jobId].erros.push({ numero: num, msg: e.message })
      }
      jobs[jobId].processados++
      await new Promise(r => setTimeout(r, 200))
    }
    if (jobs[jobId]?.status === 'rodando') {
      jobs[jobId].status = 'concluido'
      console.log(`[Validação ${jobId}] concluído: ${jobs[jobId].validos.length} válidos / ${jobs[jobId].invalidos.length} inválidos / ${jobs[jobId].erros.length} erros`)
    }
  })().catch(err => {
    if (jobs[jobId]) {
      jobs[jobId].status = 'erro'
      jobs[jobId].erroGeral = err.message
    }
  })
})

// GET /job/:jobId — retorna progresso do job
app.get('/job/:jobId', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job não encontrado ou expirado' })
  res.json(job)
})

// POST /job/:jobId/pause — pausa o job
app.post('/job/:jobId/pause', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job não encontrado' })
  if (job.status !== 'rodando') return res.status(400).json({ error: `Job não está rodando (${job.status})` })
  job.status = 'pausado'
  console.log(`[Job ${req.params.jobId}] ⏸ Pausado`)
  res.json({ ok: true, status: 'pausado' })
})

// POST /job/:jobId/resume — retoma o job
app.post('/job/:jobId/resume', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job não encontrado' })
  if (job.status !== 'pausado') return res.status(400).json({ error: `Job não está pausado (${job.status})` })
  job.status = 'rodando'
  console.log(`[Job ${req.params.jobId}] ▶ Retomado`)
  res.json({ ok: true, status: 'rodando' })
})

// Aguarda a instância ficar conectada (até timeoutMs ms)
async function aguardarConectado(instId, timeoutMs = 30000) {
  const inicio = Date.now()
  while (Date.now() - inicio < timeoutMs) {
    const inst = instances[instId]
    if (!inst) return false
    if (inst.status === 'conectado') return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

function isFrameDetachedError(err) {
  const msg = err?.message || String(err)
  return msg.includes('detached Frame') || msg.includes('Target closed') || msg.includes('Session closed')
}

// Aguarda enquanto o job estiver pausado (verifica a cada 1s)
async function aguardarSeNecessario(jobId) {
  while (jobs[jobId]?.status === 'pausado') {
    await new Promise(r => setTimeout(r, 1000))
  }
}

// Processa a lista em background
// getDelay pode ser número fixo ou função que retorna delay aleatório a cada chamada
async function processarLista(jobId, instId, contatos, getDelay = 10000, pausaACada = 0, pausaDuracaoMs = 0) {
  const sortear = typeof getDelay === 'function' ? getDelay : () => getDelay
  const job = jobs[jobId]
  let enviadosNaRodada = 0

  for (const contato of contatos) {
    // Aguarda se o job foi pausado
    await aguardarSeNecessario(jobId)
    if (job.status === 'erro' || job.status === 'concluido') return

    let inst = instances[instId]
    // Se instância desconectou no meio do caminho, aguarda até 30s reconectar
    if (!inst || inst.status !== 'conectado') {
      console.log(`[Job ${jobId}] Instância ${instId} não conectada — aguardando reconexão...`)
      const reconectou = await aguardarConectado(instId, 30000)
      if (!reconectou) {
        job.status = 'erro'
        job.erroGeral = 'Instância desconectou e não reconectou durante o disparo'
        return
      }
      inst = instances[instId]
    }

    // Sem mensagens (ex: fila só tinha templates, filtrados pelo servidor)
    if (!contato.mensagens || contato.mensagens.length === 0) {
      console.warn(`[Job ${jobId}] ⚠️ Contato ${contato.phone} sem mensagens — pulando (templates não são suportados no Baileys)`)
      job.falhas++
      continue
    }

    let contatoOk = true

    for (const msg of contato.mensagens) {
      let tentativas = 0
      const MAX = 2
      while (tentativas < MAX) {
        try {
          await enviarMensagem(inst, msg.type, contato.phone, msg.content, msg.caption, msg.filename)
          break // sucesso
        } catch (err) {
          tentativas++
          const errMsg = err?.message || String(err)

          // Frame detached / sessão caiu: aguarda reconexão e tenta de novo
          if (isFrameDetachedError(err) && tentativas < MAX) {
            console.warn(`[Job ${jobId}] Frame detached ao enviar para ${contato.phone} — aguardando reconexão (tentativa ${tentativas}/${MAX})...`)
            const reconectou = await aguardarConectado(instId, 30000)
            if (reconectou) {
              inst = instances[instId]
              continue
            }
          }

          // Falha definitiva
          contatoOk = false
          job.erros.push({ phone: contato.phone, msg: errMsg })
          console.error(`❌ [Job ${jobId}] Erro ao enviar para ${contato.phone}:`, errMsg)
          break
        }
      }
      if (!contatoOk) break

      // Delay entre mensagens do mesmo contato: 200-400ms
      if (contato.mensagens.length > 1) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 200))
      }
    }

    if (contatoOk) { job.enviados++; enviadosNaRodada++ }
    else job.falhas++

    const ehUltimo = contatos.indexOf(contato) === contatos.length - 1
    if (ehUltimo) break

    // Pausa longa a cada N envios (anti-restrição WhatsApp)
    if (pausaACada > 0 && pausaDuracaoMs > 0 && enviadosNaRodada > 0 && enviadosNaRodada % pausaACada === 0) {
      const minutos = (pausaDuracaoMs / 60000).toFixed(1)
      console.log(`[Job ${jobId}] ☕ Pausa anti-restrição: ${enviadosNaRodada} envios — aguardando ${minutos}min...`)
      job.pausandoEm = enviadosNaRodada
      await new Promise(r => setTimeout(r, pausaDuracaoMs))
      job.pausandoEm = null
      console.log(`[Job ${jobId}] ▶ Retomando após pausa`)
    }

    // Delay entre contatos: sorteia entre mín e máx (ou usa fixo)
    const delay = sortear()
    console.log(`[Job ${jobId}] Aguardando ${(delay/1000).toFixed(1)}s antes do próximo envio...`)
    await new Promise(r => setTimeout(r, delay))
  }

  job.status = 'concluido'
  console.log(`\n✅ [Job ${jobId}] Concluído — ${job.enviados} enviados, ${job.falhas} falhas`)
}

// ── Configuração do agente SDR ─────────────────────────────────────────────────
// POST /config/agent — atualiza URL de webhook e instâncias ativas do agente
app.post('/config/agent', (req, res) => {
  const { webhookUrl, webhookSecret, instances } = req.body
  if (webhookUrl !== undefined) config.agentWebhookUrl = webhookUrl || null
  if (webhookSecret !== undefined) config.agentWebhookSecret = webhookSecret || null
  if (Array.isArray(instances)) config.agentInstances = instances
  salvarConfig()
  console.log(`\n🤖 Agente SDR configurado — instâncias: [${(config.agentInstances || []).join(', ')}]`)
  res.json({ ok: true })
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
  // Usa instância 1 se conectada; senão, usa a primeira instância conectada disponível
  let inst = instances['1']
  if (!inst || inst.status !== 'conectado') {
    const conectada = Object.values(instances).find(i => i.status === 'conectado')
    if (conectada) {
      inst = conectada
      console.log(`[/disparar] Instância 1 offline — usando instância conectada: ${conectada.phone}`)
    } else {
      return res.status(503).json({ error: 'Nenhuma instância WhatsApp conectada.' })
    }
  }
  const { phone, type, content, caption, filename, mimeType, ptt } = req.body
  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })

  console.log(`\n📤 [/disparar → instância ${inst.phone ?? '?'}] Disparando ${type} → ${phone}`)
  try {
    await enviarMensagem(inst, type, phone, content, caption, filename, mimeType, ptt)
    console.log(`✅ [/disparar] Enviado com sucesso → ${phone}`)
    res.json({ ok: true })
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`❌ [/disparar] Falha ao enviar [${type}] para ${phone}: ${msg}`)
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