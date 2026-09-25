// 应用入口：主菜单、关卡路由、固定步长物理循环、公式看板与图表刷新

const LEVEL_DEFS = [
  {
    key: 'level1',
    title: '关卡一 · 惯性迷局',
    subtitle: '牛顿第一定律：力是改变运动状态的原因',
    cls: () => new LevelOne(Game),
    color: Constants.COLOR_FORCE,
  },
  {
    key: 'level2',
    title: '关卡二 · 加速度工坊',
    subtitle: '牛顿第二定律：F = m·a',
    cls: () => new LevelTwo(Game),
    color: Constants.COLOR_FRICTION,
  },
  {
    key: 'level3',
    title: '关卡三 · 碰撞交锋',
    subtitle: '牛顿第三定律：作用力与反作用力',
    cls: () => new LevelThree(Game),
    color: Constants.COLOR_THEORY,
  },
  {
    key: 'level4',
    title: '关卡四 · 平抛轨迹',
    subtitle: '抛体运动：平抛运动的分解与射程',
    cls: () => new LevelFour(Game),
    color: Constants.COLOR_HIGHLIGHT,
  },
];

const Game = {
  level: null,
  canvas: null,
  note: null,
  controlBody: null,
  chartVTEl: null,
  chartXTEl: null,
  fTitle: null,
  fLine: null,
  fSub: null,
  fResult: null,
  _acc: 0,
  _last: 0,

  init() {
    this.stage = document.getElementById('stage');
    this.viewMenu = document.getElementById('view-menu');
    this.viewLevel = document.getElementById('view-level');
    this.canvas = document.getElementById('physics-canvas');
    this.note = document.getElementById('canvas-note');
    this.controlBody = document.getElementById('control-body');
    this.chartVTEl = document.getElementById('chart-vt');
    this.chartXTEl = document.getElementById('chart-xt');
    this.fTitle = document.getElementById('formula-title');
    this.fLine = document.getElementById('formula-line');
    this.fSub = document.getElementById('formula-sub');
    this.fResult = document.getElementById('formula-result');

    this.buildMenu();
    document.getElementById('btn-back').addEventListener('click', () => {
      AudioManager.playClick();
      this.showMenu();
    });

    // 物理仿真弹窗入口
    this.sim = new PhysicsSimulator(this);
    this.sim.init();
    document.getElementById('btn-sim').addEventListener('click', () => {
      AudioManager.playClick();
      this.sim.open();
    });
    const mute = document.getElementById('btn-mute');
    mute.addEventListener('click', () => {
      const on = mute.classList.toggle('active');
      AudioManager.setMuted(on);
      mute.textContent = on ? '取消静音' : '静音';
      if (!on) AudioManager.playClick();
    });

    window.addEventListener('resize', () => this.fitStage());
    this.fitStage();
    // 首帧再校正一次：部分环境下 DOMContentLoaded 时视口尺寸尚未就绪
    requestAnimationFrame(() => this.fitStage());

    this._last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  },

  // ---- 舞台等比缩放：等价原版 1280×720 canvas_items 拉伸自适应 ----
  fitStage() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw <= 0 || vh <= 0) return; // 视口尚未就绪：保持当前缩放，避免整页被缩到 0
    const s = Math.min(vw / Constants.VIEW_W, vh / Constants.VIEW_H);
    this.stage.style.transform = `scale(${s})`;
  },

  // ---- 主菜单 ----
  buildMenu() {
    const host = document.getElementById('menu-cards');
    host.innerHTML = '';
    for (const def of LEVEL_DEFS) {
      const card = makeEl('div', 'menu-card');
      card.style.borderColor = def.color;

      const text = makeEl('div', 'menu-card-text');
      const t = makeEl('p', 'menu-card-title', def.title);
      t.style.color = def.color;
      text.appendChild(t);
      text.appendChild(makeEl('p', 'menu-card-sub', def.subtitle));
      card.appendChild(text);

      const btn = makeEl('button', 'btn', '进入关卡 →');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        AudioManager.playClick();
        this.enterLevel(def.key);
      });
      card.appendChild(btn);
      host.appendChild(card);
    }
  },

  showMenu() {
    this.level = null;
    this.viewLevel.classList.add('hidden');
    this.viewMenu.classList.remove('hidden');
  },

  enterLevel(key) {
    const def = LEVEL_DEFS.find((d) => d.key === key);
    if (!def) return;
    this.viewMenu.classList.add('hidden');
    this.viewLevel.classList.remove('hidden');
    this.level = def.cls();
    document.getElementById('level-title').textContent = this.level.title;
    document.getElementById('level-tag').textContent = this.level.tag;
    this.note.textContent = '';
    this.level.setup();
    this.level.render(0);
    this.renderCharts();
  },

  // ---- 公式看板 ----
  setFormulaTitle(t) { this.fTitle.textContent = t; },
  setFormula(t) { this.fLine.textContent = t; },
  setSubstitution(t) { this.fSub.textContent = t; },
  setResult(t) { this.fResult.textContent = t; },
  setNote(t) { this.note.textContent = t; },

  fontFamily() {
    return "'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  },

  renderCharts() {
    if (!this.level) return;
    this.level.chartVT.render(this.chartVTEl, this.fontFamily());
    this.level.chartXT.render(this.chartXTEl, this.fontFamily());
  },

  // ---- 固定步长物理循环 ----
  frame(now) {
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    const lv = this.level;
    if (lv) {
      this._acc += dt;
      let guard = 0;
      while (this._acc >= Constants.FIXED_DT && guard < 8) {
        lv.stepPhysics(Constants.FIXED_DT);
        this._acc -= Constants.FIXED_DT;
        guard++;
      }
      if (guard >= 8) this._acc = 0;
      lv.render(dt);
      this.renderCharts();
    }
    // 物理仿真弹窗：动画推进与曲线刷新
    if (this.sim && this.sim.isOpen()) {
      this.sim.step(dt);
      this.sim.render();
    }
    requestAnimationFrame((t) => this.frame(t));
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
