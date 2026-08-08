/**
 * Worker que recibe el formulario "Regístrate como profesional" de
 * Website/profesionales.html y guarda cada postulación en Cloudflare KV
 * (namespace REGISTROS) y el CV adjunto, si lo hay, en un segundo
 * namespace de KV (CVFILES) — se usó KV en vez de R2 porque R2 no estaba
 * habilitado en la cuenta (requiere activarlo a mano en el dashboard) y KV
 * ya estaba disponible; para el volumen esperado (archivos ≤ 8 MB, cientos
 * de registros) KV rinde perfectamente bien.
 *
 * Rutas:
 *   POST /registro    — público. Acepta JSON o multipart/form-data (cuando
 *                        hay CV adjunto). Valida y guarda un registro nuevo.
 *   GET  /registros    — protegido con header "x-admin-key". Devuelve todos
 *                        los registros (los consume el dashboard local en
 *                        Agentes/Nodo Profesionales/).
 *   GET  /cv/<key>      — protegido con header "x-admin-key". Descarga el
 *                        CV guardado para un registro.
 *
 * Despliegue (ver README.md en esta carpeta para el detalle paso a paso):
 *   cd Website/worker
 *   npx --yes wrangler@latest kv namespace create REGISTROS
 *   npx --yes wrangler@latest kv namespace create CVFILES
 *   # copiar los ids a wrangler.toml
 *   npx --yes wrangler@latest secret put ADMIN_KEY --name nodoxyz-registro-profesionales
 *   npx --yes wrangler@latest deploy profesionales-worker.js --name nodoxyz-registro-profesionales
 */

// Orígenes permitidos para el POST público del formulario.
// 'null' cubre pruebas locales abriendo profesionales.html con doble clic (file://).
const ALLOWED_ORIGINS = [
  'https://nodoxyz.cl',
  'https://www.nodoxyz.cl',
  'https://nodoxyz.pages.dev',
  'null',
];

const isAllowedOrigin = (origin) =>
  ALLOWED_ORIGINS.includes(origin) ||
  /^http:\/\/localhost:\d+$/.test(origin) ||
  /^https:\/\/[a-z0-9-]+\.nodoxyz\.pages\.dev$/.test(origin);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://nodoxyz.cl',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Validación de RUT chileno (módulo 11), igual a la del formulario.
