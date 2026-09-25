// 视图层：矢量受力图绘制器 + 实时图表渲染器（Canvas 2D）

// ---------------- 通用绘图辅助 ----------------

// 绘制箭头（返回实际尖端坐标）。dashed=true 时画虚线（G/N 用）
function drawArrowInto(ctx, from, dir, lenPx, color, dashed, lineWidth) {
  const lw = lineWidth || 3.0;
  const len = Math.abs(lenPx);
  if (len < 0.5) return from;
  const d = Math.hypot(dir.x, dir.y);
  if (d < 1e-9) return from;
  const ux = dir.x / d;
  const uy = dir.y / d;
  const tip = { x: from.x + ux * len, y: from.y + uy * len };

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = dashed ? 2.5 : lw;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // 箭头头部（两条线，保持与原版一致的锥形风格）
  const head = 9.0;
  const px = -uy;
  const py = ux;
  ctx.lineWidth = dashed ? 2.5 : lw;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * head + px * head * 0.5, tip.y - uy * head + py * head * 0.5);
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * head - px * head * 0.5, tip.y - uy * head - py * head * 0.5);
  ctx.stroke();
  ctx.restore();
  return tip;
}

// 将 from→tip 射线与边界矩形求交，返回裁剪后的尖端（保证不超出屏幕）
function clipTip(from, tip, bounds) {
  if (tip.x >= bounds.x && tip.x <= bounds.x + bounds.w &&
      tip.y >= bounds.y && tip.y <= bounds.y + bounds.h) {
    return tip;
  }
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  if (dx * dx + dy * dy < 1e-9) return tip;
  let t = 1.0;
  if (dx > 0) t = Math.min(t, (bounds.x + bounds.w - from.x) / dx);
  else if (dx < 0) t = Math.min(t, (bounds.x - from.x) / dx);
  if (dy > 0) t = Math.min(t, (bounds.y + bounds.h - from.y) / dy);
  else if (dy < 0) t = Math.min(t, (bounds.y - from.y) / dy);
  t = Math.max(t, 0);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

// ---------------- 矢量受力图绘制器 ----------------

class VectorDrawer {
  constructor() {
    this.arrows = [];   // {from, dir, len, color, dashed, label:{pos,text}}
    this.simplified = false; // 受力透视：true 时隐藏 G/N
    this.showLabels = true;
    this.bounds = null;      // {x,y,w,h} 画布内缩边界
  }

  setBounds(w, h, inset) {
    const m = inset === undefined ? 12 : inset;
    this.bounds = { x: m, y: m, w: Math.max(w - m * 2, 0), h: Math.max(h - m * 2, 0) };
  }

  clear() { this.arrows = []; }

  // pxPerUnit：数值 → 像素的比例，默认按力（N）换算，可传速度比例等
  drawArrow(from, direction, magnitude, color, dashed, label, pxPerUnit) {
    if (Math.abs(magnitude) < 1e-9) return;
    const scale = pxPerUnit || Constants.PX_PER_NEWTON;
    const dirLen = Math.hypot(direction.x, direction.y);
    if (dirLen < 1e-9) return;
    this.arrows.push({
      from: { x: from.x, y: from.y },
      dir: { x: direction.x / dirLen, y: direction.y / dirLen },
      len: Math.abs(magnitude) * scale,
      color,
      dashed: !!dashed,
      label: label || null,
    });
  }

  // 完整受力图：G/N 竖直黑虚线（等长、限长在画布内），f 蓝色水平，F 红色水平
  drawForceBalance(engine, from, canvasH) {
    const gMag = engine.getGravityForce();
    const fFric = engine.getFriction();
    const fApply = engine.appliedForce;

    if (!this.simplified) {
      const rawLen = gMag * Constants.PX_PER_NEWTON;
      let gLen = rawLen;
      if (canvasH > 0 && this.bounds) {
        const margin = 14.0;
        const upSpace = Math.max(from.y - margin, 16.0);
        const downSpace = Math.max(canvasH - from.y - margin, 16.0);
        gLen = Math.min(rawLen, Math.min(upSpace, downSpace) * 0.92);
      }
      this.drawArrow(from, { x: 0, y: 1 }, gLen / Constants.PX_PER_NEWTON,
        Constants.COLOR_GRAVITY, true,
        this.showLabels ? { pos: { x: from.x + 10, y: from.y + gLen * 0.5 + 14 }, text: 'G' } : null);
      this.drawArrow(from, { x: 0, y: -1 }, gLen / Constants.PX_PER_NEWTON,
        Constants.COLOR_GRAVITY, true,
        this.showLabels ? { pos: { x: from.x + 10, y: from.y - gLen * 0.5 - 6 }, text: 'N' } : null);
    }

    if (Math.abs(fFric) > 1e-9) {
      // fFric 已带符号（与运动方向相反），箭头方向取其符号
      const sgn = Math.sign(fFric);
      const label = this.showLabels
        ? { pos: { x: from.x + sgn * Math.abs(fFric) * Constants.PX_PER_NEWTON + sgn * 10, y: from.y - 18 }, text: 'f' }
        : null;
      this.drawArrow(from, { x: sgn, y: 0 }, Math.abs(fFric), Constants.COLOR_FRICTION, false, label);
    }
    if (Math.abs(fApply) > 1e-9) {
      const sgn = Math.sign(fApply);
      const label = this.showLabels
        ? { pos: { x: from.x + sgn * Math.abs(fApply) * Constants.PX_PER_NEWTON + sgn * 8, y: from.y + 26 }, text: 'F' }
        : null;
      this.drawArrow(from, { x: sgn, y: 0 }, Math.abs(fApply), Constants.COLOR_FORCE, false, label);
    }
  }

  // 简化模式下绘制水平合力箭头（红色，稍放大强调）
  drawNetForceArrow(engine, from) {
    const net = engine.getNetForce();
    if (Math.abs(net) < 1e-9) return;
    const sgn = Math.sign(net);
    const lenPx = Math.abs(net) * Constants.PX_PER_NEWTON * 1.2;
    this.arrows.push({
      from: { x: from.x, y: from.y },
      dir: { x: sgn, y: 0 },
      len: lenPx,
      color: Constants.COLOR_FORCE,
      dashed: false,
      label: this.showLabels ? { pos: { x: from.x + sgn * lenPx + 4, y: from.y - 26 }, text: 'F_合' } : null,
    });
  }

  // 提交绘制到 canvas 上下文
  render(ctx, font) {
    ctx.save();
    for (const a of this.arrows) {
      let tip = { x: a.from.x + a.dir.x * a.len, y: a.from.y + a.dir.y * a.len };
      if (this.bounds) tip = clipTip(a.from, tip, this.bounds);
      drawArrowInto(ctx, a.from, a.dir, Math.hypot(tip.x - a.from.x, tip.y - a.from.y), a.color, a.dashed);
    }
    if (font) {
      ctx.font = `16px ${font}`;
      ctx.fillStyle = Constants.COLOR_TEXT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (const a of this.arrows) {
        if (!a.label) continue;
        ctx.fillText(a.label.text, a.label.pos.x, a.label.pos.y);
      }
    }
    ctx.restore();
  }
}

// ---------------- 实时图表渲染器 ----------------

const ChartType = { V_T: 'V_T', X_T: 'X_T' };

class ChartRenderer {
  constructor(type, timeWindow) {
    this.type = type || ChartType.V_T;
    this.timeWindow = timeWindow || 10.0;
    this.title = this.type === ChartType.V_T ? 'V-t 图' : 'X-t 图';
    this.autoScale = true;
    this.fixedMin = 0;
    this.fixedMax = 10;
    this.gridStep = 2.0; // 时间轴网格步长 (s)，短时演示可调小
    this.showTheory = true;
    this._times = [];
    this._values = [];
    this._theoryFunc = null;
    this._tLatest = 0;
    this._padL = 46;
    this._padR = 12;
    this._padT = 26;
    this._padB = 26;
  }

  setup(type, timeWindow) {
    this.type = type;
    if (timeWindow !== undefined) this.timeWindow = timeWindow;
    this.title = this.type === ChartType.V_T ? 'V-t 图' : 'X-t 图';
  }

  setTitle(t) { this.title = t; }
  setAutoScale(on) { this.autoScale = on; }
  setFixedRange(a, b) { this.fixedMin = a; this.fixedMax = b; }
  setTheoryFunc(fn) { this._theoryFunc = fn; }
  setShowTheory(on) { this.showTheory = on; }
  hasData() { return this._times.length > 0; }

  pushValue(t, v) {
    this._tLatest = t;
    this._times.push(t);
    this._values.push(v);
    // 裁剪窗口外的旧点
    const cutoff = this._tLatest - this.timeWindow;
    let keep = -1;
    for (let i = 0; i < this._times.length; i++) {
      if (this._times[i] >= cutoff) { keep = i; break; }
    }
    if (keep > 0) {
      this._times = this._times.slice(keep);
      this._values = this._values.slice(keep);
    }
  }

  clear() {
    this._times = [];
    this._values = [];
    this._tLatest = 0;
  }

  _timeToX(plot, t) {
    return plot.x + (t - (this._tLatest - this.timeWindow)) / this.timeWindow * plot.w;
  }

  _toScreen(plot, t, v, vmin, vmax) {
    const x = this._timeToX(plot, t);
    const y = plot.y + (vmax - v) / (vmax - vmin) * plot.h;
    return { x, y };
  }

  render(canvas, font) {
    const { ctx, w, h } = prepareCanvas(canvas);
    if (w <= 10 || h <= 10) return;
    const plot = {
      x: this._padL,
      y: this._padT,
      w: Math.max(w - this._padL - this._padR, 0),
      h: Math.max(h - this._padT - this._padB, 0),
    };
    if (plot.w <= 5 || plot.h <= 5) return;

    ctx.clearRect(0, 0, w, h);
    // 背景
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = Constants.COLOR_PANEL_ALT;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // 纵轴范围
    let vmin, vmax;
    if (this.autoScale) {
      let lo = Infinity, hi = -Infinity;
      for (const v of this._values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (this._theoryFunc && this.showTheory) {
        const t0 = this._tLatest - this.timeWindow;
        const n = 100;
        for (let i = 0; i <= n; i++) {
          const tt = t0 + this.timeWindow * i / n;
          if (tt < 0) continue;
          const y = this._theoryFunc(tt);
          lo = Math.min(lo, y); hi = Math.max(hi, y);
        }
      }
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      if (Math.abs(hi - lo) < 1e-6) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.12;
      vmin = lo - pad;
      vmax = hi + pad;
    } else {
      vmin = this.fixedMin;
      vmax = this.fixedMax;
    }

    const fam = font || 'sans-serif';
    // 标题与纵轴单位
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = Constants.COLOR_TEXT;
    ctx.font = `12px ${fam}`;
    ctx.fillText(this.title, plot.x + 4, plot.y + 2);
    ctx.fillStyle = Constants.COLOR_TEXT_DIM;
    ctx.font = `10px ${fam}`;
    ctx.fillText(this.type === ChartType.V_T ? 'v (m/s)' : 'x (m)', plot.x + 60, plot.y + 14);

    // 横向网格与刻度（纵轴 5 等分）
    for (let i = 0; i <= 5; i++) {
      const frac = i / 5;
      const y = plot.y + plot.h * frac;
      const val = vmax - (vmax - vmin) * frac;
      ctx.strokeStyle = rgba('#d9d9d9', 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.w, y);
      ctx.stroke();
      ctx.fillStyle = Constants.COLOR_TEXT_DIM;
      ctx.font = `10px ${fam}`;
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), plot.x - 6, y + 4);
      ctx.textAlign = 'left';
    }

    // 垂直网格线：绑定到具体时刻，按 gridStep 递增，随数据左移
    const gStep = this.gridStep > 0 ? this.gridStep : 2.0;
    let gi = Math.max(Math.ceil((this._tLatest - this.timeWindow) / gStep - 1e-9), 0);
    let tau = gi * gStep;
    while (tau <= this._tLatest + 1e-6) {
      const x = this._timeToX(plot, tau);
      ctx.strokeStyle = rgba('#d9d9d9', 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
      ctx.fillStyle = Constants.COLOR_TEXT_DIM;
      ctx.font = `10px ${fam}`;
      ctx.fillText(gStep < 1 ? tau.toFixed(1) : String(Math.round(tau)), x - 6, plot.y + plot.h + 14);
      gi += 1;
      tau = gi * gStep;
    }

    // 坐标轴（左 + 下）
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y);
    ctx.lineTo(plot.x, plot.y + plot.h);
    ctx.moveTo(plot.x, plot.y + plot.h);
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
    ctx.stroke();
    ctx.fillStyle = Constants.COLOR_TEXT_DIM;
    ctx.font = `10px ${fam}`;
    ctx.textAlign = 'right';
    ctx.fillText('t (s)', plot.x + plot.w, plot.y + plot.h + 14);
    ctx.textAlign = 'left';

    // 理论曲线（半透明绿色虚线）
    if (this.showTheory && this._theoryFunc && this._tLatest > 0) {
      const t0 = this._tLatest - this.timeWindow;
      const pts = [];
      const n = 200;
      for (let i = 0; i <= n; i++) {
        const tt = t0 + this.timeWindow * i / n;
        if (tt < 0) continue;
        pts.push(this._toScreen(plot, tt, this._theoryFunc(tt), vmin, vmax));
      }
      if (pts.length > 1) {
        ctx.save();
        ctx.strokeStyle = rgba(Constants.COLOR_THEORY, 0.7);
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 实测曲线（黑色实线）
    if (this._times.length > 1) {
      ctx.save();
      ctx.strokeStyle = Constants.COLOR_TEXT;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < this._times.length; i++) {
        const p = this._toScreen(plot, this._times[i], this._values[i], vmin, vmax);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------- 坐标纸网格背景 ----------------

// 网格 = 世界坐标系：垂直整数米线随相机 scroll 平移，原点线加粗
function drawGrid(ctx, w, h, scroll) {
  const step = Constants.PX_PER_METER;
  if (step <= 0 || w <= 1 || h <= 1) return;
  const kMin = Math.floor(scroll / step) - 1;
  const kMax = Math.ceil((scroll + w) / step) + 1;
  for (let k = kMin; k <= kMax; k++) {
    const x = k * step - scroll;
    if (k === 0) {
      ctx.strokeStyle = Constants.COLOR_AXIS;
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.34);
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.22);
  ctx.lineWidth = 1;
  let y = step;
  while (y < h) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    y += step;
  }
}

// 地面线（含阴影层次），与原版一致：默认位于画布高度 72% 处（ratio 可覆盖）
function drawGround(ctx, w, h, ratio) {
  const gy = h * (ratio === undefined ? 0.72 : ratio);
  ctx.strokeStyle = Constants.COLOR_GROUND;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(204,204,199,${0.5 - i * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gy + 6 + i * 5);
    ctx.lineTo(w, gy + 6 + i * 5);
    ctx.stroke();
  }
}
