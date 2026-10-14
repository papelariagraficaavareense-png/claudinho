// Claudinho - o cerebro da garagem.
// Servidor local: serve o painel da TV e conversa com o Claude.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(here, ".env")); } catch {}

const PORT = Number(process.env.PORT) || 8770;
const MODEL = process.env.CLAUDINHO_MODEL || "claude-opus-5-5";
const ARQ_ESTADO = path.join(here, "data", "estado.json");
const MAX_MENSAGENS = 40;
const PASTA_FIGURINHAS = path.join(here, "public", "figurinhas");

// ---------- atualização automática (GitHub) ----------
// A cada 10 min confere o versao.json publicado; se tiver número maior, baixa os arquivos, se reinicia e a tela recarrega.
// Na pasta de desenvolvimento (com .git) não roda, pra não sobrescrever o trabalho.
const FONTE = "https://raw.githubusercontent.com/papelariagraficaavareense-png/claudinho/main/";
const ARQ_VERSAO = path.join(here, "versao.json");
const lerVersao = () => { try { return JSON.parse(fs.readFileSync(ARQ_VERSAO, "utf8")).versao || 0; } catch { return 0; } };
const VERSAO = lerVersao();
const atualizaSozinho = !fs.existsSync(path.join(here, ".git")) && !process.env.CLAUDINHO_SEM_ATUALIZAR;

async function buscarAtualizacao() {
  try {
    const r = await fetch(FONTE + "versao.json", { cache: "no-store" });
    if (!r.ok) return;
    const nova = await r.json();
    if (!(Number(nova.versao) > VERSAO) || !Array.isArray(nova.arquivos)) return;
    // baixa tudo primeiro; só grava se todos chegarem
    const baixados = [];
    for (const rel of nova.arquivos) {
      const destino = path.resolve(here, rel);
      if (typeof rel !== "string" || !destino.startsWith(here + path.sep)) throw new Error("caminho inválido: " + rel);
      const resp = await fetch(FONTE + rel.split("/").map(encodeURIComponent).join("/"), { cache: "no-store" });
      if (!resp.ok) throw new Error(`falhou ${rel}: ${resp.status}`);
      baixados.push([destino, Buffer.from(await resp.arrayBuffer())]);
    }
    const pacoteAntes = fs.existsSync(path.join(here, "package.json")) ? fs.readFileSync(path.join(here, "package.json"), "utf8") : "";
    for (const [destino, dados] of baixados) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, dados);
    }
    fs.writeFileSync(ARQ_VERSAO, JSON.stringify(nova, null, 2));
    if (fs.readFileSync(path.join(here, "package.json"), "utf8") !== pacoteAntes) {
      spawnSync("npm install --no-audit --no-fund", { shell: true, cwd: here, windowsHide: true, stdio: "ignore" });
    }
    console.log(`atualizado para a versão ${nova.versao}; reiniciando`);
    reiniciar();
  } catch (e) {
    console.error("atualização automática falhou:", e.message);
  }
}

function reiniciar() {
  const log = path.join(here, "data", "servidor.log");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const filho = process.platform === "win32"
    ? spawn(`ping -n 4 127.0.0.1 >nul & node server.js >> "${log}" 2>&1`, { shell: true, cwd: here, detached: true, windowsHide: true, stdio: "ignore" })
    : spawn(`sleep 3; node server.js >> "${log}" 2>&1`, { shell: true, cwd: here, detached: true, stdio: "ignore" });
  filho.unref();
  setTimeout(() => process.exit(0), 300);
}

