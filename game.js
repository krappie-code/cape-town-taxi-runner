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

// Colors — Cape Town palette
const C = {
  sky1: '#4a90d9', sky2: '#87ceeb', sky3: '#ffd89b',
  mountain: '#2d4a3e', mountainLight: '#3d6a5e',
  city: '#3a3a5c', cityLight: '#5a5a7c',
  road: '#4a4a5a', roadLight: '#5a5a6a', roadLine: '#f0c040',
  taxi: '#f0b030', taxiDark: '#c08020', taxiLight: '#ffe080',
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
      if (absDx < 20 && absDy < 20 && elapsed < 300) return; // tap ignored during play
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
    this.initTiles();
  }

  // ─── ISO HELPERS ───
  // Convert lane + depth (0=horizon, 1=player) to screen coords
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
      this.obstacles.push({
        lane: Math.floor(Math.random() * LANE_COUNT),
        z: 30,
        type: type < 0.4 ? 'car' : type < 0.7 ? 'pothole' : 'vendor',
        color: `hsl(${Math.random() * 360},60%,50%)`,
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
              this.shakeIntensity = 5;
              continue;
            }
            // Collision!
            ob.active = false;
            this.spawnSparks(ob.lane, depth);
            this.shakeIntensity = 15;
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
            // Small celebration particles
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
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const sl of this.speedLines) sl.life -= dt;
    this.speedLines = this.speedLines.filter(s => s.life > 0);

    // Display score lerp
    this.displayScore += (this.score - this.displayScore) * Math.min(1, dt * 5);

    // Shake decay
    this.shakeIntensity *= Math.max(0, 1 - dt * 8);
    if (this.shakeIntensity > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
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

  // ─── MOUNTAINS ───
  drawMountains() {
    const { cx, w, h } = this;
    const by = this.horizonY;
    const scroll = this.bgScroll[0] * 0.02;

    cx.save();
    // Table Mountain — flat top
    cx.fillStyle = C.mountain;
    cx.beginPath();
    cx.moveTo(-50, by);
    cx.lineTo(w * 0.15 - scroll % 20, by - h * 0.18);
    cx.lineTo(w * 0.35 - scroll % 20, by - h * 0.2);
    cx.lineTo(w * 0.55 - scroll % 20, by - h * 0.2);
    cx.lineTo(w * 0.65 - scroll % 20, by - h * 0.17);
    // Devil's Peak
    cx.lineTo(w * 0.78 - scroll % 20, by - h * 0.22);
    cx.lineTo(w * 0.88 - scroll % 20, by - h * 0.12);
    cx.lineTo(w + 50, by);
    cx.closePath();
    cx.fill();

    // Lighter face
    cx.fillStyle = C.mountainLight;
    cx.beginPath();
    cx.moveTo(w * 0.35 - scroll % 20, by - h * 0.2);
    cx.lineTo(w * 0.55 - scroll % 20, by - h * 0.2);
    cx.lineTo(w * 0.6 - scroll % 20, by);
    cx.lineTo(w * 0.3 - scroll % 20, by);
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
    // Lighter windows
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

    // Road surface (trapezoid converging to vanish point)
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

    // Road edge lines
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

    // Lane dividers
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

    // Diamond tiles on road for isometric feel
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
      // Draw diamond across road
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
    // Collect all objects with depth for y-sorting
    const objects = [];

    // Obstacles
    for (const ob of this.obstacles) {
      const depth = 1 - ob.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'obstacle', data: ob, depth });
    }

    // Passengers
    for (const p of this.passengers_pool) {
      const depth = 1 - p.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'passenger', data: p, depth });
    }

    // Powerups
    for (const pu of this.powerups) {
      const depth = 1 - pu.z / 30;
      if (depth < 0 || depth > 1.1) continue;
      objects.push({ type: 'powerup', data: pu, depth });
    }

    // Player taxi
    objects.push({ type: 'player', depth: 0.92 });

    // Sort by depth (far first)
    objects.sort((a, b) => a.depth - b.depth);

    for (const obj of objects) {
      if (obj.type === 'player') this.drawTaxi();
      else if (obj.type === 'obstacle') this.drawObstacle(obj.data, obj.depth);
      else if (obj.type === 'passenger') this.drawPassenger(obj.data, obj.depth);
      else if (obj.type === 'powerup') this.drawPowerup(obj.data, obj.depth);
    }
  }

  // ─── TAXI ───
  drawTaxi() {
    const { cx, w, h } = this;
    const perspective = 0.85;
    const rw = this.roadWidth * perspective;
    const px = w / 2 + (this.laneX - 1) * (rw / LANE_COUNT);
    let py = this.playerY;

    // Jump arc
    if (this.jumping) {
      py -= Math.sin(this.jumpT * Math.PI) * 60;
    }

    const sc = 0.85;
    const tw = 44 * sc; // taxi width
    const th = 60 * sc; // taxi height

    cx.save();
    cx.translate(px, py);

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.3)';
    cx.beginPath();
    cx.ellipse(0, 20 * sc, tw * 0.7, 10 * sc, 0, 0, Math.PI * 2);
    cx.fill();

    // Body — isometric box shape
    // Bottom face
    const bx = -tw / 2, by = -th * 0.2;
    cx.fillStyle = C.taxiDark;
    cx.beginPath();
    cx.moveTo(bx, by);
    cx.lineTo(0, by + 18 * sc);
    cx.lineTo(tw / 2, by);
    cx.lineTo(0, by - 18 * sc);
    cx.closePath();
    cx.fill();

    // Left face
    cx.fillStyle = C.taxi;
    cx.beginPath();
    cx.moveTo(bx, by);
    cx.lineTo(0, by + 18 * sc);
    cx.lineTo(0, by + 18 * sc - th);
    cx.lineTo(bx, by - th);
    cx.closePath();
    cx.fill();

    // Right face
    cx.fillStyle = C.taxiLight;
    cx.beginPath();
    cx.moveTo(tw / 2, by);
    cx.lineTo(0, by + 18 * sc);
    cx.lineTo(0, by + 18 * sc - th);
    cx.lineTo(tw / 2, by - th);
    cx.closePath();
    cx.fill();

    // Top face
    cx.fillStyle = C.taxi;
    cx.beginPath();
    cx.moveTo(bx, by - th);
    cx.lineTo(0, by - 18 * sc - th);
    cx.lineTo(tw / 2, by - th);
    cx.lineTo(0, by + 18 * sc - th);
    cx.closePath();
    cx.fill();

    // Windows (dark strips on left face)
    cx.fillStyle = 'rgba(30,60,100,0.8)';
    const winY = by - th * 0.65;
    cx.beginPath();
    cx.moveTo(bx + 4, winY + 4);
    cx.lineTo(-2, winY + 12 * sc + 4);
    cx.lineTo(-2, winY + 12 * sc - 10);
    cx.lineTo(bx + 4, winY - 6);
    cx.closePath();
    cx.fill();

    // Windows right face
    cx.fillStyle = 'rgba(50,80,120,0.7)';
    cx.beginPath();
    cx.moveTo(tw / 2 - 4, winY + 4);
    cx.lineTo(2, winY + 12 * sc + 4);
    cx.lineTo(2, winY + 12 * sc - 10);
    cx.lineTo(tw / 2 - 4, winY - 6);
    cx.closePath();
    cx.fill();

    // Wheels (small dark ellipses)
    cx.fillStyle = '#222';
    cx.beginPath();
    cx.ellipse(bx + 6, by - 2, 5 * sc, 3 * sc, 0.3, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(tw / 2 - 6, by - 2, 5 * sc, 3 * sc, -0.3, 0, Math.PI * 2);
    cx.fill();

    // Headlights
    cx.fillStyle = '#ffe';
    cx.beginPath();
    cx.ellipse(-8, by + 14 * sc - th * 0.05, 3, 2, 0, 0, Math.PI * 2);
    cx.fill();
    cx.beginPath();
    cx.ellipse(8, by + 14 * sc - th * 0.05, 3, 2, 0, 0, Math.PI * 2);
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
      cx.moveTo(-6, by + 18 * sc);
      cx.lineTo(6, by + 18 * sc);
      cx.lineTo(0, by + 18 * sc + 15 + Math.random() * 10);
      cx.closePath();
      cx.fill();
    }

    cx.restore();
  }

  // ─── OBSTACLES ───
  drawObstacle(ob, depth) {
    const { cx, w, h } = this;
    const perspective = 0.08 + depth * 0.92;
    const rw = this.roadWidth * perspective;
    const x = w / 2 + (ob.lane - 1) * (rw / LANE_COUNT);
    const y = this.vanishY + depth * (this.h - this.vanishY);
    const sc = perspective * 0.7;

    cx.save();
    cx.translate(x, y);

    if (ob.type === 'pothole') {
      cx.fillStyle = 'rgba(0,0,0,0.5)';
      cx.beginPath();
      cx.ellipse(0, 0, 18 * sc, 8 * sc, 0, 0, Math.PI * 2);
      cx.fill();
      cx.strokeStyle = 'rgba(80,80,80,0.6)';
      cx.lineWidth = 1.5 * sc;
      cx.stroke();
    } else if (ob.type === 'car') {
      // Isometric car box
      const cw = 22 * sc, ch = 32 * sc;
      // Shadow
      cx.fillStyle = 'rgba(0,0,0,0.25)';
      cx.beginPath();
      cx.ellipse(0, 8 * sc, cw * 0.7, 5 * sc, 0, 0, Math.PI * 2);
      cx.fill();
      // Left face
      cx.fillStyle = ob.color;
      cx.beginPath();
      cx.moveTo(-cw / 2, 0);
      cx.lineTo(0, 8 * sc);
      cx.lineTo(0, 8 * sc - ch);
      cx.lineTo(-cw / 2, -ch);
      cx.closePath();
      cx.fill();
      // Right face
      cx.fillStyle = ob.color;
      cx.globalAlpha = 0.7;
      cx.beginPath();
      cx.moveTo(cw / 2, 0);
      cx.lineTo(0, 8 * sc);
      cx.lineTo(0, 8 * sc - ch);
      cx.lineTo(cw / 2, -ch);
      cx.closePath();
      cx.fill();
      cx.globalAlpha = 1;
      // Top
      cx.fillStyle = ob.color;
      cx.globalAlpha = 0.9;
      cx.beginPath();
      cx.moveTo(-cw / 2, -ch);
      cx.lineTo(0, -ch - 8 * sc);
      cx.lineTo(cw / 2, -ch);
      cx.lineTo(0, -ch + 8 * sc);
      cx.closePath();
      cx.fill();
      cx.globalAlpha = 1;
    } else if (ob.type === 'vendor') {
      // Colorful umbrella + small figure
      const us = 14 * sc;
      cx.fillStyle = '#8B4513';
      cx.fillRect(-1.5 * sc, -25 * sc, 3 * sc, 25 * sc);
      // Umbrella
      cx.fillStyle = ob.color;
      cx.beginPath();
      cx.arc(0, -25 * sc, us, Math.PI, 0);
      cx.closePath();
      cx.fill();
      // Person
      cx.fillStyle = '#654321';
      cx.beginPath();
      cx.ellipse(0, -3 * sc, 5 * sc, 7 * sc, 0, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = '#543210';
      cx.beginPath();
      cx.arc(0, -12 * sc, 4 * sc, 0, Math.PI * 2);
      cx.fill();
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

    // Waving arm effect
    const wave = Math.sin(p.waveT) * 0.3;

    // Body
    cx.fillStyle = '#e0a060';
    cx.beginPath();
    cx.ellipse(0, -4 * sc, 5 * sc, 8 * sc, 0, 0, Math.PI * 2);
    cx.fill();
    // Head
    cx.fillStyle = '#d09050';
    cx.beginPath();
    cx.arc(0, -14 * sc, 4 * sc, 0, Math.PI * 2);
    cx.fill();
    // Arm waving
    cx.strokeStyle = '#e0a060';
    cx.lineWidth = 2.5 * sc;
    cx.beginPath();
    cx.moveTo(4 * sc, -6 * sc);
    cx.lineTo(12 * sc, (-14 + wave * 8) * sc);
    cx.stroke();

    // Small taxi stop sign
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

    // Glow
    const color = pu.type === 'shield' ? C.shield : C.boost;
    cx.fillStyle = color;
    cx.globalAlpha = 0.3 + Math.sin(this.time * 5) * 0.15;
    cx.beginPath();
    cx.arc(0, -10 * sc, 16 * sc, 0, Math.PI * 2);
    cx.fill();
    cx.globalAlpha = 1;

    // Icon
    cx.fillStyle = color;
    cx.beginPath();
    if (pu.type === 'shield') {
      // Shield shape
      cx.moveTo(0, -20 * sc);
      cx.lineTo(10 * sc, -14 * sc);
      cx.lineTo(10 * sc, -6 * sc);
      cx.quadraticCurveTo(0, 4 * sc, 0, 4 * sc);
      cx.quadraticCurveTo(0, 4 * sc, -10 * sc, -6 * sc);
      cx.lineTo(-10 * sc, -14 * sc);
      cx.closePath();
    } else {
      // Lightning bolt
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

    // Background panel
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

    // Destination
    cx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    cx.fillStyle = C.gold;
    cx.fillText(`→ ${this.destination}`, 130, 44);

    // Power-up indicators
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

    // Title
    cx.fillStyle = C.gold;
    cx.font = `bold ${Math.min(52, w * 0.09)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('CAPE TOWN', w / 2, h * 0.3);
    cx.fillText('TAXI RUNNER', w / 2, h * 0.3 + Math.min(56, w * 0.1));

    // Pulsing tap to play
    const pulse = 0.6 + Math.sin(this.time * 3) * 0.4;
    cx.globalAlpha = this.stateAlpha * pulse;
    cx.fillStyle = '#fff';
    cx.font = `bold ${Math.min(24, w * 0.045)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    cx.fillText('TAP TO PLAY', w / 2, h * 0.6);

    // Controls hint
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
