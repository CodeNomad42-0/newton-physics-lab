// 关卡实现（视图 + 控制器）：主菜单 + 三关，均为"按钮式"，参数用数字输入框

// ---------------- 工具函数 ----------------

function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

// ---------------- 关卡公共骨架 ----------------

class LevelBase {
  constructor(game) {
    this.game = game;
    this.engine = new PhysicsEngine();
    this.vectorDrawer = new VectorDrawer();
    this.chartVT = new ChartRenderer(ChartType.V_T, 10.0);
    this.chartXT = new ChartRenderer(ChartType.X_T, 10.0);
    this.camScroll = 0;
    this.simTime = 0;
    this.fields = {};
    this.panel = null;
    this.blockY = null;
    this._readouts = {};
  }

  get title() { return '牛顿三定律 · 交互式物理实验室'; }
  get tag() { return ''; }

  // ---- 面板构建辅助 ----
  build(panel) {
    this.panel = panel;
    panel.innerHTML = '';
  }

  sectionTitle(text) {
    this.panel.appendChild(makeEl('div', 'panel-section', text));
  }

  spacer(h) {
    const s = makeEl('div', 'panel-gap');
    s.style.height = (h || 8) + 'px';
    this.panel.appendChild(s);
  }

  // 数字输入框（取代原滑块）：label + <input type=number> + 单位
  addField(key, opts) {
    const row = makeEl('div', 'field-row');
    row.appendChild(makeEl('span', 'field-label', opts.label));

    const input = makeEl('input', 'field-input');
    input.type = 'number';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    input.value = String(opts.value);
    row.appendChild(input);
    row.appendChild(makeEl('span', 'field-unit', opts.unit || ''));

    const apply = (raw, rewrite) => {
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) return;
      const v = clampNum(parsed, opts.min, opts.max);
      if (rewrite && String(v) !== input.value) input.value = String(v);
      this.fields[key] = v;
      if (opts.onChange) opts.onChange(v);
    };

    input.addEventListener('input', () => apply(input.value, false));
    input.addEventListener('change', () => {
      // 失焦/回车时归一化：缺失或越界都写回合法值
      const parsed = parseFloat(input.value);
      if (Number.isNaN(parsed)) input.value = String(this.fields[key]);
      else apply(input.value, true);
    });

    this.panel.appendChild(row);
    this.fields[key] = clampNum(opts.value, opts.min, opts.max);
    this._inputs = this._inputs || {};
    this._inputs[key] = input;
    // 注册即同步初始值到物理引擎（与原滑块注册行为一致，保证默认参数生效）
    if (opts.onChange) opts.onChange(this.fields[key]);
    return input;
  }

  setField(key, v) {
    this.fields[key] = v;
    if (this._inputs && this._inputs[key]) this._inputs[key].value = String(v);
  }

  getVal(key) {
    const v = this.fields[key];
    return v === undefined ? 0 : v;
  }

  addButton(text, cls, onClick, block) {
    const b = makeEl('button', 'btn' + (cls ? ' ' + cls : '') + (block === false ? '' : ' btn-block'), text);
    b.type = 'button';
    b.addEventListener('click', () => {
      AudioManager.playClick();
      onClick();
    });
    this.panel.appendChild(b);
    return b;
  }

  addHint(text) {
    this.panel.appendChild(makeEl('div', 'panel-hint', text));
  }

  addReadout(key, initial) {
    const e = makeEl('div', 'panel-readout', initial || '');
    this.panel.appendChild(e);
    this._readouts[key] = e;
    return e;
  }

  setReadout(key, text) {
    const e = this._readouts[key];
    if (e) e.textContent = text;
  }

  addCheckbox(label, checked, onChange) {
    const wrap = makeEl('label', 'check-row');
    const input = makeEl('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.appendChild(input);
    wrap.appendChild(makeEl('span', null, label));
    this.panel.appendChild(wrap);
    return input;
  }

  // ---- 相机跟随（网格 = 世界坐标系，随物块适应性平移） ----
  resetCamera() {
    this.camScroll = 0;
    if (this.game.note) this.game.note.textContent = '';
  }

  worldToScreenX(worldXm) {
    const w = worldXm * Constants.PX_PER_METER;
    const cw = this.game.canvas.clientWidth;
    if (cw > 0) {
      const l = cw * 0.10;
      const r = cw * 0.62;
      const sx = w - this.camScroll;
      if (sx > r) this.camScroll = w - r;
      else if (sx < l) this.camScroll = w - l;
    }
    return w - this.camScroll;
  }

  // ---- 图表数据 ----
  pushCharts() {
    this.chartVT.pushValue(this.simTime, this.engine.getVelocity());
    this.chartXT.pushValue(this.simTime, this.engine.getPosition());
  }

  clearCharts() {
    this.chartVT.clear();
    this.chartXT.clear();
  }

  // ---- 生命周期（子类覆盖） ----
  setup() {}
  reset() {}
  stepPhysics(dt) {
    if (this.engine.running) {
      this.engine.step(dt);
      this.simTime += dt;
      this.pushCharts();
    }
  }
  render() {}
  updateFormula() {}

  // ---- 公共绘制：网格 + 地面 ----
  drawScene(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = Constants.COLOR_CANVAS;
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h, this.camScroll);
    drawGround(ctx, w, h);
  }
}

// ---------------- 关卡一 · 牛一定律（惯性迷局） ----------------

class LevelOne extends LevelBase {
  constructor(game) {
    super(game);
    this.START_X = 2.5;
    this.V0_PUSH = 5.0;
    this.MASS = 2.0;
    this.HALF_W = 34;
    this.HALF_H = 30;
  }