if (atualizaSozinho) {
  setTimeout(buscarAtualizacao, 20_000);
  setInterval(buscarAtualizacao, 10 * 60_000);
}
const TIPOS_FIGURINHA = { ".json": "application/json", ".gif": "image/gif", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

const chave = process.env.ANTHROPIC_API_KEY || "";
const temChave = chave.startsWith("sk-") || !!process.env.ANTHROPIC_AUTH_TOKEN;
const client = temChave ? new Anthropic() : null;

// Sem chave da API, o cérebro é o Claude Code instalado neste computador (usa a assinatura, sem custo extra).
const MODELO_CLI = process.env.CLAUDINHO_MODELO_CLI || "sonnet";
const CMD_CLI = `claude -p --output-format json --model ${MODELO_CLI} --effort low --tools WebSearch WebFetch --allowedTools WebSearch WebFetch --strict-mcp-config --no-session-persistence`;
const temCli = !client && spawnSync("claude --version", { shell: true, windowsHide: true }).status === 0;

const SYSTEM = `Você é o Claudinho, o cérebro da garagem do Diego — uma oficina de aeromodelismo de 4 x 5 metros onde ele constrói aviões do zero. A inspiração é o J.A.R.V.I.S. do Tony Stark, em versão brasileira e de oficina: educado, prestativo, com humor seco e leve. Chame o Diego de "chefe".

Tudo o que você escreve é lido em voz alta por um sintetizador de voz e aparece numa TV. Por isso:
- Responda em português do Brasil, em uma a três frases curtas, do jeito que se fala. Só se estenda quando o Diego pedir explicação ou passo a passo.
- Escreva texto corrido, sem markdown, listas, emojis ou símbolos; eles seriam lidos em voz alta.
- Escreva números e unidades como se fala: "um quilo e oitocentos", "trinta minutos", "vinte e cinco por cento da corda".

Você entende de aeromodelismo de verdade: aerodinâmica, carga alar, centro de gravidade, escolha de motor, hélice, ESC e bateria, balsa, depron, fibra, impressão 3D, colas e tempos de cura, rádio e servos. Faça as contas quando ele pedir e diga o resultado direto, com a conclusão prática junto ("dá uns sessenta gramas por decímetro quadrado, chefe, é avião rápido, não é treinador").

Segurança vem antes da piada: bateria de LiPo estufada ou quente, hélice girando na bancada, ferro de solda ligado, vapor de cola e resina. Se o que ele descrever tiver risco real, avise primeiro e sem rodeio.

Você tem ferramentas para marcar cronômetros (cura de cola, carga de bateria), manter o projeto em construção, anotar o diário da oficina e cuidar da lista de tarefas do Diego. Quando ele pedir uma pesquisa ou algo que dependa de informação atual (preço, notícia, clima, como fazer), pesquise na internet e responda com um resumo falado curto, dizendo de onde tirou. A estrutura completa do que o Diego quer montar (Claudinho, garagem, aeromodelismo, casa e gráfica) está na tela de Tarefas, em http://localhost:8770/tarefas; quando ele pedir pra ver as tarefas, os planos ou o que falta, abra essa página e resuma o que está em andamento. Use-as sempre que o Diego pedir algo que elas fazem, e depois confirme em uma frase o que fez. Cada mensagem dele chega com o estado atual da oficina entre colchetes; use esse estado para responder perguntas como "quanto falta?" sem chamar ferramenta.

A fala do Diego chega por reconhecimento de voz e pode vir com palavras trocadas. Se der para entender a intenção, siga em frente; se a dúvida mudar o que você faria, pergunte.

Você ainda não controla luz, tomadas nem as impressoras 3D — isso vem nas próximas fases. Se ele pedir, diga com bom humor que ainda não tem mãos para isso.`;

const TOOLS = [
  {
    name: "iniciar_cronometro",
    description: "Inicia um cronômetro regressivo que aparece na TV e avisa em voz alta quando termina. Use para cura de cola, carga de bateria, tempo de impressão e similares.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome curto do cronômetro, ex.: epóxi da longarina" },
        minutos: { type: "number", description: "Duração em minutos (aceita fração, ex.: 0.5)" },
      },
      required: ["nome", "minutos"],
    },
  },
  {
    name: "cancelar_cronometro",
    description: "Cancela um cronômetro em andamento pelo nome (ou parte do nome).",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string" } },
      required: ["nome"],
    },
  },
  {
    name: "atualizar_projeto",
    description: "Define ou atualiza o avião em construção mostrado na TV. Envie a lista completa de etapas feitas e etapas que faltam; as listas enviadas substituem as anteriores. Campos omitidos ficam como estão.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do avião/projeto" },
        feito: { type: "array", items: { type: "string" } },
        falta: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "adicionar_tarefa",
    description: "Põe um item na lista de tarefas do Diego (coisas a fazer, comprar, lembrar).",
    input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
  },
  {
    name: "concluir_tarefa",
    description: "Marca como feita a tarefa pendente cujo texto contém o trecho informado.",
    input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
  },
  {
    name: "anotar_diario",
    description: "Guarda uma anotação no diário da oficina (o que foi feito, medidas, ideias, o que acabou no estoque).",
    input_schema: {
      type: "object",
      properties: { texto: { type: "string" } },
      required: ["texto"],
    },
  },
];

