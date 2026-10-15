// Busca no YouTube sem chave de API: lê a página de resultados e tira os vídeos (id + título).
export async function buscarYoutube(busca, limite = 8) {
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(busca) + "&hl=pt-BR&gl=BR";
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
  });
  if (!r.ok) throw new Error("YouTube respondeu " + r.status);
  const html = await r.text();
  const achados = [];
  const vistos = new Set();
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(html)) && achados.length < limite) {
    if (vistos.has(m[1])) continue;
    vistos.add(m[1]);
    let titulo = m[2];
    try { titulo = JSON.parse('"' + m[2] + '"'); } catch {}
    achados.push({ id: m[1], titulo });
  }
  return achados;
}