  get title() { return '关卡一 · 惯性迷局'; }
  get tag() { return '牛顿第一定律 · 惯性 · 必修1 §1.1.3'; }

  setup() {
    this.build(this.game.controlBody);
    this.engine.mass = this.MASS;
    this.engine.v0 = this.V0_PUSH;
    this.engine.frictionCoeff = 0.2;

    this.sectionTitle('参数调节');
    this.addField('mu', {
      label: '摩擦系数 μ', min: 0, max: 0.8, step: 0.01, value: 0.2, unit: '',
      onChange: (v) => { this.engine.frictionCoeff = v; this.engine.recomputeState(); this.updateFormula(); },
    });

    this.spacer(4);
    this.sectionTitle('操作');
    this.pushBtn = this.addButton('推一下（v₀=5 m/s）', 'btn-primary', () => this.onPush());
    this.spacer(4);

    this.sectionTitle('显示');
    this.addCheckbox('受力透视（显示 G/N）', true, (on) => {
      this.vectorDrawer.simplified = !on;
      this.setReadout('simp', on ? '' : '简化模式：G 与 N 等大反向抵消，仅显示水平合力');
    });
    this.addReadout('simp', '');

    this.spacer(4);
    this.addHint('点击「推一下」给物块初速度，观察 μ 变化对滑行距离的影响：\nμ=0 时 V-t 图为水平直线（匀速）；μ>0 时斜率为负（匀减速）。');

    this.addReadout('fs', 'F = 0.00 N');
    this.spacer(4);
    this.addButton('重置', null, () => { this.reset(); this.engine.running = false; });

    this.chartVT.setTitle('V-t 图');
    this.chartXT.setTitle('X-t 图');
    this.chartVT.setTheoryFunc((t) => this.theoryV(t));
    this.chartXT.setTheoryFunc((t) => this.theoryS(t));
    this.chartVT.setAutoScale(false);
    this.chartVT.setFixedRange(0, 6);

    this.game.setFormulaTitle('摩擦力与合力');
    this.reset();
  }

  onPush() {
    this.engine.v0 = this.V0_PUSH;
    this.engine.reset();
    this.engine.recomputeState();
    this.engine.running = true;
    this.resetCamera();
    this.simTime = 0;
    this.clearCharts();
    this.setReadout('fs', 'F = 0.00 N（撤去推力，惯性滑行）');
  }

  reset() {
    this.engine.v0 = this.V0_PUSH;
    this.engine.reset();
    this.engine.appliedForce = 0;
    this.engine.recomputeState();
    this.engine.running = false;
    this.resetCamera();
    this.simTime = 0;
    this.clearCharts();
    this.setReadout('fs', 'F = 0.00 N');
    this.updateFormula();
  }

  updateFormula() {
    const mu = this.engine.frictionCoeff;
    const m = this.engine.mass;
    const g = this.engine.gravity;
    const f = mu * m * g;
    const fPush = this.engine.appliedForce;
    const net = fPush - f;
    this.game.setFormula('F_合 = F_推 − μ·m·g        f = μ·m·g');
    this.game.setSubstitution(
      `F_合 = ${fPush.toFixed(2)} − ${mu.toFixed(2)}×${m.toFixed(2)}×${g.toFixed(2)} = ${net.toFixed(2)} N    f = ${f.toFixed(2)} N`);
    this.game.setResult(
      `a = F_合/m = ${this.engine.getAcceleration().toFixed(2)} m/s²    v = ${this.engine.getVelocity().toFixed(2)} m/s`);
  }

  theoryV(t) {
    const a = -this.engine.frictionCoeff * this.engine.gravity;
    return Math.max(this.V0_PUSH + a * t, 0);
  }

  theoryS(t) {
    const a = -this.engine.frictionCoeff * this.engine.gravity;
    if (a < -1e-9) {
      const tStop = -this.V0_PUSH / a;
      const tc = Math.min(t, tStop);
      return this.V0_PUSH * tc + 0.5 * a * tc * tc;
    }
    return this.V0_PUSH * t;
  }

  render() {
    const { ctx, w, h } = prepareCanvas(this.game.canvas);
    if (w <= 10 || h <= 10) return;
    this.drawScene(ctx, w, h);

    if (this.blockY === null) this.blockY = h * 0.72 - this.HALF_H;
    const worldX = this.START_X + this.engine.getPosition();
    const sx = this.worldToScreenX(worldX);
    const cy = this.blockY;

    // 物块
    ctx.fillStyle = Constants.COLOR_BLOCK;
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.fillRect(sx - this.HALF_W, cy - this.HALF_H, this.HALF_W * 2, this.HALF_H * 2);
    ctx.strokeRect(sx - this.HALF_W, cy - this.HALF_H, this.HALF_W * 2, this.HALF_H * 2);

    // 受力图
    this.vectorDrawer.setBounds(w, h, 12);
    this.vectorDrawer.clear();
    this.vectorDrawer.drawForceBalance(this.engine, { x: sx, y: cy }, h);
    if (this.vectorDrawer.simplified) {
      this.vectorDrawer.drawNetForceArrow(this.engine, { x: sx, y: cy });
    }
    this.vectorDrawer.render(ctx, this.game.fontFamily());

    this.updateFormula();
  }
}

// ---------------- 关卡二 · 牛二定律（加速度工坊） ----------------

