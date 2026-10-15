// Ouvido próprio do Claudinho: transforma a fala em texto aqui dentro do computador,
// sem navegador e sem internet (sherpa-onnx + modelo de português NeMo FastConformer).
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE = "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-stt_pt_fastconformer_hybrid_large_pc-int8/resolve/main/";
const ARQUIVOS = ["tokens.txt", "model.int8.onnx"]; // o modelo tem uns 130 MB

export function criarOuvido(pastaDados) {
  const pasta = path.join(pastaDados, "modelos", "ouvido-pt");
  let reconhecedor = null;
  let preparando = null;

  async function baixar(nome) {
    const destino = path.join(pasta, nome);
    if (fs.existsSync(destino)) return;
    const r = await fetch(BASE + nome);
    if (!r.ok) throw new Error(`não consegui baixar ${nome}: ${r.status}`);
    const tmp = destino + ".baixando";
    await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, destino);
  }

  function preparar() {
    if (reconhecedor) return Promise.resolve(reconhecedor);
    preparando = preparando || (async () => {
      fs.mkdirSync(pasta, { recursive: true });
      for (const nome of ARQUIVOS) await baixar(nome);
      const sherpa = require("sherpa-onnx-node");
      reconhecedor = new sherpa.OfflineRecognizer({
        featConfig: { sampleRate: 16000, featureDim: 80 },
        modelConfig: {
          nemoCtc: { model: path.join(pasta, "model.int8.onnx") },
          tokens: path.join(pasta, "tokens.txt"),
          numThreads: 2,
          provider: "cpu",
          debug: 0,
        },
      });
      return reconhecedor;
    })().catch((e) => { preparando = null; throw e; });
    return preparando;
  }

  return {
    get pronto() { return !!reconhecedor; },
    preparar,
    async transcrever(amostras, taxa) {
      const rec = await preparar();
      const st = rec.createStream();
      st.acceptWaveform({ sampleRate: taxa, samples: amostras });
      rec.decode(st);
      return (rec.getResult(st).text || "").trim();
    },
  };
}
