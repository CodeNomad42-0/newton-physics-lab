// 物理仿真弹窗：匀变速直线运动「4 类公式自动匹配」求解 + 运动动画与 v-t / x-t 曲线

// ---------------- 题目类型 ----------------
const SIM_TYPES = [
  { key: 'linear', name: '匀变速直线运动', ready: true },
  { key: 'projectile', name: '平抛运动', ready: false, note: '暂定' },
];

// ---------------- 数据输入（4 组共 8 个输入框）----------------
// primary: 参与「知三求二」的已知量；其余为过程记录项，不参与公式求解
const SIM_GROUPS = [
  { title: '速度数据（变化）', fields: [
    { key: 'v0', label: '变化初始值 v₀', unit: 'm/s', primary: true },
    { key: 'v', label: '变化最终值 v', unit: 'm/s', primary: true },
  ] },
  { title: '加速度相关参数', fields: [
    { key: 'a', label: '加速度大小 a', unit: 'm/s²', primary: true },
    { key: 't', label: '加速度作用时间 t', unit: 's', primary: true },
  ] },
  { title: '加速度变化参数', fields: [
    { key: 'a0', label: '变化初始值 a₀', unit: 'm/s²' },
  ] },
  { title: '位移数据（变化）', fields: [
    { key: 'x', label: '变化最终值 x', unit: 'm', primary: true },
  ] },
];

const SIM_PRIMARY = ['v0', 'v', 'a', 't', 'x'];
const SIM_SYMBOL = { v0: 'v₀', v: 'v', a: 'a', t: 't', x: 'x' };
const SIM_UNIT = { v0: 'm/s', v: 'm/s', a: 'm/s²', t: 's', x: 'm' };
const SIM_EPS = 1e-9;

function simNum(v, digits) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  const d = digits === undefined ? 3 : digits;
  const r = Number(v.toFixed(d));
  return (Object.is(r, -0) ? 0 : r).toString();
}

function simFail(msg) { return { error: msg }; }

