// Marks the current section in the header menu and adds a hairline under the header once you scroll.
// The page works fully without this file; it only adds orientation.
(() => {
  const header = document.querySelector('.site-header');
  const links = [...document.querySelectorAll('.sections a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;

  const markCurrent = (id) => {
    for (const a of links) {
      const on = a.getAttribute('href') === `#${id}`;
      a.setAttribute('aria-current', on ? 'true' : 'false');
      // Keep the active chip visible in the horizontally scrolling menu on phones.
      if (on && a.parentElement.scrollWidth > a.parentElement.clientWidth) {
        a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  };

  // A section is current while it crosses a thin band 30% down the viewport.
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) markCurrent(e.target.id);
  }, { rootMargin: '-30% 0px -69% 0px' });
  sections.forEach((s) => spy.observe(s));

  const top = document.getElementById('top');
  new IntersectionObserver(([e]) => {
    header.classList.toggle('scrolled', !e.isIntersecting);
    if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', 'false'));
  }, { rootMargin: '-80px 0px 0px 0px' }).observe(top);
})();
