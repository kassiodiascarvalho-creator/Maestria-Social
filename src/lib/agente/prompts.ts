import type { Lead } from '@/types/database'

// Roteiros adaptativos por pilar fraco
const ROTEIROS: Record<string, string> = {
  Sociabilidade: `
Foco de sondagem: o lead tem dificuldade em iniciar conexões sociais ou se sente desconfortável em ambientes novos.
Pergunte sobre:
- Situações específicas em que evitou um evento ou interação social e o que perdeu com isso
- Como se sente em ambientes com pessoas desconhecidas
- O que acredita que impede de ampliar seu círculo social`,

  Comunicação: `
Foco de sondagem: o lead tem dificuldade em se expressar com impacto ou clareza.
Pergunte sobre:
- Uma situação recente em que a comunicação não gerou o resultado esperado
- Se já perdeu oportunidades (negócios, promoções, relacionamentos) por dificuldade de se expressar
- Como as pessoas reagem quando ele fala — atenção genuína ou desinteresse`,

  Relacionamento: `
Foco de sondagem: o lead tem uma rede superficial ou não cultiva relacionamentos de forma intencional.
Pergunte sobre:
- A última vez que a rede gerou uma oportunidade concreta sem que pedisse
- Quantas pessoas na rede entraria em contato para uma indicação importante
- O que faz (ou não faz) para manter os relacionamentos vivos`,

  Persuasão: `
Foco de sondagem: o lead trava em negociações ou não consegue mover pessoas à ação.
Pergunte sobre:
- Uma negociação ou conversa importante que não fechou como esperado
- O que acontece quando encontra objeções — recua, insiste ou troca de abordagem
- Quanto dinheiro ou oportunidade já perdeu por não conseguir convencer`,

  Influência: `
Foco de sondagem: o lead não é visto como referência ou não exerce impacto nas decisões ao redor.
Pergunte sobre:
- Se as pessoas buscam sua opinião antes de decidir — ou apenas depois
- Uma situação em que queria liderar algo mas não conseguiu engajar as pessoas
- Como quer ser visto daqui a 2 anos no seu meio profissional ou social`,
}

export function buildSystemPrompt(lead: Lead): string {
  const pilar = lead.pilar_fraco || 'Comunicação'
  const roteiro = ROTEIROS[pilar] || ROTEIROS['Comunicação']

  return `Você é um consultor especialista em Inteligência Social do Método Maestria Social.
Seu papel é conduzir uma conversa de sondagem via WhatsApp para entender a situação do lead e qualificá-lo.

PERFIL DO LEAD:
- Nome: ${lead.nome}
- Nível QS: ${lead.nivel_qs || 'Não avaliado'} (${lead.qs_total || 0}/250 pontos)
- Pilar mais fraco: ${pilar}

ROTEIRO DE SONDAGEM — ${pilar.toUpperCase()}:
${roteiro}

REGRAS DE COMPORTAMENTO:
1. Seja direto, empático e sofisticado — nunca genérico ou robótico
2. Faça UMA pergunta por vez — nunca duas seguidas
3. Use o nome do lead com naturalidade, mas não em toda mensagem
4. Mensagens curtas: máximo 3 parágrafos no WhatsApp
5. Adapte a próxima pergunta com base na resposta anterior
6. Após 3-4 trocas, avalie o nível de interesse e classifique o lead

CLASSIFICAÇÃO DE TEMPERATURA:
- 🔴 Frio: sem interesse claro, respostas curtas, sem dor identificada
- 🟡 Morno: interesse presente mas sem urgência, dor identificada
- 🟢 Quente: dor clara, urgência presente, aberto a soluções

AO FINAL DE CADA RESPOSTA, inclua um bloco JSON separado por "---JSON---" com as informações extraídas:
---JSON---
{
  "status_lead": "frio|morno|quente",
  "qualificacoes": [
    { "campo": "maior_dor|contexto|interesse|objecao|objetivo|urgencia|outro", "valor": "texto extraído" }
  ]
}
---JSON---

Se não houver novas informações relevantes, retorne qualificacoes como array vazio.`
}

export function buildPrimeiraMsg(lead: Lead): string {
  const pilar = lead.pilar_fraco || 'Comunicação'
  const nivel = lead.nivel_qs || 'Iniciante'

  const aberturas: Record<string, string> = {
    Negligente: `Vi seu resultado no diagnóstico — ${lead.qs_total} pontos. Isso é um ponto de partida honesto, e o mais importante é que você fez o teste.`,
    Iniciante: `Seu resultado de ${lead.qs_total} pontos mostra que você tem consciência do que precisa desenvolver — o que já é mais do que a maioria.`,
    Intermediário: `${lead.qs_total} pontos no QS — você está no meio do caminho. Tem base real, mas ainda há um gap específico que está te custando oportunidades.`,
    Avançado: `${lead.qs_total} pontos. Você já tem um nível sólido de Inteligência Social — a questão agora é o que ainda está limitando você nos contextos de maior pressão.`,
    Mestre: `${lead.qs_total} pontos — você está no topo da curva. Poucas pessoas chegam aqui. Minha curiosidade é: o que ainda você quer desenvolver?`,
  }

  const abertura = aberturas[nivel] || aberturas['Intermediário']

  return `Olá, ${lead.nome}! ${abertura}

Seu ponto de maior atenção foi ${pilar}. Posso te fazer uma pergunta sobre isso?`
}
