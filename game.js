/**
 * RTO Driving Test Simulator - Core Engine
 * Adheres to Ackerman steering vehicle dynamics, offscreen collision mapping,
 * and vector-based collision check parameters.
 */

// --- Audio System (Web Audio API) ---
class SoundSystem {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineFilter = null;
    this.gainNode = null;
    this.muted = false;
    this.initialized = false;
  }
  
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
      this.startEngineHum();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }
  
  startEngineHum() {
    if (!this.ctx || this.muted) return;
    
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // low hum
      
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
      
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
      
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);
      
      this.engineOsc.start();
    } catch (err) {
      console.error(err);
    }
  }
  
  updateEnginePitch(speed) {
    if (!this.ctx || !this.engineOsc || this.muted) return;
    
    const absSpeed = Math.abs(speed);
    const targetFreq = 45 + absSpeed * 40;
    const targetFilterFreq = 120 + absSpeed * 100;
    
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(targetFilterFreq, this.ctx.currentTime, 0.1);
  }
  
  playBeep() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // high warning pitch
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }
  
  playCrash() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }
  
  playSuccess() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      }, i * 110);
    });
  }
  
  playFailure() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    const notes = [293.66, 277.18, 261.63]; // D, C#, C descending
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
      }, i * 140);
    });
  }
}

const sounds = new SoundSystem();

// --- Game Engine Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Offscreen Canvas for precise color-coded boundary checking
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = 800;
offscreenCanvas.height = 600;
const offscreenCtx = offscreenCanvas.getContext('2d');

// --- Physics Definitions ---
const VEHICLE_CONFIGS = {
  hatchback: {
    length: 46,
    width: 24,
    wheelbase: 28,
    color: '#f97316', // Orange-500
    displayName: 'HATCHBACK',
    maxSpeed: 2.2,
    maxReverseSpeed: 1.2,
    accel: 0.05,
    brakeDecel: 0.12,
    handbrakeDecel: 0.18,
    friction: 0.02,
    steerSpeed: 0.05,
    steerReturnSpeed: 0.06,
    maxSteeringAngle: 40 * Math.PI / 180 // 40 degrees
  },
  sedan: {
    length: 58,
    width: 26,
    wheelbase: 36,
    color: '#06b6d4', // Cyan-500
    displayName: 'SEDAN',
    maxSpeed: 2.0,
    maxReverseSpeed: 1.0,
    accel: 0.04,
    brakeDecel: 0.10,
    handbrakeDecel: 0.15,
    friction: 0.015,
    steerSpeed: 0.04,
    steerReturnSpeed: 0.05,
    maxSteeringAngle: 38 * Math.PI / 180 // 38 degrees
  }
};

// Start configs for each track (x, y, headingAngle)
const TRACK_START_CONFIGS = {
  '8': { x: 317.5, y: 400, angle: -Math.PI / 2 },
  'H': { x: 240, y: 440, angle: -Math.PI / 2 },
  'parking': { x: 120, y: 380, angle: 0 }
};

// --- Game State Variables ---
let currentTrack = '8';
let currentVehicleType = 'hatchback';
let keys = {};
let penalties = 0;
let timeRemaining = 90.0;
let conesHit = 0;
let gameState = 'READY'; // READY, PLAYING, PASSED, FAILED
let lastTime = 0;
let isTouchingBoundary = false;
let boundaryFlashTimer = 0;

// Parked Cars (used in Parallel Parking track)
const parkedCars = [
  { x: 280, y: 280, width: 110, height: 50, color: '#475569' }, // slate-600
  { x: 570, y: 280, width: 110, height: 50, color: '#475569' }
];

// Cones Configuration for tracks
let cones = [];

function generateCones(trackId) {
  if (trackId === '8') {
    cones = [
      // Inner island limits to prevent corner cutting
      { x: 400, y: 145, radius: 6 },
      { x: 400, y: 255, radius: 6 },
      { x: 400, y: 345, radius: 6 },
      { x: 400, y: 455, radius: 6 },
      // Outer border visual guide cones
      { x: 400 - 110, y: 200, radius: 6 },
      { x: 400 + 110, y: 200, radius: 6 },
      { x: 400 - 110, y: 400, radius: 6 },
      { x: 400 + 110, y: 400, radius: 6 }
    ];
  } else if (trackId === 'H') {
    cones = [
      // Corner turning pockets
      { x: 280, y: 260, radius: 6 },
      { x: 280, y: 340, radius: 6 },
      { x: 520, y: 260, radius: 6 },
      { x: 520, y: 340, radius: 6 },
      // Back pockets (blocking dead ends but allowing reversing space)
      { x: 240, y: 120, radius: 6 },
      { x: 560, y: 480, radius: 6 },
      // Side guidelines
      { x: 200, y: 300, radius: 6 },
      { x: 600, y: 300, radius: 6 }
    ];
  } else if (trackId === 'parking') {
    cones = [
      // Outlining the parking bay
      { x: 350, y: 320, radius: 6 },
      { x: 500, y: 320, radius: 6 },
      { x: 350, y: 240, radius: 6 },
      { x: 500, y: 240, radius: 6 },
      { x: 425, y: 240, radius: 6 }, // Back center
      // Curb guidelines
      { x: 200, y: 320, radius: 6 },
      { x: 650, y: 320, radius: 6 }
    ];
  }
}

