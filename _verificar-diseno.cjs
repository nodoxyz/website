/**
 * _verificar-diseno.cjs: revisa el diseño del sitio (versión del brochure, con tema claro y oscuro)
 * en Chromium headless, abriendo los HTML locales con file://. Sin servidor ni despliegue.
 *
 * Uso (Playwright está instalado bajo el Node de hermes; CommonJS a propósito, ESM ignora NODE_PATH):
 *   NODE_PATH="C:/Users/NodoXYZ/AppData/Local/hermes/node/node_modules" node _verificar-diseno.cjs [carpeta-capturas]
 *
 * Mide, en index.html y profesionales.html, a 1440 px y a 390 px, en claro y en oscuro:
 *   - que la página no se desborde a lo ancho;
 *   - en los proyectos: que número, título, mandante, lugar y ficha queden a la misma altura en
 *     cada fila de dos tarjetas, y que cada valor de la ficha ocupe una sola línea sin cortarse;
 *   - que no quede la raya larga en el texto visible.
 * Deja una captura de página completa por caso en la carpeta indicada (por defecto, _capturas/).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = __dirname;
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, '_capturas'));
const PAGINAS = ['index.html', 'profesionales.html'];
const ANCHOS = [1440, 390];
const TEMAS = ['light', 'dark'];

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const fallas = [];

  for (const pagina of PAGINAS) {
    for (const ancho of ANCHOS) {
      for (const tema of TEMAS) {
        const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: tema === 'dark' ? 'dark' : 'light' });
        const p = await contexto.newPage();
        // Los servicios externos (fuentes, Turnstile, banderas) no hacen falta para medir el diseño.
        await p.route(/^https?:\/\//, (r) => r.abort());
        await p.goto('file:///' + path.join(RAIZ, pagina).replace(/\\/g, '/'));
        await p.waitForTimeout(300);
        const caso = `${pagina} ${ancho}px ${tema}`;

        const r = await p.evaluate(() => {
          const out = { desborde: 0, filas: [], valores: [], raya: false, tema: document.documentElement.getAttribute('data-theme') };
          out.desborde = document.documentElement.scrollWidth - window.innerWidth;
          const proys = [...document.querySelectorAll('.proy')];
          for (let i = 0; i + 1 < proys.length; i += 2) {
            const a = proys[i], b = proys[i + 1];
            if (a.getBoundingClientRect().top !== b.getBoundingClientRect().top) continue; // en una columna no se comparan
            for (const sel of ['.rot', 'h3', '.nombre', '.lugar', '.ficha']) {
              const ya = a.querySelector(sel).getBoundingClientRect().top;
              const yb = b.querySelector(sel).getBoundingClientRect().top;
              if (Math.abs(ya - yb) > 0.5) out.filas.push(`${sel} desalineado ${Math.round(ya)} vs ${Math.round(yb)} (proyectos ${i + 1} y ${i + 2})`);
            }
          }
          for (const dd of document.querySelectorAll('.ficha dd')) {
            const alto = parseFloat(getComputedStyle(dd).lineHeight) || 20;
            if (dd.getBoundingClientRect().height > alto * 1.5) out.valores.push(`"${dd.textContent}" ocupa más de una línea`);
            if (dd.scrollWidth > dd.clientWidth + 1) out.valores.push(`"${dd.textContent}" se corta`);
          }
          out.raya = document.body.innerText.includes('\u2014');
          return out;
        });

        if (r.tema !== tema) fallas.push(`${caso}: el tema quedó en ${r.tema}`);
        if (r.desborde > 0) fallas.push(`${caso}: se desborda ${r.desborde} px a lo ancho`);
        r.filas.forEach((f) => fallas.push(`${caso}: ${f}`));
        r.valores.forEach((f) => fallas.push(`${caso}: ${f}`));
        if (r.raya) fallas.push(`${caso}: queda una raya larga en el texto visible`);

        await p.screenshot({ path: path.join(SALIDA, `${pagina.replace('.html', '')}-${ancho}-${tema}.png`), fullPage: true });
        await contexto.close();
      }
    }
  }

  await navegador.close();
  if (fallas.length) {
    console.log('Revisar:\n- ' + fallas.join('\n- '));
    process.exitCode = 1;
  } else {
    console.log(`Conforme: ${PAGINAS.length * ANCHOS.length * TEMAS.length} casos. Capturas en ${SALIDA}`);
  }
})();
