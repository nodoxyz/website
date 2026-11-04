// Aviso interno al equipo de NodoXYZ por Resend: lo usan los dos Workers del sitio.
//   - profesionales-worker.js, cuando alguien se registra como profesional;
//   - ../worker-lead/lead-worker.js, cuando alguien termina el flujo del botón flotante.
// Necesita el secret RESEND_API_KEY en cada Worker. El destinatario sale de la variable
// AVISO_PARA de su wrangler.toml (si falta, contacto@nodoxyz.cl). El correo responde a quien
// escribió, así que "Responder" le contesta directo a esa persona.
// Todo lo que llega del formulario se escapa antes de ir al HTML.

const REMITENTE = "Avisos nodoxyz.cl <contacto@nodoxyz.cl>";
const PARA_POR_DEFECTO = "contacto@nodoxyz.cl";

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * @param {{ asunto: string, titulo: string, filas: Array<[string, string]>, responderA?: string, pie?: string }} aviso
 * @param {{ RESEND_API_KEY?: string, AVISO_PARA?: string }} env
 */
export async function avisarEquipo({ asunto, titulo, filas, responderA, pie }, env) {
  if (!env.RESEND_API_KEY) return;
  const para = String(env.AVISO_PARA || PARA_POR_DEFECTO).split(",").map((s) => s.trim()).filter(Boolean);
  const visibles = filas.filter(([, v]) => String(v ?? "").trim() !== "");

  const html = `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b0b0c;max-width:560px">
<p style="font-size:11px;letter-spacing:.18em;color:#6e5a80;margin:0 0 6px">NODO · XYZ</p>
<h1 style="font-size:20px;font-weight:400;margin:0 0 16px">${escapar(titulo)}</h1>
<table style="border-collapse:collapse;width:100%;font-size:14px">
${visibles.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;border-top:1px solid #b4a6c0;color:#6e5a80;font-size:11px;letter-spacing:.12em;vertical-align:top;white-space:nowrap">${escapar(k).toUpperCase()}</td><td style="padding:7px 0;border-top:1px solid #b4a6c0;white-space:pre-wrap">${escapar(v)}</td></tr>`).join("\n")}
</table>
${pie ? `<p style="font-size:12px;color:#706a79;margin:16px 0 0">${escapar(pie)}</p>` : ""}
</div>`;
  const texto = `${titulo}\n\n${visibles.map(([k, v]) => `${k}: ${v}`).join("\n")}${pie ? `\n\n${pie}` : ""}`;

  const cuerpo = { from: REMITENTE, to: para, subject: asunto, html, text: texto };
  if (responderA && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responderA)) cuerpo.reply_to = responderA;

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) throw new Error(`Resend ${respuesta.status}: ${await respuesta.text()}`);
}
