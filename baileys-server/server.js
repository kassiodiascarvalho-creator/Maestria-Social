/**
 * Maestria Social — Servidor Baileys Local
 * ─────────────────────────────────────────
 * Roda na sua máquina e expõe uma API HTTP para o Maestria enviar mensagens.
 *
 * 1ª vez: npm install → npm start → escaneie o QR code
 * Próximas vezes: npm start (sessão já salva)
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const P = require('pino')

const app = express()
app.use(express.json())

let sock = null
let isConnected = false

// ── Conexão com WhatsApp ───────────────────────────────────────────────────────
async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('sessao_whatsapp')

  sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Maestria Social', 'Chrome', '1.0.0'],
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      isConnected = false
      const codigo = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null
      const deslogado = codigo === DisconnectReason.loggedOut

      if (deslogado) {
        console.log('\n❌ Deslogado do WhatsApp.')
        console.log('   Delete a pasta "sessao_whatsapp" e reinicie o servidor para reconectar.\n')
      } else {
        console.log('🔄 Conexão perdida. Reconectando...')
        await conectar()
      }
    } else if (connection === 'open') {
      isConnected = true
      console.log('\n✅ WhatsApp conectado com sucesso!')
      console.log(`🚀 API pronta em http://localhost:${PORT}\n`)
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

// ── Utilitários ────────────────────────────────────────────────────────────────
function formatarTelefone(phone) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `${normalized}@s.whatsapp.net`
}

// ── Rotas ──────────────────────────────────────────────────────────────────────

// GET /status — verifica se está conectado
app.get('/status', (req, res) => {
  res.json({ connected: isConnected })
})

// POST /disparar — envia uma mensagem para um número
// Body: { phone, type, content, caption?, filename? }
app.post('/disparar', async (req, res) => {
  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp não conectado. Inicie o servidor e escaneie o QR.' })
  }

  const { phone, type, content, caption, filename } = req.body

  if (!phone) return res.status(400).json({ error: '"phone" é obrigatório' })
  if (!type)  return res.status(400).json({ error: '"type" é obrigatório' })
  if (!content && type !== 'text') return res.status(400).json({ error: '"content" é obrigatório' })

  const jid = formatarTelefone(phone)

  try {
    if (type === 'text') {
      await sock.sendMessage(jid, { text: content || '' })

    } else if (type === 'image') {
      await sock.sendMessage(jid, {
        image: { url: content },
        caption: caption || '',
      })

    } else if (type === 'audio') {
      await sock.sendMessage(jid, {
        audio: { url: content },
        mimetype: 'audio/mp4',
        ptt: false,
      })

    } else if (type === 'video') {
      await sock.sendMessage(jid, {
        video: { url: content },
        caption: caption || '',
      })

    } else if (type === 'document') {
      await sock.sendMessage(jid, {
        document: { url: content },
        fileName: filename || 'arquivo',
        mimetype: 'application/octet-stream',
      })

    } else {
      return res.status(400).json({ error: `Tipo "${type}" não suportado. Use: text, image, audio, video, document` })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Erro ao enviar:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ── Inicia servidor ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

conectar().then(() => {
  app.listen(PORT, () => {
    console.log('\n══════════════════════════════════════════')
    console.log('   Maestria Social — Servidor Baileys')
    console.log('══════════════════════════════════════════')
    console.log(`\n🌐 API rodando em: http://localhost:${PORT}`)
    console.log('📱 Aguardando conexão com WhatsApp...')
    console.log('\n   → Escaneie o QR code com seu WhatsApp')
    console.log('   → Após conectar, configure no Maestria:')
    console.log(`     BAILEYS_API_URL = http://localhost:${PORT}`)
    console.log('\n   Use um túnel (ex: ngrok) para acessar de fora:')
    console.log('   npx ngrok http 3001\n')
  })
})
