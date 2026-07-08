/* =========================================================================
 * HIGHWAY RUSH — HTML5 Canvas Racing Game
 * Pure JavaScript (ES6), no frameworks.
 * ========================================================================= */

(() => {
  'use strict';

  // ---------- CONSTANTS ----------
  const W = 480, H = 800;
  const LANES = 4;
  const ROAD_LEFT = 60, ROAD_RIGHT = 420;
  const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
  const LANE_WIDTH = ROAD_WIDTH / LANES;
  const laneX = (i) => ROAD_LEFT + LANE_WIDTH * (i + 0.5);

  const CAR_COLORS = ['#111', '#eee', '#e6b800', '#1a1a1a', '#0d47a1', '#c62828']; // traffic palette
  const OBSTACLES = ['cone', 'oil', 'hole', 'stalled', 'broken'];

  const SHOP_ITEMS = [
    { key: 'speed',  icon: '🚀', name: 'Velocidade', desc: 'Aumenta a velocidade máxima', base: 200 },
    { key: 'nitro',  icon: '⚡', name: 'Nitro',      desc: 'Aumenta a duração do nitro',  base: 250 },
    { key: 'brake',  icon: '🛑', name: 'Freio',      desc: 'Melhora a manobrabilidade',    base: 180 },
    { key: 'coins',  icon: '🪙', name: 'Moedas',     desc: 'Aumenta o valor das moedas',   base: 300 },
    { key: 'turbo',  icon: '🔥', name: 'Turbo',      desc: 'Recarga de nitro mais rápida', base: 350 },
  ];

  const CARS_CATALOG = [
    { id: 'red',    name: 'Fury Red',     color: '#e63946', price: 0,    stats: { speed: 6, accel: 7, grip: 7 } },
    { id: 'blue',   name: 'Ocean Blue',   color: '#1d4ed8', price: 500,  stats: { speed: 7, accel: 6, grip: 8 } },
    { id: 'yellow', name: 'Solar',        color: '#facc15', price: 800,  stats: { speed: 8, accel: 6, grip: 6 } },
    { id: 'green',  name: 'Toxic',        color: '#22c55e', price: 1200, stats: { speed: 7, accel: 8, grip: 7 } },
    { id: 'black',  name: 'Shadow',       color: '#1f2937', price: 2000, stats: { speed: 9, accel: 7, grip: 7 } },
    { id: 'white',  name: 'Phantom',      color: '#f3f4f6', price: 3000, stats: { speed: 9, accel: 9, grip: 9 } },
  ];

  // ---------- STORAGE ----------
  const Storage = {
    KEY: 'highway_rush_v1',
    data: null,
    defaults() {
      return {
        best: 0, coins: 0,
        selectedCar: 'red',
        ownedCars: ['red'],
        upgrades: { speed: 0, nitro: 0, brake: 0, coins: 0, turbo: 0 },
        settings: { music: 0.5, sfx: 0.7, quality: 'high' },
        rankings: [],
      };
    },
    load() {
      try {
        const raw = localStorage.getItem(this.KEY);
        this.data = raw ? { ...this.defaults(), ...JSON.parse(raw) } : this.defaults();
      } catch { this.data = this.defaults(); }
      return this.data;
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch {} },
    reset() { this.data = this.defaults(); this.save(); },
  };

  // ---------- SOUND (WebAudio synthesized) ----------
  class SoundManager {
    constructor() {
      this.ctx = null; this.enabled = true;
      this.musicNode = null; this.musicGain = null;
    }
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    beep(freq = 440, dur = 0.1, type = 'sine', vol = 0.3) {
      if (!this.enabled) return;
      this.ensure(); if (!this.ctx) return;
      const sfxVol = Storage.data.settings.sfx;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol * sfxVol;
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    }
    coin() { this.beep(880, 0.08, 'triangle', 0.35); setTimeout(() => this.beep(1320, 0.08, 'triangle', 0.3), 60); }
    crash() { this.beep(120, 0.35, 'sawtooth', 0.5); }
    nitro() { this.beep(220, 0.4, 'square', 0.25); }
    click() { this.beep(600, 0.05, 'sine', 0.2); }
    levelup() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'triangle', 0.3), i * 100)); }
    gameover() { [400, 300, 200, 150].forEach((f, i) => setTimeout(() => this.beep(f, 0.25, 'sawtooth', 0.35), i * 150)); }
    startMusic() {
      if (!this.enabled) return; this.ensure(); if (!this.ctx || this.musicNode) return;
      const musicVol = Storage.data.settings.music;
      const g = this.ctx.createGain(); g.gain.value = musicVol * 0.15;
      g.connect(this.ctx.destination);
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
      const lfo = this.ctx.createOscillator(); const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.3; lfoGain.gain.value = 20;
      lfo.connect(lfoGain).connect(o.frequency);
      o.connect(g); o.start(); lfo.start();
      this.musicNode = o; this.musicGain = g;
    }
    stopMusic() { if (this.musicNode) { try { this.musicNode.stop(); } catch {} this.musicNode = null; this.musicGain = null; } }
    setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v * 0.15; }
  }

  // ---------- INPUT ----------
  const Input = {
    left: false, right: false, up: false, down: false, nitro: false,
    _init() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = true;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.up = true;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.down = true;
        if (e.key === 'Shift') this.nitro = true;
        if (e.key === 'Escape') game.togglePause();
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = false;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.down = false;
        if (e.key === 'Shift') this.nitro = false;
      });
      // touch buttons
      document.querySelectorAll('#touch-controls .touch').forEach(btn => {
        const act = btn.dataset.act;
        const on = (e) => { e.preventDefault(); this[act] = true; };
        const off = (e) => { e.preventDefault(); this[act] = false; };
        btn.addEventListener('touchstart', on, { passive: false });
        btn.addEventListener('touchend', off);
        btn.addEventListener('mousedown', on);
        btn.addEventListener('mouseup', off);
        btn.addEventListener('mouseleave', off);
      });
    }
  };

  // ---------- HELPERS ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------- ENTITIES ----------
  class Particle {
    constructor(x, y, vx, vy, life, color, size = 3) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life; this.color = color; this.size = size;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; this.vy += 200 * dt * 0.3; }
    draw(ctx) {
      const a = Math.max(0, this.life / this.maxLife);
      ctx.globalAlpha = a; ctx.fillStyle = this.color;
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      ctx.globalAlpha = 1;
    }
  }

  class Player {
    constructor() {
      this.w = 42; this.h = 78;
      this.lane = 1;
      this.x = laneX(this.lane) - this.w / 2;
      this.targetX = this.x;
      this.y = H - 140;
      this.color = '#e63946';
      this.nitro = 100;
      this.nitroActive = false;
      this.invuln = 0;
    }
    setCar(carId) {
      const car = CARS_CATALOG.find(c => c.id === carId) || CARS_CATALOG[0];
      this.color = car.color;
      this.stats = car.stats;
    }
    update(dt, game) {
      const grip = 8 + (this.stats?.grip || 7) * 0.5;
      if (Input.left)  this.lane = Math.max(0, this.lane - 0.4 * dt * 60 * 0);
      // discrete lane change with cooldown
      if (!this._laneCd) this._laneCd = 0;
      this._laneCd -= dt;
      if (this._laneCd <= 0) {
        if (Input.left && this.lane > 0) { this.lane = Math.floor(this.lane) - 1; this._laneCd = 0.15; }
        else if (Input.right && this.lane < LANES - 1) { this.lane = Math.floor(this.lane) + 1; this._laneCd = 0.15; }
        this.lane = clamp(this.lane, 0, LANES - 1);
      }
      this.targetX = laneX(this.lane) - this.w / 2;
      this.x += (this.targetX - this.x) * clamp(grip * dt, 0, 1);

      // nitro
      const turboLvl = Storage.data.upgrades.turbo;
      const nitroCap = 100 + Storage.data.upgrades.nitro * 10;
      if (Input.nitro && this.nitro > 0) {
        this.nitroActive = true;
        this.nitro -= dt * 35;
        if (this.nitro <= 0) { this.nitro = 0; this.nitroActive = false; }
      } else {
        this.nitroActive = false;
        this.nitro = Math.min(nitroCap, this.nitro + dt * (10 + turboLvl * 2));
      }

      if (this.invuln > 0) this.invuln -= dt;

      // particles behind
      if (this.nitroActive) {
        for (let i = 0; i < 3; i++) {
          game.particles.push(new Particle(
            this.x + this.w / 2 + rand(-10, 10), this.y + this.h,
            rand(-30, 30), rand(150, 280), rand(0.2, 0.4), '#00d4ff', rand(3, 6)
          ));
        }
      } else if (game.speed > 200) {
        game.particles.push(new Particle(
          this.x + rand(4, this.w - 4), this.y + this.h,
          0, rand(80, 140), 0.25, '#ffffff33', 2
        ));
      }
    }
    draw(ctx) {
      const blink = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
      if (blink) return;
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(-this.w / 2 + 3, -this.h / 2 + 6, this.w, this.h);

      // body
      const grd = ctx.createLinearGradient(0, -this.h / 2, 0, this.h / 2);
      grd.addColorStop(0, this.color); grd.addColorStop(1, shade(this.color, -0.4));
      ctx.fillStyle = grd;
      roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 8, true);

      // windshield
      ctx.fillStyle = 'rgba(0,20,40,.85)';
      roundRect(ctx, -this.w / 2 + 6, -this.h / 2 + 12, this.w - 12, 18, 4, true);
      // rear window
      roundRect(ctx, -this.w / 2 + 6, this.h / 2 - 26, this.w - 12, 14, 4, true);

      // side stripes
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(-this.w / 2 + 2, -6, this.w - 4, 3);

      // headlights
      ctx.fillStyle = '#fffbe6';
      ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 2, 8, 4);
      ctx.fillRect(this.w / 2 - 12, -this.h / 2 + 2, 8, 4);
      // tail lights
      ctx.fillStyle = '#ff2233';
      ctx.fillRect(-this.w / 2 + 4, this.h / 2 - 6, 8, 4);
      ctx.fillRect(this.w / 2 - 12, this.h / 2 - 6, 8, 4);

      // nitro glow
      if (this.nitroActive) {
        ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 25;
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2;
        roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 8, false, true);
      }
      ctx.restore();

      // headlight cone (subtle)
      if (this.nitroActive) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        const grd2 = ctx.createLinearGradient(this.x + this.w / 2, this.y, this.x + this.w / 2, this.y - 200);
        grd2.addColorStop(0, 'rgba(255,255,220,.6)'); grd2.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = grd2;
        ctx.beginPath();
        ctx.moveTo(this.x + 4, this.y);
        ctx.lineTo(this.x - 20, this.y - 200);
        ctx.lineTo(this.x + this.w + 20, this.y - 200);
        ctx.lineTo(this.x + this.w - 4, this.y);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    get rect() { return { x: this.x + 3, y: this.y + 4, w: this.w - 6, h: this.h - 8 }; }
  }

  class Enemy {
    constructor(lane, speed, type = 'car') {
      this.type = type;
      const sizes = { car: [36, 70], suv: [40, 80], truck: [44, 110], bus: [44, 130], taxi: [36, 70] };
      const [w, h] = sizes[type] || sizes.car;
      this.w = w; this.h = h;
      this.lane = lane;
      this.x = laneX(lane) - w / 2;
      this.y = -h - rand(0, 200);
      this.speed = speed;
      this.color = type === 'taxi' ? '#facc15' : CAR_COLORS[randi(0, CAR_COLORS.length)];
      this.changeCd = rand(2, 6);
      this.canChange = Math.random() < 0.15;
    }
    update(dt, game) {
      this.y += (game.speed - this.speed) * dt;
      if (this.canChange) {
        this.changeCd -= dt;
        if (this.changeCd <= 0) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const nl = clamp(this.lane + dir, 0, LANES - 1);
          this.lane = nl; this.changeCd = rand(3, 7);
        }
      }
      const tx = laneX(this.lane) - this.w / 2;
      this.x += (tx - this.x) * clamp(3 * dt, 0, 1);
    }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(this.x + 3, this.y + 6, this.w, this.h);

      const grd = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
      grd.addColorStop(0, this.color); grd.addColorStop(1, shade(this.color, -0.4));
      ctx.fillStyle = grd;
      roundRect(ctx, this.x, this.y, this.w, this.h, 6, true);

      // windows
      ctx.fillStyle = 'rgba(10,20,40,.85)';
      if (this.type === 'truck' || this.type === 'bus') {
        roundRect(ctx, this.x + 5, this.y + 8, this.w - 10, 16, 3, true);
        // cargo lines
        ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
        for (let i = 30; i < this.h - 5; i += 12) {
          ctx.beginPath(); ctx.moveTo(this.x + 4, this.y + i); ctx.lineTo(this.x + this.w - 4, this.y + i); ctx.stroke();
        }
      } else {
        roundRect(ctx, this.x + 5, this.y + 10, this.w - 10, 16, 3, true);
        roundRect(ctx, this.x + 5, this.y + this.h - 24, this.w - 10, 12, 3, true);
      }

      // headlights (facing us -> at bottom of enemy since they face down toward player? These are traffic in front. Let's put tail lights facing player)
      ctx.fillStyle = '#ff2233';
      ctx.fillRect(this.x + 4, this.y + this.h - 5, 6, 3);
      ctx.fillRect(this.x + this.w - 10, this.y + this.h - 5, 6, 3);

      if (this.type === 'taxi') {
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + this.w / 2 - 8, this.y + 2, 16, 4);
      }

      ctx.restore();
    }
    get rect() { return { x: this.x + 3, y: this.y + 4, w: this.w - 6, h: this.h - 8 }; }
  }

  class Coin {
    constructor(lane) {
      this.w = 22; this.h = 22;
      this.x = laneX(lane) - this.w / 2;
      this.y = -30;
      this.rot = 0;
      this.collected = false;
    }
    update(dt, game) { this.y += game.speed * dt; this.rot += dt * 8; }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      const sx = Math.abs(Math.cos(this.rot));
      ctx.scale(sx, 1);
      const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
      grd.addColorStop(0, '#fff5b0'); grd.addColorStop(0.6, '#ffcc33'); grd.addColorStop(1, '#b8860b');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#8b6914'; ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
      ctx.restore();
    }
    get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  }

  class Obstacle {
    constructor(lane, kind) {
      this.kind = kind;
      this.lane = lane;
      this.w = kind === 'cone' ? 18 : (kind === 'oil' ? 40 : (kind === 'hole' ? 46 : 42));
      this.h = kind === 'cone' ? 22 : (kind === 'oil' ? 40 : (kind === 'hole' ? 30 : 78));
      this.x = laneX(lane) - this.w / 2;
      this.y = -this.h - 20;
    }
    update(dt, game) { this.y += game.speed * dt; }
    draw(ctx) {
      ctx.save();
      switch (this.kind) {
        case 'cone':
          ctx.fillStyle = '#ff6a00';
          ctx.beginPath();
          ctx.moveTo(this.x + this.w / 2, this.y);
          ctx.lineTo(this.x + this.w + 4, this.y + this.h);
          ctx.lineTo(this.x - 4, this.y + this.h);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(this.x - 2, this.y + this.h * 0.55, this.w + 4, 4);
          break;
        case 'oil':
          ctx.fillStyle = 'rgba(0,0,0,.75)';
          ctx.beginPath(); ctx.ellipse(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(80,80,120,.6)';
          ctx.beginPath(); ctx.ellipse(this.x + this.w / 2 - 4, this.y + this.h / 2 - 4, this.w / 3, this.h / 4, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'hole':
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, this.h / 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.stroke();
          break;
        case 'stalled':
        case 'broken':
          ctx.fillStyle = '#555';
          roundRect(ctx, this.x, this.y, this.w, this.h, 6, true);
          ctx.fillStyle = 'rgba(255,120,0,.4)';
          ctx.fillRect(this.x + 4, this.y + 10, this.w - 8, 12);
          ctx.fillStyle = '#222';
          ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('!', this.x + this.w / 2, this.y + this.h / 2 + 6);
          break;
      }
      ctx.restore();
    }
    get rect() { return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 }; }
  }

  // ---------- ROAD ----------
  class Road {
    constructor() { this.dashOffset = 0; this.treeOffset = 0; this.trees = []; this.mountains = []; this.buildMountains(); }
    buildMountains() {
      for (let i = 0; i < 12; i++) {
        this.mountains.push({ x: rand(0, W), y: rand(0, 300), size: rand(40, 100), color: `rgba(30,40,70,${rand(0.3, 0.6)})` });
      }
    }
    update(dt, speed) {
      this.dashOffset = (this.dashOffset + speed * dt) % 40;
      this.treeOffset = (this.treeOffset + speed * dt * 0.6) % 100;
      if (this.trees.length < 30 || Math.random() < 0.05) {
        const side = Math.random() < 0.5 ? 'left' : 'right';
        const x = side === 'left' ? rand(0, ROAD_LEFT - 10) : rand(ROAD_RIGHT + 10, W);
        this.trees.push({ x, y: -20, size: rand(14, 26) });
      }
      this.trees.forEach(t => t.y += speed * dt);
      this.trees = this.trees.filter(t => t.y < H + 40);
    }
    draw(ctx) {
      // sky/grass sides
      ctx.fillStyle = '#1e3a2e';
      ctx.fillRect(0, 0, ROAD_LEFT, H);
      ctx.fillRect(ROAD_RIGHT, 0, W - ROAD_RIGHT, H);

      // mountains at top strip
      this.mountains.forEach(m => {
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.moveTo(m.x - m.size, 60);
        ctx.lineTo(m.x, 60 - m.size * 0.5);
        ctx.lineTo(m.x + m.size, 60);
        ctx.closePath(); ctx.fill();
      });

      // asphalt
      const grd = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
      grd.addColorStop(0, '#2b2f3a'); grd.addColorStop(0.5, '#3a3f4d'); grd.addColorStop(1, '#2b2f3a');
      ctx.fillStyle = grd;
      ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, H);

      // shoulder lines (solid)
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(ROAD_LEFT - 2, 0, 3, H);
      ctx.fillRect(ROAD_RIGHT - 1, 0, 3, H);

      // lane dashes
      ctx.fillStyle = '#f8e16c';
      for (let l = 1; l < LANES; l++) {
        const x = ROAD_LEFT + LANE_WIDTH * l - 2;
        for (let y = -40 + this.dashOffset; y < H; y += 40) {
          ctx.fillRect(x, y, 4, 22);
        }
      }

      // guard rails (subtle)
      ctx.strokeStyle = 'rgba(200,200,220,.4)'; ctx.lineWidth = 2;
      for (let y = -20 + this.dashOffset * 2 % 30; y < H; y += 30) {
        ctx.beginPath(); ctx.moveTo(ROAD_LEFT - 12, y); ctx.lineTo(ROAD_LEFT - 12, y + 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ROAD_RIGHT + 12, y); ctx.lineTo(ROAD_RIGHT + 12, y + 20); ctx.stroke();
      }

      // trees
      this.trees.forEach(t => {
        ctx.fillStyle = '#2d1810';
        ctx.fillRect(t.x - 2, t.y, 4, t.size * 0.6);
        ctx.fillStyle = ['#1a4d2e', '#2d6b3f', '#164d2a'][t.x % 3 | 0];
        ctx.beginPath(); ctx.arc(t.x, t.y - 2, t.size * 0.7, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  // ---------- GAME ----------
  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.state = 'menu'; // menu, playing, paused, gameover, levelup
      this.snd = new SoundManager();
      this.reset();
      this.last = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    }

    reset() {
      this.player = new Player();
      this.player.setCar(Storage.data.selectedCar);
      this.enemies = []; this.coins = []; this.obstacles = []; this.particles = [];
      this.speed = 300; // road scroll speed
      this.baseSpeed = 300;
      this.score = 0; this.coinsCollected = 0; this.distance = 0; this.time = 0;
      this.level = 1;
      this.levelProgress = 0; this.levelTarget = 1000;
      this.combo = 1; this.comboTimer = 0;
      this.spawnTimer = 0; this.coinTimer = 0; this.obsTimer = 0;
      this.road = new Road();
    }

    start() {
      this.reset();
      this.state = 'playing';
      showScreen(null);
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('touch-controls').classList.remove('hidden');
      this.snd.startMusic();
    }

    togglePause() {
      if (this.state === 'playing') { this.state = 'paused'; showScreen('pause'); }
      else if (this.state === 'paused') { this.state = 'playing'; showScreen(null); }
    }

    gameOver() {
      this.state = 'gameover';
      this.snd.gameover(); this.snd.stopMusic();
      const s = Math.floor(this.score);
      if (s > Storage.data.best) Storage.data.best = s;
      Storage.data.coins += this.coinsCollected;
      Storage.data.rankings.push({ score: s, coins: this.coinsCollected, date: Date.now() });
      Storage.data.rankings.sort((a, b) => b.score - a.score);
      Storage.data.rankings = Storage.data.rankings.slice(0, 10);
      Storage.save();
      document.getElementById('go-score').textContent = s;
      document.getElementById('go-time').textContent = Math.floor(this.time) + 's';
      document.getElementById('go-coins').textContent = this.coinsCollected;
      document.getElementById('go-best').textContent = Storage.data.best;
      showScreen('gameover');
      document.getElementById('game-root').classList.add('shake');
      setTimeout(() => document.getElementById('game-root').classList.remove('shake'), 400);
    }

    completeLevel() {
      this.state = 'levelup';
      this.snd.levelup();
      document.getElementById('lvl-score').textContent = Math.floor(this.score);
      document.getElementById('lvl-coins').textContent = this.coinsCollected;
      showScreen('levelup');
    }

    nextLevel() {
      this.level++;
      this.levelProgress = 0;
      this.levelTarget = 1000 + this.level * 500;
      this.baseSpeed = 300 + this.level * 25;
      this.state = 'playing'; showScreen(null);
    }

    spawnEnemy() {
      const lane = randi(0, LANES);
      // avoid stacking
      if (this.enemies.some(e => e.lane === lane && e.y < 120)) return;
      const types = this.level < 2 ? ['car','car','car','suv'] : ['car','suv','truck','taxi','bus','car'];
      const type = types[randi(0, types.length)];
      const speed = rand(60, 180 + this.level * 10);
      this.enemies.push(new Enemy(lane, speed, type));
    }
    spawnCoin() {
      const lane = randi(0, LANES);
      this.coins.push(new Coin(lane));
    }
    spawnObstacle() {
      const lane = randi(0, LANES);
      if (this.enemies.some(e => e.lane === lane && e.y < 200)) return;
      const kind = OBSTACLES[randi(0, OBSTACLES.length)];
      this.obstacles.push(new Obstacle(lane, kind));
    }

    hit(damage = 1) {
      if (this.player.invuln > 0) return;
      this.player.invuln = 1.5;
      this.snd.crash();
      this.combo = 1; this.comboTimer = 0;
      // shake
      document.getElementById('game-root').classList.add('shake');
      setTimeout(() => document.getElementById('game-root').classList.remove('shake'), 300);
      // explosion particles
      for (let i = 0; i < 24; i++) {
        this.particles.push(new Particle(
          this.player.x + this.player.w / 2, this.player.y + this.player.h / 2,
          rand(-200, 200), rand(-200, 100), rand(0.4, 0.9),
          ['#ff6a00','#ffcc33','#ff2233'][randi(0,3)], rand(3, 7)
        ));
      }
      this.lives = (this.lives ?? 3) - 1;
      if (this.lives <= 0) { this.gameOver(); }
    }

    update(dt) {
      if (this.state !== 'playing') return;
      // scale speed with nitro
      const nitroBoost = this.player.nitroActive ? 250 : 0;
      const speedUpgrade = Storage.data.upgrades.speed * 15;
      this.speed = this.baseSpeed + nitroBoost + speedUpgrade;

      this.time += dt;
      this.distance += this.speed * dt;
      const kmh = Math.floor(this.speed * 0.6);

      // score & combo
      const gain = this.speed * dt * 0.05 * this.combo;
      this.score += gain;
      this.levelProgress += gain;
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;

      if (this.levelProgress >= this.levelTarget) { this.completeLevel(); return; }

      this.road.update(dt, this.speed);
      this.player.update(dt, this);

      // spawns
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnTimer = rand(0.5, 1.4) - Math.min(0.5, this.level * 0.05);
      }
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
        this.spawnCoin();
        this.coinTimer = rand(0.8, 2.2);
      }
      this.obsTimer -= dt;
      if (this.obsTimer <= 0) {
        if (this.level > 1) this.spawnObstacle();
        this.obsTimer = rand(2.5, 5) - Math.min(1.5, this.level * 0.1);
      }

      // update entities
      this.enemies.forEach(e => e.update(dt, this));
      this.coins.forEach(c => c.update(dt, this));
      this.obstacles.forEach(o => o.update(dt, this));
      this.particles.forEach(p => p.update(dt));

      // collisions
      const pr = this.player.rect;
      this.enemies.forEach(e => {
        if (rectsOverlap(pr, e.rect)) this.hit(1);
      });
      this.obstacles.forEach(o => {
        if (!o._hit && rectsOverlap(pr, o.rect)) { o._hit = true; this.hit(1); }
      });
      this.coins.forEach(c => {
        if (!c.collected && rectsOverlap(pr, c.rect)) {
          c.collected = true;
          const val = 1 + Storage.data.upgrades.coins;
          this.coinsCollected += val;
          this.combo = Math.min(10, this.combo + 0.5);
          this.comboTimer = 3;
          this.snd.coin();
          for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(
              c.x + c.w / 2, c.y + c.h / 2,
              rand(-100, 100), rand(-150, -50), rand(0.3, 0.6), '#ffcc33', rand(2, 4)
            ));
          }
        }
      });

      // cleanup
      this.enemies = this.enemies.filter(e => e.y < H + 100);
      this.coins = this.coins.filter(c => !c.collected && c.y < H + 40);
      this.obstacles = this.obstacles.filter(o => o.y < H + 40);
      this.particles = this.particles.filter(p => p.life > 0);

      // update HUD
      document.getElementById('hud-level').textContent = this.level;
      document.getElementById('hud-score').textContent = Math.floor(this.score);
      document.getElementById('hud-coins').textContent = this.coinsCollected;
      document.getElementById('hud-speed').textContent = kmh;
      document.getElementById('hud-lives').textContent = '❤️'.repeat(Math.max(0, this.lives ?? 3));
      document.getElementById('hud-combo').textContent = 'x' + this.combo.toFixed(1);
      const nitroCap = 100 + Storage.data.upgrades.nitro * 10;
      document.getElementById('hud-nitro').style.width = (this.player.nitro / nitroCap * 100) + '%';
      document.getElementById('hud-progress').style.width = clamp(this.levelProgress / this.levelTarget * 100, 0, 100) + '%';
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, W, H);
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, 200);
      sky.addColorStop(0, '#0a0f1e'); sky.addColorStop(1, '#1a2340');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 60);

      this.road.draw(ctx);
      this.coins.forEach(c => c.draw(ctx));
      this.obstacles.forEach(o => o.draw(ctx));
      this.enemies.forEach(e => e.draw(ctx));
      this.player.draw(ctx);
      this.particles.forEach(p => p.draw(ctx));

      // motion blur when fast
      if (this.player.nitroActive) {
        ctx.fillStyle = 'rgba(0,150,255,.06)';
        ctx.fillRect(0, 0, W, H);
      }

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.4, W / 2, H / 2, W * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.state === 'playing') {
        this.lives = this.lives ?? 3;
        this.update(dt);
      }
      this.draw();
      requestAnimationFrame(this.loop.bind(this));
    }
  }

  // ---------- UTILS ----------
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
  function shade(hex, amt) {
    // hex "#rrggbb" or "#rgb"; amt in -1..1
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = clamp(parseInt(c.substr(0, 2), 16) + amt * 255, 0, 255) | 0;
    const g = clamp(parseInt(c.substr(2, 2), 16) + amt * 255, 0, 255) | 0;
    const b = clamp(parseInt(c.substr(4, 2), 16) + amt * 255, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }

  // ---------- UI / MENUS ----------
  const SCREENS = ['menu', 'cars', 'shop', 'settings', 'ranking', 'credits', 'pause', 'gameover', 'levelup'];
  function showScreen(name) {
    SCREENS.forEach(s => {
      const el = document.getElementById('screen-' + s);
      if (el) el.classList.toggle('hidden', s !== name);
    });
    const hud = document.getElementById('hud');
    const touch = document.getElementById('touch-controls');
    if (name === null) { hud.classList.remove('hidden'); touch.classList.remove('hidden'); }
    else if (name === 'pause' || name === 'levelup') { /* keep hud */ }
    else { hud.classList.add('hidden'); touch.classList.add('hidden'); }
    if (name === 'menu') renderMenu();
    if (name === 'cars') renderCars();
    if (name === 'shop') renderShop();
    if (name === 'settings') renderSettings();
    if (name === 'ranking') renderRanking();
  }

  function renderMenu() {
    document.getElementById('menu-coins').textContent = Storage.data.coins;
    document.getElementById('menu-best').textContent = Storage.data.best;
  }

  function renderCars() {
    const grid = document.getElementById('cars-grid');
    grid.innerHTML = '';
    CARS_CATALOG.forEach(car => {
      const owned = Storage.data.ownedCars.includes(car.id);
      const selected = Storage.data.selectedCar === car.id;
      const div = document.createElement('div');
      div.className = 'car-card' + (selected ? ' selected' : '') + (!owned ? ' locked' : '');
      div.innerHTML = `
        <div class="car-swatch" style="background:${car.color}"></div>
        <h4>${car.name}</h4>
        <div class="meta">Vel ${car.stats.speed} · Acel ${car.stats.accel} · Grip ${car.stats.grip}</div>
        <div class="meta" style="margin-top:6px;color:${owned ? '#22e37a' : '#ffcc33'};font-weight:700">
          ${owned ? (selected ? 'SELECIONADO' : 'SELECIONAR') : ('🪙 ' + car.price)}
        </div>`;
      div.onclick = () => {
        game.snd.click();
        if (owned) { Storage.data.selectedCar = car.id; }
        else if (Storage.data.coins >= car.price) {
          Storage.data.coins -= car.price;
          Storage.data.ownedCars.push(car.id);
          Storage.data.selectedCar = car.id;
        } else { return; }
        Storage.save();
        game.player.setCar(Storage.data.selectedCar);
        renderCars();
      };
      grid.appendChild(div);
    });
  }

  function renderShop() {
    const list = document.getElementById('shop-list');
    list.innerHTML = '';
    document.getElementById('shop-coins').textContent = Storage.data.coins;
    SHOP_ITEMS.forEach(it => {
      const lvl = Storage.data.upgrades[it.key];
      const cost = it.base * (lvl + 1);
      const maxed = lvl >= 10;
      const canBuy = !maxed && Storage.data.coins >= cost;
      const dots = Array.from({ length: 10 }, (_, i) => `<span class="dot ${i < lvl ? 'on' : ''}"></span>`).join('');
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML = `
        <div class="icon">${it.icon}</div>
        <div class="info">
          <h4>${it.name}</h4>
          <small>${it.desc}</small>
          <div class="lvl-dots">${dots}</div>
        </div>
        <button class="buy" ${!canBuy ? 'disabled' : ''}>${maxed ? 'MAX' : '🪙 ' + cost}</button>`;
      el.querySelector('.buy').onclick = () => {
        if (!canBuy) return;
        Storage.data.coins -= cost;
        Storage.data.upgrades[it.key]++;
        Storage.save();
        game.snd.click();
        renderShop();
      };
      list.appendChild(el);
    });
  }

  function renderSettings() {
    document.getElementById('set-music').value = Storage.data.settings.music;
    document.getElementById('set-sfx').value = Storage.data.settings.sfx;
    document.getElementById('set-quality').value = Storage.data.settings.quality;
  }
  function renderRanking() {
    const list = document.getElementById('ranking-list');
    list.innerHTML = '';
    if (!Storage.data.rankings.length) {
      list.innerHTML = '<li style="justify-content:center">Sem partidas ainda</li>';
      return;
    }
    Storage.data.rankings.forEach(r => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${r.score} pts</span><span>🪙 ${r.coins}</span>`;
      list.appendChild(li);
    });
  }

  // ---------- BOOT ----------
  let game;
  window.addEventListener('load', () => {
    Storage.load();
    Input._init();
    const canvas = document.getElementById('game');
    game = new Game(canvas);
    window.game = game;

    // nav buttons
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        game.snd.click();
        const t = btn.dataset.nav;
        if (t === 'play') { game.start(); }
        else if (t === 'menu') {
          game.state = 'menu'; game.snd.stopMusic();
          showScreen('menu');
        }
        else showScreen(t);
      });
    });

    document.getElementById('btn-pause').onclick = () => game.togglePause();
    document.getElementById('btn-resume').onclick = () => game.togglePause();
    document.getElementById('btn-retry').onclick = () => { game.snd.click(); game.start(); };
    document.getElementById('btn-next-level').onclick = () => { game.snd.click(); game.nextLevel(); };
    document.getElementById('btn-fullscreen').onclick = () => {
      const d = document.documentElement;
      if (!document.fullscreenElement) d.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
    document.getElementById('btn-reset').onclick = () => {
      if (confirm('Zerar todo o progresso?')) { Storage.reset(); renderMenu(); alert('Progresso zerado.'); }
    };
    ['set-music', 'set-sfx'].forEach(id => {
      document.getElementById(id).oninput = (e) => {
        const key = id === 'set-music' ? 'music' : 'sfx';
        Storage.data.settings[key] = parseFloat(e.target.value);
        Storage.save();
        if (key === 'music') game.snd.setMusicVolume(Storage.data.settings.music);
      };
    });
    document.getElementById('set-quality').onchange = (e) => {
      Storage.data.settings.quality = e.target.value; Storage.save();
    };

    showScreen('menu');
  });
})();
