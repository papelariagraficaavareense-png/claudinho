// Microfone do Claudinho: guarda sempre os últimos segundos de áudio,
// pra conferir se quem falou "hey Claudinho" foi mesmo o chefe.
window.Gravador = (() => {
  const SEGUNDOS = 10;
  let ctx = null, pronto = null, taxa = 48000, ativo = false;
  let pedacos = [];

  function iniciar() {
    pronto = pronto || navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
      .then((stream) => {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        taxa = ctx.sampleRate;
        const fonte = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (e) => {
          const agora = performance.now();
          pedacos.push({ t: agora, d: new Float32Array(e.inputBuffer.getChannelData(0)) });
          while (pedacos.length && pedacos[0].t < agora - SEGUNDOS * 1000) pedacos.shift();
        };
        fonte.connect(proc);
        proc.connect(ctx.destination); // a saída fica em silêncio; só serve pra manter o processamento rodando
        ativo = true;
        // Navegador pode deixar o áudio "pausado" até alguém clicar ou apertar uma tecla.
        const destravar = () => { if (ctx.state !== "running") ctx.resume(); };
        destravar();
        for (const ev of ["click", "keydown", "touchstart"]) document.addEventListener(ev, destravar, { passive: true });
      })
      .catch((e) => { pronto = null; throw e; });
    return pronto;
  }

  function juntar(desde) {
    const partes = pedacos.filter((p) => p.t >= desde).map((p) => p.d);
    const out = new Float32Array(partes.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of partes) { out.set(p, o); o += p.length; }
    return out;
  }

  // Tira o silêncio do começo e do fim (a impressão de voz fica melhor só com a fala).
  function aparar(a) {
    const passo = Math.max(1, Math.round(taxa * 0.02));
    const energia = [];
    let maior = 0;
    for (let i = 0; i < a.length; i += passo) {
      let s = 0;
      const fim = Math.min(i + passo, a.length);
      for (let j = i; j < fim; j++) s += a[j] * a[j];
      const r = Math.sqrt(s / (fim - i));
      energia.push(r);
      if (r > maior) maior = r;
    }
    const corte = Math.max(0.008, maior * 0.12);
    const ini = energia.findIndex((r) => r > corte);
    if (ini < 0) return new Float32Array(0);
    let fim = energia.length - 1;
    while (fim > ini && energia[fim] <= corte) fim--;
    return a.slice(Math.max(0, ini - 5) * passo, Math.min(energia.length, fim + 6) * passo);
  }

  // Os últimos N segundos, só a parte com fala.
  function ultimos(seg) { return aparar(juntar(performance.now() - seg * 1000)); }

  // Grava N segundos a partir de agora (usado no cadastro da voz).
  function gravar(seg) {
    const ini = performance.now();
    return new Promise((ok) => setTimeout(() => ok(aparar(juntar(ini))), seg * 1000));
  }

  async function enviar(rota, amostras) {
    const r = await fetch(rota + "?taxa=" + taxa, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: amostras.buffer });
    return r.json();
  }

  return { iniciar, ultimos, gravar, enviar, get taxa() { return taxa; }, get ativo() { return ativo && ctx && ctx.state === "running"; } };
})();
