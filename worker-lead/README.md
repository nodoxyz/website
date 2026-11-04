# Worker — widget de contacto guiado (leads)

Recibe el POST del widget de chat guiado (`js/chat-widget-guiado.js`)
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
  site key (público) ya está incrustado en `index.html` (Fase 2, ver abajo).
- Secrets `ADMIN_KEY` y `TURNSTILE_SECRET` cargados en el Worker.
- Probado end-to-end con `curl`: honeypot descarta en silencio (200 sin
  guardar), falta de `turnstileToken` rechaza con 400, `GET /leads` exige
  `x-admin-key` correcta (401 sin ella, 200 con ella).
- **Fase 2 (widget real en el sitio) construida**: `js/chat-widget-guiado.js`
  + el modal en `index.html` (botón "Consulta aquí" del hero). Lee las
  ramas/contexto de `data/bot-config.js` (exportado desde
  `Agentes/Consulta Aqui/`, ver el README de esa carpeta para publicar un
  cambio de flujo). **Ojo**: por el CORS cerrado a `https://nodoxyz.cl`
  exacto (ver abajo), el envío real solo se puede probar en el sitio
  desplegado — no local, no `file://`, no preview de `*.pages.dev`.

Pendiente:

- **Verificar el envío real en producción** una vez desplegado este cambio
  (push a `main`): completar el flujo en `nodoxyz.cl` y confirmar que el
  lead aparece en `Agentes/Consulta Aqui/` tras `python actualizar.py`.
- **Mandar los documentos de respaldo por correo** — el widget no tiene
  (todavía) el paso de elegir documentos, y `lead-worker.js` no envía
  correos. Ver "Fuera de alcance" en el README de `Agentes/Consulta Aqui/`.
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

## Aviso al equipo por correo (04-11-2026)

Cada lead nuevo se avisa por correo con `../worker/aviso-equipo.js` (Resend), el mismo módulo
que avisa los registros de profesionales. El destinatario está en `AVISO_PARA` de
`wrangler.toml` (varios, separados por coma) y "Responder" le contesta a quien escribió. Para que
salga, este Worker necesita su propio secret: `npx --yes wrangler@latest secret put RESEND_API_KEY --name nodoxyz-lead-widget`.
Sin el secret el lead se guarda igual y el aviso no sale.