// --- Car Representation ---
class Car {
  constructor(type, startPos) {
    const config = VEHICLE_CONFIGS[type];
    this.type = type;
    this.x = startPos.x;
    this.y = startPos.y;
    this.speed = 0;
    this.headingAngle = startPos.angle;
    this.steeringAngle = 0;
    this.gear = 'D'; // 'D' (Drive/Forward) or 'R' (Reverse)
    
    // Copy parameters from config
    this.length = config.length;
    this.width = config.width;
    this.wheelbase = config.wheelbase;
    this.color = config.color;
    this.maxSpeed = config.maxSpeed;
    this.maxReverseSpeed = config.maxReverseSpeed;
    this.accel = config.accel;
    this.brakeDecel = config.brakeDecel;
    this.handbrakeDecel = config.handbrakeDecel;
    this.friction = config.friction;
    this.steerSpeed = config.steerSpeed;
    this.steerReturnSpeed = config.steerReturnSpeed;
    this.maxSteeringAngle = config.maxSteeringAngle;
  }
  
  update() {
    // 1. Core Physics Handling (Keyboard Inputs)
    let throttle = false;
    let braking = false;
    
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
      // Intended acceleration
      if (this.gear === 'D') {
        if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + this.brakeDecel); // Braking when rolling backward
          braking = true;
        } else {
          this.speed += this.accel;
          throttle = true;
        }
      } else { // gear === 'R'
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - this.brakeDecel); // Braking when rolling forward
          braking = true;
        } else {
          this.speed -= this.accel;
          throttle = true;
        }
      }
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
      // Intended braking or opposite movement
      if (this.gear === 'D') {
        if (this.speed > 0) {
          this.speed = Math.max(0, this.speed - this.brakeDecel);
          braking = true;
        } else {
          // Coast or friction stops
          this.speed = Math.min(0, this.speed + this.friction);
        }
      } else { // gear === 'R'
        if (this.speed < 0) {
          this.speed = Math.min(0, this.speed + this.brakeDecel);
          braking = true;
        } else {
          this.speed = Math.max(0, this.speed - this.friction);
        }
      }
    } else if (keys[' ']) {
      // Handbrake
      braking = true;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.handbrakeDecel);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.handbrakeDecel);
      }
    } else {
      // Coaster friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction);
      }
    }
    
    // Cap Speed limits
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    if (this.speed < -this.maxReverseSpeed) this.speed = -this.maxReverseSpeed;
    
    // Handle Braking lights flag
    this.isBraking = braking;
    
    // 2. Handle Steering Angle Inputs
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      this.steeringAngle = Math.max(-this.maxSteeringAngle, this.steeringAngle - this.steerSpeed);
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      this.steeringAngle = Math.min(this.maxSteeringAngle, this.steeringAngle + this.steerSpeed);
    } else {
      // Self centering steer logic
      if (this.steeringAngle > 0) {
        this.steeringAngle = Math.max(0, this.steeringAngle - this.steerReturnSpeed);
      } else if (this.steeringAngle < 0) {
        this.steeringAngle = Math.min(0, this.steeringAngle + this.steerReturnSpeed);
      }
    }
    
    // 3. Ackerman Bicycle Model Equations (COG Reference)
    const beta = Math.atan(0.5 * Math.tan(this.steeringAngle));
    
    // Update X, Y and Heading Angle
    this.x += this.speed * Math.cos(this.headingAngle + beta);
    this.y += this.speed * Math.sin(this.headingAngle + beta);
    this.headingAngle += (this.speed / this.wheelbase) * Math.tan(this.steeringAngle) * Math.cos(beta);
    
    // Keep angle normalized between [0, 2*PI]
    this.headingAngle = (this.headingAngle + Math.PI * 2) % (Math.PI * 2);
    
    // Feed pitch oscillator speed update
    sounds.updateEnginePitch(this.speed);
  }
  
  getCorners() {
    const hl = this.length / 2;
    const hw = this.width / 2;
    const cosH = Math.cos(this.headingAngle);
    const sinH = Math.sin(this.headingAngle);
    
    // Relative corner matrices
    const cornerDeltas = [
      { dx: hl, dy: hw },   // Front-Right
      { dx: hl, dy: -hw },  // Front-Left
      { dx: -hl, dy: hw },  // Rear-Right
      { dx: -hl, dy: -hw }  // Rear-Left
    ];
    
    return cornerDeltas.map(delta => ({
      x: this.x + delta.dx * cosH - delta.dy * sinH,
      y: this.y + delta.dx * sinH + delta.dy * cosH
    }));
  }
  
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.headingAngle);
    
    // 1. Draw headlight beams if moving
    if (gameState === 'PLAYING') {
      const beamGrad = ctx.createLinearGradient(this.length / 2, 0, this.length / 2 + 80, 0);
      beamGrad.addColorStop(0, 'rgba(253, 224, 71, 0.45)'); // Amber yellow semi-bright
      beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
      
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(this.length / 2, -this.width / 2 + 2);
      ctx.lineTo(this.length / 2 + 70, -this.width / 2 - 20);
      ctx.lineTo(this.length / 2 + 70, this.width / 2 + 20);
      ctx.lineTo(this.length / 2, this.width / 2 - 2);
      ctx.closePath();
      ctx.fill();
    }
    
    // 2. Draw Chassis shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    
    // 3. Draw Main Car Body Chassis
    ctx.fillStyle = this.color;
    // Rounded chassis corners
    const r = 4;
    ctx.beginPath();
    ctx.roundRect(-this.length / 2, -this.width / 2, this.length, this.width, r);
    ctx.fill();
    
    // Clear shadow for subsequent layers
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // 4. Draw Cabin/Glass roof structure
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'; // Dark glass color
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Smaller rectangle inside chassis for glass cabin
    ctx.roundRect(-this.length * 0.25, -this.width * 0.38, this.length * 0.55, this.width * 0.76, 2);
    ctx.fill();
    ctx.stroke();
    
    // Speclar windshield highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(this.length * 0.25, -this.width * 0.32);
    ctx.lineTo(this.length * 0.1, -this.width * 0.32);
    ctx.lineTo(this.length * 0.1, this.width * 0.32);
    ctx.lineTo(this.length * 0.25, this.width * 0.32);
    ctx.closePath();
    ctx.fill();
    
    // 5. Draw headlights
    ctx.fillStyle = '#fef08a'; // yellow-200
    ctx.fillRect(this.length / 2 - 2, -this.width / 2 + 2, 3, 5);
    ctx.fillRect(this.length / 2 - 2, this.width / 2 - 7, 3, 5);
    
    // 6. Draw taillights (bright red if braking, dull red otherwise)
    ctx.fillStyle = this.isBraking ? '#ef4444' : '#991b1b'; // bright red vs dark red
    if (this.isBraking) {
      // Glow tail effect
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 6;
    }
    ctx.fillRect(-this.length / 2 - 1, -this.width / 2 + 2, 2, 4);
    ctx.fillRect(-this.length / 2 - 1, this.width / 2 - 6, 2, 4);
    ctx.shadowBlur = 0; // reset
    
    // 7. Draw Rear Fixed Wheels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-this.wheelbase / 2 - 5, -this.width / 2 - 2, 10, 3);
    ctx.fillRect(-this.wheelbase / 2 - 5, this.width / 2 - 1, 10, 3);
    
    // 8. Draw Front Steering Wheels (Rotates with steeringAngle)
    ctx.restore(); // Exit car translation to render wheels individually
    
    // Draw front wheels with angle transform
    this.drawSteerableWheel(this.wheelbase / 2, -this.width / 2 - 1);
    this.drawSteerableWheel(this.wheelbase / 2, this.width / 2);
  }
  
  drawSteerableWheel(offsetX, offsetY) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.headingAngle);
    ctx.translate(offsetX, offsetY);
    ctx.rotate(this.steeringAngle);
    
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-5, -1, 10, 3);
    ctx.restore();
  }
}