class LevelTwo extends LevelBase {
  constructor(game) {
    super(game);
    this.START_X = 7.0;
    this.HALF_W = 34;
    this.HALF_H = 30;
    this.started = false;
  }

  get title() { return '关卡二 · 加速度工坊'; }
  get tag() { return '牛顿第二定律 F=m·a · 必修1 §1.2.3'; }

  setup() {
    this.build(this.game.controlBody);
    this.engine.mass = 2.0;
    this.engine.frictionCoeff = 0.0;
    this.engine.v0 = 0.0;

    this.sectionTitle('参数调节');
    this.addField('F', {
      label: '施加力 F', min: 1, max: 20, step: 0.5, value: 1.0, unit: 'N',
      onChange: (v) => {
        // 运行中实时生效
        if (this.started && this.engine.running) {
          this.engine.appliedForce = v;
          this.engine.recomputeState();
        }
        this.updateFormula();
      },
    });
    this.addField('m', {
      label: '质量 m', min: 1, max: 10, step: 0.5, value: 1.0, unit: 'kg',
      onChange: (v) => { this.engine.mass = v; this.engine.recomputeState(); this.updateFormula(); },
    });
    this.addField('v0', {
      label: '初速度 v₀', min: -10, max: 10, step: 0.5, value: 0, unit: 'm/s',
      onChange: (v) => { if (!this.started) this.engine.v0 = v; this.updateFormula(); },
    });
    this.addField('mu', {
      label: '摩擦系数 μ', min: 0, max: 0.8, step: 0.01, value: 0, unit: '',
      onChange: (v) => { this.engine.frictionCoeff = v; this.engine.recomputeState(); this.updateFormula(); },
    });

    this.spacer(4);
    this.sectionTitle('操作');
    this.runBtn = this.addButton('运行', 'btn-primary', () => this.onRunPause());
    this.addReadout('fs', 'F = 0.00 N');
    this.spacer(4);
    this.addHint('彩蛋：设 v₀ 为负、F 为正，观察 V-t 图穿过零点——先减速后反向加速。\nμ 默认 0（光滑面），调大 μ 可观察摩擦减速；一切遵循 F_合 = m·a。');
    this.addButton('重置', null, () => this.reset());

    this.chartVT.setTitle('V-t 图（斜率 = 加速度）');
    this.chartXT.setTitle('X-t 图');
    this.chartVT.setTheoryFunc((t) => this.theoryV(t));
    this.chartXT.setTheoryFunc((t) => this.theoryS(t));
    this.chartVT.setAutoScale(true);

    this.game.setFormulaTitle('牛顿第二定律 F = m·a');
    this.reset();
  }

  onRunPause() {
    if (this.engine.running) {
      this.engine.running = false;
      this.runBtn.textContent = '继续';
      return;
    }
    if (!this.started) {
      this.applyParamsAndStart();
      this.runBtn.textContent = '暂停';
    } else {
      this.engine.running = true;
      this.runBtn.textContent = '暂停';
    }
  }

  applyParamsAndStart() {
    this.engine.v0 = this.getVal('v0');
    this.engine.mass = this.getVal('m');
    this.engine.frictionCoeff = this.getVal('mu');
    this.engine.reset();
    this.engine.appliedForce = this.getVal('F');
    this.engine.recomputeState();
    this.engine.running = true;
    this.started = true;
    this.simTime = 0;
    this.clearCharts();
    this.resetCamera();
    this.setReadout('fs', `F = ${this.engine.appliedForce.toFixed(1)} N（运行中）`);
    this.updateFormula();
  }

  reset() {
    this.started = false;
    this.engine.v0 = this.getVal('v0');
    this.engine.reset();
    this.engine.appliedForce = 0;
    this.engine.recomputeState();
    this.engine.running = false;
    this.simTime = 0;
    this.resetCamera();
    this.clearCharts();
    this.runBtn.textContent = '运行';
    this.setReadout('fs', 'F = 0.00 N');
    this.updateFormula();
  }

  updateFormula() {
    const F = this.engine.appliedForce;
    const m = this.engine.mass;
    const f = this.engine.getFriction();
    const a = this.engine.getAcceleration();
    const t = this.engine.getTime();
    const v0 = this.engine.v0;
    const v = this.engine.getVelocity();
    const s = this.engine.getPosition();
    this.game.setFormula('F_合 = F − f     a = F_合/m     v = v₀ + a·t     s = v₀·t + ½·a·t²');
    this.game.setSubstitution(
      `F_合 = ${F.toFixed(1)} + (${f.toFixed(1)}) = ${(F + f).toFixed(2)} N    a = ${a.toFixed(2)} m/s²`);
    this.game.setResult(
      `v = ${v0.toFixed(2)} + ${a.toFixed(2)}×${t.toFixed(2)} = ${v.toFixed(2)} m/s    s = ${s.toFixed(2)} m`);
  }

  theoryV(t) {
    const a = (this.engine.appliedForce + this.engine.getFriction()) / this.engine.mass;
    return this.engine.v0 + a * t;
  }

  theoryS(t) {
    const a = (this.engine.appliedForce + this.engine.getFriction()) / this.engine.mass;
    return this.engine.v0 * t + 0.5 * a * t * t;
  }

