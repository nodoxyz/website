/**
 * registro.js — Formulario "Regístrate como profesional" (Website/profesionales.html)
 *
 * Puebla los selects de región/comuna desde el global LOCALIDADES (definido en
 * data/localidades.js, cargado como <script> — no con fetch, para que la
 * página funcione también abierta con doble clic vía file://, donde Chrome
 * bloquea fetch() de archivos locales por CORS). Sin build step: JS plano.
 */

const WORKER_URL = 'https://nodoxyz-registro-profesionales.admin-nodoxyz.workers.dev/registro';

const CV_MAX_BYTES = 8 * 1024 * 1024;
const CV_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const CV_ACCEPTED_EXT = /\.(pdf|doc|docx)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Teléfono: código de país aparte (con bandera), Chile por defecto ----
// Lista de los países más relevantes para NodoXYZ y sus clientes/postulantes
// (no son los ~195 países del mundo, pero cubre Latinoamérica completa más
// las principales economías — se puede ampliar agregando filas al arreglo).
const PAISES = [
  ['CL', '56', 'Chile'],
  ['AR', '54', 'Argentina'],
  ['PE', '51', 'Perú'],
  ['BO', '591', 'Bolivia'],
  ['BR', '55', 'Brasil'],
  ['CO', '57', 'Colombia'],
  ['EC', '593', 'Ecuador'],
  ['PY', '595', 'Paraguay'],
  ['UY', '598', 'Uruguay'],
  ['VE', '58', 'Venezuela'],
  ['MX', '52', 'México'],
  ['GT', '502', 'Guatemala'],
  ['HN', '504', 'Honduras'],
  ['SV', '503', 'El Salvador'],
  ['NI', '505', 'Nicaragua'],
  ['CR', '506', 'Costa Rica'],
  ['PA', '507', 'Panamá'],
  ['CU', '53', 'Cuba'],
  ['DO', '1', 'República Dominicana'],
  ['PR', '1', 'Puerto Rico'],
  ['HT', '509', 'Haití'],
  ['US', '1', 'Estados Unidos'],
  ['CA', '1', 'Canadá'],
  ['ES', '34', 'España'],
  ['PT', '351', 'Portugal'],
  ['FR', '33', 'Francia'],
  ['DE', '49', 'Alemania'],
  ['IT', '39', 'Italia'],
  ['GB', '44', 'Reino Unido'],
  ['IE', '353', 'Irlanda'],
  ['NL', '31', 'Países Bajos'],
  ['BE', '32', 'Bélgica'],
  ['CH', '41', 'Suiza'],
  ['AT', '43', 'Austria'],
  ['SE', '46', 'Suecia'],
  ['NO', '47', 'Noruega'],
  ['DK', '45', 'Dinamarca'],
  ['FI', '358', 'Finlandia'],
  ['PL', '48', 'Polonia'],
  ['CZ', '420', 'República Checa'],
  ['GR', '30', 'Grecia'],
  ['RO', '40', 'Rumania'],
  ['HU', '36', 'Hungría'],
  ['RU', '7', 'Rusia'],
  ['UA', '380', 'Ucrania'],
  ['TR', '90', 'Turquía'],
  ['CN', '86', 'China'],
  ['JP', '81', 'Japón'],
  ['KR', '82', 'Corea del Sur'],
  ['IN', '91', 'India'],
  ['ID', '62', 'Indonesia'],
  ['PH', '63', 'Filipinas'],
  ['VN', '84', 'Vietnam'],
  ['TH', '66', 'Tailandia'],
  ['MY', '60', 'Malasia'],
  ['SG', '65', 'Singapur'],
  ['IL', '972', 'Israel'],
  ['SA', '966', 'Arabia Saudita'],
  ['AE', '971', 'Emiratos Árabes Unidos'],
  ['PK', '92', 'Pakistán'],
  ['BD', '880', 'Bangladés'],
  ['AU', '61', 'Australia'],
  ['NZ', '64', 'Nueva Zelanda'],
  ['ZA', '27', 'Sudáfrica'],
  ['NG', '234', 'Nigeria'],
  ['EG', '20', 'Egipto'],
  ['MA', '212', 'Marruecos'],
  ['KE', '254', 'Kenia'],
];

