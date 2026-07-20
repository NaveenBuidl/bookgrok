const PRESETS_MIN = [1, 3, 5];
const DEFAULT_MIN = 5;
const SVG_NS = 'http://www.w3.org/2000/svg';

const HOURGLASS_W = 140;
const HOURGLASS_H = 190;
const NECK_Y = HOURGLASS_H / 2;
const NECK_HALF_W = 5;
const BULB_INSET = 20;
const CAP_H = 9;
const MAX_SAND_H = NECK_Y - CAP_H - 8;
const HOURGLASS_RENDER_W = 84;

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// A bulging bulb outline: wide at the cap, curving inward to the narrow neck.
// `dir` is 1 for the top bulb (wide edge at top) or -1 for the bottom bulb (wide edge at bottom).
function bulbPath(dir) {
  const wideY = dir === 1 ? 4 : HOURGLASS_H - 4;
  const neckY = NECK_Y;
  const wideLeftX = BULB_INSET;
  const wideRightX = HOURGLASS_W - BULB_INSET;
  const neckLeftX = HOURGLASS_W / 2 - NECK_HALF_W;
  const neckRightX = HOURGLASS_W / 2 + NECK_HALF_W;
  const bulge = 14 * dir;
  return [
    `M ${wideLeftX} ${wideY}`,
    `L ${wideRightX} ${wideY}`,
    `C ${wideRightX} ${wideY + bulge}, ${neckRightX} ${neckY - bulge}, ${neckRightX} ${neckY}`,
    `L ${neckLeftX} ${neckY}`,
    `C ${neckLeftX} ${neckY - bulge}, ${wideLeftX} ${wideY + bulge}, ${wideLeftX} ${wideY}`,
    'Z',
  ].join(' ');
}

function buildHourglass() {
  const svg = svgEl('svg', {
    class: 'hourglass',
    viewBox: `0 0 ${HOURGLASS_W} ${HOURGLASS_H}`,
    width: `${HOURGLASS_RENDER_W}`,
    height: `${Math.round((HOURGLASS_RENDER_W * HOURGLASS_H) / HOURGLASS_W)}`,
  });

  const topOutline = bulbPath(1);
  const bottomOutline = bulbPath(-1);

  // clip paths so sand rects never spill outside the glass bulbs
  const defs = svgEl('defs', {});
  const topClipId = 'hg-clip-top';
  const bottomClipId = 'hg-clip-bottom';
  const topClip = svgEl('clipPath', { id: topClipId });
  topClip.appendChild(svgEl('path', { d: topOutline }));
  const bottomClip = svgEl('clipPath', { id: bottomClipId });
  bottomClip.appendChild(svgEl('path', { d: bottomOutline }));
  defs.appendChild(topClip);
  defs.appendChild(bottomClip);
  svg.appendChild(defs);

  // top cap / bottom cap
  svg.appendChild(svgEl('rect', { class: 'hourglass-cap', x: 6, y: 0, width: HOURGLASS_W - 12, height: CAP_H, rx: 3 }));
  svg.appendChild(svgEl('rect', { class: 'hourglass-cap', x: 6, y: HOURGLASS_H - CAP_H, width: HOURGLASS_W - 12, height: CAP_H, rx: 3 }));

  // sand in top bulb: rect anchored at the bulb's wide top edge, height shrinks over time
  const sandTop = svgEl('rect', {
    class: 'hourglass-sand-top',
    x: 0, y: 4, width: HOURGLASS_W, height: MAX_SAND_H,
    'clip-path': `url(#${topClipId})`,
  });
  // sand in bottom bulb: rect anchored at the neck, grows downward over time
  const sandBottom = svgEl('rect', {
    class: 'hourglass-sand-bottom',
    x: 0, y: NECK_Y, width: HOURGLASS_W, height: 0,
    'clip-path': `url(#${bottomClipId})`,
  });
  const stream = svgEl('rect', {
    class: 'hourglass-stream',
    x: HOURGLASS_W / 2 - 1.5, y: NECK_Y - 2, width: 3, height: 4,
  });

  svg.appendChild(sandTop);
  svg.appendChild(stream);
  svg.appendChild(sandBottom);

  // glass outline drawn last so it sits above the sand
  svg.appendChild(svgEl('path', { class: 'hourglass-frame', d: topOutline }));
  svg.appendChild(svgEl('path', { class: 'hourglass-frame', d: bottomOutline }));

  return { svg, sandTop, sandBottom, stream };
}

export function initTimer(container) {
  let totalSeconds = DEFAULT_MIN * 60;
  let remainingSeconds = totalSeconds;
  let intervalId = null;

  const { svg: hourglassSvg, sandTop, sandBottom, stream } = buildHourglass();

  const display = document.createElement('div');
  display.className = 'timer-display';

  const durationInput = document.createElement('input');
  durationInput.type = 'number';
  durationInput.min = '1';
  durationInput.value = String(DEFAULT_MIN);
  durationInput.className = 'timer-duration-input';

  const presetRow = document.createElement('div');
  presetRow.className = 'timer-presets';
  PRESETS_MIN.forEach((min) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${min} min`;
    btn.addEventListener('click', () => {
      stop();
      durationInput.value = String(min);
      totalSeconds = min * 60;
      remainingSeconds = totalSeconds;
      render();
    });
    presetRow.appendChild(btn);
  });

  const controlRow = document.createElement('div');
  controlRow.className = 'timer-controls';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.textContent = 'Start';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.textContent = 'Pause';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';

  function render() {
    const m = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    display.textContent = `${m}:${s}`;

    const fractionRemaining = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    const topH = MAX_SAND_H * fractionRemaining;
    const bottomH = MAX_SAND_H * (1 - fractionRemaining);
    sandTop.setAttribute('y', NECK_Y - topH);
    sandTop.setAttribute('height', topH);
    sandBottom.setAttribute('height', bottomH);
    stream.style.display = intervalId !== null && remainingSeconds > 0 ? '' : 'none';
  }

  function tick() {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      render();
      stop();
      return;
    }
    render();
  }

  function start() {
    if (intervalId !== null || remainingSeconds <= 0) return;
    intervalId = setInterval(tick, 1000);
    render();
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      render();
    }
  }

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', stop);
  resetBtn.addEventListener('click', () => {
    stop();
    remainingSeconds = totalSeconds;
    render();
  });

  durationInput.addEventListener('change', () => {
    stop();
    const min = parseFloat(durationInput.value) || DEFAULT_MIN;
    totalSeconds = min * 60;
    remainingSeconds = totalSeconds;
    render();
  });

  controlRow.appendChild(startBtn);
  controlRow.appendChild(pauseBtn);
  controlRow.appendChild(resetBtn);

  const durationRow = document.createElement('div');
  durationRow.className = 'timer-duration-row';
  const durationLabel = document.createElement('label');
  durationLabel.textContent = 'Minutes:';
  durationRow.appendChild(durationLabel);
  durationRow.appendChild(durationInput);

  const inner = document.createElement('div');
  inner.className = 'timer-inner';
  inner.appendChild(hourglassSvg);
  inner.appendChild(display);
  inner.appendChild(durationRow);
  inner.appendChild(presetRow);
  inner.appendChild(controlRow);

  container.appendChild(inner);

  render();
}
