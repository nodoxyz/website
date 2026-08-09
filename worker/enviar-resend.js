// Envío del correo de confirmación de registro vía Resend.
// Pensado para un Cloudflare Worker: RESEND_API_KEY va como secret.
// La plantilla HTML se importa como texto (wrangler soporta `import html from "./correo-registro-nodoxyz.html"`
// con la regla de módulo Text, o pégala aquí como template literal).

import plantillaHtml from "./correo-registro-nodoxyz.html";

const REMITENTE = "Ingeniería NodoXYZ <contacto@nodoxyz.cl>";
const RESPUESTA = "contacto@nodoxyz.cl";
const ASUNTO = "Recibimos tu registro — Red de Profesionales NodoXYZ";

function textoPlano(nombre) {
  return `Hola ${nombre}:

Gracias por registrarte en la Red de Profesionales de Ingeniería NodoXYZ Limitada.
Recibimos correctamente tu registro y tu currículum.

Revisaremos tu experiencia y especialidad para asociar tu perfil a los tipos de
licitaciones y proyectos en los que puedas aportar mayor valor.

QUÉ SIGUE

Cuando identifiquemos una licitación o proyecto compatible con tu perfil, nos
pondremos en contacto contigo para compartir la información correspondiente.
En ese momento te indicaremos:

  - Mandante
  - Alcance del servicio
  - Plazos
  - Condiciones de participación

La invitación y cualquier solicitud de antecedentes adicionales se realizarán
antes de presentar tu perfil al proceso correspondiente.

NUESTRO COMPROMISO

Tu información es tratada exclusivamente para los fines descritos. No
presentaremos tu CV en una licitación ni lo compartiremos con terceros sin tu
autorización expresa para ese proceso en particular.

ACTUALIZAR TUS DATOS

Si obtienes nuevas certificaciones o cambia tu situación laboral, envía una
nueva versión de tu información desde https://nodoxyz.cl/profesionales
La nueva versión reemplazará a la anterior en nuestra base de profesionales.

TUS DATOS PERSONALES

El responsable del tratamiento es Ingeniería NodoXYZ Limitada, RUT 78.471.316-4.
Puedes solicitar el acceso, rectificación o eliminación de tus datos escribiendo
a contacto@nodoxyz.cl. Si solicitas tu baja de la red, eliminaremos tu CV y tus
datos de nuestra base.

Gracias por formar parte de la Red de Profesionales NodoXYZ.
Esperamos contar contigo en futuros proyectos.

Equipo NodoXYZ

--
INGENIERÍA NODOXYZ LIMITADA
RUT 78.471.316-4
https://nodoxyz.cl · https://www.linkedin.com/company/nodoxyz · contacto@nodoxyz.cl

Recibes este correo porque registraste tus antecedentes en nodoxyz.cl.
Para dejar de recibir nuestras comunicaciones informativas, escríbenos a
contacto@nodoxyz.cl`;
}

export async function enviarConfirmacion({ email, nombre }, env) {
  const saludo = (nombre || "").trim() || "";
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
