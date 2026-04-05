import OpenAI from 'openai'

export function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export const MODEL = 'gpt-4.1-mini'