  render() {
    const { ctx, w, h } = prepareCanvas(this.game.canvas);
    if (w <= 10 || h <= 10) return;
    this.drawScene(ctx, w, h);

    if (this.blockY === null) this.blockY = h * 0.72 - this.HALF_H;
    const sx = this.worldToScreenX(this.START_X + this.engine.getPosition());
    const cy = this.blockY;

    ctx.fillStyle = Constants.COLOR_BLOCK;
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.fillRect(sx - this.HALF_W, cy - this.HALF_H, this.HALF_W * 2, this.HALF_H * 2);
    ctx.strokeRect(sx - this.HALF_W, cy - this.HALF_H, this.HALF_W * 2, this.HALF_H * 2);

    this.vectorDrawer.setBounds(w, h, 12);
    this.vectorDrawer.clear();
    this.vectorDrawer.drawForceBalance(this.engine, { x: sx, y: cy }, h);
    if (this.vectorDrawer.simplified) {
      this.vectorDrawer.drawNetForceArrow(this.engine, { x: sx, y: cy });
    }
    this.vectorDrawer.render(ctx, this.game.fontFamily());

    this.updateFormula();
  }
}

// ---------------- 关卡三 · 牛三定律（碰撞交锋） ----------------

class LevelThree extends LevelBase {
  constructor(game) {
    super(game);
    this.START_A = 2.0;
    this.START_B = 9.0;
    this.START_Y = 3.5;
    this.WORLD_MIN_X = 0.0;
    this.WORLD_MAX_X = 13.5;
    // Y 轴上下边界：中心点受半径 34px 约束后，球体始终落在地面线（h×0.72）之上
    this.WORLD_MIN_Y = 0.7;
    this.WORLD_MAX_Y = 4.6;
    this.RADIUS = 34;
    this.CONTACT_DT = 0.05;
    this.FLASH_DURATION = 0.6;
    // 发射时 Y 轴随机偏转：方向随机，大小在 [MIN, MAX] 内随机，保证每次都是可见的非正碰
    this.RANDOM_VY_MIN = 0.25;
    this.RANDOM_VY_MAX = 1.0;

    this.posA = { x: this.START_A, y: this.START_Y };
    this.posB = { x: this.START_B, y: this.START_Y };
    this.velA = { x: 0, y: 0 };
    this.velB = { x: 0, y: 0 };
    this.launchVy = 0;
    this.launched = false;
    this.flashTime = 0;
    this.flashForce = 0;
    this.flashNormal = { x: 1, y: 0 };
    this.lastCollision = false;
  }

  get title() { return '关卡三 · 碰撞交锋'; }
  get tag() { return '牛顿第三定律 作用力=反作用力 · 必修1 §1.2.3'; }

  setup() {
    this.build(this.game.controlBody);
    this.vectorDrawer.showLabels = false;

    this.sectionTitle('参数调节');
    this.addField('mA', {
      label: 'A 球质量 m_A', min: 1, max: 10, step: 0.5, value: 1.0, unit: 'kg',
      onChange: () => this.updateFormula(),
    });
    this.addField('mB', {
      label: 'B 球质量 m_B', min: 1, max: 10, step: 0.5, value: 1.0, unit: 'kg',
      onChange: () => this.updateFormula(),
    });
    this.addField('vA0', {
      label: 'A 球初速度 v₀', min: 0, max: 8, step: 0.1, value: 5.0, unit: 'm/s',
      onChange: () => this.updateFormula(),
    });
    this.addField('k', {
      label: '阻力系数 k', min: 0, max: 1, step: 0.05, value: 0.3, unit: '',
      onChange: () => this.updateFormula(),
    });

    this.spacer(4);
    this.sectionTitle('操作');
    this.addButton('发射 A 球（带随机 Y 偏转）', 'btn-primary', () => this.launch(this.getVal('vA0')));
    this.addReadout('launch', '本次发射：尚未发射');
    this.spacer(4);
    this.addHint('点击「发射」按设定初速发射 A 球；每次发射的 Y 轴速度分量随机（大小 0.25~1 m/s、\n方向随机），使碰撞必为非正碰，作用力沿两球连心线方向。\n阻力 f = k·v 按速度实时显示；四周墙弹性反弹。');
    this.addButton('重置', null, () => this.reset());

    this.chartVT.setTitle('A 球速率 V-t 图');
    this.chartXT.setTitle('A 球距起点位移 X-t 图');
    this.chartVT.setAutoScale(true);

    this.game.setFormulaTitle('牛顿定律：阻力 f = k·v + 完全弹性碰撞');
    this.reset();
  }

  launch(v0) {
    // Y 轴随机偏转：纵向分量大小在 ±(RANDOM_VY_MIN~MAX) 内随机（方向随机），
    // 使碰撞必然为非正碰，作用力沿两球连心线（法线）方向，更贴近真实情形
    const mag = this.RANDOM_VY_MIN + Math.random() * (this.RANDOM_VY_MAX - this.RANDOM_VY_MIN);
    const vy = Math.random() < 0.5 ? -mag : mag;
    this.posA = { x: this.START_A, y: this.START_Y };
    this.posB = { x: this.START_B, y: this.START_Y };
    this.velA = { x: v0, y: vy };
    this.velB = { x: 0, y: 0 };
    this.launchVy = vy;
    this.launched = true;
    this.lastCollision = false;
    this.flashTime = 0;
    this.simTime = 0;
    this.clearCharts();
    this.setReadout('launch', `本次发射：v_x = ${v0.toFixed(2)} m/s    v_y = ${vy.toFixed(2)} m/s（随机 Y 轴偏转）`);
    this.game.setNote(
      `发射 A 球：v_x = ${v0.toFixed(2)} m/s    v_y = ${vy.toFixed(2)} m/s（随机 Y 轴偏转）\n` +
      '观察碰撞瞬间沿两球连心线方向的等大反向相互作用力');
    this.updateFormula();
  }

