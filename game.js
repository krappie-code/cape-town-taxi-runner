// Cape Town Taxi Runner — Isometric 2.5D Edition
// All Canvas2D, no external assets

(() => {
'use strict';

// ─── CONSTANTS ───
const LANE_COUNT = 3;
const DESTINATIONS = [
  'Khayelitsha', 'Mitchell\'s Plain', 'Wynberg', 'Claremont', 'Sea Point',
  'Observatory', 'Bellville', 'Muizenberg', 'Fish Hoek', 'Hout Bay',
  'Camps Bay', 'Langa', 'Gugulethu', 'Athlone', 'Woodstock'
];

const CAR_COLORS = [
  { left: '#cc2222', right: '#991818', top: '#ee3333' },
  { left: '#2255cc', right: '#183999', top: '#3366ee' },
  { left: '#dddddd', right: '#aaaaaa', top: '#ffffff' },
  { left: '#228833', right: '#185522', top: '#33aa44' },
  { left: '#222222', right: '#111111', top: '#333333' },
  { left: '#cc8822', right: '#996618', top: '#eeaa33' },
];

// Colors — Cape Town palette
const C = {
  sky1: '#4a90d9', sky2: '#87ceeb', sky3: '#ffd89b',
  mountain: '#3a5a7a', mountainLight: '#5a7a9a', mountainDark: '#2a4060',
  city: '#3a3a5c', cityLight: '#5a5a7c',
  road: '#4a4a5a', roadLight: '#5a5a6a', roadLine: '#f0c040',
  taxi: '#f0f0f0', taxiDark: '#1a5a9a', taxiLight: '#d0d8e0',
  taxiBlue: '#1a5a9a', taxiWhite: '#f0f0f0',
  ocean: '#2a6a9a', sand: '#e8d5a0', fynbos: '#5a8a50',
  gold: '#f0c040', red: '#e04040', blue: '#4080e0',
  shield: '#40c0f0', boost: '#f06040',
  dust: '#c8b888', spark: '#ffaa00',
  hud: 'rgba(0,0,0,0.6)', hudText: '#ffffff',
  overlay: 'rgba(10,10,30,0.75)',
};

// ─── GAME CLASS ───
class Game {
  constructor(canvas) {
    this.cv = canvas;
    this.cx = canvas.getContext('2d');
    this.state = 'menu'; // menu | playing | gameOver
    this.stateAlpha = 0;

    // Timing
    this.lastTime = 0;
    this.dt = 0;
    this.time = 0;

    // Camera shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;

    // Collision flash
    this.flashAlpha = 0;
    this.freezeTimer = 0;

    // Iso config (recalculated on resize)
    this.isoAngle = 0.46; // radians
    this.roadWidth = 0;
    this.laneWidth = 0;
    this.vanishY = 0;
    this.horizonY = 0;
    this.playerY = 0;

    // Player
    this.lane = 1;
    this.targetLane = 1;
    this.laneX = 0; // smooth interpolated
    this.jumping = false;
    this.jumpT = 0;
    this.shielded = false;
    this.shieldTimer = 0;
    this.boosted = false;
    this.boostTimer = 0;

    // Game state
    this.score = 0;
    this.displayScore = 0;
    this.speed = 3;
    this.baseSpeed = 3;
    this.maxSpeed = 12;
    this.passengers = 0;
    this.distance = 0;
    this.destination = DESTINATIONS[0];
    this.destIndex = 0;
    this.nextDestDist = 500;

    // Object pools
    this.tiles = [];
    this.obstacles = [];
    this.particles = [];
    this.speedLines = [];
    this.passengers_pool = [];
    this.powerups = [];

    // Spawn timers
    this.obstacleTimer = 0;
    this.passengerTimer = 0;
    this.powerupTimer = 0;

    // Parallax layers
    this.bgScroll = [0, 0, 0];

    // Touch
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    this.resize();
    this.initTiles();
    this.bindInput();
    requestAnimationFrame(t => this.loop(t));
  }

  // ─── RESIZE ───
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = this.w * dpr;
    this.cv.height = this.h * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.horizonY = this.h * 0.35;
    this.vanishY = this.h * 0.28;
    this.playerY = this.h * 0.78;
    this.roadWidth = this.w * 0.7;
    this.laneWidth = this.roadWidth / LANE_COUNT;
    this.tileSize = Math.max(60, this.w * 0.08);
  }

  // ─── TILES ───
  initTiles() {
    this.tiles = [];
    for (let i = 0; i < 30; i++) {
      this.tiles.push({ z: i * 1.2 });
    }
  }

  // ─── INPUT ───
  bindInput() {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('keydown', e => {
      if (this.state === 'menu' || this.state === 'gameOver') {
        if (e.code === 'Space' || e.code === 'Enter') { this.startOrRestart(); return; }
      }
      if (this.state !== 'playing') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.changeLane(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.changeLane(1);
      else if (e.code === 'ArrowUp' || e.code === 'Space') this.jump();
    });

    this.cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
      this.touchStartTime = performance.now();
    }, { passive: false });

    this.cv.addEventListener('touchend', e => {
      e.preventDefault();
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      const elapsed = performance.now() - this.touchStartTime;

      if (this.state === 'menu' || this.state === 'gameOver') {
        this.startOrRestart();
        return;
      }
      if (this.state !== 'playing') return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 20 && absDy < 20 && elapsed < 300) return;
      if (absDy > absDx && dy < -30) { this.jump(); return; }
      if (absDx > 30) this.changeLane(dx > 0 ? 1 : -1);
    }, { passive: false });

    this.cv.addEventListener('click', () => {
      if (this.state === 'menu' || this.state === 'gameOver') this.startOrRestart();
    });
  }

  changeLane(dir) {
    const next = this.targetLane + dir;
    if (next >= 0 && next < LANE_COUNT) this.targetLane = next;
  }

  jump() {
    if (!this.jumping) {
      this.jumping = true;
      this.jumpT = 0;
    }
  }

  startOrRestart() {
    this.state = 'playing';
    this.stateAlpha = 0;
    this.lane = 1;
    this.targetLane = 1;
    this.laneX = 1;
    this.score = 0;
    this.displayScore = 0;
    this.speed = this.baseSpeed;
    this.passengers = 0;
    this.distance = 0;
    this.destIndex = 0;
    this.destination = DESTINATIONS[0];
    this.nextDestDist = 500;
    this.jumping = false;
    this.shielded = false;
    this.shieldTimer = 0;
    this.boosted = false;
    this.boostTimer = 0;
    this.obstacles.length = 0;
    this.particles.length = 0;
    this.speedLines.length = 0;
    this.passengers_pool.length = 0;
    this.powerups.length = 0;
    this.obstacleTimer = 0;
    this.passengerTimer = 0;
    this.powerupTimer = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.flashAlpha = 0;
    this.freezeTimer = 0;
    this.initTiles();
  }

  // ─── ISO HELPERS ───
  isoToScreen(lane, depth) {
    const perspective = 0.3 + depth * 0.7;
    const rw = this.roadWidth * perspective;
    const cx = this.w / 2;
    const x = cx + (lane - 1) * (rw / LANE_COUNT);
    const y = this.horizonY + depth * (this.playerY - this.horizonY);
    return { x, y, scale: perspective };
  }

  // ─── GAME LOOP ───
  loop(timestamp) {
    this.dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;
    this.time = timestamp / 1000;

    // Freeze frame on collision
    if (this.freezeTimer > 0) {
      this.freezeTimer -= this.dt;
      this.draw();
      requestAnimationFrame(t => this.loop(t));
      return;
    }

    this.update();
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  }

  // ─── UPDATE ───
  update() {
    // State transition alpha
    this.stateAlpha = Math.min(1, this.stateAlpha + this.dt * 3);

    if (this.state !== 'playing') return;

    const dt = this.dt;
    const spd = this.speed;

    // Speed increases over time
    this.speed = Math.min(this.maxSpeed, this.speed + dt * 0.08);
    if (this.boosted) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) this.boosted = false;
    }
    if (this.shielded) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shielded = false;
    }

    const effectiveSpeed = this.boosted ? spd * 1.6 : spd;
    this.distance += effectiveSpeed * dt * 10;
    this.score += effectiveSpeed * dt * 5;

    // Destination cycle
    if (this.distance > this.nextDestDist) {
      this.destIndex = (this.destIndex + 1) % DESTINATIONS.length;
      this.destination = DESTINATIONS[this.destIndex];
      this.nextDestDist += 400 + Math.random() * 300;
    }

    // Smooth lane change
    this.laneX += (this.targetLane - this.laneX) * Math.min(1, dt * 10);

    // Jump
    if (this.jumping) {
      this.jumpT += dt * 3;
      if (this.jumpT >= 1) {
        this.jumping = false;
        this.jumpT = 0;
      }
    }

    // Scroll tiles
    for (const tile of this.tiles) {
      tile.z -= effectiveSpeed * dt * 0.4;
      if (tile.z < -1) tile.z += 30 * 1.2;
    }

    // Parallax
    this.bgScroll[0] += effectiveSpeed * dt * 0.5;
    this.bgScroll[1] += effectiveSpeed * dt * 1.5;
    this.bgScroll[2] += effectiveSpeed * dt * 3;

    // Spawn obstacles
    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0) {
      this.obstacleTimer = 0.8 + Math.random() * 1.5 / (spd * 0.3);
      const type = Math.random();
      const colorSet = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      this.obstacles.push({
        lane: Math.floor(Math.random() * LANE_COUNT),
        z: 30,
        type: type < 0.4 ? 'car' : type < 0.7 ? 'pothole' : 'vendor',
        colorSet,
        color: colorSet.left,
        active: true,
      });
    }

    // Spawn passengers
    this.passengerTimer -= dt;
    if (this.passengerTimer <= 0) {
      this.passengerTimer = 2 + Math.random() * 3;
      this.passengers_pool.push({
        lane: Math.floor(Math.random() * LANE_COUNT),
        z: 30,
        active: true,
        waveT: Math.random() * Math.PI * 2,
      });
    }

    // Spawn powerups
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      this.powerupTimer = 6 + Math.random() * 8;
      this.powerups.push({
        lane: Math.floor(Math.random() * LANE_COUNT),
        z: 30,
        type: Math.random() < 0.5 ? 'shield' : 'boost',
        active: true,
      });
    }

    // Update obstacles
    for (const ob of this.obstacles) {
      ob.z -= effectiveSpeed * dt * 0.4;
      if (ob.z < -1) ob.active = false;
      // Collision check
      if (ob.active && ob.z > -0.2 && ob.z < 0.8 && Math.abs(ob.z) < 1.2) {
        const depth = 1 - ob.z / 30;
        if (depth > 0.85 && depth < 1.0) {
          const laneDist = Math.abs(ob.lane - this.laneX);
          if (laneDist < 0.5) {
            if (this.jumping && ob.type === 'pothole') continue;
            if (this.shielded) {
              this.shielded = false;
              this.shieldTimer = 0;
              ob.active = false;
              this.spawnSparks(ob.lane, depth);
              this.shakeIntensity = 12;
              this.shakeDuration = 0.3;
              continue;
            }
            // Collision!
            ob.active = false;
            this.spawnCollisionParticles(ob.lane, depth);
            this.shakeIntensity = 35;
            this.shakeDuration = 0.5;
            this.flashAlpha = 0.6;
            this.freezeTimer = 0.08; // 80ms freeze frame
            this.state = 'gameOver';
            this.stateAlpha = 0;
            return;
          }
        }
      }
    }

    // Update passengers
    for (const p of this.passengers_pool) {
      p.z -= effectiveSpeed * dt * 0.4;
      p.waveT += dt * 4;
      if (p.z < -1) p.active = false;
      if (p.active) {
        const depth = 1 - p.z / 30;
        if (depth > 0.85 && depth < 1.0) {
          const laneDist = Math.abs(p.lane - this.laneX);
          if (laneDist < 0.6) {
            p.active = false;
            this.passengers++;
            this.score += 50;
            for (let i = 0; i < 5; i++) {
              this.particles.push({
                x: this.w / 2 + (p.lane - 1) * this.laneWidth * 0.6,
                y: this.playerY - 20,
                vx: (Math.random() - 0.5) * 100,
                vy: -Math.random() * 150 - 50,
                life: 0.6,
                maxLife: 0.6,
                color: C.gold,
                size: 4,
              });
            }
          }
        }
      }
    }

    // Update powerups
    for (const pu of this.powerups) {
      pu.z -= effectiveSpeed * dt * 0.4;
      if (pu.z < -1) pu.active = false;
      if (pu.active) {
        const depth = 1 - pu.z / 30;
        if (depth > 0.85 && depth < 1.0) {
          const laneDist = Math.abs(pu.lane - this.laneX);
          if (laneDist < 0.5) {
            pu.active = false;
            if (pu.type === 'shield') { this.shielded = true; this.shieldTimer = 8; }
            else { this.boosted = true; this.boostTimer = 4; }
          }
        }
      }
    }

    // Clean pools
    this.obstacles = this.obstacles.filter(o => o.active);
    this.passengers_pool = this.passengers_pool.filter(p => p.active);
    this.powerups = this.powerups.filter(p => p.active);

    // Dust particles behind taxi
    if (Math.random() < effectiveSpeed * 0.08) {
      const px = this.w / 2 + (this.laneX - 1) * this.laneWidth * 0.5;
      this.particles.push({
        x: px + (Math.random() - 0.5) * 20,
        y: this.playerY + 15,
        vx: (Math.random() - 0.5) * 30,
        vy: Math.random() * 20 + 5,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        color: C.dust,
        size: 3 + Math.random() * 4,
      });
    }

    // Speed lines
    if (effectiveSpeed > 6 && Math.random() < (effectiveSpeed - 6) * 0.1) {
      this.speedLines.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.5 + this.horizonY * 0.5,
        len: 30 + Math.random() * 60,
        life: 0.3,
        maxLife: 0.3,
      });
    }

    // Update particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const sl of this.speedLines) sl.life -= dt;
    this.speedLines = this.speedLines.filter(s => s.life > 0);

    // Display score lerp
    this.displayScore += (this.score - this.displayScore) * Math.min(1, dt * 5);

    // Flash decay
    if (this.flashAlpha > 0) this.flashAlpha -= dt * 4;

    // Shake decay
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.max(0, 1 - dt * 4);
    } else {
      this.shakeX = this.shakeY = 0;
      this.shakeIntensity = 0;
    }
  }

  spawnSparks(lane, depth) {
    const { x, y } = this.isoToScreen(lane, depth);
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 300,
        vy: -Math.random() * 200 - 50,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: Math.random() < 0.5 ? C.spark : C.red,
        size: 2 + Math.random() * 3,
      });
    }
  }

  spawnCollisionParticles(lane, depth) {
    const { x, y } = this.isoToScreen(lane, depth);
    // Many more, bigger particles for impactful collision
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 400;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        life: 0.5 + Math.random() * 0.6,
        maxLife: 1.1,
        color: [C.spark, C.red, '#ff6600', '#ffcc00', '#ffffff'][Math.floor(Math.random() * 5)],
        size: 3 + Math.random() * 7,
      });
    }
  }

  // ─── DRAW ───
  draw() {
    const { cx, w, h } = this;
    cx.save();
    cx.translate(this.shakeX, this.shakeY);

    this.drawSky();
    this.drawMountains();
    this.drawCitySkyline();
    this.drawRoad();
    this.drawGameObjects();
    this.drawParticles();
    this.drawSpeedLines();

    // Red flash overlay on collision
    if (this.flashAlpha > 0) {
      cx.fillStyle = `rgba(200,0,0,${Math.max(0, this.flashAlpha)})`;
      cx.fillRect(-50, -50, w + 100, h + 100);
    }

    this.drawHUD();

    if (this.state === 'menu') this.drawMenu();
    else if (this.state === 'gameOver') this.drawGameOver();

    cx.restore();
  }

  // ─── SKY ───
  drawSky() {
    const { cx, w, h } = this;
    const grad = cx.createLinearGradient(0, 0, 0, this.horizonY);
    grad.addColorStop(0, C.sky1);
    grad.addColorStop(0.6, C.sky2);
    grad.addColorStop(1, C.sky3);
    cx.fillStyle = grad;
    cx.fillRect(0, 0, w, h);

    // Ocean strip at horizon
    const grad2 = cx.createLinearGradient(0, this.horizonY - 30, 0, this.horizonY + 10);
    grad2.addColorStop(0, C.ocean);
    grad2.addColorStop(1, 'transparent');
    cx.fillStyle = grad2;
    cx.fillRect(0, this.horizonY - 30, w, 50);
  }

  // ─── MOUNTAINS (Table Mountain with flat top, Devil's Peak, Lion's Head) ───
  drawMountains() {
    const { cx, w, h } = this;
    const by = this.horizonY;
    const scroll = this.bgScroll[0] * 0.02;
    const s = scroll % 20;

    cx.save();

    // Lion's Head — rounded bump on the left
    cx.fillStyle = '#4a6a8a';
    cx.beginPath();
    cx.moveTo(-50, by);
    cx.quadraticCurveTo(w * 0.06 - s, by - h * 0.13, w * 0.12 - s, by - h * 0.16);
    cx.quadraticCurveTo(w * 0.16 - s, by - h * 0.18, w * 0.2 - s, by - h * 0.12);
    cx.lineTo(w * 0.22 - s, by);
    cx.closePath();
    cx.fill();

    // Table Mountain — very prominent flat top
    const mtnGrad = cx.createLinearGradient(0, by - h * 0.3, 0, by);
    mtnGrad.addColorStop(0, '#3a5a7a');
    mtnGrad.addColorStop(0.3, '#2a4a6a');
    mtnGrad.addColorStop(1, '#1a3050');
    cx.fillStyle = mtnGrad;
    cx.beginPath();
    cx.moveTo(w * 0.15 - s, by);
    // Left slope up to plateau
    cx.lineTo(w * 0.22 - s, by - h * 0.12);
    cx.lineTo(w * 0.26 - s, by - h * 0.25);
    // FLAT TOP — the defining feature
    cx.lineTo(w * 0.58 - s, by - h * 0.25);
    // Right slope down from plateau
    cx.lineTo(w * 0.62 - s, by - h * 0.12);
    cx.lineTo(w * 0.68 - s, by);
    cx.closePath();
    cx.fill();

    // Lighter cliff face on Table Mountain
    cx.fillStyle = 'rgba(120,150,180,0.3)';
    cx.beginPath();
    cx.moveTo(w * 0.26 - s, by - h * 0.25);
    cx.lineTo(w * 0.58 - s, by - h * 0.25);
    cx.lineTo(w * 0.60 - s, by - h * 0.05);
    cx.lineTo(w * 0.28 - s, by - h * 0.05);
    cx.closePath();
    cx.fill();

    // "Tablecloth" subtle cloud wisps on top
    cx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 4; i++) {
      const cx2 = w * (0.3 + i * 0.07) - s;
      const cy2 = by - h * 0.255;
      cx.beginPath();
      cx.ellipse(cx2, cy2, w * 0.04, h * 0.012, 0, 0, Math.PI * 2);
      cx.fill();
    }

    // Devil's Peak — pointed peak on the right
    cx.fillStyle = '#3a5878';
    cx.beginPath();
    cx.moveTo(w * 0.62 - s, by);
    cx.lineTo(w * 0.68 - s, by - h * 0.12);
    cx.lineTo(w * 0.74 - s, by - h * 0.28);
    cx.lineTo(w * 0.82 - s, by - h * 0.10);
    cx.lineTo(w * 0.88 - s, by);
    cx.closePath();
    cx.fill();

    // Small hills on the far right
    cx.fillStyle = '#4a6878';
    cx.beginPath();
    cx.moveTo(w * 0.85 - s, by);
    cx.quadraticCurveTo(w * 0.92 - s, by - h * 0.06, w + 50, by);
    cx.closePath();
    cx.fill();

    cx.restore();
  }

  // ─── CITY SKYLINE ───
  drawCitySkyline() {
    const { cx, w, h } = this;
    const by = this.horizonY + 5;
    const scroll = this.bgScroll[1] * 0.01;

    cx.fillStyle = C.city;
    const bw = 30;
    for (let i = 0; i < 30; i++) {
      const x = ((i * bw * 1.8 - scroll) % (w + bw * 2)) - bw;
      const bh = 15 + (Math.sin(i * 2.3) * 0.5 + 0.5) * 40;
      cx.fillRect(x, by - bh, bw, bh + 5);
    }
    cx.fillStyle = C.cityLight;
    for (let i = 0; i < 30; i++) {
      const x = ((i * bw * 1.8 - scroll) % (w + bw * 2)) - bw;
      const bh = 15 + (Math.sin(i * 2.3) * 0.5 + 0.5) * 40;
      for (let wy = by - bh + 4; wy < by - 2; wy += 8) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 7) {
          if (Math.sin(wx * 13.7 + wy * 7.3 + i) > 0.2) {
            cx.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
  }

  // ─── ROAD ───
  drawRoad() {
    const { cx, w, h } = this;

    const topW = this.roadWidth * 0.15;
    const botW = this.roadWidth * 1.1;
    const vx = w / 2;

    cx.fillStyle = C.road;
    cx.beginPath();
    cx.moveTo(vx - topW / 2, this.vanishY);
    cx.lineTo(vx + topW / 2, this.vanishY);
    cx.lineTo(vx + botW / 2, h);
    cx.lineTo(vx - botW / 2, h);
    cx.closePath();
    cx.fill();

    cx.strokeStyle = C.roadLine;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(vx - topW / 2, this.vanishY);
    cx.lineTo(vx - botW / 2, h);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(vx + topW / 2, this.vanishY);
    cx.lineTo(vx + botW / 2, h);
    cx.stroke();

    for (let l = 1; l < LANE_COUNT; l++) {
      const ratio = l / LANE_COUNT;
      cx.strokeStyle = 'rgba(240,192,64,0.5)';
      cx.lineWidth = 1.5;
      cx.setLineDash([15, 20]);
      cx.beginPath();
      const tx = vx - topW / 2 + topW * ratio;
      const bx = vx - botW / 2 + botW * ratio;
      cx.moveTo(tx, this.vanishY);
      cx.lineTo(bx, h);
      cx.stroke();
      cx.setLineDash([]);
    }

    // Diamond tiles
    const tileScroll = this.bgScroll[2] * 0.5;
    cx.save();
    for (const tile of this.tiles) {
      const depth = 1 - tile.z / 36;
      if (depth < 0 || depth > 1.05) continue;
      const y = this.vanishY + depth * (h - this.vanishY);
      const perspective = 0.08 + depth * 0.92;
      const rw = this.roadWidth * perspective;
      const tileH = this.tileSize * perspective * 0.4;
      const tileW = rw * 0.12;

      cx.strokeStyle = `rgba(240,192,64,${0.12 * depth})`;
      cx.lineWidth = 1;
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        const laneRatio = (lane + 0.5) / LANE_COUNT;
        const lx = vx - rw / 2 + rw * laneRatio;
        cx.beginPath();
        cx.moveTo(lx, y - tileH);
        cx.lineTo(lx + tileW, y);
        cx.lineTo(lx, y + tileH);
        cx.lineTo(lx - tileW, y);
        cx.closePath();
        cx.stroke();
      }
    }
    cx.restore();
  }

  // ─── GAME OBJECTS ───
  drawGameObjects() {
    const objects = [];

    for (const ob of this.obstacles) {
      const depth = 1 - ob.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'obstacle', data: ob, depth });
    }

    for (const p of this.passengers_pool) {
      const depth = 1 - p.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'passenger', data: p, depth });
    }

    for (const pu of this.powerups) {
      const depth = 1 - pu.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'powerup', data: pu, depth });
    }

    objects.push({ type: 'player', depth: 0.92 });

    objects.sort((a, b) => a.depth - b.depth);

    for (const obj of objects) {
      if (obj.type === 'player') this.drawTaxi();
      else if (obj.type === 'obstacle') this.drawObstacle(obj.data, obj.depth);
      else if (obj.type === 'passenger') this.drawPassenger(obj.data, obj.depth);
      else if (obj.type === 'powerup') this.drawPowerup(obj.data, obj.depth);
    }
  }

  // ─── TAXI (SA Minibus — white with blue trim) ───
  drawTaxi() {
    const { cx, w, h } = this;
    const perspective = 0.85;
    const rw = this.roadWidth * perspective;
    const px = w / 2 + (this.laneX - 1) * (rw / LANE_COUNT);
    let py = this.playerY;

    if (this.jumping) {
      py -= Math.sin(this.jumpT * Math.PI) * 60;
    }

    const sc = 1.0;
    const tw = 48 * sc; // wider — van shape
    const th = 70 * sc; // taller — minibus
    const isoDepth = 20 * sc; // isometric depth

    cx.save();
    cx.translate(px, py);

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.3)';
    cx.beginPath();
    cx.ellipse(0, 22 * sc, tw * 0.8, 12 * sc, 0, 0, Math.PI * 2);
    cx.fill();

    const bx = -tw / 2, by = -th * 0.15;

    // Front face (facing us) — white body
    cx.fillStyle = '#e8e8e8';
    cx.beginPath();
    cx.moveTo(-tw / 2 + 2, by + isoDepth);
    cx.lineTo(tw / 2 - 2, by + isoDepth);
    cx.lineTo(tw / 2 - 2, by + isoDepth - th);
    cx.lineTo(-tw / 2 + 2, by + isoDepth - th);
    cx.closePath();
    cx.fill();

    // Blue trim stripe across front
    cx.fillStyle = C.taxiBlue;
    cx.fillRect(-tw / 2 + 2, by + isoDepth - th * 0.35, tw - 4, th * 0.08);

    // Left face — slightly darker white
    cx.fillStyle = '#d0d0d0';
    cx.beginPath();
    cx.moveTo(bx, by);
    cx.lineTo(-tw / 2 + 2, by + isoDepth);
    cx.lineTo(-tw / 2 + 2, by + isoDepth - th);
    cx.lineTo(bx, by - th);
    cx.closePath();
    cx.fill();

    // Blue stripe on left side
    cx.fillStyle = C.taxiBlue;
    cx.beginPath();
    const stripeY = by - th * 0.35;
    cx.moveTo(bx, stripeY);
    cx.lineTo(-tw / 2 + 2, stripeY + isoDepth * 0.3);
    cx.lineTo(-tw / 2 + 2, stripeY + isoDepth * 0.3 + th * 0.08);
    cx.lineTo(bx, stripeY + th * 0.08);
    cx.closePath();
    cx.fill();

    // Right face
    cx.fillStyle = '#c8c8c8';
    cx.beginPath();
    cx.moveTo(tw / 2, by);
    cx.lineTo(tw / 2 - 2, by + isoDepth);
    cx.lineTo(tw / 2 - 2, by + isoDepth - th);
    cx.lineTo(tw / 2, by - th);
    cx.closePath();
    cx.fill();

    // Blue stripe on right side
    cx.fillStyle = C.taxiBlue;
    cx.beginPath();
    cx.moveTo(tw / 2, stripeY);
    cx.lineTo(tw / 2 - 2, stripeY + isoDepth * 0.3);
    cx.lineTo(tw / 2 - 2, stripeY + isoDepth * 0.3 + th * 0.08);
    cx.lineTo(tw / 2, stripeY + th * 0.08);
    cx.closePath();
    cx.fill();

    // Top face — white
    cx.fillStyle = '#f5f5f5';
    cx.beginPath();
    cx.moveTo(bx, by - th);
    cx.lineTo(-tw / 2 + 2, by + isoDepth - th);
    cx.lineTo(tw / 2 - 2, by + isoDepth - th);
    cx.lineTo(tw / 2, by - th);
    cx.closePath();
    cx.fill();

    // Windshield (large, front face)
    cx.fillStyle = 'rgba(30,60,100,0.75)';
    const winTop = by + isoDepth - th * 0.92;
    const winBot = by + isoDepth - th * 0.45;
    cx.fillRect(-tw / 2 + 6, winTop, tw - 12, winBot - winTop);

    // Side windows (left)
    cx.fillStyle = 'rgba(40,70,110,0.7)';
    const swTop = by - th * 0.85;
    const swH = th * 0.35;
    for (let i = 0; i < 3; i++) {
      const wy = swTop + (swH + 4) * 0 + i * 0; // single row
      cx.beginPath();
      const yOff = i * th * 0.13;
      cx.moveTo(bx + 3, by - th * 0.82 + yOff);
      cx.lineTo(-tw / 2 + 4, by + isoDepth - th * 0.82 + yOff);
      cx.lineTo(-tw / 2 + 4, by + isoDepth - th * 0.68 + yOff);
      cx.lineTo(bx + 3, by - th * 0.68 + yOff);
      cx.closePath();
      cx.fill();
    }

    // Side windows (right)
    for (let i = 0; i < 3; i++) {
      const yOff = i * th * 0.13;
      cx.beginPath();
      cx.moveTo(tw / 2 - 3, by - th * 0.82 + yOff);
      cx.lineTo(tw / 2 - 4, by + isoDepth - th * 0.82 + yOff);
      cx.lineTo(tw / 2 - 4, by + isoDepth - th * 0.68 + yOff);
      cx.lineTo(tw / 2 - 3, by - th * 0.68 + yOff);
      cx.closePath();
      cx.fill();
    }

    // Wheels
    cx.fillStyle = '#222';
    cx.beginPath();
    cx.ellipse(bx + 8, by + isoDepth * 0.8, 6 * sc, 4 * sc, 0.3, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(tw / 2 - 8, by + isoDepth * 0.8, 6 * sc, 4 * sc, -0.3, 0, Math.PI * 2);
    cx.fill();

    // Headlights
    cx.fillStyle = '#ffe';
    cx.beginPath();
    cx.ellipse(-12, by + isoDepth - 4, 4, 3, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(12, by + isoDepth - 4, 4, 3, 0, 0, Math.PI * 2);
    cx.fill();

    // Shield effect
    if (this.shielded) {
      cx.strokeStyle = C.shield;
      cx.lineWidth = 3;
      cx.globalAlpha = 0.4 + Math.sin(this.time * 6) * 0.3;
      cx.beginPath();
      cx.ellipse(0, -th * 0.3, tw * 0.9, th * 0.6, 0, 0, Math.PI * 2);
      cx.stroke();
      cx.globalAlpha = 1;
    }

    // Boost flame
    if (this.boosted) {
      cx.fillStyle = `hsl(${20 + Math.random() * 30}, 100%, ${50 + Math.random() * 30}%)`;
      cx.beginPath();
      cx.moveTo(-8, by + isoDepth + 2);
      cx.lineTo(8, by + isoDepth + 2);
      cx.lineTo(0, by + isoDepth + 20 + Math.random() * 12);
      cx.closePath();
      cx.fill();
    }

    cx.restore();
  }

  // ─── OBSTACLES (properly sized) ───
  drawObstacle(ob, depth) {
    const { cx, w, h } = this;
    const perspective = 0.08 + depth * 0.92;
    const rw = this.roadWidth * perspective;
    const lw = rw / LANE_COUNT; // lane width at this depth
    const x = w / 2 + (ob.lane - 1) * (rw / LANE_COUNT);
    const y = this.vanishY + depth * (this.h - this.vanishY);

    cx.save();
    cx.translate(x, y);

    if (ob.type === 'pothole') {
      // Pothole — dark oval, ~45% of lane width
      const pw = lw * 0.45;
      const ph = pw * 0.4; // elliptical

      // Outer cracked edge
      cx.fillStyle = '#2a2a2a';
      cx.beginPath();
      cx.ellipse(0, 0, pw * 0.6, ph * 0.6, 0, 0, Math.PI * 2);
      cx.fill();

      // Middle ring
      cx.fillStyle = '#1a1a1a';
      cx.beginPath();
      cx.ellipse(0, 0, pw * 0.45, ph * 0.45, 0, 0, Math.PI * 2);
      cx.fill();

      // Dark center (the hole)
      cx.fillStyle = '#050505';
      cx.beginPath();
      cx.ellipse(0, 0, pw * 0.3, ph * 0.3, 0, 0, Math.PI * 2);
      cx.fill();

      // Crack lines radiating out
      cx.strokeStyle = '#3a3a3a';
      cx.lineWidth = Math.max(1, perspective * 1.5);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.3;
        cx.beginPath();
        cx.moveTo(Math.cos(angle) * pw * 0.3, Math.sin(angle) * ph * 0.3);
        cx.lineTo(Math.cos(angle) * pw * 0.7, Math.sin(angle) * ph * 0.7);
        cx.stroke();
      }

    } else if (ob.type === 'car') {
      // Car — proper 3D box, ~70% of lane width, same size as player taxi
      const cw = lw * 0.7;
      const ch = cw * 1.5; // taller
      const cd = cw * 0.4; // iso depth
      const colors = ob.colorSet;

      // Shadow
      cx.fillStyle = 'rgba(0,0,0,0.3)';
      cx.beginPath();
      cx.ellipse(0, cd * 0.6, cw * 0.55, cd * 0.4, 0, 0, Math.PI * 2);
      cx.fill();

      // Front face
      cx.fillStyle = colors.left;
      cx.beginPath();
      cx.moveTo(-cw / 2 + 1, cd * 0.5);
      cx.lineTo(cw / 2 - 1, cd * 0.5);
      cx.lineTo(cw / 2 - 1, cd * 0.5 - ch);
      cx.lineTo(-cw / 2 + 1, cd * 0.5 - ch);
      cx.closePath();
      cx.fill();

      // Left face
      cx.fillStyle = colors.right;
      cx.beginPath();
      cx.moveTo(-cw / 2, 0);
      cx.lineTo(-cw / 2 + 1, cd * 0.5);
      cx.lineTo(-cw / 2 + 1, cd * 0.5 - ch);
      cx.lineTo(-cw / 2, -ch);
      cx.closePath();
      cx.fill();

      // Right face
      cx.fillStyle = colors.left;
      cx.globalAlpha = 0.75;
      cx.beginPath();
      cx.moveTo(cw / 2, 0);
      cx.lineTo(cw / 2 - 1, cd * 0.5);
      cx.lineTo(cw / 2 - 1, cd * 0.5 - ch);
      cx.lineTo(cw / 2, -ch);
      cx.closePath();
      cx.fill();
      cx.globalAlpha = 1;

      // Top face
      cx.fillStyle = colors.top;
      cx.beginPath();
      cx.moveTo(-cw / 2, -ch);
      cx.lineTo(-cw / 2 + 1, cd * 0.5 - ch);
      cx.lineTo(cw / 2 - 1, cd * 0.5 - ch);
      cx.lineTo(cw / 2, -ch);
      cx.closePath();
      cx.fill();

      // Windshield on front face
      cx.fillStyle = 'rgba(30,60,100,0.7)';
      const winW = cw * 0.7;
      const winH = ch * 0.25;
      cx.fillRect(-winW / 2, cd * 0.5 - ch * 0.9, winW, winH);

      // Headlights / taillights (since we see the rear)
      cx.fillStyle = '#ff3333';
      cx.beginPath();
      cx.ellipse(-cw * 0.3, cd * 0.5 - 3, 3 * perspective, 2 * perspective, 0, 0, Math.PI * 2);
      cx.fill();
      cx.beginPath();
      cx.ellipse(cw * 0.3, cd * 0.5 - 3, 3 * perspective, 2 * perspective, 0, 0, Math.PI * 2);
      cx.fill();

    } else if (ob.type === 'vendor') {
      // Vendor with umbrella — properly sized
      const vs = lw * 0.35;
      const us = vs * 0.8; // umbrella size

      // Umbrella pole
      cx.fillStyle = '#8B4513';
      cx.fillRect(-1.5 * perspective, -vs * 1.8, 3 * perspective, vs * 1.8);

      // Umbrella — colorful semicircle
      cx.fillStyle = ob.color;
      cx.beginPath();
      cx.arc(0, -vs * 1.8, us, Math.PI, 0);
      cx.closePath();
      cx.fill();

      // Umbrella stripes
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.beginPath();
      cx.arc(0, -vs * 1.8, us, Math.PI, Math.PI + 0.5);
      cx.lineTo(0, -vs * 1.8);
      cx.closePath();
      cx.fill();

      // Person body
      cx.fillStyle = '#654321';
      cx.beginPath();
      cx.ellipse(0, -vs * 0.15, vs * 0.25, vs * 0.4, 0, 0, Math.PI * 2);
      cx.fill();

      // Person head
      cx.fillStyle = '#543210';
      cx.beginPath();
      cx.arc(0, -vs * 0.7, vs * 0.2, 0, Math.PI * 2);
      cx.fill();

      // Small table/goods
      cx.fillStyle = '#8B6914';
      cx.fillRect(-vs * 0.4, -vs * 0.05, vs * 0.8, vs * 0.15);
    }

    cx.restore();
  }

  // ─── PASSENGERS ───
  drawPassenger(p, depth) {
    const { cx, w, h } = this;
    const perspective = 0.08 + depth * 0.92;
    const rw = this.roadWidth * perspective;
    const x = w / 2 + (p.lane - 1) * (rw / LANE_COUNT) + 20 * perspective;
    const y = this.vanishY + depth * (this.h - this.vanishY);
    const sc = perspective * 0.6;

    cx.save();
    cx.translate(x, y);

    const wave = Math.sin(p.waveT) * 0.3;

    cx.fillStyle = '#e0a060';
    cx.beginPath();
    cx.ellipse(0, -4 * sc, 5 * sc, 8 * sc, 0, 0, Math.PI * 2);
    cx.fill();
    cx.fillStyle = '#d09050';
    cx.beginPath();
    cx.arc(0, -14 * sc, 4 * sc, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = '#e0a060';
    cx.lineWidth = 2.5 * sc;
    cx.beginPath();
    cx.moveTo(4 * sc, -6 * sc);
    cx.lineTo(12 * sc, (-14 + wave * 8) * sc);
    cx.stroke();

    cx.fillStyle = C.gold;
    cx.fillRect(-8 * sc, -22 * sc, 2 * sc, 10 * sc);
    cx.fillRect(-12 * sc, -24 * sc, 10 * sc, 6 * sc);

    cx.restore();
  }

  // ─── POWERUPS ───
  drawPowerup(pu, depth) {
    const { cx, w, h } = this;
    const perspective = 0.08 + depth * 0.92;
    const rw = this.roadWidth * perspective;
    const x = w / 2 + (pu.lane - 1) * (rw / LANE_COUNT);
    const y = this.vanishY + depth * (this.h - this.vanishY);
    const sc = perspective * 0.8;
    const bob = Math.sin(this.time * 4) * 5 * sc;

    cx.save();
    cx.translate(x, y + bob);

    const color = pu.type === 'shield' ? C.shield : C.boost;
    cx.fillStyle = color;
    cx.globalAlpha = 0.3 + Math.sin(this.time * 5) * 0.15;
    cx.beginPath();
    cx.arc(0, -10 * sc, 16 * sc, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;

    cx.fillStyle = color;
    cx.beginPath();
    if (pu.type === 'shield') {
      cx.moveTo(0, -20 * sc);
      cx.lineTo(10 * sc, -14 * sc);
      cx.lineTo(10 * sc, -6 * sc);
      cx.quadraticCurveTo(0, 4 * sc, 0, 4 * sc);
      cx.quadraticCurveTo(0, 4 * sc, -10 * sc, -6 * sc);
      cx.lineTo(-10 * sc, -14 * sc);
      cx.closePath();
    } else {
      cx.moveTo(-4 * sc, -20 * sc);
      cx.lineTo(4 * sc, -10 * sc);
      cx.lineTo(0, -10 * sc);
      cx.lineTo(4 * sc, 2 * sc);
      cx.lineTo(-4 * sc, -8 * sc);
      cx.lineTo(0, -8 * sc);
      cx.closePath();
    }
    cx.fill();

    cx.restore();
  }

  // ─── PARTICLES ───
  drawParticles() {
    const { cx } = this;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      cx.globalAlpha = alpha;
      cx.fillStyle = p.color;
      cx.beginPath();
      cx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  // ─── SPEED LINES ───
  drawSpeedLines() {
    const { cx } = this;
    for (const sl of this.speedLines) {
      const alpha = sl.life / sl.maxLife;
      cx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.moveTo(sl.x, sl.y);
      cx.lineTo(sl.x, sl.y + sl.len);
      cx.stroke();
    }
  }

  // ─── HUD ───
  drawHUD() {
    if (this.state !== 'playing') return;
    const { cx, w, h } = this;

    cx.save();
    cx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    cx.textBaseline = 'top';

    const panelW = Math.min(320, w - 20);
    cx.fillStyle = C.hud;
    cx.beginPath();
    cx.roundRect(10, 10, panelW, 72, 12);
    cx.fill();

    cx.fillStyle = C.hudText;
    cx.fillText(`Score: ${Math.floor(this.displayScore)}`, 22, 18);
    cx.fillText(`🚐 ${this.passengers}`, 22, 42);

    const spdText = `${(this.speed * 12).toFixed(0)} km/h`;
    cx.fillText(spdText, 130, 18);

    cx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    cx.fillStyle = C.gold;
    cx.fillText(`→ ${this.destination}`, 130, 44);

    if (this.shielded) {
      cx.fillStyle = C.shield;
      cx.fillText(`🛡 ${this.shieldTimer.toFixed(1)}s`, 22, 56);
    }
    if (this.boosted) {
      cx.fillStyle = C.boost;
      cx.fillText(`⚡ ${this.boostTimer.toFixed(1)}s`, 120, 56);
    }

    cx.restore();
  }

  // ─── MENU ───
  drawMenu() {
    const { cx, w, h } = this;
    cx.save();
    cx.fillStyle = C.overlay;
    cx.globalAlpha = this.stateAlpha * 0.8;
    cx.fillRect(0, 0, w, h);
    cx.globalAlpha = this.stateAlpha;

    cx.fillStyle = C.gold;
    cx.font = `bold ${Math.min(52, w * 0.09)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('CAPE TOWN', w / 2, h * 0.3);
    cx.fillText('TAXI RUNNER', w / 2, h * 0.3 + Math.min(56, w * 0.1));

    const pulse = 0.6 + Math.sin(this.time * 3) * 0.4;
    cx.globalAlpha = this.stateAlpha * pulse;
    cx.fillStyle = '#fff';
    cx.font = `bold ${Math.min(24, w * 0.045)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    cx.fillText('TAP TO PLAY', w / 2, h * 0.6);

    cx.globalAlpha = this.stateAlpha * 0.5;
    cx.font = `${Math.min(16, w * 0.03)}px -apple-system, sans-serif`;
    cx.fillText('Swipe or Arrow Keys to move • Space to jump', w / 2, h * 0.7);

    cx.restore();
  }

  // ─── GAME OVER ───
  drawGameOver() {
    const { cx, w, h } = this;
    cx.save();
    cx.fillStyle = C.overlay;
    cx.globalAlpha = this.stateAlpha * 0.85;
    cx.fillRect(0, 0, w, h);
    cx.globalAlpha = this.stateAlpha;

    cx.textAlign = 'center';
    cx.textBaseline = 'middle';

    cx.fillStyle = C.red;
    cx.font = `bold ${Math.min(48, w * 0.08)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    cx.fillText('GAME OVER', w / 2, h * 0.3);

    cx.fillStyle = '#fff';
    cx.font = `bold ${Math.min(28, w * 0.05)}px -apple-system, sans-serif`;
    cx.fillText(`Score: ${Math.floor(this.score)}`, w / 2, h * 0.43);
    cx.fillText(`Passengers: ${this.passengers}`, w / 2, h * 0.5);
    cx.fillText(`Distance: ${Math.floor(this.distance)}m`, w / 2, h * 0.57);

    const pulse = 0.6 + Math.sin(this.time * 3) * 0.4;
    cx.globalAlpha = this.stateAlpha * pulse;
    cx.fillStyle = C.gold;
    cx.font = `bold ${Math.min(22, w * 0.04)}px -apple-system, sans-serif`;
    cx.fillText('TAP TO RETRY', w / 2, h * 0.7);

    cx.restore();
  }
}

// ─── INIT ───
const canvas = document.getElementById('game');
const game = new Game(canvas);

})();
