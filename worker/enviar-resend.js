// Envío del correo de confirmación de registro vía Resend.
// Pensado para un Cloudflare Worker: RESEND_API_KEY va como secret.
// La plantilla se importa como texto (regla de módulo Text en wrangler.toml)
// o se pega aquí como template literal.

import plantillaHtml from "./correo-registro-nodoxyz-dorado.html";

const REMITENTE = "Ingeniería NodoXYZ <contacto@nodoxyz.cl>";
const RESPUESTA = "contacto@nodoxyz.cl";
const ASUNTO = "Registro recibido — Red de Profesionales NodoXYZ";

function textoPlano(nombre) {
  return `Hola ${nombre}:

Tu currículum ya está en la Red de Profesionales de Ingeniería NodoXYZ.
No necesitas hacer nada más por ahora.

Cuando una licitación o proyecto coincida con tu perfil, te contactaremos con los
requerimientos técnicos y las condiciones de participación.

Tu CV no se presenta en ninguna licitación ni se comparte con terceros sin tu
autorización expresa para ese proceso en particular.

Síguenos en LinkedIn: https://www.linkedin.com/company/nodoxyz
Mantente al tanto de nuestros proyectos y del rubro.

Equipo NodoXYZ

--
¿Nuevas certificaciones? Envía una versión actualizada en
https://nodoxyz.cl/profesionales y reemplazará a la anterior.

INGENIERÍA NODOXYZ LIMITADA · RUT 78.471.316-4
Responsable del tratamiento de tus datos. Para acceder, rectificar o eliminar
tu información, escribe a contacto@nodoxyz.cl
Política de privacidad: https://nodoxyz.cl/legal/privacidad.html

Recibes este correo porque registraste tus antecedentes en
https://nodoxyz.cl/profesionales
Para dejar de recibir comunicaciones informativas, escríbenos a
contacto@nodoxyz.cl`;
}

export async function enviarConfirmacion({ email, nombre }, env) {
  const saludo = (nombre || "").trim();
  const html = plantillaHtml.replaceAll("{{nombre}}", saludo);

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [email],
      reply_to: RESPUESTA,
      subject: ASUNTO,
      html,
      text: textoPlano(saludo),
      headers: {
        "List-Unsubscribe": "<mailto:contacto@nodoxyz.cl?subject=Baja>",
      },
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`Resend ${respuesta.status}: ${await respuesta.text()}`);
  }

  return respuesta.json();
}
