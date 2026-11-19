// The hero's contour map: a smooth height field drawn as topographic lines (marching squares),
// with every fifth line heavier, like index contours on a survey map. Moving the mouse raises a
// hill under it and the lines flow around it. Nothing runs on its own: it redraws only while the
// pointer moves or the hill settles. Touch devices and reduced motion get one still drawing.
(() => {
  const band = document.querySelector('.hero-band');
  if (!band) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'terrain';
  canvas.setAttribute('aria-hidden', 'true');
  band.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const live = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CELL = 14;          // grid spacing in CSS px
  const LEVELS = 22;        // number of contour lines
  const color = getComputedStyle(document.documentElement).getPropertyValue('--sky').trim() || '#E9C46A';

  let w = 0, h = 0, cols = 0, rows = 0, field = new Float32Array(0);
  let hill = { x: 0.72, y: 0.4, k: 0 };          // current hill: position (fractions) and height
  let target = { x: 0.72, y: 0.4, k: 0 };
  let frame = 0;

  // Fixed terrain: a few broad ridges and basins, seeded so it looks the same on every visit.
  const terrain = (x, y) =>
    0.55 * Math.sin(x * 2.1 + 0.6) * Math.cos(y * 1.7 - 0.3) +
    0.35 * Math.sin(x * 3.7 - y * 2.3 + 1.9) +
    0.22 * Math.cos(x * 5.3 + y * 4.1 - 0.7) +
    0.9 * Math.exp(-((x - 2.4) ** 2 + (y - 0.9) ** 2) / 0.55) -
    0.7 * Math.exp(-((x - 0.8) ** 2 + (y - 1.7) ** 2) / 0.8);

  function size() {
    const r = band.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL) + 1; rows = Math.ceil(h / CELL) + 1;
    field = new Float32Array(cols * rows);
  }

  function sample() {
    const sx = 3.2 / Math.max(w, 1), hx = hill.x * w, hy = hill.y * h, spread = (Math.min(w, 900) * 0.16) ** 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const px = i * CELL, py = j * CELL;
        const d2 = (px - hx) ** 2 + (py - hy) ** 2;
        field[j * cols + i] = terrain(px * sx, py * sx) + hill.k * Math.exp(-d2 / spread);
      }
    }
  }

  // Marching squares: for each level, add the segment that crosses each grid cell.
  function draw() {
    sample();
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    const lo = -1.8, hi = 2.4;
    for (let l = 1; l < LEVELS; l++) {
      const v = lo + ((hi - lo) * l) / LEVELS;
      const index = l % 5 === 0;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = field[j * cols + i], b = field[j * cols + i + 1];
          const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
          const code = (a > v ? 8 : 0) | (b > v ? 4 : 0) | (c > v ? 2 : 0) | (d > v ? 1 : 0);
          if (code === 0 || code === 15) continue;
          const x = i * CELL, y = j * CELL;
          const t = (p, q) => (v - p) / (q - p);
          const top = [x + CELL * t(a, b), y], right = [x + CELL, y + CELL * t(b, c)];
          const bottom = [x + CELL * t(d, c), y + CELL], left = [x, y + CELL * t(a, d)];
          const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
          switch (code) {
            case 1: case 14: seg(left, bottom); break;
            case 2: case 13: seg(bottom, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(top, right); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, top); break;
            case 5: seg(left, top); seg(bottom, right); break;
            case 10: seg(top, right); seg(left, bottom); break;
          }
        }
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = index ? 0.42 : 0.16;
      ctx.lineWidth = index ? 1.4 : 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function step() {
    // Ease toward the pointer; stop the loop once settled.
    hill.x += (target.x - hill.x) * 0.12;
    hill.y += (target.y - hill.y) * 0.12;
    hill.k += (target.k - hill.k) * 0.08;
    draw();
    const moving = Math.abs(target.x - hill.x) + Math.abs(target.y - hill.y) + Math.abs(target.k - hill.k) > 0.002;
    frame = moving ? requestAnimationFrame(step) : 0;
  }
  const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

  size(); draw();
  band.classList.add('has-terrain');

  if (live) {
    band.addEventListener('pointermove', (e) => {
      const r = band.getBoundingClientRect();
      target = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, k: 2.6 };
      kick();
    });
    band.addEventListener('pointerleave', () => { target = { ...target, k: 0 }; kick(); });
  }

  let resizeTimer, lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { size(); draw(); }, 150);
  });
})();