  reset() {
    this.posA = { x: this.START_A, y: this.START_Y };
    this.posB = { x: this.START_B, y: this.START_Y };
    this.velA = { x: 0, y: 0 };
    this.velB = { x: 0, y: 0 };
    this.launchVy = 0;
    this.launched = false;
    this.lastCollision = false;
    this.flashTime = 0;
    this.simTime = 0;
    this.clearCharts();
    this.setReadout('launch', '本次发射：尚未发射');
    this.game.setNote('点击「发射」发射 A 球（带随机 Y 轴偏转），观察碰撞瞬间等大反向的相互作用力');
    this.updateFormula();
  }

  stepPhysics(dt) {
    if (!this.launched) return;
    this.simTime += dt;
    const k = this.getVal('k');
    const mA = this.getVal('mA');
    const mB = this.getVal('mB');

    // 阻力 f = −k·v → a = f/m（速度相关的力，实时作用于两球）
    if (k > 0) {
      this.velA.x += (-k * this.velA.x) / mA * dt;
      this.velA.y += (-k * this.velA.y) / mA * dt;
      this.velB.x += (-k * this.velB.x) / mB * dt;
      this.velB.y += (-k * this.velB.y) / mB * dt;
    }
    this.posA.x += this.velA.x * dt;
    this.posA.y += this.velA.y * dt;
    this.posB.x += this.velB.x * dt;
    this.posB.y += this.velB.y * dt;

    // 四周弹性撞墙（墙视为无限质量，法向速度反向）
    let bounced = false;
    const wall = (p, v) => {
      let hit = false;
      if (p.x <= this.WORLD_MIN_X) { p.x = this.WORLD_MIN_X; v.x = Math.abs(v.x); hit = true; }
      else if (p.x >= this.WORLD_MAX_X) { p.x = this.WORLD_MAX_X; v.x = -Math.abs(v.x); hit = true; }
      if (p.y <= this.WORLD_MIN_Y) { p.y = this.WORLD_MIN_Y; v.y = Math.abs(v.y); hit = true; }
      else if (p.y >= this.WORLD_MAX_Y) { p.y = this.WORLD_MAX_Y; v.y = -Math.abs(v.y); hit = true; }
      return hit;
    };
    if (wall(this.posA, this.velA)) bounced = true;
    if (wall(this.posB, this.velB)) bounced = true;
    if (bounced) {
      AudioManager.playCollision();
      this.game.setNote('撞墙反弹（弹性碰撞，动量守恒）：\n法向速度反向，动能不变，球继续运动');
    }

    this.checkCollision();
    this.chartVT.pushValue(this.simTime, Math.hypot(this.velA.x, this.velA.y));
    this.chartXT.pushValue(this.simTime,
      Math.hypot(this.posA.x - this.START_A, this.posA.y - this.START_Y));
  }

  checkCollision() {
    const dx = this.posB.x - this.posA.x;
    const dy = this.posB.y - this.posA.y;
    const contact = 2.0 * this.RADIUS / Constants.PX_PER_METER;
    const dist = Math.hypot(dx, dy);
    if (dist >= contact || dist < 1e-6) return;

    const rx = this.velA.x - this.velB.x;
    const ry = this.velA.y - this.velB.y;
    const nx = dx / dist;
    const ny = dy / dist;
    if (rx * nx + ry * ny <= 0) return; // 分离中，不碰撞

    const mA = this.getVal('mA');
    const mB = this.getVal('mB');
    const relN = rx * nx + ry * ny;
    // 二维完全弹性碰撞：仅交换法线方向分量（切向不变），动量/动能守恒
    const a2x = this.velA.x - (2 * mB / (mA + mB)) * relN * nx;
    const a2y = this.velA.y - (2 * mB / (mA + mB)) * relN * ny;
    const b2x = this.velB.x + (2 * mA / (mA + mB)) * relN * nx;
    const b2y = this.velB.y + (2 * mA / (mA + mB)) * relN * ny;

    // 碰撞平均力估算（冲量定理）：F = m·Δv / Δt
    this.flashForce = mA * Math.hypot(a2x - this.velA.x, a2y - this.velA.y) / this.CONTACT_DT;
    this.flashNormal = { x: nx, y: ny };
    this.flashTime = this.FLASH_DURATION;

    this.velA = { x: a2x, y: a2y };
    this.velB = { x: b2x, y: b2y };
    // 防重叠分离
    const overlap = (contact - dist) * 0.5;
    this.posA.x -= nx * overlap;
    this.posA.y -= ny * overlap;
    this.posB.x += nx * overlap;
    this.posB.y += ny * overlap;

    this.lastCollision = true;
    AudioManager.playCollision();
    this.game.setNote(
      `碰撞！F_A→B = ${this.flashForce.toFixed(0)} N    F_B→A = ${this.flashForce.toFixed(0)} N（等大反向，沿连心线）\n` +
      `v_A' = ${Math.hypot(this.velA.x, this.velA.y).toFixed(2)} m/s    v_B' = ${Math.hypot(this.velB.x, this.velB.y).toFixed(2)} m/s`);
    this.updateFormula();
  }

