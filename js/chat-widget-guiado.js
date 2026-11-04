/**
 * chat-widget-guiado.js — Widget "Consulta Aquí": burbuja flotante + panel
 * de chat con transcript (no un modal de un solo paso).
 *
 * El transcript SOLO crece: cada pregunta del bot y cada respuesta tuya
 * quedan como burbujas, como un chat real. "Empezar de nuevo" agrega
 * burbujas nuevas en vez de borrar las viejas — el historial de un intento
 * abandonado se queda a la vista, scrolleado hacia arriba.
 *
 * La conversación persiste mientras la pestaña siga abierta: cerrar el
 * panel solo lo oculta, no reinicia nada — es el comportamiento esperado de
 * un chat de verdad (a diferencia de un modal, que sí arranca de cero cada
 * vez que se reabre).
 *
 * Lee BOT_CONFIG (data/bot-config.js) para los botones de cada paso, y
 * LOCALIDADES (data/localidades.js) para el autocompletado de comuna — los
 * dos como <script>, no fetch, para no romper file://.
 *
 * Envía a Website/worker-lead/lead-worker.js (POST /lead, JSON). Ese Worker
 * tiene CORS cerrado a https://nodoxyz.cl exacto: este widget no puede
 * probarse end-to-end en local ni abierto con file://, solo en el sitio
 * desplegado.
 */

