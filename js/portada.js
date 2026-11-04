/**
 * portada.js: dibuja la portada del inicio, la misma del brochure (Brochure_NodoXYZ, portada C):
 * el borde superior como una losa en perspectiva cuyos ejes fugan al punto que separa NODO y XYZ.
 * Las líneas se cortan antes de las letras. Los colores salen de styles.css (.portada .losa,
 * .letras, .punto), así que el dibujo cambia solo con el tema claro u oscuro.
 */
(function () {
  var svg = document.getElementById('losa');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var W = 1188, H = 520, M = 8;

  function el(tag, a, padre) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) e.setAttribute(k, a[k]);
    (padre || svg).appendChild(e);
    return e;
  }

  // Línea desde (x, y) hacia el punto de fuga, cortada a "halo" del punto.
  function hacia(g, x, y, px, py, halo) {
    var dx = px - x, dy = py - y, d = Math.hypot(dx, dy), f = (d - halo) / d;
    el('line', { x1: x, y1: y, x2: x + dx * f, y2: y + dy * f }, g);
  }

  function texto(x, y, cadena, a) {
    var t = el('text', { x: x, y: y, 'text-anchor': a.ancla, 'font-size': a.tam, 'letter-spacing': a.esp, 'class': a.clase });
    t.textContent = cadena;
  }

  var g = el('g', { 'class': 'losa', 'stroke-width': 1 });
  el('rect', { x: M, y: M, width: W - 2 * M, height: H - 2 * M }, g);
  var px = W * 0.5, py = H * 0.62, n = 16;
  for (var i = 0; i <= n; i++) hacia(g, M + (W - 2 * M) * i / n, M, px, py, 56);
  [1.25, 1.6, 2.1, 2.8, 3.8, 5.3].forEach(function (z) {
    var y = py + (M - py) / z;
    el('line', { x1: px + (M - px) / z, y1: y, x2: px + (W - M - px) / z, y2: y }, g);
  });
  var gf = el('g', { 'class': 'losa fina' });
  hacia(gf, M, H - M, px, py, 200);
  hacia(gf, W - M, H - M, px, py, 200);
  el('circle', { cx: px, cy: py, r: 5.5, 'class': 'punto' });

  // letter-spacing también se suma tras la última letra: NODO se corre para que el aire
  // a cada lado del punto se vea igual.
  texto(px - 18, py + 14, 'NODO', { ancla: 'end', tam: 40, esp: 12, clase: 'letras' });
  texto(px + 30, py + 14, 'XYZ', { ancla: 'start', tam: 40, esp: 12, clase: 'letras' });
})();
