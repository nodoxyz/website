/**
 * Middleware de Cloudflare Pages: www.nodoxyz.cl redirige (301) a nodoxyz.cl, con la misma ruta.
 *
 * Hasta el 04-11-2026, www servía el sitio directo y el botón "Consulta aquí" fallaba ahí: el
 * Worker de leads solo acepta envíos desde https://nodoxyz.cl. Con un solo dominio, además,
 * los buscadores y la analítica no lo cuentan dos veces.
 */
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname === 'www.nodoxyz.cl') {
    url.hostname = 'nodoxyz.cl';
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
