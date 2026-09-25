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
  const dpr = window.devicePixelRatio || 1;
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