function rutValido(rutRaw) {
  const rut = String(rutRaw || '').replace(/[.\s]/g, '').toUpperCase();
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_RE = /^[0-9+\-\s()]+$/;
const CV_MAX_BYTES = 8 * 1024 * 1024;
const CV_ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function sanitizeFilename(name) {
  return String(name || 'cv').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

// cv_link es texto libre de un formulario publico y despues se pinta como
// href en el dashboard interno. Un `javascript:...` ahi correria con acceso a
// todos los registros cargados, no solo al de quien lo escribio. El input es
// type="url", pero eso no descarta esquemas peligrosos ni se valida solo en
// el servidor: solo se aceptan http y https.
function urlSegura(valor) {
  const url = String(valor || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

// Extrae los campos del formulario desde JSON o multipart/form-data (con
// archivo). rubros y titulos llegan repetidos (una entrada por checkbox marcado).
async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';
  const fields = {};
  let file = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        if (key === 'cv_file' && value.size > 0) file = value;
      } else if (key === 'rubros' || key === 'titulos') {
        fields[key] = fields[key] || [];
        fields[key].push(value);
      } else {
        fields[key] = value;
      }
    }
  } else {
    const body = await request.json();
    Object.assign(fields, body);
  }
  return { fields, file };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (!env.REGISTROS) {
      return json({ error: 'KV no configurado (falta el binding REGISTROS).' }, 500, headers);
    }

    if (url.pathname === '/registro' && request.method === 'POST') {
      let fields, file;
      try {
        ({ fields, file } = await parseBody(request));
      } catch {
        return json({ error: 'Body inválido (se esperaba JSON o multipart/form-data).' }, 400, headers);
      }

      // Honeypot: si el campo oculto viene relleno, es un bot. Se responde
      // "ok" para no delatar el filtro, pero no se guarda nada.
      if (fields.web && String(fields.web).trim() !== '') {
        return json({ ok: true }, 200, headers);
      }

      // RUT, región/comuna, títulos y rubros son opcionales — si viene un
      // RUT o teléfono igual se les exige formato válido. El CV es obligatorio.
      const errores = [];
      if (!fields.nombre || String(fields.nombre).trim().length < 3) errores.push('nombre');
      if (fields.rut && String(fields.rut).trim() !== '' && !rutValido(fields.rut)) errores.push('rut');
      if (!fields.email || !EMAIL_RE.test(fields.email)) errores.push('email');
      if (fields.telefono && String(fields.telefono).trim() !== '' && !TELEFONO_RE.test(fields.telefono)) errores.push('telefono');
      if (fields.consentimiento !== true && fields.consentimiento !== 'true') errores.push('consentimiento');
      if (!file) {
        errores.push('cv_file');
      } else {
        if (file.size > CV_MAX_BYTES) errores.push('cv_file_size');
        if (file.type && !CV_ALLOWED_TYPES.has(file.type)) errores.push('cv_file_type');
      }

      if (errores.length > 0) {
        return json({ error: 'Campos inválidos o faltantes.', campos: errores }, 400, headers);
      }

      const id = `reg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const registro = {
        id,
        estado: 'nuevo',
        creado: new Date().toISOString(),
        nombre: String(fields.nombre).trim(),
        rut: String(fields.rut || '').trim(),
        email: String(fields.email).trim(),
        telefono: String(fields.telefono || '').trim(),
        region: String(fields.region || '').trim(),
        region_id: String(fields.region_id || '').trim(),
        comuna: String(fields.comuna || '').trim(),
        comuna_id: String(fields.comuna_id || '').trim(),
        fecha_nacimiento: String(fields.fecha_nacimiento || '').trim(),
        nacionalidad: String(fields.nacionalidad || '').trim(),
        licencia_conducir: String(fields.licencia_conducir || ''),
        titulos: Array.isArray(fields.titulos) ? fields.titulos.slice(0, 20) : [],
        titulo_otro: String(fields.titulo_otro || '').trim(),
        anios_experiencia: String(fields.anios_experiencia || '').trim(),
        rubros: Array.isArray(fields.rubros) ? fields.rubros.slice(0, 20) : [],
        rubro_otro: String(fields.rubro_otro || '').trim(),
        cv_link: urlSegura(fields.cv_link),
        chileproveedores: String(fields.chileproveedores || ''),
        registro_consultores: String(fields.registro_consultores || ''),
        patente_profesional: String(fields.patente_profesional || ''),
        mensaje: String(fields.mensaje || '').trim().slice(0, 2000),
        newsletter: fields.newsletter === true || fields.newsletter === 'true',
        cv_file_key: null,
        cv_file_name: null,
        cv_file_size: null,
      };

      if (file) {
        if (!env.CVFILES) {
          return json({ error: 'Almacenamiento de CV no configurado (falta el binding CVFILES).' }, 500, headers);
        }
        const key = `${id}/${sanitizeFilename(file.name)}`;
        await env.CVFILES.put(key, await file.arrayBuffer(), {
          metadata: { contentType: file.type || 'application/octet-stream', filename: file.name },
        });
        registro.cv_file_key = key;
        registro.cv_file_name = file.name;
        registro.cv_file_size = file.size;
      }

      await env.REGISTROS.put(id, JSON.stringify(registro));
      return json({ ok: true, id }, 201, headers);
    }

    if (url.pathname === '/registros' && request.method === 'GET') {
      if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
        return json({ error: 'No autorizado.' }, 401, headers);
      }
      const registros = [];
      let cursor;
      do {
        const list = await env.REGISTROS.list({ cursor, limit: 1000 });
        cursor = list.cursor;
        for (const key of list.keys) {
          const value = await env.REGISTROS.get(key.name);
          if (value) registros.push(JSON.parse(value));
        }
        if (list.list_complete) break;
      } while (cursor);

      registros.sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
      return json({ ok: true, total: registros.length, registros }, 200, headers);
    }

    if (url.pathname.startsWith('/cv/') && request.method === 'GET') {
      if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
        return json({ error: 'No autorizado.' }, 401, headers);
      }
      if (!env.CVFILES) {
        return json({ error: 'Almacenamiento de CV no configurado (falta el binding CVFILES).' }, 500, headers);
      }
      const key = decodeURIComponent(url.pathname.slice('/cv/'.length));
      const { value, metadata } = await env.CVFILES.getWithMetadata(key, 'arrayBuffer');
      if (!value) return json({ error: 'No encontrado.' }, 404, headers);
      const respHeaders = new Headers(headers);
      respHeaders.set('Content-Type', metadata?.contentType || 'application/octet-stream');
      respHeaders.set('Content-Disposition', `attachment; filename="${sanitizeFilename(metadata?.filename || key.split('/').pop())}"`);
      return new Response(value, { headers: respHeaders });
    }

    return json({ error: 'Not found' }, 404, headers);
  },
};