let playerCar = null;

// --- Initialize or Reset Simulator ---
function startTest() {
  const startConfig = TRACK_START_CONFIGS[currentTrack];
  playerCar = new Car(currentVehicleType, startConfig);
  
  penalties = 0;
  timeRemaining = 90.0;
  conesHit = 0;
  isTouchingBoundary = false;
  boundaryFlashTimer = 0;
  
  generateCones(currentTrack);
  drawOffscreenTrack(currentTrack);
  updateDashboardHUD();
  
  // Reset modals
  const modal = document.getElementById('result-modal');
  modal.classList.add('hidden');
  modal.classList.remove('opacity-100');
  modal.style.opacity = '0';
  document.getElementById('modal-passed-card').classList.add('hidden');
  document.getElementById('modal-failed-card').classList.add('hidden');
  
  gameState = 'READY';
  lastTime = performance.now();
}

function selectTrack(trackId) {
  currentTrack = trackId;
  
  // Update Buttons UI
  ['8', 'H', 'parking'].forEach(id => {
    const btn = document.getElementById(`track-btn-${id}`);
    const dot = document.getElementById(`track-dot-${id}`);
    if (id === trackId) {
      btn.classList.add('border-orange-500/50', 'bg-slate-900/90', 'glow-active');
      btn.classList.remove('border-white/10', 'bg-slate-900/60');
      dot.classList.remove('scale-0');
      dot.classList.add('scale-100');
    } else {
      btn.classList.remove('border-orange-500/50', 'bg-slate-900/90', 'glow-active');
      btn.classList.add('border-white/10', 'bg-slate-900/60');
      dot.classList.remove('scale-100');
      dot.classList.add('scale-0');
    }
  });
  
  // Track name overlay
  const overlays = {
    '8': 'TRACK: 8-TRACK',
    'H': 'TRACK: H-TRACK',
    'parking': 'TRACK: PARALLEL PARKING'
  };
  document.getElementById('track-name-overlay').innerText = overlays[trackId];
  
  startTest();
}