(function () {
  const WORKER_URL = 'https://nodoxyz-lead-widget.admin-nodoxyz.workers.dev/lead';
  const TURNSTILE_SITEKEY = '0x4AAAAAAEDHaog8FKjD5oHP';

  // Mismas reglas que esContactoValido() en lead-worker.js.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const TELEFONO_RE = /^[0-9+\-\s()]{6,}$/;

  const ramas = (typeof BOT_CONFIG !== 'undefined' && Array.isArray(BOT_CONFIG.ramas))
    ? BOT_CONFIG.ramas : [];

  let estado = estadoInicial();
  let pasoActual = 'inicio'; // 'inicio' | 'intent' | 'rama' | 'contexto' | 'comuna' | 'contacto' | 'exito'
  let turnstileWidgetId = null;
  let turnstileToken = '';
  let enviando = false;
  let iniciado = false; // si ya se armó la primera burbuja de esta sesión de página

  function estadoInicial() {
    return { rama: null, contexto: null, comuna: '', nombre: '', contacto: '', mensaje: '' };
  }

  function ramaActual() {
    return ramas.find((r) => r.id === estado.rama) || null;
  }

  function comunasDisponibles() {
    if (typeof LOCALIDADES === 'undefined' || !Array.isArray(LOCALIDADES.regions)) return [];
    const nombres = [];
    LOCALIDADES.regions.forEach((r) => (r.communes || []).forEach((c) => nombres.push(c.name)));
    return nombres;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // -------------------------------------------------------------------
  // Transcript: solo crece
  // -------------------------------------------------------------------

  function elTranscript() { return document.getElementById('chat-transcript'); }
  function elComposer() { return document.getElementById('chat-composer'); }

  function scrollAlFondo() {
    const t = elTranscript();
    t.scrollTop = t.scrollHeight;
  }

  // El composer (los botones/campos del paso actual) vive DENTRO de
  // #chat-transcript, como su último hijo — así todo scrollea junto en una
  // sola región. Antes el composer era un hermano fijo afuera del scroll:
  // con 7 botones de rama ocupaba casi todo el panel y el historial de la
  // conversación quedaba prácticamente tapado arriba, visible solo por un
  // pixel. Por eso las burbujas se insertan ANTES del composer, nunca
  // después — así el composer siempre queda al final del todo.

  function agregarBurbuja(clase, html) {
    const fila = document.createElement('div');
    fila.className = `chat-msg ${clase}`;
    fila.innerHTML = `<div class="chat-msg-bubble">${html}</div>`;
    elTranscript().insertBefore(fila, elComposer());
    scrollAlFondo();
    return fila;
  }

  function agregarBurbujaUsuario(texto) {
    agregarBurbuja('chat-msg-user', escapeHtml(texto));
  }

  function mostrarEscribiendo() {
    const fila = document.createElement('div');
    fila.className = 'chat-msg chat-msg-bot chat-typing';
    fila.id = 'chat-escribiendo';
    fila.innerHTML = `<div class="chat-msg-bubble">
      <span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>
    </div>`;
    elTranscript().insertBefore(fila, elComposer());
    scrollAlFondo();
  }

  function quitarEscribiendo() {
    const fila = document.getElementById('chat-escribiendo');
    if (fila) fila.remove();
  }

  /** Simula que el bot "escribe" antes de que aparezca su mensaje. */
  function decirBot(html, callback) {
    mostrarEscribiendo();
    setTimeout(() => {
      quitarEscribiendo();
      agregarBurbuja('chat-msg-bot', html);
      if (callback) callback();
    }, 450 + Math.random() * 250);
  }

  function setComposer(html) {
    elComposer().innerHTML = html;
  }

  function limpiarComposer() {
    elComposer().innerHTML = '';
  }

  function botonCambiar() {
    return '<button type="button" class="chat-cambiar" id="chat-btn-cambiar">Empezar de nuevo</button>';
  }

  function enlazarBotonCambiar() {
    const btn = document.getElementById('chat-btn-cambiar');
    if (btn) btn.addEventListener('click', empezarDeNuevo);
  }

  function empezarDeNuevo() {
    estado = estadoInicial();
    limpiarComposer();
    decirBot('Perfecto, empecemos de nuevo 👇', irARama);
  }

  // -------------------------------------------------------------------
  // Pasos
  // -------------------------------------------------------------------

  /** Primer paso: separa a quien necesita contratar un servicio (sigue al
   * menú de ramas) de quien quiere sumarse como profesional (va directo al
   * popup "Regístrate como profesional" que ya existe en el sitio — no es
   * un lead de servicio, no pasa por el Worker de leads). */
  function irAIntent() {
    pasoActual = 'intent';
    setComposer(`
      <div class="chat-opciones">
        <button type="button" class="chat-opcion" id="chat-btn-intent-cliente">Quiero asesoría con un proyecto</button>
        <button type="button" class="chat-opcion" id="chat-btn-intent-profesional">Quiero registrarme como profesional</button>
      </div>
    `);
    document.getElementById('chat-btn-intent-cliente').addEventListener('click', () => {
      agregarBurbujaUsuario('Quiero asesoría con un proyecto');
      limpiarComposer();
      decirBot('¿En qué podemos ayudarte?', irARama);
    });
    document.getElementById('chat-btn-intent-profesional').addEventListener('click', () => {
      agregarBurbujaUsuario('Quiero registrarme como profesional');
      limpiarComposer();
      abrirPopupRegistroProfesional();
    });
  }

  /** Reusa el popup "Regístrate como profesional" que ya existe en
   * index.html (mismo backdrop, mismo llenado de 4s, mismo redirect a
   * profesionales.html) en vez de duplicar esa lógica acá — se dispara el
   * mismo click que el link de la barra de navegación. */
  function abrirPopupRegistroProfesional() {
    cerrarPanel();
    const linkNav = document.getElementById('btn-registro-nav');
    if (linkNav) linkNav.click();
  }

  function irARama() {
    pasoActual = 'rama';
    const opciones = ramas.map((r) => `<button type="button" class="chat-opcion" data-rama="${escapeHtml(r.id)}">${escapeHtml(r.label)}</button>`).join('');
    setComposer(`<div class="chat-opciones">${opciones}</div>`);
    document.querySelectorAll('#chat-composer [data-rama]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rama = ramas.find((r) => r.id === btn.dataset.rama);
        estado.rama = rama.id;
        estado.contexto = null;
        agregarBurbujaUsuario(rama.label);
        limpiarComposer();
        if (rama.tiene_paso2) {
          decirBot('¿Qué necesitas puntualmente?', irAContexto);
        } else {
          decirBot('¿De dónde es el proyecto?', irAComuna);
        }
      });
    });
  }

  function irAContexto() {
    pasoActual = 'contexto';
    const rama = ramaActual();
    const opciones = rama.contextos.map((c) => `<button type="button" class="chat-opcion" data-contexto="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`).join('');
    setComposer(`<div class="chat-opciones">${opciones}</div>${botonCambiar()}`);
    enlazarBotonCambiar();
    document.querySelectorAll('#chat-composer [data-contexto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = rama.contextos.find((x) => x.id === btn.dataset.contexto);
        estado.contexto = c.id;
        agregarBurbujaUsuario(c.label);
        limpiarComposer();
        decirBot('¿De dónde es el proyecto?', irAComuna);
      });
    });
  }

  function irAComuna() {
    pasoActual = 'comuna';
    setComposer(`
      <div class="chat-campos">
        <div class="field">
          <input type="text" id="chat-comuna" list="chat-lista-comunas"
                 placeholder="Ej: Providencia" autocomplete="off" value="${escapeHtml(estado.comuna)}">
          <datalist id="chat-lista-comunas">
            ${comunasDisponibles().map((n) => `<option value="${escapeHtml(n)}">`).join('')}
          </datalist>
          <span class="field-error" id="chat-comuna-error"></span>
        </div>
        <button type="button" class="info-btn-primary" id="chat-btn-comuna-siguiente" style="width:100%;">
          <span class="info-btn-label">Continuar</span>
        </button>
      </div>
      ${botonCambiar()}
    `);
    enlazarBotonCambiar();
    const input = document.getElementById('chat-comuna');
    input.focus();
    const seguir = () => {
      const valor = input.value.trim();
      if (!valor) {
        input.classList.add('campo-invalido');
        document.getElementById('chat-comuna-error').textContent = 'Cuéntanos en qué comuna es.';
        return;
      }
      estado.comuna = valor;
      agregarBurbujaUsuario(valor);
      limpiarComposer();
      decirBot('Ya casi — déjanos tus datos para contactarte.', irAContacto);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') seguir(); });
    input.addEventListener('input', () => {
      input.classList.remove('campo-invalido');
      document.getElementById('chat-comuna-error').textContent = '';
    });
    document.getElementById('chat-btn-comuna-siguiente').addEventListener('click', seguir);
  }

  function irAContacto() {
    pasoActual = 'contacto';
    setComposer(`
      <div class="chat-campos">
        <div class="field">
          <label for="chat-nombre">Nombre</label>
          <input type="text" id="chat-nombre" autocomplete="name" value="${escapeHtml(estado.nombre)}">
          <span class="field-error" id="chat-nombre-error"></span>
        </div>
        <div class="field">
          <label for="chat-contacto">Email o teléfono</label>
          <input type="text" id="chat-contacto" autocomplete="email" value="${escapeHtml(estado.contacto)}">
          <span class="field-error" id="chat-contacto-error"></span>
        </div>
        <div class="field">
          <label for="chat-mensaje">Mensaje (opcional)</label>
          <textarea id="chat-mensaje" rows="2" maxlength="2000">${escapeHtml(estado.mensaje)}</textarea>
        </div>

        <div class="hp-field" aria-hidden="true">
          <label for="chat-web">No completar este campo</label>
          <input type="text" id="chat-web" name="web" tabindex="-1" autocomplete="off">
        </div>

        <div class="cf-turnstile chat-turnstile" id="chat-turnstile"></div>

        <button type="button" class="info-btn-primary" id="chat-btn-enviar" style="width:100%;" disabled>
          <span class="info-btn-label">Enviar consulta</span>
        </button>
        <p class="chat-status" id="chat-status"></p>
        <p class="chat-legal">Usamos estos datos solo para responder tu consulta, según la <a href="legal/privacidad.html#datos" target="_blank" rel="noopener">política de privacidad</a>.</p>
      </div>
      ${botonCambiar()}
    `);
    enlazarBotonCambiar();
    montarTurnstile();

    document.getElementById('chat-nombre').addEventListener('input', (e) => e.target.classList.remove('campo-invalido'));
    document.getElementById('chat-contacto').addEventListener('input', (e) => e.target.classList.remove('campo-invalido'));
    document.getElementById('chat-btn-enviar').addEventListener('click', enviar);
  }

  function irAExito() {
    pasoActual = 'exito';
    limpiarComposer();
  }

  // -------------------------------------------------------------------
  // Turnstile
  // -------------------------------------------------------------------

  function montarTurnstile() {
    turnstileToken = '';
    turnstileWidgetId = null;
    actualizarBotonEnviar();
    const cont = document.getElementById('chat-turnstile');
    if (!window.turnstile || !cont) return; // el script puede tardar en cargar
    turnstileWidgetId = window.turnstile.render(cont, {
      sitekey: TURNSTILE_SITEKEY,
      theme: 'dark',
      callback: (token) => { turnstileToken = token; actualizarBotonEnviar(); },
      'expired-callback': () => { turnstileToken = ''; actualizarBotonEnviar(); },
      'error-callback': () => { turnstileToken = ''; actualizarBotonEnviar(); },
    });
  }

  function actualizarBotonEnviar() {
    const btn = document.getElementById('chat-btn-enviar');
    if (btn) btn.disabled = enviando || !turnstileToken;
  }

  // -------------------------------------------------------------------
  // Envío
  // -------------------------------------------------------------------

  function validarPasoContacto() {
    let ok = true;
    const nombreEl = document.getElementById('chat-nombre');
    const contactoEl = document.getElementById('chat-contacto');
    const nombre = nombreEl.value.trim();
    const contacto = contactoEl.value.trim();

    if (nombre.length < 3) {
      nombreEl.classList.add('campo-invalido');
      document.getElementById('chat-nombre-error').textContent = 'Cuéntanos tu nombre completo.';
      ok = false;
    } else {
      document.getElementById('chat-nombre-error').textContent = '';
    }

    if (!EMAIL_RE.test(contacto) && !TELEFONO_RE.test(contacto)) {
      contactoEl.classList.add('campo-invalido');
      document.getElementById('chat-contacto-error').textContent = 'Déjanos un email o un teléfono válido.';
      ok = false;
    } else {
      document.getElementById('chat-contacto-error').textContent = '';
    }

    if (ok) {
      estado.nombre = nombre;
      estado.contacto = contacto;
      estado.mensaje = document.getElementById('chat-mensaje').value.trim();
    }
    return ok;
  }

  async function enviar() {
    if (enviando) return;
    if (!validarPasoContacto()) return;
    if (!turnstileToken) return;

    const status = document.getElementById('chat-status');
    enviando = true;
    actualizarBotonEnviar();
    status.className = 'chat-status';
    status.textContent = 'Enviando…';

    const rama = ramaActual();
    const contextoLabel = estado.contexto
      ? (rama.contextos.find((c) => c.id === estado.contexto) || {}).label || ''
      : '';

    const cuerpo = {
      rama: estado.rama,
      contexto: contextoLabel,
      comuna: estado.comuna,
      nombre: estado.nombre,
      contacto: estado.contacto,
      mensaje: estado.mensaje,
      turnstileToken,
      web: document.getElementById('chat-web').value,
    };

    try {
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(datos.error || `Error del servidor (HTTP ${resp.status})`);

      agregarBurbujaUsuario(`Soy ${estado.nombre}, contáctame a ${estado.contacto}${estado.mensaje ? ': ' + estado.mensaje : '.'}`);
      limpiarComposer();
      decirBot(`¡Gracias, ${escapeHtml(estado.nombre)}! Recibimos tu consulta y te vamos a contactar a la brevedad.`, irAExito);
    } catch (err) {
      status.className = 'chat-status error';
      status.textContent = `No se pudo enviar: ${err.message}. Intenta de nuevo o escríbenos directo.`;
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
      turnstileToken = '';
    } finally {
      enviando = false;
      actualizarBotonEnviar();
    }
  }

  // -------------------------------------------------------------------
  // Apertura / cierre — solo oculta, nunca reinicia la conversación
  // -------------------------------------------------------------------

  function abrirPanel() {
    document.getElementById('chat-launcher').setAttribute('hidden', '');
    document.getElementById('chat-panel').removeAttribute('hidden');

    if (!iniciado) {
      iniciado = true;
      decirBot('¡Hola! 👋', () => decirBot('¿En qué podemos ayudarte hoy?', irAIntent));
    }
    scrollAlFondo();
  }

  function cerrarPanel() {
    document.getElementById('chat-panel').setAttribute('hidden', '');
    document.getElementById('chat-launcher').removeAttribute('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const launcher = document.getElementById('chat-launcher');
    const panel = document.getElementById('chat-panel');
    const btnHero = document.getElementById('btn-consulta-aqui');
    if (!launcher || !panel) return;

    launcher.addEventListener('click', abrirPanel);
    if (btnHero) btnHero.addEventListener('click', (e) => { e.preventDefault(); abrirPanel(); });
    document.getElementById('chat-panel-close').addEventListener('click', cerrarPanel);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hasAttribute('hidden')) cerrarPanel();
    });
  });
})();
