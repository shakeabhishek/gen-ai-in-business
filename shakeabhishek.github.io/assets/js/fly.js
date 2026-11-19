// NeuroHex panel: a 3D point-cloud fly (flybody, Apache-2.0) with the Giant Fiber neuron
// (Virtual Fly Brain, CC BY 4.0) drawn inside it. The fly turns to follow the mouse, and a spike
// runs down the Giant Fiber when you point at the panel, the escape reflex NeuroHex is built on.
// It redraws only while something is moving. Touch devices and reduced motion get one still view.
// Without JavaScript the panel shows assets/img/giant-fiber.svg instead.
(() => {
  const figure = document.querySelector('.neuron-visual');
  if (!figure) return;
  const panel = figure.closest('.panel');
  const live = matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    fetch('assets/data/neurohex-fly.json').then((r) => r.json()).then(start).catch(() => {});
  }, { rootMargin: '400px' });
  io.observe(figure);

  function start(data) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'fly';
    figure.prepend(canvas);
    figure.classList.add('has-fly');
    const ctx = canvas.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const sand = css.getPropertyValue('--sky').trim() || '#E9C46A';
    const bone = css.getPropertyValue('--slate').trim() || '#E6E1D3';

    // Points in fly space: x head(+) to tail(-), y left/right, z up. Scaled to about +-1.
    const toPts = (a) => { const out = new Float32Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] / 1000; return out; };
    const body = toPts(data.body), gf = toPts(data.gf), parent = data.gfParent, spike = data.spike;
    const nb = body.length / 3, ng = gf.length / 3;
    const pb = new Float32Array(nb * 3), pg = new Float32Array(ng * 3);   // projected x, y, depth

    let w = 0, h = 0, scale = 1, cx = 0, cy = 0;
    const view = { yaw: -0.55, pitch: 0.42 };          // three-quarter view, head to the right
    let yaw = view.yaw, pitch = view.pitch, tYaw = yaw, tPitch = pitch;
    let pulse = -1, frame = 0;

    function size() {
      const r = figure.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2; cy = h * 0.5; scale = Math.min(w, h) * 0.56;
    }

    function project(src, dst, n) {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (let i = 0; i < n; i++) {
        const x = src[3 * i], y = src[3 * i + 1], z = src[3 * i + 2];
        const x1 = x * cyw - y * syw, y1 = x * syw + y * cyw;
        const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
        const persp = 3 / (3 + y2);
        dst[3 * i] = cx + x1 * scale * persp;
        dst[3 * i + 1] = cy - z2 * scale * persp;
        dst[3 * i + 2] = y2;
      }
    }

    function draw() {
      project(body, pb, nb);
      project(gf, pg, ng);
      ctx.clearRect(0, 0, w, h);

      // Body: fine dots, nearer ones brighter.
      ctx.fillStyle = bone;
      for (let i = 0; i < nb; i++) {
        const d = pb[3 * i + 2];
        ctx.globalAlpha = 0.12 + 0.38 * (1 - (d + 1) / 2);
        ctx.fillRect(pb[3 * i] - 0.6, pb[3 * i + 1] - 0.6, 1.2, 1.2);
      }

      // Giant Fiber: the tree as lines.
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = sand;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < ng; i++) {
        const p = parent[i];
        if (p < 0) continue;
        ctx.moveTo(pg[3 * p], pg[3 * p + 1]);
        ctx.lineTo(pg[3 * i], pg[3 * i + 1]);
      }
      ctx.stroke();

      // The spike: a glow travelling from the dendrites down the axon.
      if (pulse >= 0) {
        const at = Math.min(spike.length - 1, Math.floor(pulse * (spike.length - 1)));
        const k = spike[at];
        const x = pg[3 * k], y = pg[3 * k + 1];
        const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
        g.addColorStop(0, 'rgba(255, 248, 225, 0.95)');
        g.addColorStop(0.35, 'rgba(233, 196, 106, 0.55)');
        g.addColorStop(1, 'rgba(233, 196, 106, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function step() {
      yaw += (tYaw - yaw) * 0.08;
      pitch += (tPitch - pitch) * 0.08;
      if (pulse >= 0) { pulse += 0.018; if (pulse > 1) pulse = -1; }
      draw();
      const moving = Math.abs(tYaw - yaw) + Math.abs(tPitch - pitch) > 0.0008 || pulse >= 0;
      frame = moving ? requestAnimationFrame(step) : 0;
    }
    const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

    size(); draw();
    if (!live) return;

    // Follow the mouse anywhere on the page, while the panel is on screen.
    let onScreen = true;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(figure);
    addEventListener('pointermove', (e) => {
      if (!onScreen) return;
      const r = figure.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
      tYaw = view.yaw + nx * 0.9;
      tPitch = view.pitch + ny * 0.35;
      kick();
    }, { passive: true });
    panel.addEventListener('pointerenter', () => { if (pulse < 0) { pulse = 0; kick(); } });

    let t, lastW = innerWidth;
    addEventListener('resize', () => {
      if (innerWidth === lastW) return;
      lastW = innerWidth; clearTimeout(t);
      t = setTimeout(() => { size(); draw(); }, 150);
    });
  }
})();