function selectVehicle(vehicleId) {
  currentVehicleType = vehicleId;
  
  // Update buttons UI
  ['hatchback', 'sedan'].forEach(id => {
    const btn = document.getElementById(`vehicle-btn-${id}`);
    if (id === vehicleId) {
      btn.classList.add('border-orange-500/50', 'bg-slate-900/90');
      btn.classList.remove('border-white/10', 'bg-slate-900/60');
    } else {
      btn.classList.remove('border-orange-500/50', 'bg-slate-900/90');
      btn.classList.add('border-white/10', 'bg-slate-900/60');
    }
  });
  
  document.getElementById('vehicle-name-overlay').innerText = `VEHICLE: ${VEHICLE_CONFIGS[vehicleId].displayName}`;
  
  startTest();
}

function toggleGear() {
  if (!playerCar || gameState === 'PASSED' || gameState === 'FAILED') return;
  sounds.init();
  playerCar.gear = playerCar.gear === 'D' ? 'R' : 'D';
  sounds.playBeep();
  updateDashboardHUD();
}

// --- Collision Checks ---
function checkBoundaryCollision(x, y) {
  if (x < 0 || x >= 800 || y < 0 || y >= 600) return true; // offscreen boundary
  const pixel = offscreenCtx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return pixel[0] > 200; // red channel indicates boundary line
}

function checkFinishZone(x, y) {
  if (x < 0 || x >= 800 || y < 0 || y >= 600) return false;
  const pixel = offscreenCtx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return pixel[1] > 200 && pixel[0] < 50; // high green, low red
}

// Oriented Bounding Box (OBB) vs Circle (Cone) Collision Check
function checkConeCollision(car, cone) {
  // Translate circle center to car's coordinate system
  const dx = cone.x - car.x;
  const dy = cone.y - car.y;
  
  // Rotate circle center relative to car heading
  const cosT = Math.cos(-car.headingAngle);
  const sinT = Math.sin(-car.headingAngle);
  const rotX = dx * cosT - dy * sinT;
  const rotY = dx * sinT + dy * cosT;
  
  const halfLen = car.length / 2;
  const halfWid = car.width / 2;
  
  // Closest point coordinates on the box edge
  const closestX = Math.max(-halfLen, Math.min(halfLen, rotX));
  const closestY = Math.max(-halfWid, Math.min(halfWid, rotY));
  
  // Compute distance from closest point to circle center
  const distX = rotX - closestX;
  const distY = rotY - closestY;
  const distSq = distX * distX + distY * distY;
  
  // Circle radius is cone.radius, add minor buffer for realistic bumper overlap
  const checkRadius = cone.radius + 3;
  return distSq < (checkRadius * checkRadius);
}

// Check collision of point with static parked cars (axis-aligned boxes)
function isPointCollidingParkedCar(px, py, box) {
  const left = box.x - box.width / 2;
  const right = box.x + box.width / 2;
  const top = box.y - box.height / 2;
  const bottom = box.y + box.height / 2;
  return px >= left && px <= right && py >= top && py <= bottom;
}

// --- Game Over / Rules Execution ---
function triggerFailure(reason) {
  gameState = 'FAILED';
  sounds.playFailure();
  
  // Display stats
  document.getElementById('modal-failed-reason').innerText = reason;
  document.getElementById('modal-fail-time').innerText = `${timeRemaining.toFixed(1)}s`;
  document.getElementById('modal-fail-penalties').innerText = `${penalties} / 3`;
  
  // Show Modal
  const modal = document.getElementById('result-modal');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('opacity-100');
    modal.style.opacity = '1';
    document.getElementById('modal-failed-card').classList.remove('hidden');
  }, 50);
}

function triggerSuccess() {
  gameState = 'PASSED';
  sounds.playSuccess();
  
  // Display stats
  const timeTaken = (90.0 - timeRemaining).toFixed(1);
  document.getElementById('modal-pass-time').innerText = `${timeTaken}s`;
  document.getElementById('modal-pass-penalties').innerText = `${penalties} / 3`;
  
  // Show Modal
  const modal = document.getElementById('result-modal');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('opacity-100');
    modal.style.opacity = '1';
    document.getElementById('modal-passed-card').classList.remove('hidden');
  }, 50);
}

function flashBoundaryWarning() {
  sounds.playBeep();
  boundaryFlashTimer = 18; // active screen flash frames
  updateDashboardHUD();
}