// Imagen de bandera real (no emoji) — un <select> nativo no admite <img>
// dentro de sus <option>, por eso el país se elige con un dropdown propio.
function banderaUrl(iso) {
  return `https://flagcdn.com/h20/${iso.toLowerCase()}.png`;
}

const PAISES_ORDENADOS = [...PAISES].sort((a, b) => a[2].localeCompare(b[2], 'es'));

// Chile: "9 1234 5678" (el 9 inicial + 8 dígitos, en grupos de 4).
// Resto de países: agrupado genérico de a 3 dígitos, sin formato estricto
// (cada país tiene su propio largo/formato — no es viable modelar los 60+).
function formatearTelefonoLocal(valor, dial) {
  const digitos = valor.replace(/\D/g, '');
  if (dial === '56') {
    const d = digitos.slice(0, 9);
    if (!d) return '';
    let resultado = d.slice(0, 1);
    if (d.length > 1) resultado += ' ' + d.slice(1, 5);
    if (d.length > 5) resultado += ' ' + d.slice(5, 9);
    return resultado;
  }
  return digitos.slice(0, 14).replace(/(\d{3})(?=\d)/g, '$1 ');
}

function telefonoEsValido(valorLocal, dial) {
  if (valorLocal === '') return true; // el teléfono es opcional
  if (dial === '56') return /^9 \d{4} \d{4}$/.test(valorLocal);
  return valorLocal.replace(/\D/g, '').length >= 6;
}

const localidades = (typeof LOCALIDADES !== 'undefined') ? LOCALIDADES : null;
let cvFile = null;

function poblarRegiones(selectRegion) {
  if (!localidades) return;
  const regionesOrdenadas = [...localidades.regions].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const region of regionesOrdenadas) {
    const opt = document.createElement('option');
    opt.value = region.id;
    opt.textContent = region.name;
    selectRegion.appendChild(opt);
  }
}

function poblarComunas(selectComuna, regionId) {
  selectComuna.innerHTML = '';
  const region = localidades.regions.find(r => r.id === regionId);
  if (!region) {
    selectComuna.innerHTML = '<option value="">Primero selecciona una región</option>';
    selectComuna.disabled = true;
    return;
  }
  selectComuna.disabled = false;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona una comuna';
  selectComuna.appendChild(placeholder);
  const comunasOrdenadas = [...region.communes].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const comuna of comunasOrdenadas) {
    const opt = document.createElement('option');
    opt.value = comuna.id;
    opt.textContent = comuna.name;
    selectComuna.appendChild(opt);
  }
}

