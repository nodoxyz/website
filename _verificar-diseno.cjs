/**
 * _verificar-diseno.cjs: revisa el diseño del sitio (versión del brochure, con tema claro y oscuro)
 * en Chromium headless, abriendo los HTML locales con file://. Sin servidor ni despliegue.
 *
 * Uso (Playwright está instalado bajo el Node de hermes; CommonJS a propósito, ESM ignora NODE_PATH):
 *   NODE_PATH="C:/Users/NodoXYZ/AppData/Local/hermes/node/node_modules" node _verificar-diseno.cjs [carpeta-capturas]
 *
 * Mide, en el inicio, profesionales y las dos páginas legales, a 1440 px y a 390 px, en claro y en oscuro:
 *   - que la página no se desborde a lo ancho;
 *   - en los proyectos: que título, mandante con lugar y datos queden a la misma altura en cada
 *     fila de dos tarjetas, y que con dos columnas cada una de esas líneas ocupe una sola línea;
 *   - que no quede la raya larga en el texto visible.
 * Deja una captura de página completa por caso en la carpeta indicada (por defecto, _capturas/).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = __dirname;
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, '_capturas'));
const PAGINAS = ['index.html', 'profesionales.html', 'legal/privacidad.html', 'legal/terminos.html'];
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
            for (const sel of ['.titulo', '.linea2', '.datos']) {
              const ya = a.querySelector(sel).getBoundingClientRect().top;
              const yb = b.querySelector(sel).getBoundingClientRect().top;
              if (Math.abs(ya - yb) > 0.5) out.filas.push(`${sel} desalineado ${Math.round(ya)} vs ${Math.round(yb)} (proyectos ${i + 1} y ${i + 2})`);
            }
          }
          const dosColumnas = proys.length > 1 && proys[0].getBoundingClientRect().top === proys[1].getBoundingClientRect().top;
          if (dosColumnas) for (const el of document.querySelectorAll('.proy h3, .proy .linea2, .proy .datos')) {
            const alto = parseFloat(getComputedStyle(el).lineHeight) || 20;
            if (el.getBoundingClientRect().height - parseFloat(getComputedStyle(el).paddingTop) > alto * 1.5) out.valores.push(`"${el.textContent}" ocupa más de una línea`);
          }
          out.raya = document.body.innerText.includes('\u2014');
          return out;
        });

        if (r.tema !== tema) fallas.push(`${caso}: el tema quedó en ${r.tema}`);
        if (r.desborde > 0) fallas.push(`${caso}: se desborda ${r.desborde} px a lo ancho`);
        r.filas.forEach((f) => fallas.push(`${caso}: ${f}`));
        r.valores.forEach((f) => fallas.push(`${caso}: ${f}`));
        if (r.raya) fallas.push(`${caso}: queda una raya larga en el texto visible`);

        await p.screenshot({ path: path.join(SALIDA, `${pagina.replace('.html', '').replace('/', '-')}-${ancho}-${tema}.png`), fullPage: true });
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