// --- Dashboard / HUD UI Update ---
function updateDashboardHUD() {
  // Speedometer circular gauge offset
  const maxUIKmH = 30;
  const kmh = Math.round(Math.abs(playerCar ? playerCar.speed : 0) * 12);
  document.getElementById('telemetry-speed').innerText = kmh;
  
  const gauge = document.getElementById('speedometer-gauge');
  const dashArray = 163; // 2 * PI * r (r=26)
  const ratio = Math.min(1, kmh / maxUIKmH);
  const offset = dashArray - (dashArray * ratio);
  gauge.style.strokeDashoffset = offset;
  
  // Gears (D/R) active lights
  const gearD = document.getElementById('gear-d');
  const gearR = document.getElementById('gear-r');
  if (playerCar && playerCar.gear === 'D') {
    gearD.classList.add('border-orange-500', 'text-orange-500', 'shadow-md', 'shadow-orange-500/20');
    gearD.classList.remove('border-white/5', 'text-slate-500');
    gearR.classList.remove('border-orange-500', 'text-orange-500', 'shadow-md', 'shadow-orange-500/20');
    gearR.classList.add('border-white/5', 'text-slate-500');
  } else {
    gearR.classList.add('border-orange-500', 'text-orange-500', 'shadow-md', 'shadow-orange-500/20');
    gearR.classList.remove('border-white/5', 'text-slate-500');
    gearD.classList.remove('border-orange-500', 'text-orange-500', 'shadow-md', 'shadow-orange-500/20');
    gearD.classList.add('border-white/5', 'text-slate-500');
  }
  
  // Timer text update
  document.getElementById('telemetry-timer').innerHTML = `${timeRemaining.toFixed(1)}<span class="text-lg">s</span>`;
  
  // Boundary LEDs update
  [1, 2, 3].forEach(idx => {
    const led = document.getElementById(`penalty-led-${idx}`);
    if (penalties >= idx) {
      led.classList.remove('bg-red-950', 'border-red-800/30', 'text-red-900');
      led.classList.add('bg-red-500', 'border-red-400', 'text-white', 'led-blink', 'shadow-lg', 'shadow-red-500/50');
    } else {
      led.classList.remove('bg-red-500', 'border-red-400', 'text-white', 'led-blink', 'shadow-lg', 'shadow-red-500/50');
      led.classList.add('bg-red-950', 'border-red-800/30', 'text-red-900');
    }
  });
  
  // Cones Hit
  document.getElementById('telemetry-cones').innerText = conesHit;
  if (conesHit > 0) {
    document.getElementById('telemetry-cones').classList.add('text-red-500');
  } else {
    document.getElementById('telemetry-cones').classList.remove('text-red-500');
  }
}

// --- Screen Canvas Draw Helpers ---
function drawConeAsset(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  
  // 1. Shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 2. Square Base
  ctx.fillStyle = '#27272a'; // dark zinc base
  ctx.fillRect(-6, 2, 12, 3);
  
  // 3. Orange Cone cone body
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-5, 2);
  ctx.lineTo(-1.5, -7);
  ctx.lineTo(1.5, -7);
  ctx.lineTo(5, 2);
  ctx.closePath();
  ctx.fill();
  
  // 4. White reflective center stripe
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-3, -1);
  ctx.lineTo(-2, -4);
  ctx.lineTo(2, -4);
  ctx.lineTo(3, -1);
  ctx.closePath();
  ctx.fill();
  
  // 5. Tip peak shadow/details
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-1.5, -7);
  ctx.lineTo(1.5, -7);
  ctx.lineTo(2, -4);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function drawParkedCar(ctx, carData) {
  ctx.save();
  ctx.translate(carData.x, carData.y);
  
  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  
  // Body fill
  ctx.fillStyle = carData.color;
  ctx.beginPath();
  ctx.roundRect(-carData.width / 2, -carData.height / 2, carData.width, carData.height, 4);
  ctx.fill();
  
  ctx.shadowColor = 'transparent'; // reset
  
  // Cabin glass
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  ctx.roundRect(-carData.width * 0.25, -carData.height * 0.38, carData.width * 0.55, carData.height * 0.76, 2);
  ctx.fill();
  
  // Headlights
  ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.fillRect(carData.width / 2 - 2, -carData.height / 2 + 3, 2, 4);
  ctx.fillRect(carData.width / 2 - 2, carData.height / 2 - 7, 2, 4);
  
  // Taillights
  ctx.fillStyle = 'rgba(153, 27, 27, 0.9)';
  ctx.fillRect(-carData.width / 2, -carData.height / 2 + 3, 2, 4);
  ctx.fillRect(-carData.width / 2, carData.height / 2 - 7, 2, 4);
  
  ctx.restore();
}

