import { toFile } from 'openai'
import { createOpenAIClient } from './openai'

/**
 * Transcreve um áudio em base64 usando OpenAI Whisper.
 * Retorna o texto transcrito ou null se falhar.
 */
export async function transcreverAudio(audioBase64: string, mimetype: string): Promise<string | null> {
  try {
    const openai = await createOpenAIClient()
    const buffer = Buffer.from(audioBase64, 'base64')

    // Determina extensão pelo mimetype
    const ext = mimetype.includes('ogg') ? 'ogg'
      : mimetype.includes('mp4') ? 'mp4'
      : mimetype.includes('mpeg') || mimetype.includes('mp3') ? 'mp3'
      : mimetype.includes('wav') ? 'wav'
      : mimetype.includes('webm') ? 'webm'
      : 'ogg'

    const file = await toFile(buffer, `audio.${ext}`, { type: mimetype.split(';')[0] })

    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'pt',
    })

    return result.text?.trim() || null
  } catch (err) {
    console.error('[transcribe] Erro ao transcrever áudio:', err)
    return null
  }
}

/**
 * Baixa e transcreve um áudio da Meta API pelo media_id.
 */
export async function transcreverAudioMeta(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    // 1. Busca a URL de download
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}?access_token=${accessToken}`)
    if (!metaRes.ok) return null
    const metaData = await metaRes.json() as { url?: string; mime_type?: string }
    if (!metaData.url) return null

    // 2. Baixa o arquivo de áudio
    const audioRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!audioRes.ok) return null

    const arrayBuffer = await audioRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimetype = metaData.mime_type || 'audio/ogg'

    return await transcreverAudio(base64, mimetype)
  } catch (err) {
    console.error('[transcribe] Erro ao baixar áudio Meta:', err)
    return null
  }
}
