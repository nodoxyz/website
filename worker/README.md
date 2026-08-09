# Worker — registro de profesionales

Recibe el POST de `Website/profesionales.html` (JSON o `multipart/form-data`
cuando hay CV adjunto) y guarda cada postulación en Cloudflare KV. El CV, si
lo hay, se guarda en un segundo namespace de KV (`CVFILES`) — se usó KV en
vez de R2 porque R2 no estaba habilitado en la cuenta (hay que activarlo a
mano en el dashboard de Cloudflare; si en algún momento se quiere migrar a
R2 para archivos más grandes, ese es el paso pendiente). El dashboard local
en `Agentes/Nodo Profesionales/` lee todo esto vía `GET /registros` y
`GET /cv/<key>`.

## Estado: ya desplegado

- URL pública: `https://nodoxyz-registro-profesionales.admin-nodoxyz.workers.dev`
- KV namespace `REGISTROS` (datos del formulario): id `92e72bbbf65e49fc89dc39ffe5e9ed9f`
- KV namespace `CVFILES` (archivos de CV, ≤ 8 MB c/u): id `37ced3def8cd47b4ad0733dd8ddf61ab`
- Secreto `ADMIN_KEY` ya configurado (el valor vive en
  `Agentes/Nodo Profesionales/config.local.json`, que no está en git — si se
  pierde, hay que generar uno nuevo con `wrangler secret put ADMIN_KEY` y
  actualizar `config.local.json`).
- `Website/js/registro.js` (`WORKER_URL`) y
  `Agentes/Nodo Profesionales/config.local.json` ya apuntan a esta URL.

Probado end-to-end con `curl` (POST /registro con archivo adjunto vía
multipart, guarda en ambos namespaces de KV; GET /registros y GET /cv/<key>
con `x-admin-key` los devuelven correctamente) — los datos de prueba se
borraron después.

## Correo de agradecimiento

Tras guardar el registro en KV, el Worker manda un correo de agradecimiento
a la persona que se registró, desde `contacto@nodoxyz.cl` (ya enrutado por
Cloudflare Email Routing hacia `admin.nodoxyz@gmail.com` — si alguien
responde, llega). Es best-effort: `enviarCorreoAgradecimiento` en
`profesionales-worker.js` envuelve el envío en try/catch — si falla, el
registro igual queda guardado y la respuesta sigue siendo `201`, el error
solo se loggea (`wrangler tail`).

El envío en sí vive en dos archivos aparte:
- `enviar-resend.js` — arma el asunto y el texto plano, y llama a la API de
  **Resend** (`fetch` directo a `api.resend.com`, sin dependencias/SDK).
- `correo-registro-nodoxyz.html` — la plantilla HTML (tabla, email-safe),
  con `{{nombre}}` como placeholder. Se importa como texto plano gracias a
  la regla de módulo `Text` en `wrangler.toml` (`rules = [{ type = "Text",
  globs = ["**/*.html"] }]`) — sigue siendo un deploy de archivo único, sin
  build step propio, Wrangler resuelve el import al empaquetar.

Se descartó el binding nativo de Cloudflare (`send_email`/Email Sending)
porque requiere el plan **Workers Paid** (US$5/mes); Resend tiene plan
gratis (3.000 emails/mes) y no depende del plan de Cloudflare.

- Cuenta en resend.com (login `admin.nodoxyz@gmail.com`), dominio
  `nodoxyz.cl` agregado y **verificado** (SPF/DKIM en un subdominio
  `send.nodoxyz.cl` para no tocar el SPF que ya usa Cloudflare Email
  Routing en la raíz).
- Secret `RESEND_API_KEY` ya cargado (`wrangler secret put RESEND_API_KEY`
  — si se pierde, generar uno nuevo en resend.com → API Keys).

## Actualizar el Worker tras cambios

```
npx --yes wrangler@latest deploy profesionales-worker.js --name nodoxyz-registro-profesionales
```

## Nota sobre costos

Cloudflare Workers y KV tienen plan gratuito (100.000 requests/día en
Workers, lecturas/escrituras de KV con cuota generosa) — para el volumen
esperado de un formulario de registro esto no debería generar costo.
