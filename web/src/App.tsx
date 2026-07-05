import { useRef, useEffect, useCallback, useState } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import {
  generateInitialPlatforms,
  generatePlatformRow,
  generateCoins,
  generatePickups,
  generateSnowflakes,
} from "./lib/mountainGen";
import type { GameState, Gender, Screen } from "./types";

// ── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 1400;
const JUMP_FORCE = -620;
const FIZZY_JUMP = -900;
const SPEED = 270;
const FRICTION = 0.45;
const ICE_FRICTION = 0.97;
const PW = 22;
const PH = 30;
const FIZZY_DUR = 5;
const INVINCIBLE_DUR = 2.5;
const SPAWN_AHEAD = 700;

const LEVELS = [
  { name: "Forest",   emoji: "🌲", bg1: "#1a3a15", bg2: "#2d5a27", rocks: 0.6, desc: "Beginner" },
  { name: "Mountain", emoji: "🏔️", bg1: "#1a2035", bg2: "#3a4a6b", rocks: 1.0, desc: "Normal"   },
  { name: "Blizzard", emoji: "❄️", bg1: "#2a3050", bg2: "#4a5a7a", rocks: 1.5, desc: "Hard"     },
  { name: "Volcano",  emoji: "🌋", bg1: "#3a1008", bg2: "#6b2a1a", rocks: 2.2, desc: "Extreme"  },
];

// ── Pixel character renderer ──────────────────────────────────────────────────
function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: boolean,
  gender: Gender,
  legPhase: number,
  fizzy: boolean,
  invincible: boolean,
) {
  const P = 3;
  ctx.save();

  if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }

  const cx = x + PW / 2;
  const cy = y + PH / 2;
  ctx.translate(cx, cy);
  if (!facing) ctx.scale(-1, 1);
  ctx.translate(-cx, -cy);

  const ox = Math.floor(x + (PW - 4 * P) / 2);
  const oy = Math.floor(y);

  const skin  = "#f5c18a";
  const hair  = gender === "boy" ? "#3a2a10" : "#c0392b";
  const shirt = gender === "boy" ? "#2980b9" : "#e91e8c";
  const pants = gender === "boy" ? "#34495e" : "#9b59b6";
  const shoe  = "#2c1a0a";

  if (fizzy) {
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 14;
  }

  function px(col: number, row: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(ox + col * P, oy + row * P, P, P);
  }

  // Hair rows 0-1
  if (gender === "boy") {
    [1, 2, 3].forEach(c => px(c, 0, hair));
    [0, 1, 2, 3].forEach(c => px(c, 1, hair));
  } else {
    [0, 1, 2, 3].forEach(c => px(c, 0, hair));
    [0, 3].forEach(c => px(c, 1, hair));
    [1, 2].forEach(c => px(c, 1, skin));
  }

  // Face rows 2-3
  [1, 2].forEach(c => px(c, 2, skin));
  [0, 3].forEach(c => px(c, 2, gender === "girl" ? hair : skin));
  [0, 1, 2, 3].forEach(c => px(c, 3, skin));

  // Eyes
  ctx.fillStyle = "#222";
  ctx.fillRect(ox + 1 * P + 1, oy + 2 * P + 1, 2, 2);
  ctx.fillRect(ox + 2 * P + 1, oy + 2 * P + 1, 2, 2);

  // Torso rows 4-5
  [0, 1, 2, 3].forEach(c => px(c, 4, shirt));
  [0, 1, 2, 3].forEach(c => px(c, 5, shirt));

  // Waist row 6
  [0, 1, 2, 3].forEach(c => px(c, 6, pants));

  // Legs rows 7-8 (animated)
  const l = Math.sin(legPhase) > 0 ? 1 : 0;
  const r2 = 1 - l;
  px(l,     7, pants);
  px(r2 + 2, 7, pants);
  px(l,     8, shoe);
  px(r2 + 2, 8, shoe);

  ctx.restore();
}

