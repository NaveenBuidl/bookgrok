import { Wheel } from 'https://cdn.jsdelivr.net/npm/spin-wheel@5.0.2/dist/spin-wheel-esm.js';

const ITEM_BACKGROUND_COLORS = ['#241d17', '#332920'];
const ITEM_LABEL_COLORS = ['#f5efe6'];
const SPIN_DURATION_MS = 2500;
const SPIN_REVOLUTIONS = 3;
const SPIN_DIRECTION = 1;

function playTick() {
  const ctx = playTick.ctx || (playTick.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function initWheel(wheelContainer, namesContainer) {
  let pool = [];
  let lastWinnerIndex = null;

  const poolInput = document.createElement('textarea');
  poolInput.className = 'wheel-pool-input';
  poolInput.placeholder = 'One name per line';
  poolInput.rows = 6;

  const spinBtn = document.createElement('button');
  spinBtn.type = 'button';
  spinBtn.textContent = 'Spin';
  spinBtn.disabled = true;

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset pool';

  const winnerDisplay = document.createElement('div');
  winnerDisplay.className = 'wheel-winner';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove from pool';
  removeBtn.hidden = true;

  const keepBtn = document.createElement('button');
  keepBtn.type = 'button';
  keepBtn.textContent = 'Keep in pool';
  keepBtn.hidden = true;

  const winnerActions = document.createElement('div');
  winnerActions.className = 'wheel-winner-actions';
  winnerActions.appendChild(removeBtn);
  winnerActions.appendChild(keepBtn);

  const wheelStage = document.createElement('div');
  wheelStage.className = 'wheel-stage';

  const wheelCanvasHost = document.createElement('div');
  wheelCanvasHost.className = 'wheel-canvas-host';

  const pointer = document.createElement('div');
  pointer.className = 'wheel-pointer';

  wheelCanvasHost.appendChild(pointer);
  wheelStage.appendChild(wheelCanvasHost);

  const controls = document.createElement('div');
  controls.className = 'wheel-controls';
  controls.appendChild(poolInput);
  controls.appendChild(spinBtn);
  controls.appendChild(resetBtn);

  namesContainer.appendChild(controls);
  namesContainer.appendChild(winnerDisplay);
  namesContainer.appendChild(winnerActions);
  wheelContainer.appendChild(wheelStage);

  let wheel = null;
  let spinning = false;

  function itemsFromPool() {
    return pool.map((name) => ({ label: name }));
  }

  function clearWinner() {
    lastWinnerIndex = null;
    winnerDisplay.textContent = '';
    removeBtn.hidden = true;
    keepBtn.hidden = true;
  }

  function buildWheel() {
    wheel = new Wheel(wheelCanvasHost, {
      items: itemsFromPool(),
      isInteractive: false,
      pointerAngle: 90,
      radius: 1,
      itemBackgroundColors: ITEM_BACKGROUND_COLORS,
      itemLabelColors: ITEM_LABEL_COLORS,
      itemLabelFont: 'system-ui, sans-serif',
      onCurrentIndexChange: () => {
        if (spinning) playTick();
      },
      onRest: (e) => {
        spinning = false;
        const winner = pool[e.currentIndex];
        if (winner !== undefined) {
          lastWinnerIndex = e.currentIndex;
          winnerDisplay.textContent = `Up next: ${winner}`;
          removeBtn.hidden = false;
          keepBtn.hidden = false;
        }
        updateSpinEnabled();
      },
    });
  }

  function updateSpinEnabled() {
    spinBtn.disabled = pool.length === 0 || spinning;
  }

  poolInput.addEventListener('change', () => {
    pool = poolInput.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    clearWinner();
    if (!wheel) {
      buildWheel();
    } else {
      wheel.items = itemsFromPool();
    }
    updateSpinEnabled();
  });

  spinBtn.addEventListener('click', () => {
    if (!wheel || pool.length === 0 || spinning) return;
    spinning = true;
    clearWinner();
    updateSpinEnabled();
    const targetIndex = Math.floor(Math.random() * pool.length);
    wheel.spinToItem(targetIndex, SPIN_DURATION_MS, true, SPIN_REVOLUTIONS, SPIN_DIRECTION, null);
  });

  removeBtn.addEventListener('click', () => {
    if (lastWinnerIndex === null) return;
    pool = pool.filter((_, i) => i !== lastWinnerIndex);
    wheel.items = itemsFromPool();
    clearWinner();
    updateSpinEnabled();
  });

  keepBtn.addEventListener('click', () => {
    clearWinner();
  });

  resetBtn.addEventListener('click', () => {
    pool = poolInput.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    clearWinner();
    if (!wheel) {
      buildWheel();
    } else {
      wheel.items = itemsFromPool();
    }
    updateSpinEnabled();
  });

  buildWheel();
}
