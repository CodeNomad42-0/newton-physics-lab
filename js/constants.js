// 全局常量：物理参数 / 坐标标尺 / 浅色实验室风配色（与原 Godot 版 constants.gd 对齐）
const Constants = {
  // ---- 物理 ----
  GRAVITY: 9.8,              // g (m/s²)
  PHYSICS_HZ: 60,            // 固定物理步长 (Hz)
  FIXED_DT: 1.0 / 60.0,      // 单个物理步长 (s)

  // ---- 坐标标尺 ----
  PX_PER_METER: 60.0,        // 物理米 → 屏幕像素
  PX_PER_NEWTON: 20.0,       // 力 N → 箭头像素

  // ---- 配色（浅色实验室风 · 高对比层次） ----
  COLOR_BG: '#e7e4dc',       // 全局背景 暖灰
  COLOR_PANEL: '#ffffff',    // 面板/卡片 纯白
  COLOR_PANEL_ALT: '#efede5',// 面板分隔/浅灰
  COLOR_CANVAS: '#fbfaf5',   // 中央画布 暖白
  COLOR_HEADER: '#eef2f7',   // 标题栏 浅冷灰
  COLOR_GROUND: '#c6c6bd',   // 地面 中灰
  COLOR_BLOCK: '#ffffff',    // 物块/冰球 白
  COLOR_OUTLINE: '#2f3640',  // 物块描边/文字 深墨
  COLOR_TEXT: '#232b36',     // 主文字 深墨
  COLOR_TEXT_DIM: '#68727e', // 次要文字
  COLOR_FORCE: '#e53935',    // 红：主动力/合力
  COLOR_FRICTION: '#1e88e5', // 蓝：摩擦力/阻力
  COLOR_GRAVITY: '#14181d',  // 黑：G/N（虚线）
  COLOR_THEORY: '#2e9e44',   // 绿：理论曲线
  COLOR_HIGHLIGHT: '#f57c00',// 橙：交互提示/高亮
  COLOR_AXIS: '#9aa0a6',     // 图表坐标轴/网格

  // ---- 布局尺寸 ----
  VIEW_W: 1280.0,            // 设计分辨率宽
  VIEW_H: 720.0,             // 设计分辨率高
  BTN_MIN_H: 44.0,           // 触屏最小点击目标高度
};

// ---- 运行环境能力检测：优雅降级用（完整能力 → 旧 Safari 的替代路径） ----
const Env = {
  hasPointer: typeof window.PointerEvent === 'function',   // Pointer Events：iOS 13+ / 现代浏览器
  hasTouch: 'ontouchstart' in window || (navigator.maxTouchPoints | 0) > 0,
  // 触屏设备把 dpr 上限压到 2：iOS 3x 背板会让 canvas 内存翻数倍，2x 视觉几乎无损
  maxDpr: ('ontouchstart' in window || (navigator.maxTouchPoints | 0) > 0) ? 2 : 4,
};

// 无 requestAnimationFrame 的旧浏览器：用定时器模拟，避免主循环完全不启动
if (typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = function (cb) {
    return window.setTimeout(function () {
      cb(typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    }, 16);
  };
  window.cancelAnimationFrame = function (id) { window.clearTimeout(id); };
}

// 读取 iOS 安全区（刘海 / 灵动岛 / Home 指示条）
// 旧 Safari 不支持 env() 时 CSS 变量为空，这里统一回落为 0，布局照常
function safeInsets() {
  const cs = window.getComputedStyle(document.documentElement);
  const px = function (name) {
    const v = parseFloat(cs.getPropertyValue(name));
    return isFinite(v) ? v : 0;
  };
  return {
    top: px('--safe-top'),
    right: px('--safe-right'),
    bottom: px('--safe-bottom'),
    left: px('--safe-left'),
  };
}

// 核心能力兜底：完全没有 Canvas 2D 时给一句提示，而不是整页白屏
function hasCanvas2D() {
  try {
    return !!document.createElement('canvas').getContext('2d');
  } catch (e) {
    return false;
  }
}

// 将 #rrggbb 转为 rgba() 字符串
function rgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// 准备 Canvas（适配 devicePixelRatio，返回 {ctx, w, h}，坐标以 CSS 像素计）
function prepareCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, Env.maxDpr);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) {
    return { ctx: canvas.getContext('2d'), w: 0, h: 0 };
  }
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