// ---------------- 10 组「知三求二」求解式 ----------------
const SIM_SOLVERS = {
  // 已知 v₀、a、t
  'a,t,v0': (k) => {
    const v = k.v0 + k.a * k.t;
    const x = k.v0 * k.t + 0.5 * k.a * k.t * k.t;
    return { values: { v, x }, steps: [
      { id: 'f1', text: `v = v₀ + a·t = ${simNum(k.v0)} + ${simNum(k.a)} × ${simNum(k.t)} = ${simNum(v)} m/s` },
      { id: 'f2', text: `x = v₀·t + ½·a·t² = ${simNum(k.v0)} × ${simNum(k.t)} + ½ × ${simNum(k.a)} × ${simNum(k.t)}² = ${simNum(x)} m` },
    ] };
  },

  // 已知 v、a、t
  'a,t,v': (k) => {
    const v0 = k.v - k.a * k.t;
    const x = (v0 + k.v) / 2 * k.t;
    return { values: { v0, x }, steps: [
      { id: 'f1', text: `由 v = v₀ + a·t 反解：v₀ = v - a·t = ${simNum(k.v)} - ${simNum(k.a)} × ${simNum(k.t)} = ${simNum(v0)} m/s` },
      { id: 'f4', text: `x = (v₀ + v)/2 · t = (${simNum(v0)} + ${simNum(k.v)}) / 2 × ${simNum(k.t)} = ${simNum(x)} m` },
    ] };
  },

  // 已知 a、t、x
  'a,t,x': (k) => {
    if (Math.abs(k.t) < SIM_EPS) return simFail('时间 t = 0 时位移必为 0，无法由 x 反求 v₀，请改填其它已知量');
    const v0 = (k.x - 0.5 * k.a * k.t * k.t) / k.t;
    const v = v0 + k.a * k.t;
    return { values: { v0, v }, steps: [
      { id: 'f2', text: `由 x = v₀·t + ½·a·t² 反解：v₀ = (x - ½·a·t²) / t = (${simNum(k.x)} - ½ × ${simNum(k.a)} × ${simNum(k.t)}²) / ${simNum(k.t)} = ${simNum(v0)} m/s` },
      { id: 'f1', text: `v = v₀ + a·t = ${simNum(v0)} + ${simNum(k.a)} × ${simNum(k.t)} = ${simNum(v)} m/s` },
    ] };
  },

  // 已知 v₀、v、a
  'a,v,v0': (k) => {
    if (Math.abs(k.a) < SIM_EPS) return simFail('加速度 a = 0 时 v 必等于 v₀，无法由二者确定时间 t，请改填其它已知量');
    const t = (k.v - k.v0) / k.a;
    if (t < -1e-9) return simFail(`求得 t = ${simNum(t)} s 为负，与「加速度作用时间」矛盾，请检查数据`);
    const x = (k.v0 + k.v) / 2 * t;
    return { values: { t, x }, steps: [
      { id: 'f1', text: `由 v = v₀ + a·t 反解：t = (v - v₀) / a = (${simNum(k.v)} - ${simNum(k.v0)}) / ${simNum(k.a)} = ${simNum(t)} s` },
      { id: 'f4', text: `x = (v₀ + v)/2 · t = (${simNum(k.v0)} + ${simNum(k.v)}) / 2 × ${simNum(t)} = ${simNum(x)} m` },
    ] };
  },

  // 已知 v、a、x
  'a,v,x': (k) => {
    const D = k.v * k.v - 2 * k.a * k.x;
    if (D < -SIM_EPS) return simFail(`由 v² = v₀² + 2a·x 得 v₀² = ${simNum(D)} < 0，该组数据无实数解`);
    const s = Math.sqrt(Math.max(D, 0));
    let v0, t, stepT;
    if (Math.abs(k.a) < SIM_EPS) {
      v0 = k.v;
      if (Math.abs(v0) < SIM_EPS) return simFail('a = 0 且 v = 0 时位移不为 0，数据矛盾，请改填其它已知量');
      t = k.x / v0;
      stepT = { id: 'f2', text: `a = 0（匀速）：x = v·t，故 t = x / v = ${simNum(k.x)} / ${simNum(v0)} = ${simNum(t)} s` };
    } else {
      const cands = [s, -s].map((c) => ({ c, tc: (k.v - c) / k.a }))
        .filter((o) => o.tc >= -1e-9)
        .sort((o1, o2) => o1.tc - o2.tc);
      if (!cands.length) return simFail('由 v² = v₀² + 2a·x 解出的两个 v₀ 对应时间均为负，数据不合理');
      v0 = cands[0].c;
      t = cands[0].tc;
      stepT = { id: 'f1', text: `t = (v - v₀) / a = (${simNum(k.v)} - ${simNum(v0)}) / ${simNum(k.a)} = ${simNum(t)} s` };
      if (cands.length > 1) {
        stepT.text += `（另一根 v₀ = ${simNum(cands[1].c)} m/s 对应 t = ${simNum(cands[1].tc)} s 也成立，此处取 t 较小的解）`;
      }
    }
    return { values: { v0, t }, steps: [
      { id: 'f3', text: `由 v² = v₀² + 2a·x 反解：v₀² = v² - 2a·x = ${simNum(k.v)}² - 2 × ${simNum(k.a)} × ${simNum(k.x)} = ${simNum(D)}` },
      { id: 'f3', text: `v₀ = ±√${simNum(Math.max(D, 0))} = ±${simNum(s)} m/s，取 v₀ = ${simNum(v0)} m/s（满足 t ≥ 0）` },
      stepT,
    ] };
  },

  // 已知 v₀、a、x
  'a,v0,x': (k) => {
    const D = k.v0 * k.v0 + 2 * k.a * k.x;
    if (D < -SIM_EPS) return simFail(`由 v² = v₀² + 2a·x 得 v² = ${simNum(D)} < 0，该组数据无实数解`);
    const s = Math.sqrt(Math.max(D, 0));
    let v, t, stepT;
    if (Math.abs(k.a) < SIM_EPS) {
      v = k.v0;
      if (Math.abs(v) < SIM_EPS) return simFail('a = 0 且 v₀ = 0 时位移不为 0，数据矛盾，请改填其它已知量');
      t = k.x / v;
      stepT = { id: 'f2', text: `a = 0（匀速）：x = v₀·t，故 t = x / v₀ = ${simNum(k.x)} / ${simNum(v)} = ${simNum(t)} s` };
    } else {
      const cands = [s, -s].map((c) => ({ c, tc: (c - k.v0) / k.a }))
        .filter((o) => o.tc >= -1e-9)
        .sort((o1, o2) => o1.tc - o2.tc);
      if (!cands.length) return simFail('由 v² = v₀² + 2a·x 解出的两个 v 对应时间均为负，数据不合理');
      v = cands[0].c;
      t = cands[0].tc;
      stepT = { id: 'f1', text: `t = (v - v₀) / a = (${simNum(v)} - ${simNum(k.v0)}) / ${simNum(k.a)} = ${simNum(t)} s` };
      if (cands.length > 1) {
        stepT.text += `（另一根 v = ${simNum(cands[1].c)} m/s 对应 t = ${simNum(cands[1].tc)} s 也成立，此处取 t 较小的解）`;
      }
    }
    return { values: { v, t }, steps: [
      { id: 'f3', text: `由 v² = v₀² + 2a·x 求解：v² = v₀² + 2a·x = ${simNum(k.v0)}² + 2 × ${simNum(k.a)} × ${simNum(k.x)} = ${simNum(D)}` },
      { id: 'f3', text: `v = ±√${simNum(Math.max(D, 0))} = ±${simNum(s)} m/s，取 v = ${simNum(v)} m/s（满足 t ≥ 0）` },
      stepT,
    ] };
  },

  // 已知 v₀、v、t
  't,v,v0': (k) => {
    if (Math.abs(k.t) < SIM_EPS) return simFail('时间 t = 0 时 v 必等于 v₀，加速度无法确定，请改填其它已知量');
    const a = (k.v - k.v0) / k.t;
    const x = (k.v0 + k.v) / 2 * k.t;
    return { values: { a, x }, steps: [
      { id: 'f1', text: `由 v = v₀ + a·t 反解：a = (v - v₀) / t = (${simNum(k.v)} - ${simNum(k.v0)}) / ${simNum(k.t)} = ${simNum(a)} m/s²` },
      { id: 'f4', text: `x = (v₀ + v)/2 · t = (${simNum(k.v0)} + ${simNum(k.v)}) / 2 × ${simNum(k.t)} = ${simNum(x)} m` },
    ] };
  },

  // 已知 v、t、x
  't,v,x': (k) => {
    if (Math.abs(k.t) < SIM_EPS) return simFail('时间 t = 0 时位移必为 0，无法由 x 反求 v₀，请改填其它已知量');
    const v0 = 2 * k.x / k.t - k.v;
    const a = (k.v - v0) / k.t;
    return { values: { v0, a }, steps: [
      { id: 'f4', text: `由 x = (v₀ + v)/2 · t 反解：v₀ = 2x / t - v = 2 × ${simNum(k.x)} / ${simNum(k.t)} - ${simNum(k.v)} = ${simNum(v0)} m/s` },
      { id: 'f1', text: `a = (v - v₀) / t = (${simNum(k.v)} - ${simNum(v0)}) / ${simNum(k.t)} = ${simNum(a)} m/s²` },
    ] };
  },

  // 已知 v₀、t、x
  't,v0,x': (k) => {
    if (Math.abs(k.t) < SIM_EPS) return simFail('时间 t = 0 时位移必为 0，无法由 x 反求加速度，请改填其它已知量');
    const a = 2 * (k.x - k.v0 * k.t) / (k.t * k.t);
    const v = k.v0 + a * k.t;
    return { values: { a, v }, steps: [
      { id: 'f2', text: `由 x = v₀·t + ½·a·t² 反解：a = 2(x - v₀·t) / t² = 2 × (${simNum(k.x)} - ${simNum(k.v0)} × ${simNum(k.t)}) / ${simNum(k.t)}² = ${simNum(a)} m/s²` },
      { id: 'f1', text: `v = v₀ + a·t = ${simNum(k.v0)} + ${simNum(a)} × ${simNum(k.t)} = ${simNum(v)} m/s` },
    ] };
  },

  // 已知 v₀、v、x
  'v,v0,x': (k) => {
    const sum = k.v0 + k.v;
    if (Math.abs(sum) < SIM_EPS) return simFail('v₀ + v = 0 时由 x = (v₀ + v)/2 · t 无法确定时间，请改填其它已知量');
    const t = 2 * k.x / sum;
    if (Math.abs(t) < SIM_EPS) return simFail('求得 t = 0，与已知位移矛盾，请检查数据');
    const a = (k.v - k.v0) / t;
    return { values: { t, a }, steps: [
      { id: 'f4', text: `由 x = (v₀ + v)/2 · t 反解：t = 2x / (v₀ + v) = 2 × ${simNum(k.x)} / (${simNum(k.v0)} + ${simNum(k.v)}) = ${simNum(t)} s` },
      { id: 'f1', text: `a = (v - v₀) / t = (${simNum(k.v)} - ${simNum(k.v0)}) / ${simNum(t)} = ${simNum(a)} m/s²` },
    ] };
  },
};

