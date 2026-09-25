// 自研纯数学物理引擎（模型层）：60Hz 固定步长解析式计算
// - 一维水平运动，水平向右为正
// - 摩擦方向与运动方向相反；速度过零 clamp 为 0（不被摩擦弹回）
// - 静止时静摩擦抵消施加力，直到 |F| 超过 μ·m·g
class PhysicsEngine {
  constructor() {
    // ---- 配置属性（随时可改，下一物理帧生效） ----
    this.mass = 2.0;              // m (kg)
    this.appliedForce = 0.0;      // 施加力 F (N)，水平向右为正
    this.frictionCoeff = 0.0;     // 动摩擦因数 μ
    this.gravity = Constants.GRAVITY;
    this.v0 = 0.0;                // 初速度 (m/s)
    this.running = false;

    // ---- 内部状态 ----
    this._time = 0;
    this._position = 0;           // s (m)
    this._velocity = 0;           // v (m/s)
    this._acceleration = 0;       // a (m/s²)
    this._netForce = 0;           // F_合 (N)
    this._friction = 0;           // f (N)，带符号
  }

  reset() {
    this._time = 0;
    this._position = 0;
    this._velocity = this.v0;
    this._acceleration = 0;
    this._netForce = 0;
    this._friction = 0;
  }

  setRunning(on) { this.running = on; }

  // 推进一个物理步长
  step(delta) {
    if (!this.running) return;
    this._time += delta;
    this._friction = this._computeFriction();
    this._netForce = this.appliedForce + this._friction;
    let acc = this._netForce / Math.max(this.mass, 0.001);
    let vNew = this._velocity + acc * delta;
    // 速度过零判定：不允许被摩擦弹回反向滑动
    if (this._velocity !== 0 && vNew !== 0 &&
        Math.sign(vNew) !== Math.sign(this._velocity)) {
      // 仅当施加力不足以克服最大静摩擦时才停在 0
      if (Math.abs(this.appliedForce) <= this.frictionCoeff * this.mass * this.gravity) {
        vNew = 0;
        acc = 0;
        this._netForce = 0;
        this._friction = -this.appliedForce;
      }
    }
    // 梯形积分（半平均速度）：对匀变速精确
    const vAvg = (this._velocity + vNew) * 0.5;
    this._velocity = vNew;
    this._acceleration = acc;
    this._position += vAvg * delta;
  }

  isMoving() { return Math.abs(this._velocity) > 1e-9; }

  // 外部改动 appliedForce 后重算 f / F_合 / a（不推进时间）
  recomputeState() {
    this._friction = this._computeFriction();
    this._netForce = this.appliedForce + this._friction;
    this._acceleration = this._netForce / Math.max(this.mass, 0.001);
  }

  // ---- 只读接口 ----
  getPosition() { return this._position; }
  getVelocity() { return this._velocity; }
  getAcceleration() { return this._acceleration; }
  getNetForce() { return this._netForce; }
  getGravityForce() { return this.mass * this.gravity; }
  getNormal() { return this.mass * this.gravity; }
  getFriction() { return this._friction; }
  getFrictionMagnitude() { return this.frictionCoeff * this.mass * this.gravity; }
  getTime() { return this._time; }
  isResting() { return Math.abs(this._velocity) < 1e-9 && Math.abs(this._netForce) < 1e-9; }

  _computeFriction() {
    const fMax = this.frictionCoeff * this.mass * this.gravity;
    if (Math.abs(this._velocity) > 1e-9) {
      return -Math.sign(this._velocity) * fMax;
    }
    // 静止：静摩擦抵消施加力（不超出最大静摩擦）
    return -Math.max(-fMax, Math.min(fMax, this.appliedForce));
  }
}
