/**
 * JARVIS Agent Router
 * Analisa a mensagem do usuário e roteia para o subagente correto.
 */

export const AGENTS = {
  maps: {
    name: 'Agente Maps',
    icon: '🗺️',
    triggers: [/como chegar/i, /rota para/i, /distância de/i, /onde fica/i, /trânsito hoje/i, /endereço de/i, /trajeto/i, /direção para/i],
  },
  webSearch: {
    name: 'Agente Busca Web',
    icon: '🔍',
    triggers: [/pesquisar online/i, /o que aconteceu hoje/i, /buscar no google/i, /notícias sobre/i, /quem é /i, /qual o preço de/i, /saiba mais sobre/i, /pesquise sobre/i],
  },
  fullstack: {
    name: 'Agente Full-stack',
    icon: '🏗️',
    triggers: [
      /sistema completo/i, /\barquitetura\b/i, /\bdeploy\b/i, /\bfullstack\b/i, /full.stack/i,
      /conexão entre/i, /fluxo de dados/i, /projeto inteiro/i,
      // Termos gerais de projeto — prioridade máxima sobre agentes específicos
      /\bprojeto\b/i, /\bsistema\b/i, /\baplicação\b/i, /\bapp\b/i, /\bplataforma\b/i,
      /como estruturar/i, /como organizar/i, /melhor abordagem/i, /como desenvolver/i,
      /\bfeature\b/i, /\bfuncionalidade\b/i, /como implementar/i, /me ajuda (a|com)/i,
      /criar (um|uma)\b/i, /desenvolver (um|uma)\b/i, /\bmonorepo\b/i, /\bci\/cd\b/i,
    ],
  },
  devWeb: {
    name: 'Agente Dev Web',
    icon: '🌐',
    // Apenas contexto muito específico de web/browser — não projeto em geral
    triggers: [/\bbrowser\b/i, /\bhosting\b/i, /hospedagem/i, /\bdomínio\b/i, /\bseo\b/i, /protocolo http/i, /\bnginx\b/i, /\bcors\b/i, /\bwebpack\b/i],
  },
  devMobile: {
    name: 'Agente Dev Mobile',
    icon: '📱',
    // Apenas contexto muito específico de mobile
    triggers: [/\bapk\b/i, /\bios\b/i, /\bmobile\b/i, /\bcelular\b/i, /\bstore\b/i, /\bemulador\b/i, /flutter/i, /react native/i, /expo\b/i],
  },
  frontend: {
    name: 'Agente Frontend',
    icon: '🎨',
    // Apenas contexto específico de UI/CSS — não projeto em geral
    triggers: [/\bcss\b/i, /\blayout\b/i, /\bestilo\b/i, /\bbotão\b/i, /\bcomponente\b/i, /\bvisual\b/i, /\bui\b/i, /\bux\b/i, /tailwind/i, /\banimação\b/i, /\bresponsivo\b/i],
  },
  backend: {
    name: 'Agente Backend',
    icon: '⚙️',
    // Apenas contexto específico de servidor/banco — não projeto em geral
    triggers: [/\bservidor\b/i, /\bapi\b/i, /banco de dados/i, /\bendpoint\b/i, /\btoken\b/i, /\bbackend\b/i, /\bdatabase\b/i, /\bpostgres\b/i, /\bmysql\b/i, /\bmongodb\b/i, /\borm\b/i],
  },
  weather: {
    name: 'Agente Clima',
    icon: '🌤️',
    triggers: [/vai chover/i, /previsão do tempo/i, /\btemperatura\b/i, /\bclima\b/i, /sol ou chuva/i, /graus hoje/i, /\bumidade\b/i, /como está o tempo/i],
  },
  horoscope: {
    name: 'Agente Horóscopo',
    icon: '♈',
    triggers: [/meu signo/i, /\bhoróscopo\b/i, /previsão astral/i, /\bastrologia\b/i, /\bascendente\b/i, /mapa astral/i, /sorte hoje/i, /signo de/i],
  },
  data: {
    name: 'Agente Dados',
    icon: '📊',
    triggers: [/\bplanilha\b/i, /\bexcel\b/i, /\bcsv\b/i, /\bcalcular\b/i, /\bmedia\b/i, /\bestatística\b/i, /\bgráficos\b/i, /média de/i, /\bstatistics\b/i],
  },
  files: {
    name: 'Agente Arquivos',
    icon: '📄',
    triggers: [/ler pdf/i, /analisar documento/i, /texto do arquivo/i, /resumo do doc/i, /ver arquivo/i, /\bdocx\b/i, /extrair texto/i, /analisar arquivo/i],
  },
  knowledge: {
    name: 'Agente Informações',
    icon: '🧠',
    triggers: [/\bcuriosidade\b/i, /fato histórico/i, /quem inventou/i, /definição de/i, /significado de/i, /\bpor que\b/i, /como funciona/i, /\bhistória de\b/i],
  },
};

/**
 * Detecta qual agente deve responder à mensagem.
 * Retorna o agente detectado ou null (JARVIS base responde).
 */
export function routeToAgent(message) {
  if (!message) return null;
  const text = message.toLowerCase();

  for (const [key, agent] of Object.entries(AGENTS)) {
    for (const trigger of agent.triggers) {
      if (trigger.test(text)) {
        return { key, ...agent };
      }
    }
  }
  return null;
}