import type { Lead } from '@/types/database'

const SITE_URL = 'https://maestriasocial.com'

function wrap(titulo: string, corpoHtml: string, cta?: { texto: string; url: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#0e0f09;font-family:Arial,sans-serif;color:#fff9e6;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:11px;color:#c2904d;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px;">◆ Maestria Social</div>
    <h1 style="font-size:28px;line-height:1.2;color:#fff9e6;margin:0 0 18px;">${titulo}</h1>
    <div style="font-size:15px;line-height:1.7;color:#cdbfa8;">${corpoHtml}</div>
    ${cta ? `<div style="margin-top:28px;"><a href="${cta.url}" style="display:inline-block;background:#c2904d;color:#0e0f09;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:10px;">${cta.texto}</a></div>` : ''}
    <hr style="border:none;border-top:1px solid #2a1f18;margin:32px 0 18px;">
    <p style="font-size:12px;color:#7a6e5e;">Maestria Social — Inteligência Social aplicada</p>
  </div>
</body></html>`
}

export interface EmailTemplate {
  assunto: string
  html: string
  texto: string
}

export function emailDia0(lead: Lead): EmailTemplate {
  const linkResultado = `${SITE_URL}/resultado/${lead.id}`
  const assunto = `${lead.nome}, seu Quociente Social está pronto`
  const html = wrap(
    `${lead.qs_percentual ?? Math.round(((lead.qs_total ?? 0) / 250) * 100)}/100 — Nível ${lead.nivel_qs ?? ''}`,
    `<p>Olá, ${lead.nome}!</p>
     <p>Seu diagnóstico foi registrado. Seu pilar de maior oportunidade é <strong>${lead.pilar_fraco}</strong>.</p>
     <p>Esse é o ponto que mais está te custando oportunidades hoje — e também onde a evolução acontece mais rápido.</p>`,
    { texto: 'Ver meu resultado completo', url: linkResultado }
  )
  return {
    assunto,
    html,
    texto: `Olá ${lead.nome}, seu QS é ${lead.qs_percentual ?? Math.round(((lead.qs_total ?? 0) / 250) * 100)}/100. Veja: ${linkResultado}`,
  }
}

export function emailDia1(lead: Lead): EmailTemplate {
  const assunto = `O que ${lead.pilar_fraco} significa na prática`
  const html = wrap(
    `Por que ${lead.pilar_fraco} é o seu próximo nível`,
    `<p>${lead.nome}, ontem você descobriu que <strong>${lead.pilar_fraco}</strong> é seu pilar mais fraco.</p>
     <p>Esse pilar é responsável por boa parte das oportunidades que escapam — negociações que não fecham, conexões que não evoluem, espaço que outros ocupam.</p>
     <p>A boa notícia: é o pilar mais treinável quando você sabe o que olhar.</p>`,
    { texto: 'Conversar no WhatsApp', url: `${SITE_URL}/obrigado` }
  )
  return { assunto, html, texto: `${lead.nome}, ${lead.pilar_fraco} é treinável.` }
}

export function emailDia3(lead: Lead): EmailTemplate {
  const assunto = `${lead.nome}, um caso real de quem virou a chave`
  const html = wrap(
    `Quem evoluiu o pilar de ${lead.pilar_fraco}`,
    `<p>Quero te mostrar como pessoas com o mesmo perfil que o seu transformaram ${lead.pilar_fraco} em vantagem competitiva.</p>
     <p>Não é técnica de palco. É sistema diário, aplicado às situações reais do trabalho e da vida pessoal.</p>`,
    { texto: 'Quero meu próximo passo', url: `${SITE_URL}/obrigado` }
  )
  return { assunto, html, texto: `Caso real de evolução em ${lead.pilar_fraco}.` }
}

export function emailDia5(lead: Lead): EmailTemplate {
  const assunto = `Os 3 erros que travam ${lead.pilar_fraco}`
  const html = wrap(
    `Os 3 erros mais comuns`,
    `<p>${lead.nome}, esses são os 3 erros que vejo repetidos em quase todo perfil com gap em ${lead.pilar_fraco}:</p>
     <ol>
       <li>Tentar compensar com esforço em vez de método</li>
       <li>Achar que é traço de personalidade — não é, é habilidade</li>
       <li>Esperar contexto perfeito para começar a treinar</li>
     </ol>
     <p>O Método resolve os três no mesmo lugar.</p>`,
    { texto: 'Falar comigo no WhatsApp', url: `${SITE_URL}/obrigado` }
  )
  return { assunto, html, texto: `3 erros que travam ${lead.pilar_fraco}.` }
}

export function emailDia7(lead: Lead): EmailTemplate {
  const assunto = `${lead.nome}, última chamada`
  const html = wrap(
    `Sua janela de evolução`,
    `<p>Faz uma semana desde seu diagnóstico. ${lead.qs_percentual ?? Math.round(((lead.qs_total ?? 0) / 250) * 100)}/100 não é um número para guardar — é um ponto de partida.</p>
     <p>Quem age na primeira semana costuma transformar o resultado em 90 dias. Quem deixa para depois, raramente volta.</p>
     <p>Bora conversar?</p>`,
    { texto: 'Quero evoluir agora', url: `${SITE_URL}/obrigado` }
  )
  return { assunto, html, texto: `${lead.nome}, última chamada do funil.` }
}
