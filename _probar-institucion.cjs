// Prueba el campo «Universidad o instituto» de profesionales.html en un Chromium oculto (16-11-2026).
// Busca sin tildes, elige con el teclado, usa una institución que no está en la lista y revisa que
// el envío lleve institucion e institucion_registro (el POST al worker se intercepta, no sale nada).
// Uso: NODE_PATH="C:/Users/NodoXYZ/AppData/Local/hermes/node/node_modules" node _probar-institucion.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'file:///' + path.resolve(__dirname, 'profesionales.html').replace(/\\/g, '/');
const fallas = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK   ' : 'FALLA'} ${msg}`); if (!cond) fallas.push(msg); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  let enviado = null;
  await page.route('**/registro', async (route) => {
    enviado = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(URL);

  const input = page.locator('#institucion');
  const visibles = () => page.locator('#institucion-lista li[role=option]').allTextContents();

  await input.click();
  ok(!(await page.locator('#institucion-lista').isHidden()), 'al entrar al campo se abre la lista');
  ok((await visibles()).length === 128, `la lista completa trae 128 instituciones (${(await visibles()).length})`);

  await input.fill('catolica norte');
  ok(JSON.stringify(await visibles()) === JSON.stringify(['Universidad Católica del Norte', 'Usar «catolica norte» (otra institución)']),
    `«catolica norte» encuentra la UCN: ${JSON.stringify(await visibles())}`);
  await input.press('Enter');
  ok(await input.inputValue() === 'Universidad Católica del Norte', 'Enter elige la primera');
  ok(await page.locator('#institucion-lista').isHidden(), 'y cierra la lista');

  await input.fill('duoc');
  fs.mkdirSync(path.join(__dirname, '_capturas'), { recursive: true });
  await page.locator('#inst-field').screenshot({ path: path.join(__dirname, '_capturas', 'institucion-duoc.png') });
  await input.press('Escape');
  await input.fill('universidad de chile');
  await page.locator('#nombre').click(); // sale del campo sin elegir: se ajusta al nombre oficial
  ok(await input.inputValue() === 'Universidad de Chile', 'lo escrito igual a un nombre de la lista queda con el nombre oficial');

  await input.fill('Universidad de Buenos Aires');
  await page.locator('#institucion-lista li.inst-otra').click();
  ok(await input.inputValue() === 'Universidad de Buenos Aires', 'la opción «otra institución» deja lo escrito');

  // Envío: nombre, email, CV y autorización, con una institución de la lista.
  await input.fill('inacap');
  await page.locator('#institucion-lista li[role=option]', { hasText: 'Instituto Profesional INACAP' }).click();
  await page.fill('#nombre', 'Prueba Institucion');
  await page.fill('#email', 'prueba@ejemplo.com');
  await page.setInputFiles('#cv_file', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') });
  await page.check('#consentimiento');
  await page.click('#btn-enviar');
  await page.waitForTimeout(800);
  ok(enviado !== null, 'se envió el formulario');
  ok(/name="institucion"\r\n\r\nInstituto Profesional INACAP\r\n/.test(enviado || ''), 'el envío lleva institucion');
  ok(/name="institucion_registro"\r\n\r\nD6\r\n/.test(enviado || ''), 'y su código del Mineduc (D6)');
  ok(await input.inputValue() === '', 'después de enviar el campo queda limpio');
  ok(errores.length === 0, `sin errores de JavaScript ${errores.join(' | ')}`);

  await browser.close();
  console.log(fallas.length ? `\n${fallas.length} falla(s)` : '\nTodo conforme');
  process.exit(fallas.length ? 1 : 0);
})();