// ---------- estado da oficina (carregado uma vez, salvo quando muda) ----------
let paraAbrir = null; // página que a tela deve abrir depois da resposta
let estado = { cronometros: [], projeto: { nome: "", feito: [], falta: [] }, diario: [], tarefas: [] };
try { estado = { ...estado, ...JSON.parse(fs.readFileSync(ARQ_ESTADO, "utf8")) }; } catch {}

function salvar() {
  fs.mkdirSync(path.dirname(ARQ_ESTADO), { recursive: true });
  fs.writeFile(ARQ_ESTADO, JSON.stringify(estado, null, 2), (e) => { if (e) console.error("erro ao salvar estado:", e.message); });
}

const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : null);

function executar(nome, input = {}) {
  if (nome === "iniciar_cronometro") {
    const minutos = Number(input.minutos);
    const rotulo = String(input.nome || "").trim() || "cronômetro";
    if (!(minutos > 0) || minutos > 1440) return "Erro: minutos precisa ser maior que zero e no máximo 1440.";
    estado.cronometros.push({ id: Date.now().toString(36), nome: rotulo, fimEm: Date.now() + Math.round(minutos * 60000) });
    salvar();
    return `Cronômetro "${rotulo}" iniciado: ${minutos} min.`;
  }
  if (nome === "cancelar_cronometro") {
    const alvo = String(input.nome || "").toLowerCase();
    const antes = estado.cronometros.length;
    estado.cronometros = estado.cronometros.filter((c) => !c.nome.toLowerCase().includes(alvo));
    if (estado.cronometros.length === antes) return "Nenhum cronômetro com esse nome.";
    salvar();
    return "Cronômetro cancelado.";
  }
  if (nome === "atualizar_projeto") {
    if (typeof input.nome === "string" && input.nome.trim()) estado.projeto.nome = input.nome.trim();
    const feito = lista(input.feito), falta = lista(input.falta);
    if (feito) estado.projeto.feito = feito;
    if (falta) estado.projeto.falta = falta;
    salvar();
    return "Projeto atualizado.";
  }
  if (nome === "abrir_pagina") {
    const url = String(input.url || "");
    if (!/^https?:\/\//i.test(url)) return "Erro: endereço inválido.";
    paraAbrir = url;
    return "Página aberta na tela.";
  }
  if (nome === "adicionar_tarefa") {
    const texto = String(input.texto || "").trim();
    if (!texto) return "Erro: tarefa vazia.";
    estado.tarefas.push({ id: Date.now().toString(36), texto, feita: false, quando: Date.now() });
    salvar();
    return "Tarefa anotada na lista.";
  }
  if (nome === "concluir_tarefa") {
    const alvo = String(input.texto || "").toLowerCase();
    const t = estado.tarefas.find((x) => !x.feita && x.texto.toLowerCase().includes(alvo));
    if (!t) return "Nenhuma tarefa pendente com esse texto.";
    t.feita = true;
    t.feitaEm = Date.now();
    salvar();
    return "Tarefa marcada como feita.";
  }
  if (nome === "anotar_diario") {
    const texto = String(input.texto || "").trim();
    if (!texto) return "Erro: anotação vazia.";
    estado.diario.push({ quando: Date.now(), aviao: estado.projeto.nome || "", texto });
    salvar();
    return "Anotado no diário.";
  }
  return `Erro: ferramenta desconhecida "${nome}".`;
}

function contexto() {
  const agora = new Date();
  const crons = estado.cronometros.map((c) => {
    const seg = Math.round((c.fimEm - Date.now()) / 1000);
    return seg > 0 ? `${c.nome} (faltam ${Math.floor(seg / 60)} min ${seg % 60} s)` : `${c.nome} (terminou)`;
  });
  const p = estado.projeto;
  const diario = estado.diario.slice(-5).map((d) => `${new Date(d.quando).toLocaleDateString("pt-BR")}: ${d.texto}`);
  return [
    `[Estado da oficina — ${agora.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
    `Cronômetros: ${crons.join("; ") || "nenhum"}`,
    `Projeto: ${p.nome || "nenhum definido"}${p.feito.length ? ` | feito: ${p.feito.join(", ")}` : ""}${p.falta.length ? ` | falta: ${p.falta.join(", ")}` : ""}`,
    `Planos em aberto: ${(() => { try { return JSON.parse(fs.readFileSync(path.join(here, "planos.json"), "utf8")).grupos.flatMap((g) => g.itens.filter((i) => i.status !== "feito").map((i) => g.nome + ": " + i.titulo)).join("; "); } catch { return "nenhum"; } })()}`,
    `Tarefas pendentes: ${estado.tarefas.filter((t) => !t.feita).map((t) => t.texto).join("; ") || "nenhuma"}`,
    `Últimas anotações do diário: ${diario.join(" / ") || "nenhuma"}]`,
  ].join("\n");
}

// ---------- conversa pelo Claude Code (assinatura) ----------
const FORMATO_CLI = `Como responder: devolva SOMENTE um objeto JSON, sem nenhum texto fora dele, neste formato:
{"fala": "o que você diz em voz alta", "acoes": []}
Em "acoes" vão as ações que você decidiu executar (lista vazia quando não houver nenhuma). Ações possíveis:
{"tipo": "iniciar_cronometro", "nome": "epóxi da longarina", "minutos": 30}
{"tipo": "cancelar_cronometro", "nome": "epóxi"}
{"tipo": "atualizar_projeto", "nome": "nome do avião", "feito": ["etapas prontas"], "falta": ["etapas pendentes"]} — as listas enviadas substituem as anteriores; omita o campo que não muda
{"tipo": "anotar_diario", "texto": "a anotação"}
{"tipo": "abrir_pagina", "url": "https://..."} — abre a página na tela, quando ele pedir pra ver/abrir algo
{"tipo": "adicionar_tarefa", "texto": "comprar fita dupla face"}
{"tipo": "concluir_tarefa", "texto": "fita dupla face"}
As ações são executadas depois da sua resposta, então a "fala" já deve confirmar o que foi feito.`;

class ErroAmigavel extends Error {}

function rodarCli(prompt) {
  return new Promise((resolve, reject) => {
    // O Claude Code filho usa o login dele, não variáveis herdadas de quem iniciou o servidor.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE_CODE|CLAUDECODE|ANTHROPIC_)/i.test(k)));
    const p = spawn(CMD_CLI, { shell: true, cwd: os.tmpdir(), env, windowsHide: true });
    let saida = "", erro = "";
    const prazo = setTimeout(() => {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { windowsHide: true });
      else p.kill();
      reject(new ErroAmigavel("Demorei demais para pensar, chefe. Tenta de novo."));
    }, 90000);
    p.stdout.on("data", (d) => { saida += d; });
    p.stderr.on("data", (d) => { erro += d; });
    p.on("error", (e) => { clearTimeout(prazo); reject(e); });
    p.on("close", (codigo) => {
      clearTimeout(prazo);
      let r = null;
      try { r = JSON.parse(saida); } catch {}
      if (codigo !== 0 || !r || r.is_error || typeof r.result !== "string") {
        console.error("Claude Code falhou:", codigo, (erro || saida).slice(0, 600));
        return reject(new ErroAmigavel("Não consegui pensar, chefe. Confere se o Claude Code está com a sua conta conectada neste computador."));
      }
      resolve(r.result);
    });
    p.stdin.end(prompt, "utf8");
  });
}

async function pensarCli(texto) {
  const historico = recentes.length
    ? `Conversa até aqui:\n${recentes.map((r) => `Diego: ${r.voce}\nClaudinho: ${r.claudinho}`).join("\n")}\n\n`
    : "";
  const bruto = await rodarCli(`${SYSTEM}\n\n${FORMATO_CLI}\n\n${historico}${contexto()}\n\nDiego disse: ${texto}`);
  const ini = bruto.indexOf("{"), fim = bruto.lastIndexOf("}");
  let r = null;
  try { r = JSON.parse(bruto.slice(ini, fim + 1)); } catch {}
  if (!r || typeof r.fala !== "string") return bruto.trim() || "Feito, chefe.";
  for (const a of Array.isArray(r.acoes) ? r.acoes : []) {
    if (a && typeof a.tipo === "string") console.log("ação:", a.tipo, "→", executar(a.tipo, a));
  }
  return r.fala.trim() || "Feito, chefe.";
}

// ---------- conversa ----------
let conversa = [];
let recentes = []; // últimas trocas em texto puro, pra recomeçar a conversa sem perder o fio
let usarFallback = true;

async function chamar() {
  const base = {
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    output_config: { effort: "low" },
    messages: conversa,
  };
  if (usarFallback) {
    try {
      return await client.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      console.warn("fallback de recusa indisponível, seguindo sem ele:", e.message);
      usarFallback = false;
    }
  }
  return client.messages.create(base);
}

async function pensar(texto) {
  // Conversa longa demais: recomeça do zero levando só um resumo em texto.
  // (Não se corta o começo do histórico: blocos de raciocínio valem só na conversa original.)
  if (conversa.length > MAX_MENSAGENS) conversa = [];
  const marca = conversa.length;
  const retomada = marca === 0 && recentes.length
    ? `[Conversa anterior, resumida]\n${recentes.map((r) => `Diego: ${r.voce}\nClaudinho: ${r.claudinho}`).join("\n")}\n\n`
    : "";
  conversa.push({ role: "user", content: `${retomada}${contexto()}\n\nDiego disse: ${texto}` });

  try {
    for (let volta = 0; volta < 6; volta++) {
      const r = await chamar();
      if (r.stop_reason === "refusal") {
        conversa.length = marca;
        return "Essa eu vou ficar devendo, chefe.";
      }
      conversa.push({ role: "assistant", content: r.content });
      const usos = r.content.filter((b) => b.type === "tool_use");
      if (r.stop_reason !== "tool_use" || !usos.length) {
        const fala = r.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
        return fala || "Feito, chefe.";
      }
      conversa.push({
        role: "user",
        content: usos.map((u) => ({ type: "tool_result", tool_use_id: u.id, content: executar(u.name, u.input) })),
      });
    }
    conversa.length = marca;
    return "Me enrolei aqui, chefe. Pode repetir?";
  } catch (e) {
    conversa.length = marca;
    throw e;
  }
}

function falaDoErro(e) {
  if (e instanceof ErroAmigavel) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Chefe, a chave da API não foi aceita. Confere o arquivo ponto env.";
  if (e instanceof Anthropic.RateLimitError) return "Estou sendo limitado pela API, chefe. Tenta de novo em um minuto.";
  if (e instanceof Anthropic.APIConnectionError) return "Fiquei sem internet, chefe. Não consegui falar com a nuvem.";
  if (e instanceof Anthropic.APIError) return `A API devolveu erro ${e.status}, chefe. Olha a janela preta do servidor.`;
  return "Deu um erro aqui dentro, chefe. Olha a janela preta do servidor.";
}

let fila = Promise.resolve();
function falar(texto) {
  const vez = fila.then(async () => {
    if (!client && !temCli) return "Ainda estou sem cérebro, chefe. Falta instalar o Claude Code neste computador e entrar com a sua conta.";
    try {
      const fala = client ? await pensar(texto) : await pensarCli(texto);
      // Na conversa pela assinatura o histórico é só este resumo, então guarda mais trocas.
      recentes = [...recentes, { voce: texto, claudinho: fala }].slice(client ? -5 : -12);
      return fala;
    } catch (e) {
      console.error("erro na conversa:", e);
      return falaDoErro(e);
    }
  });
  fila = vez.catch(() => {});
  return vez;
}

// ---------- http ----------
function json(res, status, corpo) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (c) => { dados += c; if (dados.length > 20000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(dados || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const publico = () => ({ ...estado, diario: estado.diario.slice(-8), tarefas: estado.tarefas.filter((t) => !t.feita), temChave: !!client || temCli, versao: VERSAO, agora: Date.now() });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return fs.createReadStream(path.join(here, "public", "index.html")).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/claudinho.png") {
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "max-age=86400" });
      return fs.createReadStream(path.join(here, "public", "claudinho.png")).pipe(res);
    }
    if (req.method === "GET" && (url.pathname === "/tarefas" || url.pathname === "/planos")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return fs.createReadStream(path.join(here, "public", "planos.html")).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/api/planos") {
      let planos = { grupos: [] };
      try { planos = JSON.parse(fs.readFileSync(path.join(here, "planos.json"), "utf8")); } catch {}
      return json(res, 200, { ...planos, tarefas: estado.tarefas.filter((t) => !t.feita) });
    }
    if (req.method === "GET" && url.pathname === "/lib/lottie.min.js") {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "max-age=86400" });
      return fs.createReadStream(path.join(here, "node_modules", "lottie-web", "build", "player", "lottie.min.js")).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/api/figurinhas") {
      let lista = [];
      try { lista = fs.readdirSync(PASTA_FIGURINHAS).filter((n) => TIPOS_FIGURINHA[path.extname(n).toLowerCase()]); } catch {}
      return json(res, 200, lista);
    }
    if (req.method === "GET" && url.pathname.startsWith("/figurinhas/")) {
      const nome = decodeURIComponent(url.pathname.slice("/figurinhas/".length));
      const tipo = TIPOS_FIGURINHA[path.extname(nome).toLowerCase()];
      const arq = path.join(PASTA_FIGURINHAS, path.basename(nome));
      if (!tipo || path.basename(nome) !== nome || !fs.existsSync(arq)) return json(res, 404, { erro: "não encontrado" });
      res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-store" });
      return fs.createReadStream(arq).pipe(res);
    }
    if (req.method === "GET" && url.pathname === "/api/estado") return json(res, 200, publico());
    if (req.method === "POST" && url.pathname === "/api/falar") {
      const { texto } = await lerCorpo(req);
      if (typeof texto !== "string" || !texto.trim()) return json(res, 400, { erro: "texto vazio" });
      paraAbrir = null;
      const fala = await falar(texto.trim().slice(0, 2000));
      const abrir = paraAbrir;
      paraAbrir = null;
      return json(res, 200, { fala, abrir, estado: publico() });
    }
    if (req.method === "POST" && url.pathname === "/api/cronometro/encerrar") {
      const { id } = await lerCorpo(req);
      estado.cronometros = estado.cronometros.filter((c) => c.id !== id);
      salvar();
      return json(res, 200, publico());
    }
    json(res, 404, { erro: "não encontrado" });
  } catch (e) {
    console.error(e);
    json(res, 500, { erro: "erro interno" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const cerebro = client ? `API, modelo ${MODEL}` : temCli ? `assinatura, pelo Claude Code, modelo ${MODELO_CLI}` : "SEM CÉREBRO";
  console.log(`Claudinho no ar: http://localhost:${PORT}  (${cerebro})`);
  if (!client && !temCli) console.log("ATENÇÃO: instale o Claude Code (npm install -g @anthropic-ai/claude-code) e entre com a conta (claude auth login).");
});