  updateFormula() {
    const mA = this.getVal('mA');
    const mB = this.getVal('mB');
    const k = this.getVal('k');
    const spdA = Math.hypot(this.velA.x, this.velA.y);
    const spdB = Math.hypot(this.velB.x, this.velB.y);
    const fa = k * spdA;
    const fb = k * spdB;
    const px = mA * this.velA.x + mB * this.velB.x;
    const py = mA * this.velA.y + mB * this.velB.y;
    const p = Math.hypot(px, py);
    this.game.setFormula('阻力 f = k·v（与速度反向）    碰撞：动量守恒 + 动能守恒');
    this.game.setSubstitution(
      `f_A = ${k.toFixed(2)}×${spdA.toFixed(2)} = ${fa.toFixed(2)} N    f_B = ${k.toFixed(2)}×${spdB.toFixed(2)} = ${fb.toFixed(2)} N`);
    const prefix = this.lastCollision ? '碰撞后' : '运动中';
    this.game.setResult(
      `${prefix}：v_A = ${spdA.toFixed(2)} m/s    v_B = ${spdB.toFixed(2)} m/s    总动量 p = ${p.toFixed(2)} kg·m/s`);
  }

  render(dt) {
    const { ctx, w, h } = prepareCanvas(this.game.canvas);
    if (w <= 10 || h <= 10) return;
    this.drawScene(ctx, w, h);

    const ax = this.posA.x * Constants.PX_PER_METER;
    const ay = this.posA.y * Constants.PX_PER_METER;
    const bx = this.posB.x * Constants.PX_PER_METER;
    const by = this.posB.y * Constants.PX_PER_METER;

    // 两球
    for (const c of [{ x: ax, y: ay }, { x: bx, y: by }]) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, this.RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = Constants.COLOR_BLOCK;
      ctx.fill();
      ctx.strokeStyle = Constants.COLOR_OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    this.vectorDrawer.setBounds(w, h, 12);
    this.vectorDrawer.clear();

    // 阻力箭头 f = k·v（与速度反向）
    const k = this.getVal('k');
    if (k > 0) {
      const fa = k * Math.hypot(this.velA.x, this.velA.y);
      if (fa > 0.02) {
        const la = Math.hypot(this.velA.x, this.velA.y);
        this.vectorDrawer.drawArrow({ x: ax, y: ay }, { x: -this.velA.x / la, y: -this.velA.y / la }, fa,
          Constants.COLOR_FRICTION, false, { pos: { x: ax + 6, y: ay - this.RADIUS - 14 }, text: 'f_A' });
      }
      const fb = k * Math.hypot(this.velB.x, this.velB.y);
      if (fb > 0.02) {
        const lb = Math.hypot(this.velB.x, this.velB.y);
        this.vectorDrawer.drawArrow({ x: bx, y: by }, { x: -this.velB.x / lb, y: -this.velB.y / lb }, fb,
          Constants.COLOR_FRICTION, false, { pos: { x: bx + 6, y: by - this.RADIUS - 14 }, text: 'f_B' });
      }
    }

    // 碰撞箭头闪烁（等大反向，沿碰撞法线）
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const lenPx = Math.min(this.flashForce * Constants.PX_PER_NEWTON, 170);
      this.vectorDrawer.drawArrow({ x: ax, y: ay }, this.flashNormal, lenPx / Constants.PX_PER_NEWTON,
        Constants.COLOR_FORCE, false, null);
      this.vectorDrawer.drawArrow({ x: bx, y: by }, { x: -this.flashNormal.x, y: -this.flashNormal.y },
        lenPx / Constants.PX_PER_NEWTON, Constants.COLOR_FRICTION, false, null);
    }

    this.vectorDrawer.render(ctx, this.game.fontFamily());

    // A/B 球文字标注
    ctx.save();
    ctx.font = `16px ${this.game.fontFamily()}`;
    ctx.fillStyle = Constants.COLOR_TEXT;
    ctx.textAlign = 'left';
    ctx.fillText('A', ax - this.RADIUS * 0.5 - 16, ay - this.RADIUS - 2);
    ctx.fillText('B', bx + this.RADIUS * 0.5 + 2, by - this.RADIUS - 2);
    ctx.restore();

    this.updateFormula();
  }
}

// ---------------- 关卡四 · 抛体运动（平抛轨迹） ----------------

class LevelFour extends LevelBase {
  constructor(game) {
    super(game);
    this.EDGE_X = 0.0;        // 抛出边缘的世界横坐标（与网格原点重合）
    this.RADIUS = 14;         // 抛体为圆形
    this.PX_PER_SPEED = 8;    // 速度矢量比例：1 m/s = 8 px
    this.flying = false;
    this.landed = false;
    this.launched = false;
    this.posX = 0;
    this.dropY = 0;
    this.trace = [];
    this.showPredict = true;
  }

  get title() { return '关卡四 · 平抛轨迹'; }
  get tag() { return '抛体运动 · 运动的合成与分解 · 必修2 §5.2'; }

