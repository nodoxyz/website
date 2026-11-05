/**
 * metricas.js: Microsoft Clarity sin cookies de nodoxyz.cl, solo en la página de inicio.
 * Da mapas de calor de clics y desplazamiento, tiempo en la página y reproducciones de la visita.
 *
 * Sin cookies de nodoxyz.cl: se le avisa a Clarity desde el primer momento que no hay consentimiento
 * (consentv2 con analytics_Storage "denied"), así que asigna un id por visita (_cltk, en sessionStorage)
 * y no escribe cookies en el dominio del sitio (learn.microsoft.com/clarity/setup-and-installation/
 * clarity-consent-api-v2). Medido el 05-11-2026 en Chrome: igual quedan cookies de terceros de Microsoft
 * en clarity.ms y bing.com (MUID, CLID, MR, SM, ANONCHK), que la política declara. En el panel
 * de Clarity, además, va activado Settings > Setup > Consent Mode. Lo que se escribe en el chat
 * queda oculto (data-clarity-mask en #chat-panel) y el formulario de profesionales no carga
 * este archivo. Todo esto lo describe la sección 7 de legal/privacidad.html: si cambia, se
 * actualiza la política.
 *
 * Mientras CLARITY_ID esté vacío no se carga nada. El id sale de clarity.microsoft.com, en el
 * proyecto de nodoxyz.cl (Settings > Overview > Project ID).
 */
(function () {
  var CLARITY_ID = 'z8q4zbelem';
  if (!CLARITY_ID || location.hostname !== 'nodoxyz.cl') return;

  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };
  window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.clarity.ms/tag/' + CLARITY_ID;
  document.head.appendChild(s);
})();