// 由 3 个已知量求解，返回 { values, steps } 或 { error }
function simSolve(known) {
  const keys = SIM_PRIMARY.filter((k) => known[k] !== undefined);
  if (keys.length !== 3) return simFail(`需要恰好 3 个已知量（当前 ${keys.length} 个）`);
  const fn = SIM_SOLVERS[keys.slice().sort().join(',')];
  if (!fn) return simFail('该已知量组合暂不支持求解');
  return fn(known);
}

// ---------------- 仿真弹窗 ----------------

class PhysicsSimulator {
  constructor(game) {
    this.game = game;
    this.typeKey = SIM_TYPES[0].key;
    this.fields = {};
    this.solved = null;      // 完整数据 { v0, v, a, t, x }
    this.animT = 0;
    this.tEnd = 0;
    this.animGridStep = 1;
    this.playing = false;
    this.dragging = false;
    this.progGeom = null;    // 进度条几何（用于命中检测）
    this.chartsOpen = false;
    this.chartVT = new ChartRenderer(ChartType.V_T, 1.0);
    this.chartXT = new ChartRenderer(ChartType.X_T, 1.0);
  }

  init() {
    this.overlay = document.getElementById('sim-overlay');
    this.typesHost = document.getElementById('sim-types');
    this.fieldsHost = document.getElementById('sim-fields');
    this.hintEl = document.getElementById('sim-hint');
    this.typeTag = document.getElementById('sim-type-tag');
    this.canvas = document.getElementById('sim-canvas');
    this.chartVTEl = document.getElementById('sim-chart-vt');
    this.chartXTEl = document.getElementById('sim-chart-xt');
    this.chartDock = document.getElementById('sim-chart-dock');
    this.chartArrow = document.getElementById('sim-chart-arrow');
    this.fTitle = document.getElementById('sim-formula-title');
    this.fLine = document.getElementById('sim-formula-line');
    this.fSub = document.getElementById('sim-formula-sub');
    this.fResult = document.getElementById('sim-formula-result');

    this.chartVT.setTitle('v-t 图（速度）');
    this.chartXT.setTitle('x-t 图（位移）');

    this.buildTypes();
    this.buildFields();
    this.bindCanvas();

    document.getElementById('sim-close').addEventListener('click', () => {
      AudioManager.playClick();
      this.close();
    });
    document.getElementById('sim-solve').addEventListener('click', () => this.runSolve());
    document.getElementById('sim-clear').addEventListener('click', () => this.clearAll());
    document.getElementById('sim-chart-toggle').addEventListener('click', () => this.toggleCharts());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.setHint('在 v₀ / v / a / t / x 中任填 3 个已知量，留空 2 个由系统自动匹配公式求解。');
    this.clearAll(true);
  }

