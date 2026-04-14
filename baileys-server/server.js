/**
 * Maestria Social — Servidor WhatsApp Local (whatsapp-web.js)
 * ─────────────────────────────────────────────────────────────
 * 1ª vez: npm install → npm start → escaneie o QR code
 * Próximas vezes: npm start (sessão já salva automaticamente)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const express = require('express')

const app = express()
app.use(express.json())

let isConnected = false
let client = null

// ── Cliente WhatsApp ───────────────────────────────────────────────────────────
client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessao_whatsapp' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
})

client.on('qr', (qr) => {
  console.log('\n📱 Escaneie o QR code abaixo com seu WhatsApp:\n')
  qrcode.generate(qr, { small: true })
  console.log('\n(WhatsApp > Dispositivos conectados > Conectar dispositivo)\n')
})

client.on('ready', () => {
  isConnected = true
  console.log('\n✅ WhatsApp conectado com sucesso!')
  console.log(`🚀 API pronta em http://localhost:${PORT}\n`)
})

client.on('authenticated', () => {
  console.log('🔐 Autenticado — salvando sessão...')
})

client.on('auth_failure', () => {
  console.log('❌ Falha na autenticação. Delete "sessao_whatsapp" e reinicie.')
  isConnected = false
})

client.on('disconnected', (reason) => {
  isConnected = false
  console.log('🔌 Desconectado:', reason)
  console.log('🔄 Reiniciando...')
  client.initialize()
})

// ── Utilitários ────────────────────────────────────────────────────────────────
function formatarTelefone(phone) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `${normalized}@c.us`
}

async function baixarMidia(url) {
  const media = await MessageMedia.fromUrl(url, {
    unsafeMime: true,
    reqheaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
  return media
}

// Resolve o ID correto do número no WhatsApp (evita erro "No LID for user")
async function resolverChatId(phone) {
  const formatted = formatarTelefone(phone)
  const numberId = await client.getNumberId(formatted)
  if (!numberId) throw new Error(`Número ${phone} não encontrado no WhatsApp`)
  return numberId._serialized
}

// ── Rotas ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: isConnected ? 'conectado' : 'aguardando QR', servidor: 'Maestria WhatsApp' })
})

app.get('/status', (req, res) => {
  res.json({ connected: isConnected })
})

app.post('/disparar', async (req, res) => {
  if (!isConnected || !client) {
    return res.status(503).json({ error: 'WhatsApp não conectado. Escaneie o QR code no terminal.' })
  }

  const { phone, type, content, caption, filename } = req.body

  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })

  try {
    const chatId = await resolverChatId(phone)

    if (type === 'text') {
      await client.sendMessage(chatId, content || '')

    } else if (type === 'image') {
      const media = await baixarMidia(content)
      await client.sendMessage(chatId, media, { caption: caption || '' })

    } else if (type === 'audio') {
      const media = await baixarMidia(content)
      await client.sendMessage(chatId, media, { sendAudioAsVoice: false })

    } else if (type === 'video') {
      const media = await baixarMidia(content)
      await client.sendMessage(chatId, media, { caption: caption || '' })

    } else if (type === 'document') {
      const media = await baixarMidia(content)
      if (filename) media.filename = filename
      await client.sendMessage(chatId, media)

    } else {
      return res.status(400).json({ error: `Tipo "${type}" não suportado` })
    }

    res.json({ ok: true })
  } catch (err) {
    const msg = err?.message || String(err)
    console.error(`❌ Erro ao enviar [${type}] para ${phone}:`, msg)
    res.status(500).json({ error: msg })
  }
})

// ── Inicia servidor ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════')
  console.log('   Maestria Social — Servidor WhatsApp')
  console.log('══════════════════════════════════════════')
  console.log(`\n🌐 API rodando em: http://localhost:${PORT}`)
  console.log('📱 Inicializando WhatsApp...\n')
  client.initialize()
})
