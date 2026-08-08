/**
 * Worker que recibe leads del widget de contacto guiado (js/chat-widget-guiado.js
 * en nodoxyz.cl) y los guarda en Cloudflare KV (namespace LEADS). Sigue el
 * mismo patrón que Website/worker/profesionales-worker.js (KV, honeypot,
 * x-admin-key para lectura), pero agrega validación Turnstile server-side:
 * este formulario es público y sin fricción (sin registro/login ni CV
 * adjunto que filtre bots por sí solo), más expuesto a spam que el de
 * profesionales.
 *
 * Rutas:
 *   POST /lead   — público. JSON. Valida Turnstile + honeypot + campos del
 *                  flujo guiado (ver PROYECTO — Formulario de contacto
 *                  guiado), guarda un lead nuevo.
 *   GET  /leads  — protegido con header "x-admin-key". Devuelve todos los
 *                  leads (los consume el script de pull hacia Nucleo/Leads/,
 *                  ver Fase 3).
 *
 * Seguridad:
 *   - Turnstile validado server-side contra siteverify. Si el token falta
 *     o la verificación falla, se descarta la solicitud (400) — nunca se
 *     confía en un flag "verificado" mandado desde el cliente.
 *   - Honeypot: campo oculto "web" que un bot llena y un humano nunca ve —
 *     si viene relleno, se responde 200 (para no delatar el filtro) pero
 *     no se guarda nada.
 *   - CORS restringido a un solo origen fijo (https://nodoxyz.cl), sin
 *     comodín ni excepciones de localhost/preview — a diferencia de
 *     profesionales-worker.js, que sí las tiene. Esto es intencional (ver
 *     brief, "Requisitos de seguridad": "CORS solo https://nodoxyz.cl.
 *     Nunca *") y significa que probar este endpoint abriendo el HTML por
 *     doble clic (file://) o desde un preview *.pages.dev no funcionará.
 *   - Rate limiting por IP: NO está en este archivo. Se configura en el
 *     dashboard de Cloudflare (Security → WAF → Rate limiting rules) para
 *     la ruta /lead — así lo pide el brief ("antes del Worker"). Pendiente
 *     de configurar a mano, ver README.md de esta carpeta.
 *   - Retención/borrado de leads no convertidos: todavía sin definir (ver
 *     Fase 4 del brief). Por ahora los leads no expiran solos en KV.
 *
 * Despliegue:
 *   cd Website/worker-lead
 *   npx --yes wrangler@latest kv namespace create LEADS
 *   # copiar el id que imprime a wrangler.toml
 *   npx --yes wrangler@latest secret put ADMIN_KEY --name nodoxyz-lead-widget
 *   npx --yes wrangler@latest secret put TURNSTILE_SECRET --name nodoxyz-lead-widget
 *   npx --yes wrangler@latest deploy lead-worker.js --name nodoxyz-lead-widget
 */

const ALLOWED_ORIGIN = 'https://nodoxyz.cl';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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

// Líneas de negocio válidas para el Paso 1 (ver brief, "Ramas del paso 1").
const RAMAS_VALIDAS = new Set([
  'ingenieria_civil',
  'construccion',
  'inspeccion',
  'tasaciones',
  'regularizacion',
  'informacion',
  'otro',
]);

// Estas 2 ramas saltan Paso 2 (contexto) y Paso 3 (documentos) y van
// directo a Paso 4 (comuna) — ver brief, "Flujo del formulario".
const RAMAS_SIN_PASO2 = new Set(['informacion', 'otro']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_RE = /^[0-9+\-\s()]{6,}$/;

function esContactoValido(valor) {
  const v = String(valor || '').trim();
  return EMAIL_RE.test(v) || TELEFONO_RE.test(v);
}

async function verificarTurnstile(token, ip, secret) {
  if (!token || !secret) return false;
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders();
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (!env.LEADS) {
      return json({ error: 'KV no configurado (falta el binding LEADS).' }, 500, headers);
    }

    if (url.pathname === '/lead' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Body inválido (se esperaba JSON).' }, 400, headers);
      }

      // Honeypot: si el campo oculto viene relleno, es un bot. Se responde
      // "ok" para no delatar el filtro, pero no se guarda nada.
      if (body.web && String(body.web).trim() !== '') {
        return json({ ok: true }, 200, headers);
      }

      if (!env.TURNSTILE_SECRET) {
        return json({ error: 'Turnstile no configurado (falta el secret TURNSTILE_SECRET).' }, 500, headers);
      }
      const ip = request.headers.get('CF-Connecting-IP');
      const turnstileOk = await verificarTurnstile(body.turnstileToken, ip, env.TURNSTILE_SECRET);
      if (!turnstileOk) {
        return json({ error: 'Verificación anti-bot fallida.' }, 400, headers);
      }

      const rama = String(body.rama || '').trim();
      const errores = [];
      if (!RAMAS_VALIDAS.has(rama)) errores.push('rama');
      if (!RAMAS_SIN_PASO2.has(rama) && String(body.contexto || '').trim() === '') errores.push('contexto');
      if (!body.comuna || String(body.comuna).trim() === '') errores.push('comuna');
      if (!body.nombre || String(body.nombre).trim().length < 3) errores.push('nombre');
      if (!esContactoValido(body.contacto)) errores.push('contacto');

      if (errores.length > 0) {
        return json({ error: 'Campos inválidos o faltantes.', campos: errores }, 400, headers);
      }

      const id = `lead_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const lead = {
        id,
        estado: 'nuevo',
        creado: new Date().toISOString(),
        rama,
        contexto: String(body.contexto || '').trim(),
        documentos: Array.isArray(body.documentos) ? body.documentos.slice(0, 20).map(String) : [],
        comuna: String(body.comuna).trim(),
        mensaje: String(body.mensaje || '').trim().slice(0, 2000),
        nombre: String(body.nombre).trim(),
        contacto: String(body.contacto).trim(),
      };

      await env.LEADS.put(id, JSON.stringify(lead));
      return json({ ok: true, id }, 201, headers);
    }

    if (url.pathname === '/leads' && request.method === 'GET') {
      if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
        return json({ error: 'No autorizado.' }, 401, headers);
      }
      const leads = [];
      let cursor;
      do {
        const list = await env.LEADS.list({ cursor, limit: 1000 });
        cursor = list.cursor;
        for (const key of list.keys) {
          const value = await env.LEADS.get(key.name);
          if (value) leads.push(JSON.parse(value));
        }
        if (list.list_complete) break;
      } while (cursor);

      leads.sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
      return json({ ok: true, total: leads.length, leads }, 200, headers);
    }

    return json({ error: 'Not found' }, 404, headers);
  },
};
