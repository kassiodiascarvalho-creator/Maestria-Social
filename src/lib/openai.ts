import OpenAI from 'openai'
import { getConfig } from './config'

export async function createOpenAIClient() {
  const apiKey = await getConfig('OPENAI_API_KEY')
  if (!apiKey) throw new Error('[openai] OPENAI_API_KEY não configurado')
  return new OpenAI({ apiKey })
}

export const MODEL = 'gpt-4.1-mini'