  // ---- 画布交互：进度条拖动逐帧检验 + 播放/暂停 + 左右方向键逐帧 ----
  bindCanvas() {
    const c = this.canvas;
    const toLocal = (e) => {
      const r = c.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (c.clientWidth / Math.max(r.width, 1)),
        y: (e.clientY - r.top) * (c.clientHeight / Math.max(r.height, 1)),
      };
    };

    c.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      const hit = this.hitProgress(p.x, p.y);
      if (!hit) return;
      e.preventDefault();
      if (hit === 'btn') {
        this.togglePlay();
        return;
      }
      this.dragging = true;
      if (c.setPointerCapture) c.setPointerCapture(e.pointerId);
      this.seekFromX(p.x);
    });

    c.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      if (this.dragging) {
        this.seekFromX(p.x);
        return;
      }
      const hit = this.hitProgress(p.x, p.y);
      c.style.cursor = hit === 'btn' ? 'pointer' : (hit ? 'ew-resize' : 'default');
    });

    const stopDrag = () => { this.dragging = false; };
    c.addEventListener('pointerup', stopDrag);
    c.addEventListener('pointercancel', stopDrag);

    c.addEventListener('keydown', (e) => {
      if (!this.solved || this.tEnd <= 0) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepFrames(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  hitProgress(x, y) {
    const g = this.progGeom;
    if (!g) return null;
    if (y < g.barY - 22 || y > g.barY + 16) return null;
    if (x >= g.btnX - 4 && x <= g.btnX + g.btnSize + 4) return 'btn';
    if (x >= g.trackX0 - 6 && x <= g.trackX1 + 6) return 'track';
    return null;
  }

  seekFromX(x) {
    const g = this.progGeom;
    if (!g || !this.solved || this.tEnd <= 0) return;
    const frac = clampNum((x - g.trackX0) / Math.max(g.trackX1 - g.trackX0, 1), 0, 1);
    this.seek(frac * this.tEnd);
  }

  // 定位到某一时刻（暂停播放，便于逐帧检查）
  seek(t) {
    if (!this.solved) return;
    this.playing = false;
    this.animT = clampNum(t, 0, this.tEnd);
    this.syncCharts();
  }

  stepFrames(n) {
    this.seek(this.animT + n * Constants.FIXED_DT);
  }

  togglePlay() {
    if (!this.solved || this.tEnd <= 0) return;
    if (this.playing) {
      this.playing = false;
      return;
    }
    if (this.animT >= this.tEnd - 1e-9) this.animT = 0; // 已结束则从头播放
    this.playing = true;
    AudioManager.playClick();
  }

  // ---- 题目类型 ----
  buildTypes() {
    this.typeBtns = {};
    this.typesHost.innerHTML = '';
    for (const t of SIM_TYPES) {
      const btn = makeEl('button', 'sim-type', t.ready ? t.name : `${t.name}（${t.note}）`);
      btn.type = 'button';
      if (!t.ready) btn.classList.add('soon');
      btn.addEventListener('click', () => this.selectType(t.key));
      this.typeBtns[t.key] = btn;
      this.typesHost.appendChild(btn);
    }
    this.refreshTypes();
  }

  selectType(key) {
    const t = SIM_TYPES.find((x) => x.key === key);
    if (!t) return;
    AudioManager.playClick();
    if (!t.ready) {
      this.setHint(`「${t.name}」${t.note}：仅作出选项，暂未开放实际内容。当前可仿真的题目类型为「匀变速直线运动」。`);
      return;
    }
    this.typeKey = key;
    this.refreshTypes();
    this.setHint('已选择「匀变速直线运动」：在 v₀ / v / a / t / x 中任填 3 个，留空 2 个自动求解。');
  }

  refreshTypes() {
    for (const t of SIM_TYPES) {
      const b = this.typeBtns[t.key];
      if (b) b.classList.toggle('active', t.key === this.typeKey);
    }
    const cur = SIM_TYPES.find((x) => x.key === this.typeKey);
    this.typeTag.textContent = cur && cur.ready ? `${cur.name} · 4 类公式自动匹配` : '';
  }

  // ---- 数据输入 ----
  buildFields() {
    this.fieldsHost.innerHTML = '';
    for (const g of SIM_GROUPS) {
      this.fieldsHost.appendChild(makeEl('div', 'panel-section', g.title));
      for (const f of g.fields) {
        const row = makeEl('div', 'field-row');
        row.appendChild(makeEl('span', 'field-label', f.label));
        const input = makeEl('input', 'field-input');
        input.type = 'number';
        input.step = '0.1';
        input.placeholder = f.primary ? '已知 / 待求' : '记录项';
        input.addEventListener('input', () => this.onFieldEdit(f.key, input));
        row.appendChild(input);
        row.appendChild(makeEl('span', 'field-unit', f.unit));
        this.fields[f.key] = { input, def: f };
        this.fieldsHost.appendChild(row);
      }
    }
    const note = makeEl('div', 'panel-hint', 'a₀ 仅作记录，不参与公式求解。加速度取单一恒定值 a。');
    this.fieldsHost.appendChild(note);
  }

  onFieldEdit(key, input) {
    input.classList.remove('solved');
    if (this.solved) {
      this.solved = null;
      this.playing = false;
      this.setHint('数据已修改，请重新点击「求解并仿真」。');
    }
  }

  readValues() {
    const out = {};
    for (const key of Object.keys(this.fields)) {
      const raw = this.fields[key].input.value.trim();
      if (raw === '') continue;
      const n = parseFloat(raw);
      if (Number.isNaN(n)) continue;
      out[key] = n;
    }
    return out;
  }

  // ---- 求解 ----
  runSolve() {
    AudioManager.playClick();
    if (this.typeKey !== 'linear') {
      this.setHint('当前题目类型暂未开放，请选择「匀变速直线运动」。', true);
      return;
    }
    const vals = this.readValues();
    const known = {};
    for (const k of SIM_PRIMARY) if (vals[k] !== undefined) known[k] = vals[k];
    const n = Object.keys(known).length;
    if (n < 3) {
      this.fail(`已知量不足：还需再填 ${3 - n} 个（v₀ / v / a / t / x 中任填 3 个）`);
      return;
    }
    if (n > 3) {
      this.fail(`已知量过多：已填 ${n} 个，请留空恰好 2 个待求项`);
      return;
    }
    if (known.t !== undefined && known.t < 0) {
      this.fail('时间 t 不能为负，请修改后重试');
      return;
    }

    const res = simSolve(known);
    if (res.error) {
      this.fail(res.error);
      return;
    }

    const s = Object.assign({}, known, res.values);
    this.solved = s;

    // 回填自动求出的量
    for (const k of SIM_PRIMARY) {
      if (known[k] !== undefined) continue;
      const inp = this.fields[k].input;
      inp.value = simNum(s[k]);
      inp.classList.add('solved');
    }

    this.showDerivation(known, res.steps, s);
    this.setHint('求解完成：橙色输入框为系统自动算出并回填的结果。');
    this.startAnimation();
  }

  fail(msg) {
    this.setHint(msg, true);
    this.fTitle.textContent = '公式推导';
    this.fLine.textContent = '暂无法求解';
    this.fSub.textContent = '';
    this.fResult.textContent = msg;
  }

  showDerivation(known, steps, s) {
    const knownText = SIM_PRIMARY
      .filter((k) => known[k] !== undefined)
      .map((k) => `${SIM_SYMBOL[k]} = ${simNum(known[k])} ${SIM_UNIT[k]}`)
      .join('、');
    const wantText = SIM_PRIMARY
      .filter((k) => known[k] === undefined)
      .map((k) => SIM_SYMBOL[k])
      .join('、');

    this.fTitle.textContent = '公式推导 · 匀变速直线运动';
    this.fLine.textContent = `已知：${knownText}　→　待求：${wantText}`;
    this.fSub.textContent = steps.map((st, i) => `${i + 1}. 【${st.id.toUpperCase()}】${st.text}`).join('\n');
    this.fResult.textContent = `求解结果：${wantText.split('、').map((sym, i) => {
      const k = SIM_PRIMARY.filter((kk) => known[kk] === undefined)[i];
      return `${sym} = ${simNum(s[k])} ${SIM_UNIT[k]}`;
    }).join('，')}`;
  }

  // ---- 动画 ----
  startAnimation() {
    const s = this.solved;
    this.tEnd = Math.max(s.t, 0);
    this.animT = 0;
    this.playing = false;
    if (this.tEnd <= 0) {
      this.syncCharts();
      this.setHint('求得时间 t = 0，没有可播放的运动过程。', true);
      return;
    }
    const gs = this.tEnd <= 1 ? 0.2 : (this.tEnd <= 3 ? 0.5 : (this.tEnd <= 8 ? 1 : 2));
    this.animGridStep = gs;
    for (const c of [this.chartVT, this.chartXT]) {
      c.timeWindow = this.tEnd;
      c.gridStep = gs;
      c.setTheoryFunc(null);
    }
    this.chartVT.setTheoryFunc((tt) => s.v0 + s.a * tt);
    this.chartXT.setTheoryFunc((tt) => s.v0 * tt + 0.5 * s.a * tt * tt);
    if (Math.abs(s.a) > SIM_EPS && s.v0 * s.a < 0) {
      this.setHint(`注意：a 与 v₀ 反向，物块先减速到 0（t = ${simNum(-s.v0 / s.a)} s）后反向加速。`);
    }
    this.playing = true;
    this.syncCharts();
  }

  clearAll(silent) {
    for (const key of Object.keys(this.fields)) {
      const inp = this.fields[key].input;
      inp.value = '';
      inp.classList.remove('solved');
    }
    this.solved = null;
    this.playing = false;
    this.dragging = false;
    this.animT = 0;
    this.tEnd = 0;
    this.chartVT.clear();
    this.chartXT.clear();
    this.chartVT.setTheoryFunc(null);
    this.chartXT.setTheoryFunc(null);
    this.fTitle.textContent = '公式推导';
    this.fLine.textContent = '请选择题目类型并输入数据';
    this.fSub.textContent = '';
    this.fResult.textContent = '';
    if (!silent) {
      this.setHint('已清空全部数据，可重新输入 3 个已知量。');
      AudioManager.playClick();
    }
  }

  setHint(msg, isErr) {
    this.hintEl.textContent = msg || '';
    this.hintEl.classList.toggle('err', !!isErr);
  }

  // ---- 开关 ----
  open() {
    this.overlay.classList.remove('hidden');
    const fam = this.game.fontFamily();
    this.chartVT.render(this.chartVTEl, fam);
    this.chartXT.render(this.chartXTEl, fam);
  }

  close() {
    this.overlay.classList.add('hidden');
    this.playing = false; // 关闭时暂停动画，保留当前画面
  }

  isOpen() { return !this.overlay.classList.contains('hidden'); }

  // ---- 每帧：推进时间 + 更新曲线 ----
  step(dt) {
    if (!this.solved || !this.playing) return;
    this.animT = Math.min(this.animT + dt, this.tEnd);
    if (this.animT >= this.tEnd - 1e-9) this.playing = false;
    this.syncCharts();
  }

  // 曲线始终按当前时刻重建，便于进度条来回拖动时图表与画面保持一致
  syncCharts() {
    this.chartVT.clear();
    this.chartXT.clear();
    const s = this.solved;
    if (!s) return;
    const n = 240;
    for (let i = 0; i <= n; i++) {
      const tt = this.animT * i / n;
      this.chartVT.pushValue(tt, s.v0 + s.a * tt);
      this.chartXT.pushValue(tt, s.v0 * tt + 0.5 * s.a * tt * tt);
    }
  }

  render() {
    this.renderMotion();
    if (!this.chartsOpen) return;
    const fam = this.game.fontFamily();
    this.chartVT.render(this.chartVTEl, fam);
    this.chartXT.render(this.chartXTEl, fam);
  }

  // ---- 图表坞折叠 ----
  toggleCharts() {
    this.chartsOpen = !this.chartsOpen;
    this.chartDock.classList.toggle('open', this.chartsOpen);
    this.chartArrow.textContent = this.chartsOpen ? '收起 ▴' : '展开 ▾';
    AudioManager.playClick();
  }

  // 运动画布：实验室网格 + 地面 + 刻度/位移标尺 + 物块与矢量 + 底部进度条
  renderMotion() {
    const { ctx, w, h } = prepareCanvas(this.canvas);
    if (w <= 10 || h <= 10) return;
    const fam = this.game.fontFamily();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = Constants.COLOR_CANVAS;
    ctx.fillRect(0, 0, w, h);

    // 地面上方留给运动场景，下方 96px 固定留给刻度与进度条
    const groundY = h - 96;
    drawGrid(ctx, w, h, 0);
    drawGround(ctx, w, h, groundY / h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (!this.solved) {
      ctx.fillStyle = Constants.COLOR_TEXT_DIM;
      ctx.font = `13px ${fam}`;
      ctx.fillText('输入 3 个已知量后点击「求解并仿真」，此处将播放物块的运动过程。', 16, 26);
      this.drawProgress(ctx, w, h, fam);
      return;
    }

    const s = this.solved;
    const tEnd = this.tEnd;
    const posAt = (tau) => s.v0 * tau + 0.5 * s.a * tau * tau;
    const tt = this.animT;
    const posNow = posAt(tt);
    const vNow = s.v0 + s.a * tt;

    // 横轴映射：覆盖整段运动（a 与 v₀ 反向时含折返点）
    const cands = [0, posAt(tEnd)];
    if (Math.abs(s.a) > SIM_EPS) {
      const tv = -s.v0 / s.a;
      if (tv > 0 && tv < tEnd) cands.push(posAt(tv));
    }
    const lo = Math.min(...cands);
    const hi = Math.max(...cands);
    const span = Math.max(hi - lo, 0.5);
    const padL = 56, padR = 56;
    const scale = Math.min(Constants.PX_PER_METER, (w - padL - padR) / span);
    const xOf = (sv) => padL + (sv - lo) * scale;

    // 米刻度
    const tickStep = span <= 6 ? 1 : (span <= 12 ? 2 : 5);
    ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.8);
    ctx.lineWidth = 1;
    ctx.font = `10px ${fam}`;
    ctx.textAlign = 'center';
    for (let m = Math.ceil(lo / tickStep) * tickStep; m <= hi + 1e-9; m += tickStep) {
      const xx = xOf(m);
      ctx.beginPath();
      ctx.moveTo(xx, groundY + 4);
      ctx.lineTo(xx, groundY + 11);
      ctx.stroke();
      ctx.fillStyle = Constants.COLOR_TEXT_DIM;
      ctx.fillText(simNum(m), xx, groundY + 23);
    }

    // 起点竖虚线（仅作起点标注）
    const xs = xOf(0);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.95);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xs, 30);
    ctx.lineTo(xs, groundY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = Constants.COLOR_TEXT_DIM;
    ctx.font = `10px ${fam}`;
    ctx.textAlign = 'center';
    ctx.fillText('起点', xs, 24);

    // 位移标尺（起点 → 终点）
    if (Math.abs(s.x) > 1e-6) {
      const xe = xOf(s.x);
      const ry = groundY + 38;
      ctx.strokeStyle = Constants.COLOR_HIGHLIGHT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xs, ry);
      ctx.lineTo(xe, ry);
      ctx.moveTo(xs, ry - 5);
      ctx.lineTo(xs, ry + 5);
      ctx.moveTo(xe, ry - 5);
      ctx.lineTo(xe, ry + 5);
      ctx.stroke();
      ctx.fillStyle = Constants.COLOR_HIGHLIGHT;
      ctx.font = `11px ${fam}`;
      ctx.textAlign = 'center';
      ctx.fillText(`位移 x = ${simNum(s.x)} m`, (xs + xe) / 2, ry + 13);
    }

    // 物块（白块 + 深墨描边，与各关卡一致）
    const bw = 46, bh = 46;
    const bx = Math.min(Math.max(xOf(posNow) - bw / 2, 14), w - bw - 14);
    const by = groundY - bh;
    const bcx = bx + bw / 2;   // 物块中心竖线：各矢量的起点
    const bcy = by + bh / 2;
    ctx.fillStyle = Constants.COLOR_BLOCK;
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.stroke();

    // 物块上只标「受到的力」：合外力 F 方向与 a 一致
    ctx.font = `13px ${fam}`;
    const fLen = Math.min(Math.abs(s.a) * 8, 120);
    if (fLen > 2) {
      const sgn = Math.sign(s.a);
      drawArrowInto(ctx, { x: bcx, y: bcy }, { x: sgn, y: 0 }, fLen,
        Constants.COLOR_FORCE, false, 3);
      ctx.fillStyle = Constants.COLOR_FORCE;
      ctx.textAlign = sgn > 0 ? 'left' : 'right';
      ctx.fillText('F', bcx + sgn * (fLen + 8), bcy + 5);
    }

    // 速度矢量（蓝）与加速度矢量（红）浮于物块上方，不压在物块上
    const aY = Math.max(by - 26, 42);
    const vY = Math.max(by - 56, aY - 28);
    const vLen = Math.min(Math.abs(vNow) * 8, 130);
    if (vLen > 2) {
      const sgn = Math.sign(vNow);
      drawArrowInto(ctx, { x: bcx, y: vY }, { x: sgn, y: 0 }, vLen,
        Constants.COLOR_FRICTION, false, 3);
      ctx.fillStyle = Constants.COLOR_FRICTION;
      ctx.textAlign = sgn > 0 ? 'left' : 'right';
      ctx.fillText('v', bcx + sgn * (vLen + 8), vY + 5);
    }
    const aLen = Math.min(Math.abs(s.a) * 8, 120);
    if (aLen > 2) {
      const sgn = Math.sign(s.a);
      drawArrowInto(ctx, { x: bcx, y: aY }, { x: sgn, y: 0 }, aLen,
        Constants.COLOR_FORCE, false, 3);
      ctx.fillStyle = Constants.COLOR_FORCE;
      ctx.textAlign = sgn > 0 ? 'left' : 'right';
      ctx.fillText('a', bcx + sgn * (aLen + 8), aY + 5);
    }

    // 左上角状态
    const state = this.playing ? '运动中' : (tt >= tEnd - 1e-9 ? '已结束' : (tt <= 1e-9 ? '未开始' : '已暂停'));
    ctx.textAlign = 'left';
    ctx.fillStyle = Constants.COLOR_TEXT;
    ctx.font = `13px ${fam}`;
    ctx.fillText(
      `t = ${simNum(tt, 2)} / ${simNum(tEnd, 2)} s　x = ${simNum(posNow, 3)} m　v = ${simNum(vNow, 3)} m/s　a = ${simNum(s.a, 3)} m/s²　（${state}）`,
      16, 22);
    ctx.fillStyle = Constants.COLOR_TEXT_DIM;
    ctx.font = `11px ${fam}`;
    ctx.fillText('拖动进度条逐帧检验，或按 ← / → 逐帧步进', 16, 40);

    this.drawProgress(ctx, w, h, fam);
  }

  // 画布下半部分的进度条：播放/暂停 + 可拖动时间轴 + 时间刻度
  drawProgress(ctx, w, h, fam) {
    const barY = h - 18;
    const btnX = 12;
    const btnSize = 32;
    const btnY = barY - btnSize / 2;
    const trackX0 = btnX + btnSize + 12;
    const trackX1 = w - 16;
    this.progGeom = { barY, btnX, btnSize, trackX0, trackX1 };

    const ready = !!this.solved && this.tEnd > 0;
    const frac = ready ? clampNum(this.animT / this.tEnd, 0, 1) : 0;

    // 播放 / 暂停按钮
    ctx.save();
    ctx.fillStyle = Constants.COLOR_PANEL_ALT;
    ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.9);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(btnX, btnY, btnSize, btnSize);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ready ? Constants.COLOR_HIGHLIGHT : Constants.COLOR_TEXT_DIM;
    if (this.playing) {
      ctx.fillRect(btnX + 11, btnY + 8, 4, 16);
      ctx.fillRect(btnX + 18, btnY + 8, 4, 16);
    } else {
      ctx.beginPath();
      ctx.moveTo(btnX + 12, btnY + 8);
      ctx.lineTo(btnX + 23, btnY + 16);
      ctx.lineTo(btnX + 12, btnY + 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 轨道
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.7);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(trackX0, barY);
    ctx.lineTo(trackX1, barY);
    ctx.stroke();
    if (ready && frac > 0) {
      ctx.strokeStyle = Constants.COLOR_HIGHLIGHT;
      ctx.beginPath();
      ctx.moveTo(trackX0, barY);
      ctx.lineTo(trackX0 + (trackX1 - trackX0) * frac, barY);
      ctx.stroke();
    }
    ctx.restore();

    // 时间刻度
    if (ready && this.animGridStep > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(Constants.COLOR_AXIS, 0.75);
      ctx.lineWidth = 1;
      ctx.font = `10px ${fam}`;
      ctx.fillStyle = Constants.COLOR_TEXT_DIM;
      ctx.textAlign = 'center';
      for (let tv = 0; tv <= this.tEnd + 1e-9; tv += this.animGridStep) {
        const xx = trackX0 + (trackX1 - trackX0) * (tv / this.tEnd);
        ctx.beginPath();
        ctx.moveTo(xx, barY - 8);
        ctx.lineTo(xx, barY - 3);
        ctx.stroke();
        ctx.fillText(simNum(tv, 1), xx, barY - 11);
      }
      ctx.restore();
    }

    // 当前时间
    ctx.save();
    ctx.font = `11px ${fam}`;
    ctx.fillStyle = Constants.COLOR_TEXT;
    ctx.textAlign = 'right';
    ctx.fillText(`${simNum(this.animT, 2)} / ${simNum(this.tEnd, 2)} s`, trackX1, h - 5);
    ctx.restore();

    // 手柄
    if (ready) {
      const hx = trackX0 + (trackX1 - trackX0) * frac;
      ctx.save();
      ctx.fillStyle = Constants.COLOR_HIGHLIGHT;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, barY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