function drawTrack(ctx, trackId) {
  if (trackId === '8') {
    // 1. Asphalt path
    ctx.fillStyle = '#1e293b'; // slate-800 road
    ctx.beginPath();
    const alpha = 1.14;
    ctx.arc(400, 200, 110, alpha, Math.PI - alpha, true);
    ctx.arc(400, 400, 110, Math.PI + alpha, -alpha, true);
    ctx.closePath();
    ctx.fill();
    
    // Clear inner island circles to background
    ctx.fillStyle = '#0f172a'; // slate-900 canvas ground
    ctx.beginPath();
    ctx.arc(400, 200, 55, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(400, 400, 55, 0, Math.PI * 2);
    ctx.fill();
    
    // 2. Yellow solid borders
    ctx.strokeStyle = '#eab308'; // amber-500
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(400, 200, 110, alpha, Math.PI - alpha, true);
    ctx.arc(400, 400, 110, Math.PI + alpha, -alpha, true);
    ctx.closePath();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(400, 200, 55, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(400, 400, 55, 0, Math.PI * 2);
    ctx.stroke();
    
    // 3. Lane center guidelines (dashed white)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(400, 200, 82.5, 0, Math.PI * 2);
    ctx.arc(400, 400, 82.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 4. Start grid
    ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillRect(317.5 - 27.5, 400 - 25, 55, 50);
    ctx.strokeRect(317.5 - 27.5, 400 - 25, 55, 50);
    
    // Start text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', 317.5, 400);
    
    // 5. Finish Zone
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.fillRect(455, 375, 55, 50);
    ctx.strokeRect(455, 375, 55, 50);
    ctx.fillStyle = '#10b981';
    ctx.fillText('FINISH', 482.5, 400);
    
    // Direction help overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(400, 200, 82.5, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    // draw minor arrowhead
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(400, 117.5 - 5);
    ctx.lineTo(400, 117.5 + 5);
    ctx.lineTo(410, 117.5);
    ctx.closePath();
    ctx.fill();
    
  } else if (trackId === 'H') {
    // 1. Asphalt roads
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(200, 120, 80, 360);
    ctx.fillRect(520, 120, 80, 360);
    ctx.fillRect(280, 260, 240, 80);
    
    // 2. Yellow solid borders
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, 120);
    ctx.lineTo(200, 480);
    ctx.lineTo(280, 480);
    ctx.lineTo(280, 340);
    ctx.lineTo(520, 340);
    ctx.lineTo(520, 480);
    ctx.lineTo(600, 480);
    ctx.lineTo(600, 120);
    ctx.lineTo(520, 120);
    ctx.lineTo(520, 260);
    ctx.lineTo(280, 260);
    ctx.lineTo(280, 120);
    ctx.closePath();
    ctx.stroke();
    
    // 3. Dash line guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(240, 120);
    ctx.lineTo(240, 480);
    ctx.moveTo(560, 120);
    ctx.lineTo(560, 480);
    ctx.moveTo(280, 300);
    ctx.lineTo(520, 300);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 4. Start Zone (bottom-left)
    ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillRect(202, 400, 76, 60);
    ctx.strokeRect(202, 400, 76, 60);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', 240, 430);
    
    // 5. Finish Zone (top-right)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10b981';
    ctx.fillRect(522, 122, 76, 80);
    ctx.strokeRect(522, 122, 76, 80);
    ctx.fillStyle = '#10b981';
    ctx.fillText('FINISH', 560, 162);
    
    // Path Directions overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('1. DRIVE UP', 240, 370);
    ctx.fillText('2. REVERSE POCKETS', 400, 285);
    ctx.fillText('3. DRIVE UP TO FINISH', 560, 370);
    
  } else if (trackId === 'parking') {
    // 1. Asphalt roads
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 320, 800, 120);
    ctx.fillRect(350, 240, 150, 80); // Parking bay
    
    // 2. Yellow solid boundaries
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    
    // Top curb
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(350, 320);
    ctx.moveTo(500, 320);
    ctx.lineTo(800, 320);
    ctx.stroke();
    
    // Bottom curb
    ctx.beginPath();
    ctx.moveTo(0, 440);
    ctx.lineTo(800, 440);
    ctx.stroke();
    
    // Parking bay borders (dashed yellow on screen)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(350, 320);
    ctx.lineTo(350, 240);
    ctx.lineTo(500, 240);
    ctx.lineTo(500, 320);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Lane separator (dashed white)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 380);
    ctx.lineTo(800, 380);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 3. Start Zone
    ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
    ctx.lineWidth = 2;
    ctx.fillRect(80, 330, 80, 100);
    ctx.strokeRect(80, 330, 80, 100);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START', 120, 380);
    
    // 4. Finish Zone (parking bay target box)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = '#10b981';
    ctx.fillRect(360, 250, 130, 60);
    ctx.strokeRect(360, 250, 130, 60);
    ctx.fillStyle = '#10b981';
    ctx.fillText('PARK HERE', 425, 280);
    
    // Draw guide arrows
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('1. DRIVE PAST BAY', 280, 400);
    ctx.fillText('2. REVERSE PARALLEL INTO BAY', 490, 400);
  }
}

