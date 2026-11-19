// Marks the current section in the header menu and adds a hairline under the header once you scroll.
// The page works fully without this file; it only adds orientation.
(() => {
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.sections');
  const links = [...document.querySelectorAll('.sections a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = null;

  // Scroll only the chip row sideways. Never use scrollIntoView here: on phones it also
  // scrolls the page, which interrupts momentum scrolling and makes the page jump.
  const revealChip = (a) => {
    if (menu.scrollWidth <= menu.clientWidth) return;
    const left = a.offsetLeft - menu.offsetLeft;
    const right = left + a.offsetWidth;
    if (left >= menu.scrollLeft && right <= menu.scrollLeft + menu.clientWidth) return;
    menu.scrollTo({ left: Math.max(0, left - 16), behavior: reduce ? 'auto' : 'smooth' });
  };

  // Altimeter ticks: place each at its section's share of the page height (desktop only, CSS hides it elsewhere).
  const ticks = [...document.querySelectorAll('.altimeter a')];
  const placeTicks = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max <= 0) return;
    for (const a of ticks) {
      const s = document.querySelector(a.getAttribute('href'));
      if (s) a.style.top = `${Math.min(100, Math.max(0, (s.offsetTop - 80) / max * 100))}%`;
    }
  };
  placeTicks();
  addEventListener('load', placeTicks);
  addEventListener('resize', placeTicks);

  const markCurrent = (id) => {
    if (id === current) return;
    current = id;
    for (const a of ticks) a.setAttribute('aria-current', a.getAttribute('href') === `#${id}` ? 'true' : 'false');
    for (const a of links) {
      const on = a.getAttribute('href') === `#${id}`;
      a.setAttribute('aria-current', on ? 'true' : 'false');
      if (on) revealChip(a);
    }
  };

  // A section is current while it crosses a thin band 30% down the viewport.
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) markCurrent(e.target.id);
  }, { rootMargin: '-30% 0px -69% 0px' });
  sections.forEach((s) => spy.observe(s));

  // The last section is short and may never reach that band, so mark it once the footer shows.
  const footer = document.querySelector('.site-footer');
  const last = sections[sections.length - 1];
  if (footer) new IntersectionObserver(([e]) => { if (e.isIntersecting) markCurrent(last.id); }).observe(footer);

  const top = document.getElementById('top');
  // The header turns solid after the first 120px of scroll, so the receding hero never shows through it.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:120px;left:0;width:1px;height:1px;pointer-events:none';
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => header.classList.toggle('scrolled', !e.isIntersecting)).observe(sentinel);

  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      current = null;
      links.forEach((a) => a.setAttribute('aria-current', 'false'));
    }
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(top);
})();
