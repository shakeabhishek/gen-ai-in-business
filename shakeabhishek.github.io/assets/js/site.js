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

  const markCurrent = (id) => {
    if (id === current) return;
    current = id;
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
  new IntersectionObserver(([e]) => {
    header.classList.toggle('scrolled', !e.isIntersecting);
    if (e.isIntersecting) {
      current = null;
      links.forEach((a) => a.setAttribute('aria-current', 'false'));
    }
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(top);
})();
