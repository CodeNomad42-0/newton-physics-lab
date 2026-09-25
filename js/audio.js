// 音效管理：按钮点击 / 碰撞（CC0 资源，音量较低不干扰讲解）
const AudioManager = {
  muted: false,
  _sounds: {},
  _ready: false,

  init() {
    if (this._ready) return;
    const files = {
      click: 'assets/audio/click.wav',
      collision: 'assets/audio/collision.wav',
      drag: 'assets/audio/drag.wav',
    };
    for (const [key, path] of Object.entries(files)) {
      const a = new Audio(path);
      a.volume = 0.32; // 约为 -10 dB
      a.preload = 'auto';
      this._sounds[key] = a;
    }
    this._ready = true;
  },

  play(key) {
    if (this.muted) return;
    this.init();
    const src = this._sounds[key];
    if (!src) return;
    // 克隆节点，保证快速连续触发不被前一次播放打断
    const node = src.cloneNode(true);
    node.volume = src.volume;
    node.play().catch(() => {});
  },

  playClick() { this.play('click'); },
  playCollision() { this.play('collision'); },
  playDrag() { this.play('drag'); },

  setMuted(m) { this.muted = m; },
};
