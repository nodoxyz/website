# Website — NodoXYZ

Landing simple de una sola página. Sin build step, sin dependencias:
`index.html` + `styles.css`, se abre directo en el navegador.

## Estado

Borrador de diseño — dorado sutil sobre negro, tipografía serif
(Playfair Display) para el título y sans (Inter) para el resto. El
contenido de texto (hero, "Nosotros") es placeholder marcado con
comentarios `<!-- -->` en el HTML — falta reemplazarlo por la
descripción real de la empresa.

## Editar

Abrir `index.html` y `styles.css` con cualquier editor. Colores y
tipografía están como variables CSS al principio de `styles.css`
(`:root`) para cambiarlos en un solo lugar.

## Deploy

Conectado a Cloudflare Pages (proyecto `nodoxyz`, dominios `nodoxyz.cl`
y `www.nodoxyz.cl`) vía integración con Git: cada push a `main` dispara
un deploy automático de todo el repo (sin build command, output en la
raíz). `worker/` y `worker-lead/` quedan servidos como archivos
estáticos más junto con el resto — no es un problema de seguridad (no
tienen secretos, ya son públicos en GitHub), pero no se ejecutan como
Worker ahí; esos se despliegan aparte con
`npx wrangler deploy --name <nombre>` desde cada carpeta (ver sus
README.md).

## Caché: versión en la URL de cada CSS y JS (04-11-2026)

Cloudflare entrega los `.css` y `.js` con 4 horas de caché en el navegador: lo fija el ajuste
"Browser Cache TTL" de la zona nodoxyz.cl, que pisa lo que diga `_headers`. Si se publica un cambio
de `styles.css` o de un script sin cambiar su URL, quien ya visitó el sitio ve el HTML nuevo con la
hoja o el script anterior (así faltó la línea de los datos de cada proyecto el 04-11-2026).

**Regla:** al cambiar `styles.css` o un archivo de `js/` o `data/`, sube el `?v=AAAAMMDD` de su
enlace en todas las páginas (`index.html`, `profesionales.html`, `legal/*.html`). Si alguien deja
la zona en "Respect Existing Headers" (Caching > Configuration > Browser Cache TTL), `_headers` ya
pide revalidar siempre y la versión en la URL deja de ser necesaria.

Antes de publicar: `NODE_PATH="C:/Users/NodoXYZ/AppData/Local/hermes/node/node_modules" node _verificar-diseno.cjs`
mide desbordes, alineación de proyectos y texto en una línea en las cuatro páginas, en claro y oscuro.
