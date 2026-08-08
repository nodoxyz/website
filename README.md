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
