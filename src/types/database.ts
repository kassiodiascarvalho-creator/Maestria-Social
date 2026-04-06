export type NivelQS = 'Negligente' | 'Iniciante' | 'Intermediário' | 'Avançado' | 'Mestre'
export type StatusLead = 'frio' | 'morno' | 'quente'
export type RoleMensagem = 'user' | 'assistant'
export type CampoQualificacao = 'maior_dor' | 'contexto' | 'interesse' | 'objecao' | 'objetivo' | 'urgencia' | 'orcamento' | 'outro'
export type EventoWebhook = 'novo_lead' | 'lead_qualificado' | 'mensagem_recebida' | 'status_atualizado'

export type ScoresPilares = {
  A: number
  B: number
  C: number
  D: number
  E: number
}

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string
          nome: string
          email: string
          whatsapp: string
          qs_total: number | null
          qs_percentual: number | null
          scores: ScoresPilares | null
          pilar_fraco: string | null
          nivel_qs: NivelQS | null
          status_lead: StatusLead
          agente_iniciado: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          email: string
          whatsapp: string
          qs_total?: number | null
          qs_percentual?: number | null
          scores?: ScoresPilares | null
          pilar_fraco?: string | null
          nivel_qs?: NivelQS | null
          status_lead?: StatusLead
          agente_iniciado?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          nome?: string
          email?: string
          whatsapp?: string
          qs_total?: number | null
          qs_percentual?: number | null
          scores?: ScoresPilares | null
          pilar_fraco?: string | null
          nivel_qs?: NivelQS | null
          status_lead?: StatusLead
          agente_iniciado?: boolean
          atualizado_em?: string
        }
        Relationships: []
      }
      conversas: {
        Row: {
          id: string
          lead_id: string
          role: RoleMensagem
          mensagem: string
          criado_em: string
        }
        Insert: {
          id?: string
          lead_id: string
          role: RoleMensagem
          mensagem: string
          criado_em?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      qualificacoes: {
        Row: {
          id: string
          lead_id: string
          campo: CampoQualificacao
          valor: string
          criado_em: string
        }
        Insert: {
          id?: string
          lead_id: string
          campo: CampoQualificacao
          valor: string
          criado_em?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          nome: string
          chave_hash: string
          chave_prefixo: string
          ativa: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          nome: string
          chave_hash: string
          chave_prefixo: string
          ativa?: boolean
          criado_em?: string
        }
        Update: {
          nome?: string
          ativa?: boolean
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          valor: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          chave: string
          valor: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          valor?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          id: string
          evento: EventoWebhook
          url: string
          secret: string | null
          ativo: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          evento: EventoWebhook
          url: string
          secret?: string | null
          ativo?: boolean
          criado_em?: string
        }
        Update: {
          evento?: EventoWebhook
          url?: string
          secret?: string | null
          ativo?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Helpers de conveniência
export type Lead = Database['public']['Tables']['leads']['Row']
export type LeadInsert = Database['public']['Tables']['leads']['Insert']
export type Conversa = Database['public']['Tables']['conversas']['Row']
export type Qualificacao = Database['public']['Tables']['qualificacoes']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type WebhookConfig = Database['public']['Tables']['webhook_configs']['Row']
