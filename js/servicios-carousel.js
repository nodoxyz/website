(function () {
  const grid = document.querySelector('.servicios .grid');
  const dotsWrap = document.getElementById('servicios-dots');
  if (!grid || !dotsWrap) return;

  const cards = Array.from(grid.children);
  const dots = Array.from(dotsWrap.children);
  const mq = window.matchMedia('(max-width: 640px)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let timer = null;

  function render() {
    grid.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('activo', i === index));
  }

  function goTo(i) {
    index = (i + cards.length) % cards.length;
    render();
  }

  function next() {
    goTo(index + 1);
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startAuto() {
    stopAuto();
    if (reduceMotion) return;
    timer = setInterval(next, 2800);
  }

  function enableCarousel() {
    grid.style.transition = 'transform 0.4s ease';
    render();
    startAuto();
  }

  function disableCarousel() {
    stopAuto();
    grid.style.transform = '';
    grid.style.transition = '';
  }

  grid.addEventListener('click', () => {
    if (!mq.matches) return;
    next();
    startAuto();
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      if (!mq.matches) return;
      goTo(Number(dot.dataset.i));
      startAuto();
    });
  });

  function sync() {
    if (mq.matches) enableCarousel();
    else disableCarousel();
  }

  mq.addEventListener('change', sync);
  sync();
})();
