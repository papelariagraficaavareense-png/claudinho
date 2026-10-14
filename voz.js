// Reconhecer a voz do Diego: o Claudinho só obedece a ele.
// Tudo roda no próprio computador (sherpa-onnx), sem mandar a voz pra lugar nenhum.
// No cadastro, cada frase vira uma "impressão de voz" (256 números); na hora do pedido,
// o trecho falado é comparado com a média das impressões cadastradas.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const URL_MODELO = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34_LM.onnx";
const MAX_AMOSTRAS = 15;

export function criarVoz(pastaDados) {
  const ARQ_MODELO = path.join(pastaDados, "modelos", "voz.onnx");
  const ARQ_VOZ = path.join(pastaDados, "voz.json");
  let extrator = null;
  let preparando = null;
  let cadastro = { amostras: [] };
  try { cadastro = JSON.parse(fs.readFileSync(ARQ_VOZ, "utf8")); } catch {}

  function salvar() {
    fs.mkdirSync(path.dirname(ARQ_VOZ), { recursive: true });
    fs.writeFileSync(ARQ_VOZ, JSON.stringify(cadastro));
  }

  // Baixa o modelo (uns 25 MB) na primeira vez e carrega o extrator.
  function preparar() {
    if (extrator) return Promise.resolve(extrator);
    preparando = preparando || (async () => {
      if (!fs.existsSync(ARQ_MODELO)) {
        fs.mkdirSync(path.dirname(ARQ_MODELO), { recursive: true });
        const r = await fetch(URL_MODELO);
        if (!r.ok) throw new Error("não consegui baixar o modelo de voz: " + r.status);
        const tmp = ARQ_MODELO + ".baixando";
        fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
        fs.renameSync(tmp, ARQ_MODELO);
      }
      const sherpa = require("sherpa-onnx-node");
      extrator = new sherpa.SpeakerEmbeddingExtractor({ model: ARQ_MODELO, numThreads: 2, debug: false });
      return extrator;
    })().catch((e) => { preparando = null; throw e; });
    return preparando;
  }

  async function impressao(amostras, taxa) {
    const ext = await preparar();
    const st = ext.createStream();
    st.acceptWaveform({ sampleRate: taxa, samples: amostras });
    st.inputFinished();
    return Array.from(ext.compute(st));
  }

  const cosseno = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return d / Math.sqrt(na * nb);
  };
  const media = () => cadastro.amostras[0].map((_, i) => cadastro.amostras.reduce((s, e) => s + e[i], 0) / cadastro.amostras.length);

  // Limite de aceitação calibrado pelas próprias frases do cadastro:
  // um pouco abaixo da frase menos parecida, sem sair da faixa segura.
  function limiar() {
    if (cadastro.limiarFixo) return cadastro.limiarFixo;
    const m = media();
    const menor = Math.min(...cadastro.amostras.map((e) => cosseno(m, e)));
    return Math.min(0.92, Math.max(0.85, menor - 0.04));
  }

  return {
    estado() {
      const n = cadastro.amostras.length;
      return { cadastrada: n >= 5, amostras: n, limiar: n >= 2 ? Number(limiar().toFixed(3)) : null, modeloBaixado: fs.existsSync(ARQ_MODELO) };
    },
    preparar,
    async cadastrar(amostras, taxa) {
      const e = await impressao(amostras, taxa);
      cadastro.amostras = [...cadastro.amostras, e].slice(-MAX_AMOSTRAS);
      salvar();
      return this.estado();
    },
    // Sem cadastro completo, não bloqueia ninguém (ainda não sabe quem é o chefe).
    async conferir(amostras, taxa) {
      if (cadastro.amostras.length < 5) return { ok: true, semCadastro: true };
      const e = await impressao(amostras, taxa);
      const nota = cosseno(media(), e);
      const lim = limiar();
      return { ok: nota >= lim, nota: Number(nota.toFixed(3)), limiar: Number(lim.toFixed(3)) };
    },
    apagar() {
      cadastro = { amostras: [] };
      salvar();
      return this.estado();
    },
  };
}
