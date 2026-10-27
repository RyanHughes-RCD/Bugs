// The pixel editor behind the Sprite Studio: a zoomed grid on a canvas,
// painted with the game's palette. Rows are strings of palette characters,
// '.' for transparent, the same format as data/sprites.js.
//
// Tools: pen, eraser, fill and picker, with an optional left/right mirror.
// Every finished stroke is one undo step.
export const TOOLS = ['pen', 'erase', 'fill', 'pick'];
const HISTORY = 100;

export class SpriteEditor {
  constructor(canvas, palette, rows, onChange = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.onChange = onChange;
    this.tool = 'pen';
    this.color = 'K';
    this.mirror = false;
    this.load(rows);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, () => this.up());
  }

  load(rows) {
    this.n = rows.length;
    this.grid = rows.map((r) => [...r]);
    this.undoStack = [];
    this.redoStack = [];
    this.resize();
    this.draw();
  }

  rows() {
    return this.grid.map((r) => r.join(''));
  }

  // A fresh, blank grid at a new size (16 or 32).
  resizeGrid(n) {
    this.load(Array.from({ length: n }, () => '.'.repeat(n)));
    this.onChange();
  }

  resize() {
    const css = Math.min(this.canvas.parentElement?.clientWidth || 320, 360);
    this.cell = Math.floor((css * (window.devicePixelRatio || 1)) / this.n);
    this.canvas.width = this.canvas.height = this.cell * this.n;
    this.canvas.style.width = this.canvas.style.height = `${(this.cell * this.n) / (window.devicePixelRatio || 1)}px`;
  }

  draw() {
    const { ctx, cell, n } = this;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const ch = this.grid[y][x];
        if (ch === '.') {
          // A checkerboard shows what's transparent.
          ctx.fillStyle = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#d9d4c7' : '#ece8dd';
        } else ctx.fillStyle = this.palette[ch] || '#ff00ff';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // Faint grid lines, a stronger one down the middle for symmetry.
    ctx.fillStyle = 'rgba(26, 28, 44, 0.12)';
    for (let i = 1; i < n; i++) {
      ctx.fillRect(i * cell, 0, 1, n * cell);
      ctx.fillRect(0, i * cell, n * cell, 1);
    }
    ctx.fillStyle = this.mirror ? 'rgba(177, 62, 83, 0.6)' : 'rgba(26, 28, 44, 0.25)';
    ctx.fillRect((n / 2) * cell - 1, 0, 2, n * cell);
  }

  cellAt(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * this.n);
    const y = Math.floor(((e.clientY - r.top) / r.height) * this.n);
    return x >= 0 && y >= 0 && x < this.n && y < this.n ? [x, y] : null;
  }

  down(e) {
    const at = this.cellAt(e);
    if (!at) return;
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    if (this.tool === 'pick') {
      const ch = this.grid[at[1]][at[0]];
      if (ch !== '.') this.color = ch;
      this.tool = 'pen';
      this.onChange('tool');
      return;
    }
    this.before = this.rows();
    if (this.tool === 'fill') {
      this.fill(...at, this.color);
      this.up();
      return;
    }
    this.stroking = true;
    this.last = at;
    this.paint(...at);
  }

  // Fills every cell between the last point and this one, so a fast stroke
  // leaves no gaps.
  move(e) {
    if (!this.stroking) return;
    const at = this.cellAt(e);
    if (!at) return;
    let [x, y] = this.last;
    const [x1, y1] = at;
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, this.tool === 'erase' ? '.' : this.color);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    this.last = at;
    this.draw();
  }

  up() {
    if (!this.before) return;
    this.stroking = false;
    if (this.before.join('') !== this.rows().join('')) {
      this.undoStack.push(this.before);
      if (this.undoStack.length > HISTORY) this.undoStack.shift();
      this.redoStack = [];
      this.onChange();
    }
    this.before = null;
  }

  set(x, y, ch) {
    this.grid[y][x] = ch;
    if (this.mirror) this.grid[y][this.n - 1 - x] = ch;
  }

  paint(x, y) {
    this.set(x, y, this.tool === 'erase' ? '.' : this.color);
    this.draw();
  }

  fill(x, y, ch) {
    const from = this.grid[y][x];
    if (from === ch) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= this.n || cy >= this.n || this.grid[cy][cx] !== from) continue;
      this.set(cx, cy, ch);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    this.draw();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.rows());
    this.grid = this.undoStack.pop().map((r) => [...r]);
    this.draw();
    this.onChange();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.rows());
    this.grid = this.redoStack.pop().map((r) => [...r]);
    this.draw();
    this.onChange();
  }

  clear() {
    this.before = this.rows();
    this.grid = this.grid.map((r) => r.map(() => '.'));
    this.draw();
    this.up();
  }
}