// --- Draw Offscreen Boundaries Map ---
function drawOffscreenTrack(trackId) {
  // Fill background solid black (drivable/safe area)
  offscreenCtx.fillStyle = '#000000';
  offscreenCtx.fillRect(0, 0, 800, 600);
  
  // Draw boundaries solid red (R=255, G=0, B=0)
  offscreenCtx.strokeStyle = 'rgba(255, 0, 0, 255)';
  offscreenCtx.lineWidth = 5;
  
  if (trackId === '8') {
    const alpha = 1.14;
    
    // Outer boundaries
    offscreenCtx.beginPath();
    offscreenCtx.arc(400, 200, 110, alpha, Math.PI - alpha, true);
    offscreenCtx.arc(400, 400, 110, Math.PI + alpha, -alpha, true);
    offscreenCtx.closePath();
    offscreenCtx.stroke();
    
    // Inner islands
    offscreenCtx.beginPath();
    offscreenCtx.arc(400, 200, 55, 0, Math.PI * 2);
    offscreenCtx.stroke();
    
    offscreenCtx.beginPath();
    offscreenCtx.arc(400, 400, 55, 0, Math.PI * 2);
    offscreenCtx.stroke();
    
    // Finish zone (Green)
    offscreenCtx.fillStyle = 'rgba(0, 255, 0, 255)';
    offscreenCtx.fillRect(455, 375, 55, 50);
    
  } else if (trackId === 'H') {
    // Draw boundary path
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(200, 120);
    offscreenCtx.lineTo(200, 480);
    offscreenCtx.lineTo(280, 480);
    offscreenCtx.lineTo(280, 340);
    offscreenCtx.lineTo(520, 340);
    offscreenCtx.lineTo(520, 480);
    offscreenCtx.lineTo(600, 480);
    offscreenCtx.lineTo(600, 120);
    offscreenCtx.lineTo(520, 120);
    offscreenCtx.lineTo(520, 260);
    offscreenCtx.lineTo(280, 260);
    offscreenCtx.lineTo(280, 120);
    offscreenCtx.closePath();
    offscreenCtx.stroke();
    
    // Finish Zone (Green)
    offscreenCtx.fillStyle = 'rgba(0, 255, 0, 255)';
    offscreenCtx.fillRect(522, 122, 76, 80);
    
  } else if (trackId === 'parking') {
    // Top curb
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, 320);
    offscreenCtx.lineTo(350, 320);
    offscreenCtx.moveTo(500, 320);
    offscreenCtx.lineTo(800, 320);
    offscreenCtx.stroke();
    
    // Bottom curb
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(0, 440);
    offscreenCtx.lineTo(800, 440);
    offscreenCtx.stroke();
    
    // Parking bay lines
    offscreenCtx.beginPath();
    offscreenCtx.moveTo(350, 320);
    offscreenCtx.lineTo(350, 240);
    offscreenCtx.lineTo(500, 240);
    offscreenCtx.lineTo(500, 320);
    offscreenCtx.stroke();
    
    // Finish Zone (Green)
    offscreenCtx.fillStyle = 'rgba(0, 255, 0, 255)';
    offscreenCtx.fillRect(360, 250, 130, 60);
  }
}

