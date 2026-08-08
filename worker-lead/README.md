# Worker — widget de contacto guiado (leads)

Recibe el POST del widget de chat guiado (`js/chat-widget-guiado.js`, Fase 2)
y guarda cada lead en Cloudflare KV (namespace `LEADS`). Mismo patrón que
`Website/worker/profesionales-worker.js` (KV, honeypot, `x-admin-key` para
lectura), con una diferencia importante: este formulario es público y sin
fricción (nadie sube un CV que ya filtre bots por sí solo), así que además
valida **Turnstile** en el servidor antes de guardar nada.

## Estado: desplegado y probado (31 julio 2026)

- URL: `https://nodoxyz-lead-widget.admin-nodoxyz.workers.dev`
- KV namespace `LEADS` creado y enlazado en `wrangler.toml`.
- Widget de Turnstile creado vía API para el dominio `nodoxyz.cl` (modo
  `managed`) — site key y secret key en `Conexion/credenciales.md`. El
  site key (público) todavía no está incrustado en ningún HTML — eso es
  Fase 2.
- Secrets `ADMIN_KEY` y `TURNSTILE_SECRET` cargados en el Worker.
- Probado end-to-end con `curl`: honeypot descarta en silencio (200 sin
  guardar), falta de `turnstileToken` rechaza con 400, `GET /leads` exige
  `x-admin-key` correcta (401 sin ella, 200 con ella).

Pendiente:

- **Fase 2**: el widget real en el sitio (HTML/JS/CSS), con el site key de
  Turnstile embebido — sin eso, nadie puede generar un `turnstileToken`
  válido y `POST /lead` seguirá rechazando todo con 400.
- **Rate limiting por IP** — no está en este archivo. Se configura en el
  dashboard de Cloudflare: Security → WAF → Rate limiting rules, sobre la
  ruta del Worker (`/lead`). El código no lo implementa porque el brief
  pide que corra "antes del Worker", a nivel de Cloudflare — queda
  pendiente de configurar a mano.

Para volver a desplegar tras cambios en `lead-worker.js`:

```
cd Website/worker-lead
npx --yes wrangler@latest deploy lead-worker.js --name nodoxyz-lead-widget
```

## Rutas

| Ruta | Método | Acceso | Qué hace |
|---|---|---|---|
| `/lead` | POST | Público | Valida Turnstile + honeypot + campos, guarda un lead nuevo en KV |
| `/leads` | GET | `x-admin-key` | Devuelve todos los leads (los va a consumir el script de pull hacia `Nucleo/Leads/`, Fase 3) |

## Body esperado en `POST /lead`

```json
{
  "turnstileToken": "...",
  "web": "",
  "rama": "ingenieria_civil | construccion | inspeccion | tasaciones | regularizacion | informacion | otro",
  "contexto": "texto del botón elegido en Paso 2 (vacío si la rama es informacion u otro)",
  "documentos": ["..."],
  "comuna": "texto",
  "mensaje": "texto libre, opcional",
  "nombre": "texto",
  "contacto": "email o teléfono"
}
```

`web` es el honeypot (mismo nombre de campo que usa `profesionales.html`,
por consistencia — debe quedar oculto en el widget y nunca completarse por
un humano).

## CORS: solo `https://nodoxyz.cl`

A diferencia de `profesionales-worker.js` (que acepta también previews de
`*.pages.dev` y `localhost` para pruebas), este Worker **no tiene ninguna
excepción** — así lo pide el brief explícitamente ("CORS solo
https://nodoxyz.cl. Nunca *"). Esto significa que:

- Abrir el widget con doble clic (`file://`) no va a poder mandar el POST.
- Un preview deploy de Cloudflare Pages (`*.nodoxyz.pages.dev`) tampoco.
- Para probar en local hay que servir el sitio desde el dominio real o
  ajustar esto temporalmente (y revertirlo antes de desplegar a producción).

## Pendiente de decisión (Fase 4)

Retención y borrado de leads no convertidos — la Ley 21.719 rige desde el
01-12-2026. Por ahora los leads guardados en KV **no expiran solos**. Una
vez que se defina el plazo, se puede usar `expirationTtl` en el
`env.LEADS.put(...)` para que Cloudflare los borre automáticamente.
