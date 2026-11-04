/**
 * tema.js: modo claro u oscuro del sitio.
 *
 * Se carga en el <head> sin defer, para fijar data-theme en <html> antes de pintar la página
 * (sin el parpadeo de un tema al otro). Si la persona eligió un tema con el botón, se respeta
 * y queda guardado en localStorage; si no eligió, se sigue el tema del sistema operativo y se
 * actualiza solo cuando este cambia. Los colores de cada tema están en styles.css (:root).
 */
(function () {
  var CLAVE = 'nodoxyz_tema';
  var raiz = document.documentElement;
  var sistemaOscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function elegido() {
    try {
      var t = localStorage.getItem(CLAVE);
      return t === 'dark' || t === 'light' ? t : null;
    } catch (e) {
      return null;
    }
  }

  function delSistema() {
    return sistemaOscuro && sistemaOscuro.matches ? 'dark' : 'light';
  }

  function aplicar(tema) {
    raiz.setAttribute('data-theme', tema);
    var botones = document.querySelectorAll('.tema-btn');
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-pressed', String(tema === 'dark'));
    }
  }

  aplicar(elegido() || delSistema());

  if (sistemaOscuro && sistemaOscuro.addEventListener) {
    sistemaOscuro.addEventListener('change', function () {
      if (!elegido()) aplicar(delSistema());
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    aplicar(raiz.getAttribute('data-theme'));
    var botones = document.querySelectorAll('.tema-btn');
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener('click', function () {
        var nuevo = raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(CLAVE, nuevo); } catch (e) { /* sin almacenamiento, vale solo para esta visita */ }
        aplicar(nuevo);
      });
    }
  });
})();