// --- Main Loop and Updates ---
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 16.666; // Normalize to approx 1.0 at 60fps
  if (dt > 3) dt = 3; // Prevent physics explosions due to background tabs
  lastTime = timestamp;
  
  update(dt);
  render();
  
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (gameState !== 'PLAYING' && gameState !== 'READY') {
    if (playerCar) playerCar.isBraking = true; // Tail lights on if ended
    return;
  }
  
  // 1. Detect first movement to transition from READY to PLAYING
  if (gameState === 'READY') {
    const isMovingInput = keys['ArrowUp'] || keys['ArrowDown'] || keys['w'] || keys['s'] || keys['W'] || keys['S'];
    if (isMovingInput) {
      gameState = 'PLAYING';
      sounds.init(); // Initialize audio context upon user activation
    }
  }
  
  if (gameState === 'PLAYING') {
    // 2. Update countdown timer
    timeRemaining = Math.max(0, timeRemaining - (dt * 0.01666));
    if (timeRemaining <= 0) {
      triggerFailure("Time Expired (90s limit reached)!");
      updateDashboardHUD();
      return;
    }
    
    // 3. Update Car physics
    playerCar.update();
    
    // 4. Check Boundary collisions (scanning corners of the car)
    const corners = playerCar.getCorners();
    let isColliding = false;
    for (let c of corners) {
      if (checkBoundaryCollision(c.x, c.y)) {
        isColliding = true;
        break;
      }
    }
    
    // State edge transition to trigger penalty counts once
    if (isColliding) {
      if (!isTouchingBoundary) {
        penalties++;
        isTouchingBoundary = true;
        flashBoundaryWarning();
        if (penalties >= 3) {
          triggerFailure("Exceeded boundary limit (3/3 crossings)!");
          updateDashboardHUD();
          return;
        }
      }
    } else {
      isTouchingBoundary = false;
    }
    
    // 5. Check Obstacle cones collision
    for (let cone of cones) {
      if (checkConeCollision(playerCar, cone)) {
        conesHit = 1;
        sounds.playCrash();
        triggerFailure("Collision with traffic cone obstacle!");
        updateDashboardHUD();
        return;
      }
    }
    
    // 6. Check Parked Cars collision (for Parallel Parking)
    if (currentTrack === 'parking') {
      for (let pCar of parkedCars) {
        // Simple bounding box checks on the 4 corners of player car
        for (let c of corners) {
          if (isPointCollidingParkedCar(c.x, c.y, pCar)) {
            sounds.playCrash();
            triggerFailure("Collision with parked vehicle!");
            updateDashboardHUD();
            return;
          }
        }
      }
    }
    
    // 7. Check Finish Zone & Stop Condition
    const isCenterInFinish = checkFinishZone(playerCar.x, playerCar.y);
    const isStopped = Math.abs(playerCar.speed) < 0.05;
    
    if (isCenterInFinish && isStopped) {
      // Parallel parking verification (must be parked parallel to curb)
      if (currentTrack === 'parking') {
        const angleDiff = Math.abs(playerCar.headingAngle % (Math.PI * 2));
        const isParallel = angleDiff < 0.22 || Math.abs(angleDiff - Math.PI * 2) < 0.22 || Math.abs(angleDiff - Math.PI) < 0.22;
        if (isParallel) {
          triggerSuccess();
        } else {
          // If stopped in zone but crooked, prompt them
          ctx.save();
          ctx.fillStyle = '#ef4444';
          ctx.font = 'semibold 12px sans-serif';
          ctx.fillText("CAR IS CROOKED! Align parallel to curb.", 425, 220);
          ctx.restore();
        }
      } else {
        triggerSuccess();
      }
    }
  }
  
  // Handle warning flash timer
  if (boundaryFlashTimer > 0) {
    boundaryFlashTimer--;
  }
  
  updateDashboardHUD();
}

function render() {
  // Clear screen canvas
  ctx.fillStyle = '#0f172a'; // bg-slate-900 matches style.css body
  ctx.fillRect(0, 0, 800, 600);
  
  // 1. Draw Track asphalt and boundaries
  drawTrack(ctx, currentTrack);
  
  // 2. Draw Parked Cars (Parallel Parking)
  if (currentTrack === 'parking') {
    parkedCars.forEach(pCar => drawParkedCar(ctx, pCar));
  }
  
  // 3. Draw Cones
  cones.forEach(c => drawConeAsset(ctx, c.x, c.y));
  
  // 4. Draw Player Car
  if (playerCar) {
    playerCar.draw(ctx);
  }
  
  // 5. Draw boundary warning flash overlay
  if (boundaryFlashTimer > 0) {
    ctx.fillStyle = `rgba(239, 68, 68, ${0.12 * (boundaryFlashTimer / 18)})`;
    ctx.fillRect(0, 0, 800, 600);
    
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 800, 600);
  }
}

// --- High DPI Canvas Configuration ---
function setupCanvasScaling() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 800 * dpr;
  canvas.height = 600 * dpr;
  canvas.style.width = '800px';
  canvas.style.height = '600px';
  ctx.scale(dpr, dpr);
}

// --- Event Listeners and Button Bindings ---
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  // Disable browser viewport scrolling for arrow keys, space, shift
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(e.key)) {
    e.preventDefault();
  }
  
  if (e.key === 'Shift') {
    toggleGear();
  }
  if (e.key === 'r' || e.key === 'R') {
    startTest();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// UI controls binding
document.getElementById('track-btn-8').addEventListener('click', () => selectTrack('8'));
document.getElementById('track-btn-H').addEventListener('click', () => selectTrack('H'));
document.getElementById('track-btn-parking').addEventListener('click', () => selectTrack('parking'));

document.getElementById('vehicle-btn-hatchback').addEventListener('click', () => selectVehicle('hatchback'));
document.getElementById('vehicle-btn-sedan').addEventListener('click', () => selectVehicle('sedan'));

document.getElementById('restart-btn').addEventListener('click', startTest);
document.getElementById('modal-pass-btn').addEventListener('click', startTest);
document.getElementById('modal-fail-btn').addEventListener('click', startTest);

// Gear indicators click triggers shift
document.getElementById('gear-d').addEventListener('click', () => {
  if (playerCar) {
    playerCar.gear = 'D';
    sounds.playBeep();
    updateDashboardHUD();
  }
});
document.getElementById('gear-r').addEventListener('click', () => {
  if (playerCar) {
    playerCar.gear = 'R';
    sounds.playBeep();
    updateDashboardHUD();
  }
});

// --- Initialize and Run ---
setupCanvasScaling();
selectTrack('8');
selectVehicle('hatchback');
requestAnimationFrame(gameLoop);