// Formatea a medida que se escribe: 123456789 -> 12.345.678-9. El último
// carácter ingresado (dígito o K) se toma como verificador; el resto son el
// cuerpo, con puntos de miles. Se recalcula completo en cada input, igual
// que formatearTelefonoLocal — el cursor salta al final, pero es consistente
// con el resto del formulario.
function formatearRut(valor) {
  const limpio = valor.replace(/[^\dkK]/g, '').toUpperCase();
  if (!limpio) return '';
  const cuerpo = limpio.slice(0, -1).replace(/\D/g, '').slice(0, 8);
  const dv = limpio.slice(-1);
  if (!cuerpo) return dv;
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFormateado}-${dv}`;
}

// Valida RUT chileno con dígito verificador (módulo 11).
function validarRut(rutRaw) {
  const rut = String(rutRaw).replace(/[.\s]/g, '').toUpperCase();
  const match = rut.match(/^(\d{1,8})-?([\dK])$/);
  if (!match) return false;
  const [, cuerpo, dv] = match;
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === dvEsperado;
}






// Existing setStatus function
function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = 'form-status' + (kind ? ' ' + kind : '');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Checkbox "Otro" ---
// Se puede combinar con opciones de la lista (ej: "Ingeniero Civil" + "Otro:
// Técnico Sanitario"). Al marcar "Otro" se bloquean las demás casillas para
// no seguir agregando mientras se escribe el texto, pero las que ya estaban
// marcadas NO se desmarcan — solo quedan congeladas hasta desmarcar "Otro".

function initOtroToggle(gridId, nombreCampo, otroCheckId, otroInputId) {
  const grid = document.getElementById(gridId);
  const otroCheck = document.getElementById(otroCheckId);
  const otroInput = document.getElementById(otroInputId);
  const otrasCheckboxes = () => Array.from(grid.querySelectorAll(`input[name="${nombreCampo}"]`));

  function actualizar() {
    otroInput.disabled = !otroCheck.checked;
    if (!otroCheck.checked) otroInput.value = '';
    otrasCheckboxes().forEach((cb) => { cb.disabled = otroCheck.checked; });
  }

  otroCheck.addEventListener('change', actualizar);
  actualizar();
}

// --- Teléfono: bandera-imagen + dropdown propio ---------------------------
// Devuelve la API pública ({ getPais, getLocal }) que usa initFormulario
// para leer el país elegido y el número local ya formateado.
function initTelefonoPais() {
  const campo = document.getElementById('tel-field');
  const boton = document.getElementById('telefono-flag-btn');
  const bandera = document.getElementById('telefono-flag-img');
  const input = document.getElementById('telefono');
  const lista = document.getElementById('telefono-dropdown');

  let pais = PAISES.find(([iso]) => iso === 'CL'); // [iso, dial, nombre]

  function aplicarPais([iso, dial, nombre]) {
    pais = [iso, dial, nombre];
    bandera.src = banderaUrl(iso);
    bandera.alt = nombre;
    boton.setAttribute('aria-label', `País: ${nombre} (+${dial}). Elegir otro.`);
  }

  function digitosLocales() {
    const digitos = input.value.replace(/\D/g, '');
    return digitos.startsWith(pais[1]) ? digitos.slice(pais[1].length) : digitos;
  }

  function refrescarInput() {
    const local = formatearTelefonoLocal(digitosLocales(), pais[1]);
    input.value = `+${pais[1]}${local ? ' ' + local : ' '}`;
  }

  function poblarLista() {
    for (const [iso, dial, nombre] of PAISES_ORDENADOS) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.iso = iso;
      li.innerHTML = `<img src="${banderaUrl(iso)}" alt=""><span class="tel-opt-nombre">${nombre}</span><span class="tel-opt-dial">+${dial}</span>`;
      li.addEventListener('click', () => {
        // Ojo: hay que sacar los dígitos locales usando el país VIEJO antes
        // de reasignar `pais` — si no, digitosLocales() compara contra el
        // código nuevo y no logra despegar el prefijo anterior del número.
        const localesPrevios = digitosLocales();
        aplicarPais([iso, dial, nombre]);
        const local = formatearTelefonoLocal(localesPrevios, dial);
        input.value = `+${dial}${local ? ' ' + local : ' '}`;
        cerrar();
        input.focus();
      });
      lista.appendChild(li);
    }
  }

  function abrir() {
    lista.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
  }
  function cerrar() {
    lista.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
  }

  boton.addEventListener('click', () => {
    lista.hidden ? abrir() : cerrar();
  });
  document.addEventListener('click', (e) => {
    if (!campo.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim() === '') refrescarInput();
  });
  input.addEventListener('input', refrescarInput);

  poblarLista();
  aplicarPais(pais);

  return {
    getDial: () => pais[1],
    getLocal: () => formatearTelefonoLocal(digitosLocales(), pais[1]),
    getFull: () => {
      const local = formatearTelefonoLocal(digitosLocales(), pais[1]);
      return local ? `+${pais[1]} ${local}` : '';
    },
  };
}

// --- Nacionalidad: mismo dropdown de países con bandera que el teléfono,
// reutilizando PAISES/PAISES_ORDENADOS/banderaUrl (nada de rehacer las
// banderas) — pero sin código de marcado, el valor guardado es el nombre
// del país. Chile queda como opción por defecto.
function initNacionalidadPais() {
  const campo = document.getElementById('nacionalidad-field');
  const boton = document.getElementById('nacionalidad-btn');
  const bandera = document.getElementById('nacionalidad-flag-img');
  const nombreEl = document.getElementById('nacionalidad-nombre');
  const hidden = document.getElementById('nacionalidad');
  const lista = document.getElementById('nacionalidad-dropdown');
  if (!campo || !boton || !bandera || !nombreEl || !hidden || !lista) return;

  function aplicarPais([iso, , nombre]) {
    hidden.value = nombre;
    bandera.src = banderaUrl(iso);
    bandera.alt = nombre;
    nombreEl.textContent = nombre;
    boton.setAttribute('aria-label', `Nacionalidad: ${nombre}. Elegir otra.`);
  }

  function abrir() {
    lista.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
  }
  function cerrar() {
    lista.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
  }

  function poblarLista() {
    for (const [iso, , nombre] of PAISES_ORDENADOS) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.iso = iso;
      li.innerHTML = `<img src="${banderaUrl(iso)}" alt=""><span class="tel-opt-nombre">${nombre}</span>`;
      li.addEventListener('click', () => {
        aplicarPais([iso, null, nombre]);
        cerrar();
        boton.focus();
      });
      lista.appendChild(li);
    }
  }

  boton.addEventListener('click', () => {
    lista.hidden ? abrir() : cerrar();
  });
  document.addEventListener('click', (e) => {
    if (!campo.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });

  poblarLista();
  aplicarPais(PAISES.find(([iso]) => iso === 'CL'));
}

// --- Licencia de conducir: dropdown propio con checkboxes (multi-choice) --
// Mismo look que el dropdown de país (.pais-field/.pais-btn/.tel-dropdown),
// pero cada opción es un checkbox. "No tiene" es excluyente con el resto,
// igual que el patrón "Otro" de initOtroToggle: al marcarla se deshabilitan
// las demás en vez de solo desmarcarlas.
function initLicenciaDropdown() {
  const campo = document.getElementById('licencia-field');
  const boton = document.getElementById('licencia-btn');
  const resumen = document.getElementById('licencia-resumen');
  const hidden = document.getElementById('licencia_conducir');
  const lista = document.getElementById('licencia-dropdown');
  if (!campo || !boton || !resumen || !hidden || !lista) return;

  const checkboxes = Array.from(lista.querySelectorAll('input[type="checkbox"]'));
  const noTiene = checkboxes.find((cb) => cb.value === 'No tiene');

  function actualizarResumen() {
    const marcadas = checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);
    hidden.value = marcadas.join(', ');
    resumen.textContent = marcadas.length ? marcadas.join(', ') : '-- Selecciona --';
  }

  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb === noTiene) {
        checkboxes.forEach((otra) => {
          if (otra === noTiene) return;
          otra.disabled = cb.checked;
          if (cb.checked) otra.checked = false;
        });
      } else if (cb.checked) {
        noTiene.checked = false;
      }
      actualizarResumen();
    });
  });

  function abrir() {
    lista.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
  }
  function cerrar() {
    lista.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
  }
  boton.addEventListener('click', () => {
    lista.hidden ? abrir() : cerrar();
  });
  document.addEventListener('click', (e) => {
    if (!campo.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });

  actualizarResumen();
}

// --- Dropzone de CV -------------------------------------------------------

function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const input = document.getElementById('cv_file');
  const idle = document.getElementById('dropzone-idle');
  const fileView = document.getElementById('dropzone-file');
  const filenameEl = document.getElementById('dropzone-filename');
  const removeBtn = document.getElementById('dropzone-remove');
  const errorEl = document.getElementById('error-cv');

  function mostrarArchivo(file) {
    filenameEl.textContent = `${file.name} · ${formatBytes(file.size)}`;
    idle.hidden = true;
    fileView.hidden = false;
    dropzone.dispatchEvent(new Event('cvchange'));
  }

  function limpiar() {
    cvFile = null;
    input.value = '';
    idle.hidden = false;
    fileView.hidden = true;
    // El CV es obligatorio: al sacarlo queda vacío de nuevo, así que se
    // vuelve a mostrar el aviso en vez de dejarlo en blanco.
    errorEl.textContent = 'Por favor adjunta tu CV.';
    dropzone.classList.add('has-error');
    dropzone.dispatchEvent(new Event('cvchange'));
  }

  function validarYAsignar(file) {
    if (!file) return;
    const tipoOk = CV_ACCEPTED_TYPES.includes(file.type) || CV_ACCEPTED_EXT.test(file.name);
    if (!tipoOk) {
      errorEl.textContent = 'Formato no admitido. Sube un PDF o Word (.pdf, .doc, .docx).';
      dropzone.classList.add('has-error');
      return;
    }
    if (file.size > CV_MAX_BYTES) {
      errorEl.textContent = `El archivo pesa ${formatBytes(file.size)}, el máximo es 8 MB.`;
      dropzone.classList.add('has-error');
      return;
    }
    errorEl.textContent = '';
    dropzone.classList.remove('has-error');
    cvFile = file;
    mostrarArchivo(file);
  }

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  input.addEventListener('change', () => {
    if (input.files && input.files[0]) validarYAsignar(input.files[0]);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) validarYAsignar(file);
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    limpiar();
  });
}

// --- Formulario -------------------------------------------------------

function initFormulario() {
  const form = document.getElementById('form-registro');
  const selectRegion = document.getElementById('region');
  const selectComuna = document.getElementById('comuna');
  const telefonoInput = document.getElementById('telefono');
  const telefonoPais = initTelefonoPais();
  const errorNombre = document.getElementById('error-nombre');
  const errorRut = document.getElementById('error-rut');
  const errorEmail = document.getElementById('error-email');
  const errorTelefono = document.getElementById('error-telefono');
  const errorCv = document.getElementById('error-cv');
  const errorConsentimiento = document.getElementById('error-consentimiento');
  const status = document.getElementById('form-status');
  const btnEnviar = document.getElementById('btn-enviar');

  selectRegion.addEventListener('change', () => {
    poblarComunas(selectComuna, selectRegion.value);
  });

  const dropzoneEl = document.getElementById('dropzone');
  const telField = document.getElementById('tel-field');
  const consentimientoLabel = form.consentimiento.closest('.checkbox');

  function marcar(el, invalido) {
    el.classList.toggle('campo-invalido', invalido);
  }

  // Botón "Enviar registro": no es un <button disabled> real (así el clic
  // igual dispara el submit y hace scroll al primer campo con problema),
  // pero pasa de gris-dorado apagado a dorado pleno a medida que se
  // completan los 3 mínimos: Nombre, Email y CV. El consentimiento queda
  // fuera de este cálculo a propósito: si falta, el botón ya se ve
  // "apretable" y el clic abre el modal de autorización en vez de seguir
  // luciendo incompleto.
  function actualizarBotonEnviar() {
    const condiciones = [
      form.nombre.value.trim() !== '',
      EMAIL_RE.test(form.email.value.trim()),
      !!cvFile,
    ];
    const completos = condiciones.filter(Boolean).length;
    const progreso = completos / condiciones.length;
    btnEnviar.style.setProperty('--progreso', String(progreso));
    btnEnviar.classList.toggle('cta--incompleto', progreso < 1);
  }

  // Nombre y Email: se marcan de entrada si están vacíos (los 4 mínimos
  // obligatorios — Nombre, Email, CV y Consentimiento — no esperan al
  // submit para avisar) y se revalidan en cada tecla, no solo al salir.
  function validarNombreAhora() {
    const vacio = form.nombre.value.trim() === '';
    marcar(form.nombre, vacio);
    errorNombre.textContent = vacio ? 'Por favor completa este campo.' : '';
    actualizarBotonEnviar();
  }

  function validarEmailAhora() {
    const valor = form.email.value.trim();
    if (valor === '') {
      marcar(form.email, true);
      errorEmail.textContent = 'Por favor completa este campo.';
      actualizarBotonEnviar();
      return;
    }
    const invalido = !EMAIL_RE.test(valor);
    marcar(form.email, invalido);
    errorEmail.textContent = invalido ? 'Formato de email inválido.' : '';
    actualizarBotonEnviar();
  }

  form.nombre.addEventListener('input', validarNombreAhora);
  form.email.addEventListener('input', validarEmailAhora);
  form.email.addEventListener('blur', validarEmailAhora);

  function validarRutAhora() {
    const rutTexto = form.rut.value.trim();
    const invalido = rutTexto !== '' && !validarRut(rutTexto);
    marcar(form.rut, invalido);
    errorRut.textContent = invalido ? 'RUT inválido. Formato: 12.345.678-9' : '';
  }
  form.rut.addEventListener('input', () => {
    form.rut.value = formatearRut(form.rut.value);
    if (errorRut.textContent) validarRutAhora();
  });
  form.rut.addEventListener('blur', validarRutAhora);

  function marcarCvVacio() {
    dropzoneEl.classList.add('has-error');
    errorCv.textContent = 'Por favor adjunta tu CV.';
  }
  dropzoneEl.addEventListener('cvchange', actualizarBotonEnviar);

  // Consentimiento: es el 4to campo realmente obligatorio (junto a Nombre,
  // Email y CV) — se marca y limpia en vivo igual que los otros.
  function validarConsentimientoAhora() {
    const invalido = !form.consentimiento.checked;
    if (consentimientoLabel) consentimientoLabel.classList.toggle('campo-invalido', invalido);
    errorConsentimiento.textContent = invalido ? 'Debes autorizar el uso de tus datos para continuar.' : '';
    actualizarBotonEnviar();
  }
  form.consentimiento.addEventListener('change', validarConsentimientoAhora);

  // Modal rápido de autorización: aparece solo cuando Nombre/Email/CV ya
  // están OK y lo único que falta es el check de la política de privacidad.
  const modalBackdrop = document.getElementById('consent-modal-backdrop');
  const modalAceptar = document.getElementById('consent-modal-accept');
  const modalCancelar = document.getElementById('consent-modal-cancel');
  const modalNewsletter = document.getElementById('consent-modal-newsletter');

  function abrirModalConsentimiento() {
    consentimientoLabel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    modalNewsletter.checked = false;
    modalBackdrop.hidden = false;
    modalAceptar.focus();
  }
  function cerrarModalConsentimiento() {
    modalBackdrop.hidden = true;
  }
  modalAceptar.addEventListener('click', () => {
    form.consentimiento.checked = true;
    form.newsletter.checked = modalNewsletter.checked;
    validarConsentimientoAhora();
    cerrarModalConsentimiento();
    form.requestSubmit();
  });
  modalCancelar.addEventListener('click', cerrarModalConsentimiento);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) cerrarModalConsentimiento();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.hidden) cerrarModalConsentimiento();
  });

  // Ícono junto al título del nav: reabre el mismo popup "Únete a nuestra
  // Red de Profesionales" que se muestra en index.html (y se autocierra a
  // los 4s), pero con X para cerrar y sin el botón Registrarme — por si
  // alguien no alcanzó a leerlo antes de que se cerrara solo.
  const infoReopenBtn = document.getElementById('info-reopen-btn');
  const infoReopenBackdrop = document.getElementById('info-reopen-modal-backdrop');
  const infoReopenClose = document.getElementById('info-reopen-modal-close');

  function abrirInfoReopen() {
    infoReopenBackdrop.hidden = false;
  }
  function cerrarInfoReopen() {
    infoReopenBackdrop.hidden = true;
    infoReopenBtn.focus();
  }
  if (infoReopenBtn && infoReopenBackdrop) {
    infoReopenBtn.addEventListener('click', abrirInfoReopen);
    infoReopenClose.addEventListener('click', cerrarInfoReopen);
    infoReopenBackdrop.addEventListener('click', (e) => {
      if (e.target === infoReopenBackdrop) cerrarInfoReopen();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !infoReopenBackdrop.hidden) cerrarInfoReopen();
    });
  }

  validarNombreAhora();
  validarEmailAhora();
  validarConsentimientoAhora();
  actualizarBotonEnviar();
  if (!cvFile) marcarCvVacio();

  // Teléfono: red flag apenas el usuario sale del campo, igual que el email.
  telefonoInput.addEventListener('blur', () => {
    const invalido = !telefonoEsValido(telefonoPais.getLocal(), telefonoPais.getDial());
    marcar(telField, invalido);
    errorTelefono.textContent = invalido ? 'Teléfono incompleto o inválido.' : '';
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorRut.textContent = '';
    errorEmail.textContent = '';
    errorTelefono.textContent = '';
    errorCv.textContent = '';
    errorConsentimiento.textContent = '';
    setStatus(status, '', '');

    // Honeypot: si un bot rellenó el campo oculto, se descarta en silencio.
    if (form.web.value.trim() !== '') {
      setStatus(status, 'Gracias por tu registro.', 'ok');
      form.reset();
      return;
    }

    validarNombreAhora();
    const nombreValido = form.nombre.value.trim() !== '';

    // RUT es opcional — si viene relleno igual se valida el formato.
    validarRutAhora();
    const rutTexto = form.rut.value.trim();
    const rutValido = rutTexto === '' || validarRut(rutTexto);

    validarEmailAhora();
    const emailValido = EMAIL_RE.test(form.email.value.trim());

    const telefonoValido = telefonoEsValido(telefonoPais.getLocal(), telefonoPais.getDial());
    if (!telefonoValido) errorTelefono.textContent = 'Teléfono incompleto o inválido.';
    marcar(telField, !telefonoValido);

    if (!cvFile) marcarCvVacio();
    else dropzoneEl.classList.remove('has-error');

    const rubrosSeleccionados = Array.from(form.querySelectorAll('input[name="rubros"]:checked')).map(el => el.value);
    const titulosSeleccionados = Array.from(form.querySelectorAll('input[name="titulos"]:checked')).map(el => el.value);

    // Nombre, RUT, Email, Teléfono y CV: si falta alguno, se hace scroll al
    // primero con problema (ya quedó marcado en rojo) y no se sigue.
    if (!nombreValido || !rutValido || !emailValido || !telefonoValido || !cvFile) {
      const primerInvalido = form.querySelector('.campo-invalido, .dropzone.has-error');
      primerInvalido?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Si todo lo demás está OK y solo falta el check de autorización, se
    // pregunta con un modal rápido en vez de solo marcarlo en rojo.
    if (!form.consentimiento.checked) {
      validarConsentimientoAhora();
      abrirModalConsentimiento();
      return;
    }

    const datos = {
      nombre: form.nombre.value.trim(),
      rut: rutTexto,
      email: form.email.value.trim(),
      telefono: telefonoPais.getFull(),
      region: selectRegion.value ? (selectRegion.options[selectRegion.selectedIndex]?.textContent || '') : '',
      region_id: selectRegion.value,
      comuna: selectComuna.value ? (selectComuna.options[selectComuna.selectedIndex]?.textContent || '') : '',
      comuna_id: selectComuna.value,
      fecha_nacimiento: form.fecha_nacimiento.value,
      nacionalidad: form.nacionalidad.value.trim(),
      licencia_conducir: form.licencia_conducir.value,
      titulo_otro: form.titulo_otro.value.trim(),
      anios_experiencia: form.anios_experiencia.value,
      rubro_otro: form.rubro_otro.value.trim(),
      cv_link: form.cv_link.value.trim(),
      chileproveedores: form.chileproveedores.value,
      registro_consultores: form.registro_consultores.value,
      patente_profesional: form.patente_profesional.value,
      mensaje: form.mensaje.value.trim(),
      consentimiento: form.consentimiento.checked ? 'true' : 'false',
      newsletter: form.newsletter.checked ? 'true' : 'false',
      web: form.web.value,
    };

    const body = new FormData();
    for (const [key, value] of Object.entries(datos)) body.append(key, value);
    for (const rubro of rubrosSeleccionados) body.append('rubros', rubro);
    for (const titulo of titulosSeleccionados) body.append('titulos', titulo);
    if (cvFile) body.append('cv_file', cvFile, cvFile.name);

    btnEnviar.disabled = true;
    setStatus(status, 'Enviando...', '');

    try {
      const res = await fetch(WORKER_URL, { method: 'POST', body });
      if (!res.ok) {
        const respBody = await res.json().catch(() => ({}));
        throw new Error(respBody.error || `Error del servidor (HTTP ${res.status})`);
      }
      setStatus(status, '¡Gracias! Recibimos tu registro y te contactaremos cuando surja un proyecto para tu rubro.', 'ok');
      form.reset();
      poblarComunas(selectComuna, '');
      cvFile = null;
      document.getElementById('dropzone-idle').hidden = false;
      document.getElementById('dropzone-file').hidden = true;
      document.getElementById('titulo_otro_check').dispatchEvent(new Event('change'));
      document.getElementById('rubro_otro_check').dispatchEvent(new Event('change'));
    } catch (err) {
      setStatus(status, `No se pudo enviar el registro: ${err.message}`, 'error');
    } finally {
      btnEnviar.disabled = false;
    }
  });
}

// Nombre, Email y RUT deben quedar primero, antes de Documentos (donde
// está el CV) y recién después el resto de "Datos de contacto" (Teléfono,
// Región, Comuna, etc.) — igual en mobile y en desktop. Se logra moviendo
// nodos del DOM en vez de con CSS order/grid, porque el fieldset "Datos de
// contacto" usa un grid de 3 columnas en desktop y separarlo en dos
// rompería esa grilla (al sacar justo 3 campos quedan 6 en el grid
// original, o sea 2 filas completas — no se rompe).
function initOrdenCampos() {
  const fieldsetDatos = document.getElementById('fieldset-datos-contacto');
  const fieldsetDocumentos = document.getElementById('fieldset-documentos');
  const grid = fieldsetDatos?.querySelector('.form-grid');
  const campoNombre = document.getElementById('nombre')?.closest('.field');
  const campoEmail = document.getElementById('email')?.closest('.field');
  const campoRut = document.getElementById('rut')?.closest('.field');
  if (!fieldsetDatos || !fieldsetDocumentos || !grid || !campoNombre || !campoEmail || !campoRut) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-grid form-section campos-basicos';
  wrapper.appendChild(campoNombre);
  wrapper.appendChild(campoEmail);
  wrapper.appendChild(campoRut);

  const parent = fieldsetDatos.parentNode;
  parent.insertBefore(wrapper, fieldsetDatos);
  parent.insertBefore(fieldsetDocumentos, fieldsetDatos);
}

(function main() {
  if (!localidades) {
    setStatus(document.getElementById('form-status'), 'No se pudieron cargar las regiones (data/localidades.js no se cargó).', 'error');
  } else {
    poblarRegiones(document.getElementById('region'));
  }
  initDropzone();
  initOtroToggle('titulos-grid', 'titulos', 'titulo_otro_check', 'titulo_otro');
  initOtroToggle('rubros-grid', 'rubros', 'rubro_otro_check', 'rubro_otro');
  initFormulario();
  initNacionalidadPais();
  initLicenciaDropdown();
  initOrdenCampos();
})();