  setup() {
    this.build(this.game.controlBody);

    this.sectionTitle('参数调节');
    this.addField('v0', {
      label: '初速度 v₀', min: 1, max: 20, step: 0.5, value: 6.0, unit: 'm/s',
      onChange: () => this.onParamChange(),
    });
    // 高度上限受可视范围约束：地面线以上约 5.4 m，留出球体半径余量后取 4.5 m
    this.addField('h', {
      label: '抛出点高度 h', min: 1, max: 4.5, step: 0.5, value: 3.0, unit: 'm',
      onChange: () => this.onParamChange(),
    });
    this.addField('g', {
      label: '重力加速度 g', min: 1.6, max: 20, step: 0.1, value: 9.8, unit: 'm/s²',
      onChange: () => this.onParamChange(),
    });

    this.spacer(4);
    this.sectionTitle('操作');
    this.addButton('抛出（水平初速）', 'btn-primary', () => this.launch());
    this.addReadout('launch', '本次抛出：尚未抛出');
    this.spacer(4);

    this.sectionTitle('显示');
    this.addCheckbox('显示预测轨迹与落点', true, (on) => { this.showPredict = on; });
    this.addHint('平抛可分解为「水平匀速 + 竖直自由落体」：落地时间只由 h 与 g 决定，与 v₀ 无关。\n改参数即可预览绿色虚线预测轨迹与落点，点「抛出」后橙色实线为实际飞过的轨迹。');

    this.addButton('重置', null, () => this.reset());

    this.chartVT.setTitle('V-t 图（合速度）');
    this.chartXT.setTitle('X-t 图（水平位移）');
    this.chartVT.setAutoScale(true);
    this.chartXT.setAutoScale(true);
    this.chartVT.setTheoryFunc((t) => this.theoryV(t));
    this.chartXT.setTheoryFunc((t) => this.theoryX(t));
    this.applyChartScale();

    this.game.setFormulaTitle('平抛运动：水平匀速 + 竖直自由落体');
    this.reset();
  }

  // 图表时间窗与网格步长随落地时间自适应（平抛全场通常不足 3 s）
  applyChartScale() {
    const tLand = Math.sqrt(2 * this.getVal('h') / this.getVal('g'));
    const win = Math.max(isFinite(tLand) ? tLand : 1.0, 0.4);
    const gs = win <= 1.0 ? 0.2 : (win <= 2.5 ? 0.5 : 1.0);
    for (const c of [this.chartVT, this.chartXT]) {
      c.timeWindow = win;
      c.gridStep = gs;
    }
  }

  // 运行中改参数会破坏已飞轨迹与预测的一致性，直接复位
  onParamChange() {
    if (this.flying) this.reset();
    this.applyChartScale();
    this.updateFormula();
  }

  launch() {
    const v0 = this.getVal('v0');
    const g = this.getVal('g');
    const h0 = this.getVal('h');
    const tLand = Math.sqrt(2 * h0 / g);
    this.simTime = 0;
    this.posX = 0;
    this.dropY = 0;
    this.trace = [{ x: 0, y: 0 }];
    this.flying = true;
    this.landed = false;
    this.launched = true;
    this.clearCharts();
    this.applyChartScale();
    this.resetCamera();
    this.chartVT.pushValue(0, v0); // t = 0 时竖直分速度为 0，合速度即 v₀
    this.chartXT.pushValue(0, 0);
    this.setReadout('launch',
      `本次抛出：v₀ = ${v0.toFixed(2)} m/s    h = ${h0.toFixed(2)} m    g = ${g.toFixed(2)} m/s²`);
    this.game.setNote(
      `抛出：水平 v₀ = ${v0.toFixed(2)} m/s，竖直初速 0（自由落体）\n` +
      `落地时间 t = √(2h/g) = ${tLand.toFixed(2)} s    水平射程 x = v₀·t = ${(v0 * tLand).toFixed(2)} m`);
    this.updateFormula();
  }

  reset() {
    this.simTime = 0;
    this.posX = 0;
    this.dropY = 0;
    this.trace = [];
    this.flying = false;
    this.landed = false;
    this.launched = false;
    this.clearCharts();
    this.resetCamera();
    this.setReadout('launch', '本次抛出：尚未抛出');
    this.game.setNote('设置 v₀ / h / g 后点击「抛出」；绿色虚线为预测轨迹与落点，橙色实线为实际飞过的轨迹');
    this.updateFormula();
  }

  stepPhysics(dt) {
    if (!this.flying) return;
    const v0 = this.getVal('v0');
    const g = this.getVal('g');
    const h0 = this.getVal('h');
    const tLand = Math.sqrt(2 * h0 / g);

    // 平抛解析解（水平匀速 + 竖直自由落体），无积分漂移
    let t = this.simTime + dt;
    const landedNow = t >= tLand;
    if (landedNow) t = tLand;
    this.simTime = t;
    const vy = g * t;
    this.posX = v0 * t;
    this.dropY = 0.5 * g * t * t;

    this.trace.push({ x: this.posX, y: this.dropY });
    this.chartVT.pushValue(t, Math.hypot(v0, vy));
    this.chartXT.pushValue(t, this.posX);

    if (landedNow) {
      this.flying = false;
      this.landed = true;
      AudioManager.playCollision();
      const theta = Math.atan2(vy, v0) * 180 / Math.PI;
      this.game.setNote(
        `落地！水平射程 x = ${this.posX.toFixed(2)} m    落地时间 t = ${tLand.toFixed(2)} s\n` +
        `落地速度 v = ${Math.hypot(v0, vy).toFixed(2)} m/s（与水平方向夹角 ${theta.toFixed(1)}°）`);
    }
  }