// ── Game state factory ────────────────────────────────────────────────────────
function makeGameState(cw: number, ch: number, levelIdx: number): GameState {
  const platforms = generateInitialPlatforms(cw, ch);
  const coins     = generateCoins(platforms);
  const pickups   = generatePickups(platforms);
  const snowflakes = generateSnowflakes(55, cw, ch);
  const lvl = LEVELS[levelIdx] ?? LEVELS[0]!;
  return {
    px: cw / 2 - PW / 2,
    py: ch - 80,
    pvx: 0, pvy: 0,
    onGround: false,
    facing: true,
    jumpCount: 0,
    lives: 3,
    invincibleTimer: 0,
    fizzyTimer: 0,
    cameraY: 0,
    platforms, rocks: [],
    coins, pickups,
    particles: [], snowflakes,
    score: 0,
    coinsCollected: 0,
    altitude: 0,
    maxAltitude: 0,
    rockSpawnTimer: 0,
    rockSpawnInterval: 5 / lvl.rocks,
    legPhase: 0,
    deathTimer: 0,
    prevJump: false,
    touchLeft: false, touchRight: false, touchJump: false,
  };
}

function spawnParticles(s: GameState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 80 + Math.random() * 140;
    s.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 60,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFrame(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  s: GameState,
  gender: Gender,
  levelIdx: number,
) {
  const lv = LEVELS[levelIdx] ?? LEVELS[0]!;
  const cam = s.cameraY;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, lv.bg1);
  grad.addColorStop(1, lv.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Stars
  ctx.fillStyle = "#ffffff55";
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137 + 50) % cw;
    const sy = (((i * 97 + 30) % (ch * 2)) - (cam * 0.05 % ch) + ch * 2) % ch;
    ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }

  ctx.save();
  ctx.translate(0, -cam);

  // Platforms
  for (const p of s.platforms) {
    if (p.crumbled) continue;
    if (p.y < cam - 20 || p.y > cam + ch + 20) continue;

    let color = "#5a8a3a";
    let topColor = "#7ab84a";
    if (p.type === "ice")    { color = "#5a9aaa"; topColor = "#8adaee"; }
    if (p.type === "crumble"){ color = "#8a6a3a"; topColor = "#aa8a5a"; }
    if (p.type === "bounce") { color = "#aa5a2a"; topColor = "#ee8a4a"; }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, 14, 4);
    ctx.fill();

    ctx.fillStyle = topColor;
    ctx.fillRect(p.x + 4, p.y, p.width - 8, 4);

    if (p.type !== "normal") {
      ctx.fillStyle = "#fff8";
      ctx.font = "bold 9px Manrope, sans-serif";
      ctx.textAlign = "center";
      const lbl = p.type === "ice" ? "ICE" : p.type === "crumble" ? "!" : "↑";
      ctx.fillText(lbl, p.x + p.width / 2, p.y + 9);
    }

    if (p.type === "crumble" && p.crumbleTimer > 0.2) {
      ctx.strokeStyle = "#fff6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + p.width * 0.3, p.y);
      ctx.lineTo(p.x + p.width * 0.4, p.y + 14);
      ctx.moveTo(p.x + p.width * 0.6, p.y);
      ctx.lineTo(p.x + p.width * 0.5, p.y + 14);
      ctx.stroke();
    }
  }

  // Coins
  for (const coin of s.coins) {
    if (coin.collected) continue;
    if (coin.y < cam - 20 || coin.y > cam + ch + 20) continue;
    const bob = Math.sin(coin.anim) * 3;
    ctx.save();
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffec6e";
    ctx.beginPath();
    ctx.arc(coin.x - 2, coin.y + bob - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Pickups
  for (const pick of s.pickups) {
    if (pick.collected) continue;
    if (pick.y < cam - 20 || pick.y > cam + ch + 20) continue;
    const bob = Math.sin(pick.anim) * 4;
    ctx.save();
    if (pick.kind === "fizzy") {
      ctx.shadowColor = "#ffe066";
      ctx.shadowBlur = 12;
      // Can body
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(pick.x - 6, pick.y + bob - 10, 12, 18);
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(pick.x - 6, pick.y + bob - 10, 12, 4);
      // Bubbles
      ctx.fillStyle = "#fff8";
      ctx.beginPath();
      ctx.arc(pick.x - 2, pick.y + bob - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pick.x + 2, pick.y + bob, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 7px Manrope";
      ctx.textAlign = "center";
      ctx.fillText("🥤", pick.x, pick.y + bob + 4);
    } else {
      // Medicine cross
      ctx.shadowColor = "#44ff88";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fff";
      ctx.fillRect(pick.x - 9, pick.y + bob - 9, 18, 18);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(pick.x - 3, pick.y + bob - 9, 6, 18);
      ctx.fillRect(pick.x - 9, pick.y + bob - 3, 18, 6);
    }
    ctx.restore();
  }

  // Rocks
  for (const rock of s.rocks) {
    if (rock.y < cam - 20 || rock.y > cam + ch + 20) continue;
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.rotation);
    ctx.fillStyle = "#7a6a5a";
    ctx.beginPath();
    ctx.arc(0, 0, rock.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a8a7a";
    ctx.beginPath();
    ctx.arc(-rock.radius * 0.25, -rock.radius * 0.25, rock.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player
  drawPixelChar(ctx, s.px, s.py, s.facing, gender, s.legPhase, s.fizzyTimer > 0, s.invincibleTimer > 0);

  // Particles
  for (const p of s.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // un-translate camera

  // Snowflakes (screen-space)
  ctx.fillStyle = "#ffffffcc";
  for (const sf of s.snowflakes) {
    ctx.beginPath();
    ctx.arc(sf.x, sf.y, sf.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Altitude HUD
  ctx.fillStyle = "#ffffffaa";
  ctx.font = "bold 14px Manrope, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`🏔️ ${Math.floor(s.altitude / 10)}m`, cw - 12, 28);
}

// ── Touch button style ────────────────────────────────────────────────────────
const touchBtnStyle: React.CSSProperties = {
  background: "#ffffff22",
  border: "2px solid #ffffff44",
  borderRadius: 14,
  color: "#fff",
  fontSize: "1.6rem",
  width: 64,
  height: 64,
  cursor: "pointer",
  userSelect: "none",
  WebkitUserSelect: "none",
  touchAction: "none",
};

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]       = useState<Screen>("home");
  const [gender, setGender]       = useState<Gender>("boy");
  const [levelIdx, setLevelIdx]   = useState(0);
  const [score, setScore]         = useState(0);
  const [coinsUI, setCoinsUI]     = useState(0);
  const [livesUI, setLivesUI]     = useState(3);
  const [fizzyUI, setFizzyUI]     = useState(false);
  const [highScore, updateHighScore] = useHighScore("climberadventure_hs");

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<GameState | null>(null);
  const genderRef  = useRef<Gender>("boy");
  const levelRef   = useRef(0);
  const screenRef  = useRef<Screen>("home");

  useEffect(() => { genderRef.current = gender; }, [gender]);
  useEffect(() => { levelRef.current = levelIdx; }, [levelIdx]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stateRef.current = makeGameState(canvas.width, canvas.height, levelRef.current);
    setLivesUI(3);
    setCoinsUI(0);
    setScore(0);
    setFizzyUI(false);
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Init when entering playing screen
  useEffect(() => {
    if (screen === "playing") initGame();
  }, [screen, initGame]);

  // Key listener
  useEffect(() => {
    const keys = new Set<string>();
    (window as unknown as { _gameKeys: Set<string> })._gameKeys = keys;
    const down = (e: KeyboardEvent) => {
      keys.add(e.key);
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Game loop
  const tick = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    // Input
    const keys: Set<string> = (window as unknown as { _gameKeys: Set<string> })._gameKeys ?? new Set();
    const goLeft  = keys.has("ArrowLeft")  || keys.has("a") || keys.has("A") || s.touchLeft;
    const goRight = keys.has("ArrowRight") || keys.has("d") || keys.has("D") || s.touchRight;
    const jumpNow = keys.has("ArrowUp") || keys.has("w") || keys.has("W") || keys.has(" ") || s.touchJump;
    const jumpJust = jumpNow && !s.prevJump;
    s.prevJump = jumpNow;

    // Death pause
    if (s.deathTimer > 0) {
      s.deathTimer -= dt;
      if (s.deathTimer <= 0) {
        if (s.lives <= 0) {
          updateHighScore(s.score);
          setScore(s.score);
          setCoinsUI(s.coinsCollected);
          setScreen("dead");
          return;
        }
        // Respawn
        s.py = s.cameraY + ch * 0.65;
        s.pvx = 0; s.pvy = 0;
        s.invincibleTimer = INVINCIBLE_DUR;
      }
      renderFrame(ctx, cw, ch, s, genderRef.current, levelRef.current);
      return;
    }

    // Horizontal movement
    if (goLeft)  s.pvx -= SPEED * 8 * dt;
    if (goRight) s.pvx += SPEED * 8 * dt;
    s.pvx = Math.max(-SPEED, Math.min(SPEED, s.pvx));
    if (!goLeft && !goRight) s.pvx *= Math.pow(FRICTION, dt * 60);
    if (Math.abs(s.pvx) < 1) s.pvx = 0;
    if (s.pvx > 0) s.facing = true;
    if (s.pvx < 0) s.facing = false;

    // Jump
    const jf = s.fizzyTimer > 0 ? FIZZY_JUMP : JUMP_FORCE;
    if (jumpJust) {
      if (s.onGround) {
        s.pvy = jf;
        s.jumpCount = 1;
        spawnParticles(s, s.px + PW / 2, s.py + PH, "#ffffff", 5);
      } else if (s.jumpCount < 2) {
        s.pvy = jf * 0.85;
        s.jumpCount++;
        spawnParticles(s, s.px + PW / 2, s.py + PH, "#aaddff", 5);
      }
    }

    // Gravity & movement
    s.pvy += GRAVITY * dt;
    s.py  += s.pvy * dt;
    s.px  += s.pvx * dt;

    // Wrap horizontal
    if (s.px + PW < 0) s.px = cw;
    if (s.px > cw)     s.px = -PW;

    // Timers
    if (s.invincibleTimer > 0) s.invincibleTimer -= dt;
    if (s.fizzyTimer > 0) {
      s.fizzyTimer -= dt;
      setFizzyUI(s.fizzyTimer > 0);
    }

    // Platform collision
    s.onGround = false;
    for (const p of s.platforms) {
      if (p.crumbled) continue;
      const prevBottom = s.py + PH - s.pvy * dt;
      const atBottom   = s.py + PH;
      if (
        s.pvy >= 0 &&
        s.px + PW > p.x + 4 &&
        s.px < p.x + p.width - 4 &&
        atBottom >= p.y &&
        prevBottom <= p.y + 12
      ) {
        s.py = p.y - PH;
        s.onGround = true;
        s.jumpCount = 0;

        if (p.type === "bounce") {
          s.pvy = JUMP_FORCE * 1.4;
          spawnParticles(s, s.px + PW / 2, s.py + PH, "#ff9900", 6);
        } else if (p.type === "ice") {
          s.pvx *= Math.pow(ICE_FRICTION, dt * 60);
          s.pvy = 0;
        } else {
          s.pvy = 0;
        }

        if (p.type === "crumble") {
          p.crumbleTimer += dt;
          if (p.crumbleTimer > 0.7) p.crumbled = true;
        }
      }
    }

    // Leg anim
    if (s.onGround && (goLeft || goRight)) s.legPhase += dt * 12;

    // Camera: follow player upward
    const targetCam = s.py - ch * 0.45;
    if (targetCam < s.cameraY) s.cameraY += (targetCam - s.cameraY) * Math.min(1, dt * 7);

    // Altitude & score
    const alt = -s.cameraY;
    if (alt > s.maxAltitude) {
      s.maxAltitude = alt;
      s.altitude = alt;
      s.score = Math.floor(alt / 10) + s.coinsCollected * 5;
    }

    // Spawn more platforms above
    const topVisible = s.cameraY - SPAWN_AHEAD;
    const highestY   = Math.min(...s.platforms.map(p => p.y));
    if (highestY > topVisible) {
      let y = highestY - (110 + Math.random() * 50);
      while (y > topVisible) {
        const newPlats = generatePlatformRow(cw, y, s.altitude);
        s.platforms.push(...newPlats);
        s.coins.push(...generateCoins(newPlats));
        s.pickups.push(...generatePickups(newPlats));
        y -= 110 + Math.random() * 50;
      }
    }

    // Cull off-screen objects
    const cullY = s.cameraY + ch + 300;
    s.platforms = s.platforms.filter(p => p.y < cullY);
    s.coins     = s.coins.filter(c => c.y < cullY);
    s.pickups   = s.pickups.filter(p => p.y < cullY);

    // Spawn rocks
    s.rockSpawnTimer += dt;
    if (s.rockSpawnTimer >= s.rockSpawnInterval) {
      s.rockSpawnTimer = 0;
      const lvl = LEVELS[levelRef.current] ?? LEVELS[0]!;
      s.rockSpawnInterval = (4 + Math.random() * 3) / lvl.rocks;
      const rad = 8 + Math.random() * 10;
      s.rocks.push({
        x: Math.random() * cw,
        y: s.cameraY - 30,
        vx: (Math.random() - 0.5) * 180,
        vy: 80 + Math.random() * 120,
        radius: rad,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }

    // Update rocks
    for (const rock of s.rocks) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.vy += GRAVITY * 0.4 * dt;
      rock.rotation += rock.rotSpeed * dt;
      if (rock.x < 0) rock.x = cw;
      if (rock.x > cw) rock.x = 0;

      // Hit player
      if (s.invincibleTimer <= 0 && s.deathTimer <= 0) {
        const dx = rock.x - (s.px + PW / 2);
        const dy = rock.y - (s.py + PH / 2);
        if (Math.sqrt(dx * dx + dy * dy) < rock.radius + 11) {
          s.lives--;
          s.invincibleTimer = INVINCIBLE_DUR;
          s.deathTimer = 0.4;
          spawnParticles(s, s.px + PW / 2, s.py + PH / 2, "#ff4444", 10);
          setLivesUI(s.lives);
          rock.y = cullY + 999;
        }
      }
    }
    s.rocks = s.rocks.filter(r => r.y < cullY);

    // Collect coins
    for (const coin of s.coins) {
      coin.anim += dt * 3;
      if (!coin.collected) {
        const dx = coin.x - (s.px + PW / 2);
        const dy = coin.y - (s.py + PH / 2);
        if (Math.sqrt(dx * dx + dy * dy) < 18) {
          coin.collected = true;
          s.coinsCollected++;
          s.score += 5;
          spawnParticles(s, coin.x, coin.y, "#ffd700", 6);
          setCoinsUI(s.coinsCollected);
        }
      }
    }

    // Collect pickups
    for (const pick of s.pickups) {
      pick.anim += dt * 2;
      if (!pick.collected) {
        const dx = pick.x - (s.px + PW / 2);
        const dy = pick.y - (s.py + PH / 2);
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          pick.collected = true;
          if (pick.kind === "fizzy") {
            s.fizzyTimer = FIZZY_DUR;
            setFizzyUI(true);
            spawnParticles(s, pick.x, pick.y, "#ffe066", 8);
          } else {
            if (s.lives < 5) { s.lives++; setLivesUI(s.lives); }
            spawnParticles(s, pick.x, pick.y, "#44ff88", 8);
          }
        }
      }
    }

    // Update particles
    for (const p of s.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    s.particles = s.particles.filter(p => p.life > 0);

    // Snowflakes
    for (const sf of s.snowflakes) {
      sf.y += sf.speed * dt;
      if (sf.y > ch) { sf.y = -5; sf.x = Math.random() * cw; }
    }

    // Fell off bottom
    if (s.py > s.cameraY + ch + 100 && s.invincibleTimer <= 0 && s.deathTimer <= 0) {
      s.lives--;
      s.deathTimer = 0.5;
      setLivesUI(s.lives);
      spawnParticles(s, s.px + PW / 2, s.py, "#ff4444", 12);
    }

    // Render
    renderFrame(ctx, cw, ch, s, genderRef.current, levelRef.current);
    setScore(s.score);
  }, [updateHighScore]);

  useGameLoop(tick, screen !== "playing");

  // Touch helpers
  const setTouch = (dir: "left" | "right" | "jump", val: boolean) => {
    if (!stateRef.current) return;
    if (dir === "left")  stateRef.current.touchLeft  = val;
    if (dir === "right") stateRef.current.touchRight = val;
    if (dir === "jump")  stateRef.current.touchJump  = val;
  };

  const level = LEVELS[levelIdx] ?? LEVELS[0]!;

  // ── Home screen ─────────────────────────────────────────────────────────────
  if (screen === "home") {
    return (
      <GameShell topbar={<GameTopbar title="Climber Adventure" score={highScore} />}>
        <div className="flex flex-col items-center justify-center h-full gap-6 px-4"
          style={{ background: "linear-gradient(180deg, #0d1b2a 0%, #1a3a15 100%)" }}>
          <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(2rem,8vw,3.5rem)", color: "#fff", textShadow: "0 4px 24px #000c", textAlign: "center" }}>
            ⛰️ Climber Adventure
          </h1>
          <p style={{ color: "#9ef", fontSize: "0.95rem", marginTop: -16 }}>Reach the summit!</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 300 }}>
            <button onClick={() => setScreen("character")}
              style={menuBtn("#27ae60")}>🎮 Play</button>
            <button onClick={() => setScreen("levels")}
              style={menuBtn("#2980b9")}>🗺️ Levels</button>
            <button onClick={() => setScreen("character")}
              style={menuBtn("#8e44ad")}>👤 Choose Character</button>
          </div>

          <p style={{ color: "#aaa", fontSize: "0.8rem" }}>🏆 Best: {highScore}m</p>
          <p style={{ color: "#666", fontSize: "0.75rem", textAlign: "center" }}>
            ← → / WASD to move · Space / ↑ to jump
          </p>
        </div>
      </GameShell>
    );
  }

  // ── Character select ─────────────────────────────────────────────────────────
  if (screen === "character") {
    return (
      <GameShell topbar={<GameTopbar title="Choose Character" score={0} />}>
        <div className="flex flex-col items-center justify-center h-full gap-6 px-4"
          style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)" }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.5rem,6vw,2.2rem)", color: "#fff" }}>
            Who are you?
          </h2>

          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {/* Boy */}
            <button onClick={() => setGender("boy")} style={charCard(gender === "boy", "#2980b9", "#5dade2")}>
              <canvas width={66} height={90}
                style={{ imageRendering: "pixelated", display: "block", margin: "0 auto 10px" }}
                ref={el => {
                  if (!el) return;
                  const c = el.getContext("2d");
                  if (!c) return;
                  c.clearRect(0, 0, 66, 90);
                  drawPixelChar(c, 10, 5, true, "boy", 0, false, false);
                }} />
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Boy 🧒</p>
              {gender === "boy" && <p style={{ color: "#5dade2", fontSize: "0.8rem", margin: "4px 0 0" }}>✓ Selected</p>}
            </button>

            {/* Girl */}
            <button onClick={() => setGender("girl")} style={charCard(gender === "girl", "#8e44ad", "#d980fa")}>
              <canvas width={66} height={90}
                style={{ imageRendering: "pixelated", display: "block", margin: "0 auto 10px" }}
                ref={el => {
                  if (!el) return;
                  const c = el.getContext("2d");
                  if (!c) return;
                  c.clearRect(0, 0, 66, 90);
                  drawPixelChar(c, 10, 5, true, "girl", 0, false, false);
                }} />
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Girl 👧</p>
              {gender === "girl" && <p style={{ color: "#d980fa", fontSize: "0.8rem", margin: "4px 0 0" }}>✓ Selected</p>}
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setScreen("home")} style={menuBtn("#555")}>← Back</button>
            <button onClick={() => setScreen("playing")} style={menuBtn("#27ae60")}>
              Play as {gender === "boy" ? "Boy 🧒" : "Girl 👧"} →
            </button>
          </div>
        </div>
      </GameShell>
    );
  }

  // ── Level select ─────────────────────────────────────────────────────────────
  if (screen === "levels") {
    return (
      <GameShell topbar={<GameTopbar title="Select Level" score={0} />}>
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4"
          style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)" }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.5rem,6vw,2.2rem)", color: "#fff" }}>
            Choose a Level
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 340 }}>
            {LEVELS.map((lv, i) => (
              <button key={i} onClick={() => { setLevelIdx(i); setScreen("character"); }}
                style={{
                  background: levelIdx === i ? lv.bg2 : "#1a2a3a",
                  border: `3px solid ${levelIdx === i ? "#fff" : "#2c3e50"}`,
                  borderRadius: 16, padding: "14px 20px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 16,
                  boxShadow: levelIdx === i ? "0 0 20px #fff3" : "none",
                  transition: "all 0.2s",
                }}>
                <span style={{ fontSize: "2rem" }}>{lv.emoji}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>{lv.name}</p>
                  <p style={{ color: "#aaa", fontSize: "0.8rem", margin: 0 }}>{lv.desc}</p>
                </div>
                {levelIdx === i && <span style={{ marginLeft: "auto", color: "#fff" }}>✓</span>}
              </button>
            ))}
          </div>

          <button onClick={() => setScreen("home")} style={{ ...menuBtn("#555"), marginTop: 8 }}>← Back</button>
        </div>
      </GameShell>
    );
  }

  // ── Game Over ────────────────────────────────────────────────────────────────
  if (screen === "dead") {
    return (
      <GameShell topbar={<GameTopbar title="Game Over" score={score} />}>
        <div className="flex flex-col items-center justify-center h-full gap-5 px-4"
          style={{ background: "linear-gradient(180deg, #2c0a0a 0%, #1a0505 100%)" }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(2rem,8vw,3rem)", color: "#ff4444" }}>
            💀 Game Over
          </h2>
          <div style={{ background: "#ffffff18", borderRadius: 20, padding: "24px 40px", textAlign: "center" }}>
            <p style={{ color: "#ffd700", fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px" }}>🏔️ {score}m climbed</p>
            <p style={{ color: "#ffd700", fontSize: "1.1rem", margin: "0 0 8px" }}>🪙 {coinsUI} coins</p>
            <p style={{ color: "#aaa", fontSize: "0.9rem", margin: 0 }}>🏆 Best: {highScore}m</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => setScreen("playing")} style={menuBtn("#27ae60")}>🔄 Play Again</button>
            <button onClick={() => setScreen("home")}    style={menuBtn("#2980b9")}>🏠 Home</button>
          </div>
        </div>
      </GameShell>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────
  return (
    <GameShell topbar={<GameTopbar title={`${level.emoji} ${level.name}`} score={score} />}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }} />

        {/* HUD */}
        <div style={{ position: "absolute", top: 10, left: 10, pointerEvents: "none", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ background: "#0009", borderRadius: 10, padding: "6px 12px", color: "#fff", fontSize: "1rem" }}>
            {Array.from({ length: Math.max(0, livesUI) }).map((_, i) => <span key={i}>❤️</span>)}
            {livesUI <= 0 && <span>💀</span>}
          </div>
          <div style={{ background: "#0009", borderRadius: 10, padding: "6px 12px", color: "#ffd700", fontWeight: 700, fontSize: "0.95rem" }}>
            🪙 {coinsUI}
          </div>
          {fizzyUI && (
            <div style={{ background: "#ffe06699", borderRadius: 10, padding: "6px 12px", color: "#333", fontWeight: 700, fontSize: "0.85rem" }}>
              🥤 BOOST!
            </div>
          )}
        </div>

        {/* Touch controls */}
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={touchBtnStyle}
              onPointerDown={() => setTouch("left", true)}
              onPointerUp={() => setTouch("left", false)}
              onPointerLeave={() => setTouch("left", false)}>◀</button>
            <button style={touchBtnStyle}
              onPointerDown={() => setTouch("right", true)}
              onPointerUp={() => setTouch("right", false)}
              onPointerLeave={() => setTouch("right", false)}>▶</button>
          </div>
          <button style={{ ...touchBtnStyle, width: 72, height: 72, background: "#27ae6088", fontSize: "1.8rem" }}
            onPointerDown={() => setTouch("jump", true)}
            onPointerUp={() => setTouch("jump", false)}
            onPointerLeave={() => setTouch("jump", false)}>↑</button>
        </div>

        {/* Pause */}
        <button onClick={() => setScreen("home")}
          style={{ position: "absolute", top: 10, right: 10, background: "#0009", border: "none", borderRadius: 10, color: "#fff", fontSize: "1.1rem", padding: "8px 14px", cursor: "pointer" }}>
          ⏸
        </button>
      </div>
    </GameShell>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function menuBtn(bg: string): React.CSSProperties {
  return {
    background: bg, color: "#fff", border: "none",
    borderRadius: 14, padding: "14px 28px",
    fontSize: "1.05rem", fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 14px #0005", width: "100%",
  };
}

function charCard(selected: boolean, bg: string, glow: string): React.CSSProperties {
  return {
    background: selected ? bg : "#1a2a3a",
    border: `4px solid ${selected ? glow : "#2c3e50"}`,
    borderRadius: 20, padding: "22px 28px", cursor: "pointer",
    boxShadow: selected ? `0 0 28px ${glow}88` : "none",
    transition: "all 0.2s", minWidth: 130,
  };
}
