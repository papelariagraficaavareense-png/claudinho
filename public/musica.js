// Música do Claudinho pelo YouTube: player pequeno no canto da tela.
// Busca pelo servidor (/api/youtube), toca o primeiro resultado que deixar tocar fora do YouTube
// e conta pro servidor o que está tocando (pro quadrado "Tocando agora" do painel).
window.Musica = (() => {
  let player = null, apiPronta = null, fila = [], indice = 0, volume = 70, abaixado = false, titulo = "";

  const caixa = document.createElement("div");
  caixa.id = "musica";
  caixa.hidden = true;
  caixa.innerHTML = '<div id="ytPlayer"></div><div class="mus-titulo"></div>';
  document.body.append(caixa);

  function carregarApi() {
    apiPronta = apiPronta || new Promise((ok) => {
      window.onYouTubeIframeAPIReady = ok;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.append(s);
    });
    return apiPronta;
  }
  const estado = () => { try { return player.getPlayerState(); } catch { return -1; } };
  function avisar() {
    fetch("/api/musica", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, tocando: !caixa.hidden && estado() === 1 }) }).catch(() => {});
  }

  async function tocarIndice(i) {
    const v = fila[i];
    if (!v) { caixa.hidden = true; titulo = ""; avisar(); return false; }
    indice = i;
    titulo = v.titulo;
    caixa.querySelector(".mus-titulo").textContent = "🎵 " + titulo;
    caixa.hidden = false;
    await carregarApi();
    if (!player) {
      await new Promise((ok) => {
        player = new YT.Player("ytPlayer", {
          width: 320, height: 180, videoId: v.id,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => { e.target.setVolume(abaixado ? 15 : volume); e.target.playVideo(); ok(); },
            onStateChange: (e) => { if (e.data === 0) proxima(); avisar(); },
            onError: () => proxima(), // vídeo que não deixa tocar fora do YouTube: vai pro próximo
          },
        });
      });
    } else {
      player.loadVideoById(v.id);
      player.setVolume(abaixado ? 15 : volume);
    }
    avisar();
    return true;
  }

  async function tocar(busca) {
    const r = await fetch("/api/youtube?q=" + encodeURIComponent(busca)).then((x) => x.json()).catch(() => []);
    if (!r.length) return false;
    fila = r;
    return tocarIndice(0);
  }
  function proxima() { return tocarIndice(indice + 1); }
  function pausar() { try { player.pauseVideo(); } catch {} setTimeout(avisar, 400); }
  function continuar() { try { player.playVideo(); } catch {} setTimeout(avisar, 400); }
  function parar() { try { player.stopVideo(); } catch {} caixa.hidden = true; titulo = ""; avisar(); }
  function mudarVolume(passo) {
    volume = Math.max(5, Math.min(100, volume + passo));
    if (!abaixado) try { player.setVolume(volume); } catch {}
    return volume;
  }
  // Enquanto o Claudinho ouve, pensa ou fala, a música fica baixinha
  function abaixar(sim) {
    if (abaixado === sim) return;
    abaixado = sim;
    try { player.setVolume(sim ? 15 : volume); } catch {}
  }

  return { tocar, proxima, pausar, continuar, parar, mudarVolume, abaixar, get tocando() { return !caixa.hidden && estado() === 1; }, get ativo() { return !caixa.hidden; } };
})();