  updateFormula() {
    const v0 = this.getVal('v0');
    const g = this.getVal('g');
    const h0 = this.getVal('h');
    const tLand = Math.sqrt(2 * h0 / g);
    const range = v0 * tLand;
    const vyL = g * tLand;
    this.game.setFormula('x = v₀·t      y = ½·g·t²      v = √(v₀² + (g·t)²)      落地 t = √(2h/g)');
    this.game.setSubstitution(
      `x = ${v0.toFixed(2)}·t    y = ½×${g.toFixed(2)}·t² = ${(0.5 * g).toFixed(2)}·t²    ` +
      `落地 t = √(2×${h0.toFixed(2)}/${g.toFixed(2)}) = ${tLand.toFixed(2)} s`);

    if (this.landed) {
      const theta = Math.atan2(vyL, v0) * 180 / Math.PI;
      this.game.setResult(
        `落地：t = ${tLand.toFixed(2)} s    x = ${range.toFixed(2)} m    v = ${Math.hypot(v0, vyL).toFixed(2)} m/s    与水平夹角 θ = ${theta.toFixed(1)}°`);
    } else if (this.flying) {
      const t = this.simTime;
      const vy = g * t;
      this.game.setResult(
        `t = ${t.toFixed(2)} s：x = ${(v0 * t).toFixed(2)} m    y = ${(0.5 * g * t * t).toFixed(2)} m    ` +
        `v_x = ${v0.toFixed(2)}    v_y = ${vy.toFixed(2)}    v = ${Math.hypot(v0, vy).toFixed(2)} m/s`);
    } else {
      this.game.setResult(
        `预测：落地时间 t = ${tLand.toFixed(2)} s    水平射程 x = ${range.toFixed(2)} m    落地速度 v = ${Math.hypot(v0, vyL).toFixed(2)} m/s`);
    }
  }

  theoryV(t) {
    return Math.hypot(this.getVal('v0'), this.getVal('g') * t);
  }

  theoryX(t) {
    return this.getVal('v0') * t;
  }

  render() {
    const { ctx, w, h } = prepareCanvas(this.game.canvas);
    if (w <= 10 || h <= 10) return;
    this.drawScene(ctx, w, h);

    const groundY = h * 0.72;
    const v0 = this.getVal('v0');
    const g = this.getVal('g');
    const h0 = this.getVal('h');
    const tLand = Math.sqrt(2 * h0 / g);
    const range = v0 * tLand;
    const step = Constants.PX_PER_METER;

    // 相机横向跟随抛体；纵向以地面线为基准（1 m = 60 px，与网格同尺度）
    // 台面位于地面线以上 h 米处，抛体圆心在台面上方一个半径：落地时球体恰好停在地面线上
    const ballScreenX = this.worldToScreenX(this.posX);
    const edgeX = this.EDGE_X * step - this.camScroll;
    const topY = groundY - h0 * step;
    const ballBaseY = groundY - this.RADIUS;
    const ballY = ballBaseY - (h0 - this.dropY) * step;

    // 预测轨迹（绿虚线 = 理论曲线）
    if (this.showPredict) {
      ctx.save();
      ctx.strokeStyle = rgba(Constants.COLOR_THEORY, 0.75);
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const n = 96;
      for (let i = 0; i <= n; i++) {
        const t = tLand * i / n;
        const px = v0 * t * step - this.camScroll;
        const py = ballBaseY - (h0 - 0.5 * g * t * t) * step;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 抛出台（悬崖 / 桌沿）
    ctx.fillStyle = 'rgba(198,198,189,0.55)';
    ctx.fillRect(0, topY, Math.max(edgeX, 0), groundY - topY);
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, topY, Math.max(edgeX - 1, 0), groundY - topY);
    ctx.strokeStyle = Constants.COLOR_GROUND;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(edgeX, topY);
    ctx.stroke();

    // 已飞出轨迹（橙实线 = 高亮）
    if (this.trace.length > 1) {
      ctx.save();
      ctx.strokeStyle = Constants.COLOR_HIGHLIGHT;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < this.trace.length; i++) {
        const px = this.trace[i].x * step - this.camScroll;
        const py = ballBaseY - (h0 - this.trace[i].y) * step;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 落点标记
    if (this.showPredict) {
      const landX = range * step - this.camScroll;
      ctx.save();
      ctx.fillStyle = Constants.COLOR_HIGHLIGHT;
      ctx.beginPath();
      ctx.arc(landX, groundY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `13px ${this.game.fontFamily()}`;
      ctx.textAlign = 'center';
      ctx.fillText(`落点 x = ${range.toFixed(2)} m`, landX, groundY + 20);
      ctx.restore();
    }

    // 抛出点高度标注（贴台面右上角）
    ctx.save();
    ctx.font = `13px ${this.game.fontFamily()}`;
    ctx.fillStyle = Constants.COLOR_TEXT_DIM;
    ctx.textAlign = 'right';
    ctx.fillText(`h = ${h0.toFixed(2)} m`, edgeX - 8, topY - 8);
    ctx.restore();

    // 抛体（圆形）
    ctx.beginPath();
    ctx.arc(ballScreenX, ballY, this.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = Constants.COLOR_BLOCK;
    ctx.fill();
    ctx.strokeStyle = Constants.COLOR_OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 速度分解矢量：v_x（蓝，恒定）与 v_y（红，= g·t）
    if (this.launched) {
      const tEff = this.flying ? this.simTime : tLand;
      const vy = g * tEff;
      const s = this.PX_PER_SPEED;
      this.vectorDrawer.setBounds(w, h, 12);
      this.vectorDrawer.clear();
      this.vectorDrawer.drawArrow({ x: ballScreenX, y: ballY }, { x: 1, y: 0 }, v0,
        Constants.COLOR_FRICTION, false,
        { pos: { x: ballScreenX + v0 * s + 6, y: ballY + 5 }, text: 'v_x' }, s);
      this.vectorDrawer.drawArrow({ x: ballScreenX, y: ballY }, { x: 0, y: 1 }, vy,
        Constants.COLOR_FORCE, false,
        { pos: { x: ballScreenX - 28, y: ballY + vy * s + 16 }, text: 'v_y' }, s);
      this.vectorDrawer.render(ctx, this.game.fontFamily());
    }

    this.updateFormula();
  }
}
