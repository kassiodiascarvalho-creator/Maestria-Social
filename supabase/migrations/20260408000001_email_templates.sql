CREATE TABLE IF NOT EXISTS public.email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilar         text NOT NULL CHECK (pilar IN ('Sociabilidade','Comunicação','Relacionamento','Persuasão','Influência')),
  dia           int  NOT NULL CHECK (dia IN (0,1,3,5,7)),
  assunto       text NOT NULL,
  corpo_html    text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pilar, dia)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access email_templates"
  ON public.email_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.email_templates TO service_role;

-- ══════════════════════════════════════════════
-- SEED: 25 templates (5 pilares × 5 dias)
-- corpo_html = conteúdo interno (sem wrapper)
-- ══════════════════════════════════════════════

-- ── SOCIABILIDADE ──────────────────────────────
INSERT INTO public.email_templates (pilar, dia, assunto, corpo_html) VALUES

('Sociabilidade', 0,
 '{nome}, seu Quociente Social está pronto — {qs_total}/250',
 '<p>Olá, {nome}!</p>
<p>Seu diagnóstico chegou. Você marcou <strong>{qs_total}/250</strong> e seu pilar de maior oportunidade é <strong>Sociabilidade</strong>.</p>
<p>Isso significa que iniciar conexões, entrar em ambientes novos e ampliar seu círculo ainda exige um esforço desproporcional — e isso tem custo real em oportunidades que passam sem que você perceba.</p>
<p>A boa notícia: Sociabilidade é o pilar que responde mais rápido ao método certo. Uma conversa já pode mudar o ponto de partida.</p>
<p><a href="{link_resultado}" style="color:#c2904d;">Ver meu resultado completo →</a></p>'),

('Sociabilidade', 1,
 '{nome}, a trava que impede conexões reais',
 '<p>{nome}, ontem você descobriu que Sociabilidade é seu ponto de atenção.</p>
<p>A maioria das pessoas acha que o problema é timidez ou introversão. Não é.</p>
<p>O que trava conexões reais é a ausência de um sistema simples para iniciar e manter conversas com intenção — sem forçar, sem parecer artificial.</p>
<p>Você provavelmente já sabe falar bem quando está no seu ambiente. O desafio é exportar isso para contextos novos. E isso se treina.</p>
<p>Posso te mostrar o primeiro passo?</p>'),

('Sociabilidade', 3,
 'Quem tinha o mesmo perfil que você — e o que mudou',
 '<p>{nome}, deixa eu te contar sobre alguém com o mesmo diagnóstico.</p>
<p>Ela chegou com Sociabilidade travada, evitava eventos de networking, sentia que "não era para ela". Três meses depois, gerou duas indicações de negócios dentro de um grupo que ela teria evitado antes.</p>
<p>O que mudou não foi a personalidade dela. Foi o método de entrada — como ela iniciava conversas, como mantinha o fio depois do primeiro encontro.</p>
<p>Isso está disponível para você também. Quando quiser conversar, é só responder aqui.</p>'),

('Sociabilidade', 5,
 'Os 3 erros que bloqueiam sua Sociabilidade',
 '<p>{nome}, esses são os 3 erros mais comuns em quem tem gap em Sociabilidade:</p>
<ol>
  <li><strong>Esperar sentir vontade para iniciar</strong> — a vontade vem depois da ação, não antes</li>
  <li><strong>Tentar ser interessante em vez de interessado</strong> — conexões se formam por atenção genuína, não por performance</li>
  <li><strong>Tratar networking como evento</strong> — em vez de comportamento diário e intencional</li>
</ol>
<p>O Método Maestria Social corrige os três com aplicações práticas, não teoria.</p>'),

('Sociabilidade', 7,
 '{nome}, última chamada',
 '<p>Faz uma semana desde que você descobriu que Sociabilidade é seu pilar de atenção.</p>
<p>{qs_total}/250. Não é um número pra guardar — é um ponto de partida.</p>
<p>Cada semana sem método é uma semana de oportunidades passando pela frente sem que você consiga alcançá-las. Eventos, pessoas, conexões que poderiam mudar sua trajetória.</p>
<p>Ou age agora, ou o resultado vira só um número esquecido numa aba do celular.</p>'),

-- ── COMUNICAÇÃO ────────────────────────────────
('Comunicação', 0,
 '{nome}, seu Quociente Social está pronto — {qs_total}/250',
 '<p>Olá, {nome}!</p>
<p>Diagnóstico registrado. <strong>{qs_total}/250</strong> — e seu pilar de maior oportunidade é <strong>Comunicação</strong>.</p>
<p>Isso quer dizer que em momentos decisivos — uma apresentação, uma reunião importante, uma conversa que definia algo — você não gerou o impacto que queria. E esse gap tem custo: oportunidades, promoções, fechamentos que não vieram.</p>
<p>Comunicação de impacto não é dom. É estrutura. E estrutura se aprende.</p>
<p><a href="{link_resultado}" style="color:#c2904d;">Ver meu resultado completo →</a></p>'),

('Comunicação', 1,
 '{nome}, por que suas palavras não estão gerando o resultado que deveriam',
 '<p>{nome}, comunicação fraca não é falar mal. É falar certo no momento errado, ou certo demais sem direção.</p>
<p>O problema é quase sempre a estrutura da mensagem: sem âncora emocional, sem hierarquia de informação, sem gatilho de ação.</p>
<p>Quem tem Comunicação como pilar fraco sente que as palavras saem certas — mas as pessoas não reagem como deveriam. Isso não é problema de vocabulário. É de método.</p>
<p>Esse método existe. E começa com uma mudança simples que você pode aplicar amanhã.</p>'),

('Comunicação', 3,
 'O que acontece quando você aprende a comunicar com impacto',
 '<p>{nome}, ele era gerente de projetos. Inteligente, preparado, mas suas apresentações não moviam ninguém.</p>
<p>Em 60 dias de trabalho específico em Comunicação, fechou um projeto que estava travado há 4 meses — com a mesma equipe, o mesmo orçamento, a mesma proposta. A diferença foi a forma como apresentou.</p>
<p>Comunicação não muda o que você tem para oferecer. Muda o quanto as pessoas conseguem enxergar o valor do que você oferece.</p>
<p>Quando quiser entender como aplicar isso ao seu contexto, é só falar.</p>'),

('Comunicação', 5,
 'Os 3 erros que fazem sua comunicação não gerar resultado',
 '<p>{nome}, esses são os 3 padrões que travam Comunicação:</p>
<ol>
  <li><strong>Começar pelo "o quê" em vez do "por quê"</strong> — as pessoas precisam entender o motivo antes de processar o conteúdo</li>
  <li><strong>Falar para informar, não para mover</strong> — toda comunicação precisa de uma intenção clara de ação</li>
  <li><strong>Adaptar o volume, não a estrutura</strong> — falar mais devagar ou mais alto não resolve o problema de clareza</li>
</ol>
<p>O Método trabalha esses três pontos de forma sequencial e prática.</p>'),

('Comunicação', 7,
 '{nome}, última chamada',
 '<p>Uma semana. {qs_total}/250 em Comunicação.</p>
<p>Cada reunião sem impacto, cada apresentação que não moveu, cada "vou pensar" que nunca voltou — tem um custo acumulado.</p>
<p>Comunicação de impacto não é talento. É o único pilar que, quando destravado, muda a percepção que as pessoas têm de você de forma imediata e permanente.</p>
<p>Uma conversa pode ser o começo disso. A decisão é sua.</p>'),

-- ── RELACIONAMENTO ─────────────────────────────
('Relacionamento', 0,
 '{nome}, seu Quociente Social está pronto — {qs_total}/250',
 '<p>Olá, {nome}!</p>
<p><strong>{qs_total}/250</strong>. Seu pilar de maior oportunidade é <strong>Relacionamento</strong>.</p>
<p>Isso indica que sua rede existe, mas não funciona de forma ativa a seu favor. Poucas indicações chegam espontaneamente. Os contatos estão lá, mas o vínculo é raso o suficiente para que ninguém pense em você na hora certa.</p>
<p>Rede estratégica não é quantidade de contatos. É profundidade e intenção. E isso se constrói com método.</p>
<p><a href="{link_resultado}" style="color:#c2904d;">Ver meu resultado completo →</a></p>'),

('Relacionamento', 1,
 '{nome}, por que sua rede não gera oportunidades',
 '<p>{nome}, a maioria das pessoas cultiva rede da forma errada: adiciona contatos, aparece em eventos, troca cartão — e depois some.</p>
<p>Relacionamento estratégico exige frequência, reciprocidade e posicionamento. Sem esses três elementos, você é só mais um nome numa lista.</p>
<p>A pergunta certa não é "quantas pessoas você conhece". É: quantas pessoas pensariam em você hoje se surgisse uma oportunidade relevante?</p>
<p>Se a resposta é "poucos" — esse é exatamente o gap que vamos trabalhar.</p>'),

('Relacionamento', 3,
 'De rede superficial para rede que gera resultado',
 '<p>{nome}, ele tinha 2.000 conexões no LinkedIn e zero indicações chegando por mês.</p>
<p>Em 90 dias de trabalho específico em Relacionamento Estratégico, passou a receber em média 3 indicações qualificadas por mês — da mesma rede que já existia.</p>
<p>O que mudou foi o comportamento: como ele aparecia, o que entregava sem pedir nada, como reativava contatos adormecidos.</p>
<p>Rede que gera resultado não é maior. É mais cultivada.</p>'),

('Relacionamento', 5,
 'Os 3 erros que mantêm sua rede superficial',
 '<p>{nome}, os padrões mais comuns em Relacionamento fraco:</p>
<ol>
  <li><strong>Entrar em contato só quando precisa de algo</strong> — a rede percebe e retribui com distância</li>
  <li><strong>Tratar todos os contatos da mesma forma</strong> — rede estratégica exige segmentação e atenção diferenciada</li>
  <li><strong>Focar em volume em vez de profundidade</strong> — 50 vínculos reais valem mais que 5.000 conexões rasas</li>
</ol>
<p>O Método estrutura um sistema de cultivo de rede que cabe na sua rotina sem parecer forçado.</p>'),

('Relacionamento', 7,
 '{nome}, última chamada',
 '<p>Uma semana desde o diagnóstico. {qs_total}/250 em Relacionamento.</p>
<p>Oportunidades não chegam sozinhas. Elas chegam através de pessoas — e pessoas indicam quem elas lembram, não quem é mais competente.</p>
<p>Cada semana sem cultivar relacionamentos estratégicos é uma semana a mais em que outros estão ocupando o espaço que poderia ser seu.</p>
<p>Quando quiser começar, é só responder aqui.</p>'),

-- ── PERSUASÃO ──────────────────────────────────
('Persuasão', 0,
 '{nome}, seu Quociente Social está pronto — {qs_total}/250',
 '<p>Olá, {nome}!</p>
<p><strong>{qs_total}/250</strong>. Seu pilar de maior oportunidade é <strong>Persuasão</strong>.</p>
<p>Isso significa que em negociações, vendas ou conversas onde você precisa mover alguém à ação — o resultado fica abaixo do que você merece. Propostas que não fecham, objeções que travam, "vou pensar" que nunca volta.</p>
<p>Persuasão não é manipulação. É fazer a outra pessoa enxergar o valor que você já enxerga. E isso tem método.</p>
<p><a href="{link_resultado}" style="color:#c2904d;">Ver meu resultado completo →</a></p>'),

('Persuasão', 1,
 '{nome}, o que está impedindo você de fechar mais',
 '<p>{nome}, quem tem gap em Persuasão costuma ter o mesmo padrão: argumenta bem, tem bons argumentos, mas na hora decisiva algo trava.</p>
<p>O problema raramente é o argumento. É a sequência. Persuasão eficaz segue uma estrutura específica: estabelece confiança antes de apresentar a solução, identifica a objeção real antes de responder a aparente, cria urgência sem pressão.</p>
<p>Sem essa estrutura, você pode ter o melhor produto, serviço ou ideia do mundo — e ainda assim ouvir "não" com mais frequência do que deveria.</p>'),

('Persuasão', 3,
 'De travado em negociações para fechamentos consistentes',
 '<p>{nome}, ele era consultor. Produto excelente, preço justo, mas taxa de fechamento de 20%.</p>
<p>Em 45 dias trabalhando Persuasão de forma estruturada, passou para 55%. Mesmos clientes, mesma proposta, mesmo preço. O que mudou foi como conduzia a conversa até o momento do sim.</p>
<p>Persuasão não é convencer. É conduzir. E existe um caminho claro para aprender a fazer isso de forma natural, sem parecer vendedor forçado.</p>'),

('Persuasão', 5,
 'Os 3 erros que travam seus fechamentos',
 '<p>{nome}, os padrões mais comuns em Persuasão fraca:</p>
<ol>
  <li><strong>Responder a objeção aparente, não a real</strong> — "preciso pensar" quase nunca é sobre tempo</li>
  <li><strong>Apresentar benefícios antes de estabelecer dor</strong> — a solução só tem valor depois que o problema está claro</li>
  <li><strong>Criar pressão em vez de urgência genuína</strong> — pressão gera resistência; urgência real gera decisão</li>
</ol>
<p>O Método trabalha Persuasão com simulações reais do seu contexto específico — não técnicas genéricas de vendas.</p>'),

('Persuasão', 7,
 '{nome}, última chamada',
 '<p>Uma semana. {qs_total}/250 em Persuasão.</p>
<p>Cada "vou pensar" sem retorno, cada negociação que não fechou, cada proposta rejeitada sem motivo claro — tem um valor real agregado. Provavelmente mais do que você imagina.</p>
<p>Persuasão é o pilar com retorno financeiro mais direto e mensurável. Quando você destrava isso, os resultados aparecem nas primeiras semanas.</p>
<p>Se decidiu agir, o melhor momento é agora.</p>'),

-- ── INFLUÊNCIA ─────────────────────────────────
('Influência', 0,
 '{nome}, seu Quociente Social está pronto — {qs_total}/250',
 '<p>Olá, {nome}!</p>
<p><strong>{qs_total}/250</strong>. Seu pilar de maior oportunidade é <strong>Influência</strong>.</p>
<p>Isso indica que você ainda não é visto como referência no seu meio. Suas opiniões têm peso, mas não definem decisões. Você está presente, mas não está no centro.</p>
<p>Influência não é cargo ou título. É a percepção que as pessoas têm de você antes de você abrir a boca. E isso se constrói de forma intencional.</p>
<p><a href="{link_resultado}" style="color:#c2904d;">Ver meu resultado completo →</a></p>'),

('Influência', 1,
 '{nome}, a diferença entre estar presente e ser referência',
 '<p>{nome}, a maioria das pessoas confunde visibilidade com influência. Não são a mesma coisa.</p>
<p>Você pode estar em todas as reuniões, em todos os grupos, com ótimas ideias — e ainda assim não ser a pessoa que as pessoas consultam antes de decidir.</p>
<p>Influência real é quando seu posicionamento precede sua presença. Quando alguém pensa em um assunto e pensa em você antes de qualquer outra coisa.</p>
<p>Isso se constrói. E começa com três mudanças de comportamento muito específicas.</p>'),

('Influência', 3,
 'De invisível para referência — como isso acontece na prática',
 '<p>{nome}, ela era coordenadora numa empresa de médio porte. Competente, dedicada — mas nunca chamada para as decisões estratégicas.</p>
<p>Em 4 meses de trabalho específico em Influência, passou a ser consultada pela diretoria antes das reuniões. Não mudou de cargo. Mudou de posicionamento.</p>
<p>Influência se constrói por consistência, por posicionamento intencional e pela forma como você ocupa espaço — mesmo quando ninguém está prestando atenção.</p>'),

('Influência', 5,
 'Os 3 erros que impedem você de se tornar referência',
 '<p>{nome}, os padrões mais comuns em Influência fraca:</p>
<ol>
  <li><strong>Esperar ser reconhecido em vez de se posicionar</strong> — influência não é prêmio, é construção ativa</li>
  <li><strong>Diluir opinião para agradar a todos</strong> — referências têm posição clara; quem quer agradar todos não influencia ninguém</li>
  <li><strong>Mostrar competência sem construir autoridade</strong> — competência é pré-requisito; autoridade é o que faz as pessoas seguirem você</li>
</ol>
<p>O Método trabalha Influência com um plano de posicionamento personalizado para o seu contexto.</p>'),

('Influência', 7,
 '{nome}, última chamada',
 '<p>Uma semana. {qs_total}/250 em Influência.</p>
<p>Daqui a 2 anos, onde você quer ser visto no seu meio? Como referência, como alguém que define direções — ou na mesma posição de hoje?</p>
<p>Influência não se constrói da noite para o dia. Mas também não se constrói esperando. Cada semana sem método é uma semana que outros estão ocupando o espaço que poderia ser seu.</p>
<p>Quando decidir agir, estaremos aqui.</p>');

NOTIFY pgrst, 'reload schema';
