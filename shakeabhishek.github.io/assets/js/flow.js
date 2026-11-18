// The About section: text set in columns that flow around circles you can drag, re-wrapping live.
// Pretext (assets/vendor/pretext, MIT) measures the text without touching layout, so each drag
// frame is pure arithmetic: for every line we subtract what the circles cover at that height and
// fill the gaps that are left. Without JavaScript the plain paragraphs show instead.
const flow = document.querySelector('[data-flow]');

if (flow) {
  // Load the layout library only when the section is about to be seen.
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const pretext = await import('../vendor/pretext/layout.js');
    start(pretext);
  }, { rootMargin: '600px 0px' });
  io.observe(flow);
}

async function start({ prepareWithSegments, layoutNextLineRange, materializeLineRange }) {
  const source = flow.querySelector('.flow-source');
  const linesEl = flow.querySelector('.flow-lines');
  const orbs = [...flow.querySelectorAll('.orb')];
  const paragraphs = [...source.querySelectorAll('p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());

  const PAD = 14;        // breathing room between text and a circle
  const MIN_SEG = 96;    // skip slivers narrower than this, so no gap holds a lone word
  const GAP = 48;        // gutter between columns
  let font, lineHeight, prepared, cols, colW, width, height = 0, spans = [];

  function readType() {
    const cs = getComputedStyle(source.querySelector('p'));
    const size = Math.round(parseFloat(cs.fontSize));
    const next = `${cs.fontWeight} ${size}px Geist`;
    lineHeight = Math.round(parseFloat(cs.lineHeight));
    if (next !== font) {
      font = next;
      prepared = paragraphs.map((t) => prepareWithSegments(t, font));
    }
  }

  // Circles: position stored as a fraction of the box so they survive resizes. Narrow screens start
  // them near the edges (data-mx/my) so the single column flows down one side instead of splitting.
  const narrow = () => flow.clientWidth < 600;
  const home = (el) => narrow() && el.dataset.mx ? [parseFloat(el.dataset.mx), parseFloat(el.dataset.my)] : [parseFloat(el.dataset.x), parseFloat(el.dataset.y)];
  const state = orbs.map((el) => { const [fx, fy] = home(el); return { el, fx, fy, r: 0, moved: false }; });
  let wasNarrow = narrow();
  const radius = (o) => o.el.offsetWidth / 2;

  function route(H) {
    const out = [];
    let p = 0, cursor = undefined, firstLine = true;
    const circles = state.map((o) => ({ cx: o.fx * width, cy: o.fy * H, r: o.r + PAD }));
    for (let c = 0; c < cols && p < prepared.length; c++) {
      const x0 = c * (colW + GAP), x1 = x0 + colW;
      for (let y = 0; y + lineHeight <= H && p < prepared.length; y += lineHeight) {
        // Blocked spans at this line's height, merged, then the free gaps between them.
        const blocked = [];
        for (const { cx, cy, r } of circles) {
          const dy = cy < y ? y - cy : cy > y + lineHeight ? cy - (y + lineHeight) : 0;
          if (dy >= r) continue;
          const hw = Math.sqrt(r * r - dy * dy);
          blocked.push([cx - hw, cx + hw]);
        }
        blocked.sort((a, b) => a[0] - b[0]);
        const free = [];
        let at = x0;
        for (const [a, b] of blocked) {
          if (b <= at) continue;
          if (a > at) free.push([at, Math.min(a, x1)]);
          at = Math.max(at, b);
          if (at >= x1) break;
        }
        if (at < x1) free.push([at, x1]);

        for (let [a, b] of free) {
          if (p >= prepared.length) break;
          // First line of each paragraph after the first is indented, magazine style.
          const indent = firstLine && p > 0 ? 28 : 0;
          if (b - a - indent < MIN_SEG) continue;
          const segW = Math.floor(b - a - indent);
          const range = layoutNextLineRange(prepared[p], segW, cursor);
          if (range === null) { p++; cursor = undefined; firstLine = true; break; }
          // A gap narrower than the full column that would split a word mid-way is skipped;
          // the word waits for the next gap. Only a full-width line may break a word.
          if (range.end.graphemeIndex > 0 && segW < colW - indent) continue;
          out.push({ x: a + indent, y, text: materializeLineRange(prepared[p], range).text });
          cursor = range.end; firstLine = false;
          // A finished paragraph ends its line; the next one starts fresh on the line below.
          if (layoutNextLineRange(prepared[p], 10000, cursor) === null) { p++; cursor = undefined; firstLine = true; break; }
        }
      }
    }
    return { lines: out, done: p >= prepared.length };
  }

  function render() {
    readType();
    width = Math.floor(flow.clientWidth);
    // Crossing the phone/desktop width resets circles you haven't moved to that layout's spots.
    if (narrow() !== wasNarrow) {
      wasNarrow = narrow();
      state.forEach((o) => { if (!o.moved) [o.fx, o.fy] = home(o.el); });
    }
    cols = width >= 900 ? 2 : 1;
    colW = Math.floor((width - GAP * (cols - 1)) / cols);
    state.forEach((o) => { o.r = radius(o); });

    // Find the shortest height that fits all the text, never shrinking while you drag.
    let H = Math.max(height || 0, 320);
    let result = route(H);
    if (!dragging) {
      H = 320; result = route(H);
      while (!result.done && H < 6000) { H += lineHeight; result = route(H); }
      H += lineHeight;
      result = route(H);
    } else {
      while (!result.done && H < 6000) { H += lineHeight; result = route(H); }
    }
    height = H;
    flow.style.height = `${H}px`;

    // Reuse line elements; only their text and position change per frame.
    while (spans.length < result.lines.length) { const s = document.createElement('span'); linesEl.append(s); spans.push(s); }
    spans.forEach((s, i) => {
      const line = result.lines[i];
      if (!line) { s.textContent = ''; return; }
      s.textContent = line.text;
      s.style.transform = `translate(${line.x}px, ${line.y}px)`;
    });
    state.forEach((o) => {
      o.el.style.transform = `translate(${o.fx * width - o.r}px, ${o.fy * H - o.r}px)`;
    });
  }

  let frame = 0, dragging = null;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); };
  const clamp = (o) => {
    o.fx = Math.min(1 - o.r / width, Math.max(o.r / width, o.fx));
    o.fy = Math.min(1 - o.r / height, Math.max(o.r / height, o.fy));
  };

  for (const o of state) {
    o.el.addEventListener('pointerdown', (e) => {
      if (dragging) return;
      const box = flow.getBoundingClientRect();
      dragging = { o, id: e.pointerId, dx: e.clientX - (box.left + o.fx * width), dy: e.clientY - (box.top + o.fy * height) };
      o.el.setPointerCapture(e.pointerId);
      o.el.classList.add('dragging'); o.moved = true;
    });
    o.el.addEventListener('pointermove', (e) => {
      if (!dragging || dragging.id !== e.pointerId) return;
      const box = flow.getBoundingClientRect();
      o.fx = (e.clientX - dragging.dx - box.left) / width;
      o.fy = (e.clientY - dragging.dy - box.top) / height;
      clamp(o); schedule();
    });
    const end = (e) => {
      if (!dragging || dragging.id !== e.pointerId) return;
      dragging = null; o.el.classList.remove('dragging');
    };
    o.el.addEventListener('pointerup', end);
    o.el.addEventListener('pointercancel', end);
    // Keyboard: arrow keys move a focused circle.
    o.el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 64 : 16;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault(); o.moved = true;
      o.fx += d[0] / width; o.fy += d[1] / height; clamp(o); schedule();
    });
  }

  // Measure with the real web font, not the fallback.
  await document.fonts.load(`400 19px Geist`, paragraphs.join(' '));
  flow.classList.add('is-live');
  render();
  let resizeTimer;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!dragging) render(); }, 100); }).observe(flow.parentElement);
}
