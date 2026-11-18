// Dithered photos: each figure[data-dither] gets a canvas over its <img>, drawn with Atkinson
// dithering in two colors (the page navy and Columbia Blue). Hover fades the canvas to show the
// real photo. Touch devices skip this and keep the color photo; nothing here is needed to read the page.
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const DARK = [10, 15, 28];      // --bg
  const LIGHT = [185, 217, 235];  // Columbia Blue
  const PIXEL = 2.5;              // CSS px per dither dot

  function draw(figure) {
    const img = figure.querySelector('img');
    const box = figure.getBoundingClientRect();
    if (!img.naturalWidth || !box.width) return;
    const w = Math.max(40, Math.round(box.width / PIXEL));
    const h = Math.max(40, Math.round(box.height / PIXEL));

    let canvas = figure.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      figure.append(canvas);
    }
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Cover-crop like object-fit: cover, honouring the image's object-position.
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) * (isNaN(px) ? 0.5 : px), (h - dh) * (isNaN(py) ? 0.5 : py), dw, dh);

    const data = ctx.getImageData(0, 0, w, h);
    const lum = new Float32Array(w * h);
    let lo = 255, hi = 0;
    for (let i = 0; i < w * h; i++) {
      const v = 0.2126 * data.data[i * 4] + 0.7152 * data.data[i * 4 + 1] + 0.0722 * data.data[i * 4 + 2];
      lum[i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    // Stretch contrast so dark studio photos still read as a face, not a blob.
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < lum.length; i++) lum[i] = ((lum[i] - lo) / span) * 255 * 1.08;

    // Atkinson: spread 1/8 of the error to six neighbours.
    const spread = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const out = lum[i] < 128 ? 0 : 255;
        const err = (lum[i] - out) / 8;
        lum[i] = out;
        for (const [dx, dy] of spread) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny < h) lum[ny * w + nx] += err;
        }
        const c = out ? LIGHT : DARK;
        data.data.set([c[0], c[1], c[2], 255], i * 4);
      }
    }
    ctx.putImageData(data, 0, 0);
    figure.classList.add('is-dithered');
  }

  const figures = [...document.querySelectorAll('[data-dither]')];
  const ready = (f) => {
    const img = f.querySelector('img');
    (img.complete ? Promise.resolve() : img.decode().catch(() => {})).then(() => draw(f));
  };
  // Draw each photo when it comes near the screen, not all at load.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { ready(e.target); io.unobserve(e.target); }
  }, { rootMargin: '300px 0px' });
  figures.forEach((f) => io.observe(f));

  // Redraw only when the window gets wider or narrower, not when the page grows taller.
  let t, lastWidth = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(t);
    t = setTimeout(() => figures.filter((f) => f.classList.contains('is-dithered')).forEach(draw), 200);
  });
})();
