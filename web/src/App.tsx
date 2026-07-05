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
import type { GameState, Platform, Gender, Screen } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 1400;
const JUMP_FORCE = -600;
const FIZZY_JUMP_FORCE = -820;
const PLAYER_SPEED = 260;
const NORMAL_FRICTION = 0.55; // snappy stop — less slippery
const ICE_FRICTION = 0.97;
const ROCK_SPAWN_BASE = 5;
const PLATFORM_SPAWN_AHEAD = 700;
const FIZZY_DURATION = 5;
const INVINCIBLE_DURATION = 2;
const PLAYER_W = 20;
const PLAYER_H = 28;

const LEVEL_CONFIG = [
  { label: "Forest",    bg: ["#2d5a27","#1a3a15"], rockMult: 0.6, label2: "Beginner"   },
  { label: "Mountain",  bg: ["#3a4a6b","#1a2035"], rockMult: 1.0, label2: "Normal"     },
  { label: "Blizzard",  bg: ["#4a5a7a","#2a3050"], rockMult: 1.5, label2: "Hard"       },
  { label: "Volcano",   bg: ["#6b2a1a","#3a1008"], rockMult: 2.2, label2: "Extreme"    },
];

// ─── Pixel art character drawing ──────────────────────────────────────────────
function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingRight: boolean,
  gender: Gender,
  legPhase: number,
  onGround: boolean,
  fizzy: boolean,
  invincible: boolean,
) {
  // pixel size
  const P = 3;
  ctx.save();
  if (invincible && Math.floor(Date.now() / 80) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  if (!facingRight) {
    ctx.translate(x + PLAYER_W / 2, y + PLAYER_H / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(x + PLAYER_W / 2), -(y + PLAYER_H / 2));
  }

  const cx = Math.floor(x + PLAYER_W / 2);
  const ty = Math.floor(y);

  // colours
  const skinColor   = "#f5c5a0";
  const hairBoy     = "#3a2010";
  const hairGirl    = "#c0306a";
  const shirtBoy    = "#2255cc";
  const shirtGirl   = "#dd3388";
  const pantsColor  = gender === "boy" ? "#334477" : "#882255";
  const shoeColor   = "#222222";
  const glowColor   = fizzy ? "#ffee44" : "transparent";

  // fizzy glow aura
  if (fizzy) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
  }

  function px(col: number, row: number, color: string, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - Math.floor(PLAYER_W / 2) + col * P, ty + row * P, P * w, P * h);
  }

  // HEAD (3×3 pixels wide)
  px(1, 0, gender === "boy" ? hairBoy : hairGirl, 4, 1); // hair top
  if (gender === "girl") {
    px(0, 0, hairGirl, 1, 2); // side hair left
    px(4, 0, hairGirl, 1, 2); // side hair right
  }
  px(1, 1, skinColor, 4, 2); // face
  // eyes
  px(1, 1, "#111", 1, 1);
  px(3, 1, "#111", 1, 1);
  // mouth smile
  px(2, 2, "#cc6644", 1, 1);

  // BODY / SHIRT
  const shirt = gender === "boy" ? shirtBoy : shirtGirl;
  px(1, 3, shirt, 4, 3);

  // ARMS
  px(0, 3, skinColor, 1, 2);
  px(5, 3, skinColor, 1, 2);

  // PANTS
  px(1, 6, pantsColor, 2, 2);
  px(3, 6, pantsColor, 2, 2);

  // LEGS (animated)
  const legSwing = onGround ? Math.sin(legPhase * 8) * 1 : 0;
  const lOff = Math.round(legSwing);
  const rOff = -lOff;
  // left leg
  ctx.fillStyle = pantsColor;
  ctx.fillRect(cx - Math.floor(PLAYER_W / 2) + 1 * P, ty + (8 + lOff) * P, P, P * 2);
  // right leg
  ctx.fillRect(cx - Math.floor(PLAYER_W / 2) + 3 * P, ty + (8 + rOff) * P, P, P * 2);

  // SHOES
  px(0, 9, shoeColor, 2, 1);
  px(3, 9, shoeColor, 2, 1);

  ctx.restore();
}

// ─── Draw pixelated coin ──────────────────────────────────────────────────────
function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 3) * 3;
  const cy = y + bob;
  ctx.save();
  ctx.shadowColor = "#ffcc00";
  ctx.shadowBlur = 8;
  // outer ring
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(x - 7, cy - 7, 14, 14);
  // inner shine
  ctx.fillStyle = "#ffe566";
  ctx.fillRect(x - 5, cy - 5, 10, 10);
  // centre
  ctx.fillStyle = "#ffaa00";
  ctx.fillRect(x - 3, cy - 3, 6, 6);
  // $ symbol pixel
  ctx.fillStyle = "#cc8800";
  ctx.fillRect(x - 1, cy - 4, 2, 8);
  ctx.fillRect(x - 3, cy - 2, 6, 2);
  ctx.restore();
}

// ─── Draw fizzy drink (power-up) ─────────────────────────────────────────────
function drawFizzy(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 2.5 + 1) * 3;
  const cy = y + bob;
  ctx.save();
  ctx.shadowColor = "#44ffcc";
  ctx.shadowBlur = 10;
  // can body
  ctx.fillStyle = "#ff3355";
  ctx.fillRect(x - 6, cy - 9, 12, 16);
  // can top
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(x - 5, cy - 11, 10, 3);
  // can bottom
  ctx.fillRect(x - 5, cy + 6, 10, 3);
  // label stripe
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 5, cy - 4, 10, 4);
  // bubbles
  ctx.fillStyle = "#44ffcc";
  ctx.fillRect(x - 2, cy - 7, 2, 2);
  ctx.fillRect(x + 1, cy - 5, 2, 2);
  ctx.restore();
}

// ─── Draw medicine (heart pickup) ────────────────────────────────────────────
function drawMedicine(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 2 + 2) * 3;
  const cy = y + bob;
  ctx.save();
  ctx.shadowColor = "#ff4488";
  ctx.shadowBlur = 10;
  // cross (plus sign)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 8, cy - 8, 16, 16);
  ctx.fillStyle = "#ee2244";
  ctx.fillRect(x - 6, cy - 2, 12, 4);
  ctx.fillRect(x - 2, cy - 6, 4, 12);
  ctx.restore();
}

// ─── Draw rock ────────────────────────────────────────────────────────────────
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#888";
  // pixelated rock: draw as irregular polygon using rects
  const s = Math.floor(r / 3) * 3;
  ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(-s * 0.5, -s * 0.8, s, s * 0.4);
  ctx.fillStyle = "#666";
  ctx.fillRect(s * 0.2, s * 0.2, s * 0.5, s * 0.4);
  ctx.restore();
}

// ─── Draw platform ────────────────────────────────────────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform) {
  if (p.crumbled) return;
  const colors: Record<Platform["type"], [string, string]> = {
    normal:  ["#5a8a3a", "#3a6a1a"],
    ice:     ["#88ccff", "#4499dd"],
    crumble: ["#aa7744", "#885522"],
    bounce:  ["#ffaa22", "#cc7700"],
  };
  const [top, side] = colors[p.type];
  // side
  ctx.fillStyle = side;
  ctx.fillRect(p.x, p.y + 8, p.width, 10);
  // top surface (pixelated edge)
  ctx.fillStyle = top;
  ctx.fillRect(p.x, p.y, p.width, 10);
  // pixel highlights
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(p.x + 2, p.y + 1, p.width - 4, 3);
  // crumble warning
  if (p.type === "crumble" && p.crumbleTimer > 0) {
    ctx.fillStyle = `rgba(255,80,0,${Math.min(p.crumbleTimer * 0.6, 0.7)})`;
    ctx.fillRect(p.x, p.y, p.width, 10);
  }
}

// ─── make initial game state ──────────────────────────────────────────────────
function makeState(cw: number, ch: number, level: number): GameState {
  const platforms = generateInitialPlatforms(cw, ch);
  const coins = generateCoins(platforms, []);
  const pickups = generatePickups(platforms, []);
  const rockMult = LEVEL_CONFIG[level]?.rockMult ?? 1;
  return {
    px: cw / 2 - PLAYER_W / 2,
    py: ch - 80,
    pvx: 0,
    pvy: 0,
    onGround: false,
    facingRight: true,
    jumpCount: 0,
    lives: 3,
    invincibleTimer: 0,
    fizzyTimer: 0,
    cameraY: 0,
    platforms,
    rocks: [],
    coins,
    pickups,
    particles: [],
    snowflakes: generateSnowflakes(50, cw, ch),
    score: 0,
    coins_collected: 0,
    maxAltitude: 0,
    rockSpawnTimer: 0,
    rockSpawnInterval: ROCK_SPAWN_BASE / rockMult,
    altitude: 0,
    playerLegPhase: 0,
    deathTimer: 0,
    touchLeft: false,
    touchRight: false,
    touchJump: false,
  };
}

function spawnParticles(
  state: GameState, x: number, y: number, color: string, count: number, speed = 120,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s - 60,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ onPlay, onCharacter, onLevels }: {
  onPlay: () => void;
  onCharacter: () => void;
  onLevels: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-0"
      style={{ background: "linear-gradient(180deg, #1a2a4a 0%, #2d5a27 100%)" }}>
      {/* Mountain illustration */}
      <div className="relative w-full flex justify-center mb-2" style={{ height: 120 }}>
        <svg viewBox="0 0 320 120" width="320" height="120" style={{ position: "absolute" }}>
          <polygon points="160,10 60,110 260,110" fill="#4a6a8a" />
          <polygon points="160,10 100,70 220,70" fill="#6a8aaa" />
          <polygon points="160,10 140,40 180,40" fill="#ffffff" opacity="0.8" />
          {/* snow cap */}
          <polygon points="160,10 145,35 175,35" fill="#eef" />
          {/* flag */}
          <rect x="159" y="10" width="2" height="18" fill="#cc2222" />
          <polygon points="161,10 161,20 172,15" fill="#ff4444" />
          {/* pixel climber on mountain */}
          <rect x="148" y="52" width="6" height="8" fill="#f5c5a0" />
          <rect x="147" y="60" width="8" height="6" fill="#2255cc" />
          <rect x="147" y="66" width="3" height="4" fill="#334477" />
          <rect x="152" y="66" width="3" height="4" fill="#334477" />
        </svg>
      </div>

      {/* Title */}
      <h1 style={{ fontFamily: "Fraunces, serif", color: "#fff", fontSize: 32, fontWeight: 900,
        textShadow: "0 3px 12px #000a", letterSpacing: 1, marginBottom: 4 }}>
        ⛰️ Climber Adventure
      </h1>
      <p style={{ color: "#aaddff", fontSize: 13, marginBottom: 24, fontFamily: "Manrope, sans-serif" }}>
        Reach the summit!
      </p>

      {/* Buttons */}
      <button onClick={onPlay}
        style={{ background: "#22cc55", color: "#fff", border: "none", borderRadius: 12,
          padding: "14px 48px", fontSize: 20, fontWeight: 800, cursor: "pointer",
          fontFamily: "Manrope, sans-serif", boxShadow: "0 4px 0 #118833", marginBottom: 12,
          minWidth: 200, minHeight: 52 }}>
        ▶ PLAY
      </button>

      <button onClick={onCharacter}
        style={{ background: "#cc44aa", color: "#fff", border: "none", borderRadius: 12,
          padding: "12px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer",
          fontFamily: "Manrope, sans-serif", boxShadow: "0 4px 0 #882277", marginBottom: 10,
          minWidth: 200, minHeight: 48 }}>
        👤 Choose Character
      </button>

      <button onClick={onLevels}
        style={{ background: "#4488ff", color: "#fff", border: "none", borderRadius: 12,
          padding: "12px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer",
          fontFamily: "Manrope, sans-serif", boxShadow: "0 4px 0 #2255cc", marginBottom: 10,
          minWidth: 200, minHeight: 48 }}>
        🗺️ Select Level
      </button>

      <p style={{ color: "#88aacc", fontSize: 11, marginTop: 8, fontFamily: "Manrope, sans-serif" }}>
        Arrow keys / WASD to move · Space or ↑ to jump
      </p>
    </div>
  );
}

// ─── CHARACTER SELECT SCREEN ──────────────────────────────────────────────────
function CharacterScreen({ gender, onSelect, onBack }: {
  gender: Gender;
  onSelect: (g: Gender) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4"
      style={{ background: "linear-gradient(180deg, #1a2a4a 0%, #2d1a4a 100%)" }}>
      <h2 style={{ fontFamily: "Fraunces, serif", color: "#fff", fontSize: 26, fontWeight: 800,
        textShadow: "0 2px 8px #000a", marginBottom: 8 }}>
        Choose Your Character
      </h2>

      <div style={{ display: "flex", gap: 32, marginBottom: 16 }}>
        {/* BOY */}
        <button onClick={() => onSelect("boy")}
          style={{ background: gender === "boy" ? "#2255cc" : "#1a2a4a",
            border: gender === "boy" ? "4px solid #88aaff" : "4px solid #334466",
            borderRadius: 16, padding: "20px 28px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            minWidth: 110, minHeight: 160, transition: "all 0.15s" }}>
          {/* Pixel boy preview */}
          <canvas width={48} height={60} ref={el => {
            if (!el) return;
            const ctx = el.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, 48, 60);
            const P = 4;
            const draw = (col: number, row: number, color: string, w = 1, h = 1) => {
              ctx.fillStyle = color;
              ctx.fillRect(col * P, row * P, P * w, P * h);
            };
            draw(1, 0, "#3a2010", 4, 1);
            draw(1, 1, "#f5c5a0", 4, 2);
            draw(1, 1, "#111", 1, 1); draw(3, 1, "#111", 1, 1);
            draw(2, 2, "#cc6644", 1, 1);
            draw(1, 3, "#2255cc", 4, 3);
            draw(0, 3, "#f5c5a0", 1, 2); draw(5, 3, "#f5c5a0", 1, 2);
            draw(1, 6, "#334477", 2, 2); draw(3, 6, "#334477", 2, 2);
            draw(1, 8, "#222", 2, 1); draw(3, 8, "#222", 2, 1);
          }} style={{ imageRendering: "pixelated" }} />
          <span style={{ color: "#fff", fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15 }}>
            BOY
          </span>
          {gender === "boy" && <span style={{ color: "#88ffaa", fontSize: 18 }}>✓</span>}
        </button>

        {/* GIRL */}
        <button onClick={() => onSelect("girl")}
          style={{ background: gender === "girl" ? "#aa2277" : "#1a2a4a",
            border: gender === "girl" ? "4px solid #ffaadd" : "4px solid #334466",
            borderRadius: 16, padding: "20px 28px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            minWidth: 110, minHeight: 160, transition: "all 0.15s" }}>
          {/* Pixel girl preview */}
          <canvas width={48} height={60} ref={el => {
            if (!el) return;
            const ctx = el.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, 48, 60);
            const P = 4;
            const draw = (col: number, row: number, color: string, w = 1, h = 1) => {
              ctx.fillStyle = color;
              ctx.fillRect(col * P, row * P, P * w, P * h);
            };
            draw(1, 0, "#c0306a", 4, 1);
            draw(0, 0, "#c0306a", 1, 2); draw(5, 0, "#c0306a", 1, 2);
            draw(1, 1, "#f5c5a0", 4, 2);
            draw(1, 1, "#111", 1, 1); draw(3, 1, "#111", 1, 1);
            draw(2, 2, "#cc6644", 1, 1);
            draw(1, 3, "#dd3388", 4, 3);
            draw(0, 3, "#f5c5a0", 1, 2); draw(5, 3, "#f5c5a0", 1, 2);
            draw(1, 6, "#882255", 2, 2); draw(3, 6, "#882255", 2, 2);
            draw(1, 8, "#222", 2, 1); draw(3, 8, "#222", 2, 1);
          }} style={{ imageRendering: "pixelated" }} />
          <span style={{ color: "#fff", fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 15 }}>
            GIRL
          </span>
          {gender === "girl" && <span style={{ color: "#ffaadd", fontSize: 18 }}>✓</span>}
        </button>
      </div>

      <p style={{ color: "#aabbcc", fontFamily: "Manrope, sans-serif", fontSize: 13 }}>
        Selected: <strong style={{ color: "#fff" }}>{gender === "boy" ? "🧑 Boy" : "👧 Girl"}</strong>
      </p>

      <button onClick={onBack}
        style={{ background: "#334466", color: "#aac", border: "none", borderRadius: 10,
          padding: "10px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
          fontFamily: "Manrope, sans-serif", marginTop: 8, minHeight: 44 }}>
        ← Back
      </button>
    </div>
  );
}

// ─── LEVEL SELECT SCREEN ──────────────────────────────────────────────────────
function LevelScreen({ level, onSelect, onBack }: {
  level: number;
  onSelect: (l: number) => void;
  onBack: () => void;
}) {
  const emojis = ["🌲", "⛰️", "❄️", "🌋"];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4"
      style={{ background: "linear-gradient(180deg, #1a2a4a 0%, #2a1a0a 100%)" }}>
      <h2 style={{ fontFamily: "Fraunces, serif", color: "#fff", fontSize: 26, fontWeight: 800,
        textShadow: "0 2px 8px #000a", marginBottom: 4 }}>
        Select Level
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
        {LEVEL_CONFIG.map((cfg, i) => (
          <button key={i} onClick={() => onSelect(i)}
            style={{ background: level === i ? "#2255cc" : "#1a2a3a",
              border: level === i ? "3px solid #88aaff" : "3px solid #334455",
              borderRadius: 14, padding: "14px 18px", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              minWidth: 120, minHeight: 90 }}>
            <span style={{ fontSize: 28 }}>{emojis[i]}</span>
            <span style={{ color: "#fff", fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 15 }}>
              {cfg.label}
            </span>
            <span style={{ color: "#aac", fontFamily: "Manrope, sans-serif", fontSize: 11 }}>
              {cfg.label2}
            </span>
            {level === i && <span style={{ color: "#88ffaa", fontSize: 14 }}>✓ Selected</span>}
          </button>
        ))}
      </div>
      <button onClick={onBack}
        style={{ background: "#334466", color: "#aac", border: "none", borderRadius: 10,
          padding: "10px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
          fontFamily: "Manrope, sans-serif", minHeight: 44 }}>
        ← Back
      </button>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gender, setGender] = useState<Gender>("boy");
  const [level, setLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [coins, setCoins] = useState(0);
  const [fizzyActive, setFizzyActive] = useState(false);
  const [highScore, updateHighScore] = useHighScore("climberadventure_hs");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const jumpPressedRef = useRef(false);
  const timeRef = useRef(0);

  // ─── Key listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "playing") return;
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || e.key === " " || e.key === "w" || e.key === "W") {
        jumpPressedRef.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
      if (e.key === "ArrowUp" || e.key === " " || e.key === "w" || e.key === "W") {
        jumpPressedRef.current = false;
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [screen]);

  // ─── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;
    stateRef.current = makeState(cw, ch, level);
    setScore(0);
    setLives(3);
    setCoins(0);
    setFizzyActive(false);
    setScreen("playing");
  }, [level]);

  // ─── Game loop ────────────────────────────────────────────────────────────
  const tick = useCallback((dt: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    timeRef.current += dt;
    const t = timeRef.current;

    if (screen !== "playing") return;

    // ── Input ──────────────────────────────────────────────────────────────
    const keys = keysRef.current;
    const left  = keys.has("ArrowLeft")  || keys.has("a") || keys.has("A") || s.touchLeft;
    const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D") || s.touchRight;
    const jumpPressed = jumpPressedRef.current || s.touchJump;

    // ── Physics ────────────────────────────────────────────────────────────
    const jumpForce = s.fizzyTimer > 0 ? FIZZY_JUMP_FORCE : JUMP_FORCE;

    if (left)  s.pvx -= PLAYER_SPEED * 6 * dt;
    if (right) s.pvx += PLAYER_SPEED * 6 * dt;

    // Clamp horizontal speed
    s.pvx = Math.max(-PLAYER_SPEED, Math.min(PLAYER_SPEED, s.pvx));

    // Friction — much less slippery on normal, only ice is slippery
    const onIce = s.platforms.some(p =>
      p.type === "ice" && !p.crumbled &&
      s.py + PLAYER_H >= p.y && s.py + PLAYER_H <= p.y + 14 &&
      s.px + PLAYER_W > p.x && s.px < p.x + p.width
    );
    const friction = onIce ? ICE_FRICTION : NORMAL_FRICTION;
    if (!left && !right) s.pvx *= Math.pow(friction, dt * 60);

    // Jump
    if (jumpPressed && s.onGround) {
      s.pvy = jumpForce;
      s.jumpCount = 1;
      s.onGround = false;
      spawnParticles(s, s.px + PLAYER_W / 2, s.py + PLAYER_H, "#aaffaa", 5, 80);
      jumpPressedRef.current = false;
      s.touchJump = false;
    } else if (jumpPressed && s.jumpCount === 1) {
      s.pvy = jumpForce * 0.85;
      s.jumpCount = 2;
      spawnParticles(s, s.px + PLAYER_W / 2, s.py + PLAYER_H, "#aaaaff", 5, 80);
      jumpPressedRef.current = false;
      s.touchJump = false;
    }

    // Gravity
    s.pvy += GRAVITY * dt;

    // Move
    s.px += s.pvx * dt;
    s.py += s.pvy * dt;

    // Wrap horizontally
    if (s.px + PLAYER_W < 0) s.px = cw;
    if (s.px > cw) s.px = -PLAYER_W;

    // ── Platform collision ─────────────────────────────────────────────────
    s.onGround = false;
    for (const p of s.platforms) {
      if (p.crumbled) continue;
      const prevBottom = s.py + PLAYER_H - s.pvy * dt;
      const curBottom  = s.py + PLAYER_H;
      if (
        s.pvx * dt + s.px + PLAYER_W > p.x + 2 &&
        s.px + 2 < p.x + p.width &&
        curBottom >= p.y && prevBottom <= p.y + 10 &&
        s.pvy >= 0
      ) {
        s.py = p.y - PLAYER_H;
        s.pvy = 0;
        s.onGround = true;
        s.jumpCount = 0;

        if (p.type === "bounce") {
          s.pvy = jumpForce * 1.3;
          s.onGround = false;
          spawnParticles(s, s.px + PLAYER_W / 2, s.py + PLAYER_H, "#ffcc00", 6, 100);
        }
        if (p.type === "crumble") {
          p.crumbleTimer += dt * 3;
          if (p.crumbleTimer >= 1) {
            p.crumbled = true;
            spawnParticles(s, p.x + p.width / 2, p.y, "#aa7744", 8, 100);
          }
        }
      }
    }

    // ── Altitude & camera ──────────────────────────────────────────────────
    const worldY = s.py + s.cameraY;
    s.altitude = Math.max(0, -worldY + ch);
    s.maxAltitude = Math.max(s.maxAltitude, s.altitude);
    s.score = Math.floor(s.maxAltitude / 10) + s.coins_collected * 5;

    // Smooth camera: follow player upward
    const targetCam = s.py - ch * 0.45;
    if (targetCam < s.cameraY) {
      s.cameraY += (targetCam - s.cameraY) * Math.min(1, dt * 5);
    }

    // ── Spawn platforms ahead ──────────────────────────────────────────────
    const topVisible = s.cameraY - PLATFORM_SPAWN_AHEAD;
    const highestPlat = Math.min(...s.platforms.map(p => p.y));
    if (highestPlat > topVisible) {
      let y = highestPlat - (110 + Math.random() * 50);
      while (y > topVisible) {
        const newPlats = generatePlatformRow(cw, y, s.altitude);
        s.platforms.push(...newPlats);
        generateCoins(newPlats, []).forEach(c => s.coins.push(c));
        generatePickups(newPlats, []).forEach(p => s.pickups.push(p));
        y -= 110 + Math.random() * 50;
      }
    }

    // Cull far-below platforms/coins/pickups
    s.platforms = s.platforms.filter(p => p.y < s.cameraY + ch + 300);
    s.coins     = s.coins.filter(c => c.y < s.cameraY + ch + 300);
    s.pickups   = s.pickups.filter(p => p.y < s.cameraY + ch + 300);

    // ── Coin collection ────────────────────────────────────────────────────
    for (const c of s.coins) {
      if (c.collected) continue;
      if (Math.abs(c.x - (s.px + PLAYER_W / 2)) < 18 && Math.abs(c.y - (s.py + PLAYER_H / 2)) < 18) {
        c.collected = true;
        s.coins_collected++;
        spawnParticles(s, c.x, c.y - s.cameraY, "#ffcc00", 6, 100);
      }
    }

    // ── Pickup collection ──────────────────────────────────────────────────
    for (const p of s.pickups) {
      if (p.collected) continue;
      const screenY = p.y - s.cameraY;
      if (Math.abs(p.x - (s.px + PLAYER_W / 2)) < 20 && Math.abs(screenY - (s.py + PLAYER_H / 2)) < 20) {
        p.collected = true;
        if (p.kind === "fizzy") {
          s.fizzyTimer = FIZZY_DURATION;
          spawnParticles(s, p.x, screenY, "#44ffcc", 10, 120);
        } else {
          if (s.lives < 5) s.lives = Math.min(5, s.lives + 1);
          spawnParticles(s, p.x, screenY, "#ff4488", 10, 120);
        }
      }
    }

    // ── Timers ─────────────────────────────────────────────────────────────
    if (s.fizzyTimer > 0) s.fizzyTimer -= dt;
    if (s.invincibleTimer > 0) s.invincibleTimer -= dt;

    // ── Rocks ─────────────────────────────────────────────────────────────
    const rockMult = LEVEL_CONFIG[level]?.rockMult ?? 1;
    s.rockSpawnTimer += dt;
    if (s.rockSpawnTimer >= s.rockSpawnInterval) {
      s.rockSpawnTimer = 0;
      s.rockSpawnInterval = (ROCK_SPAWN_BASE / rockMult) * (0.7 + Math.random() * 0.6);
      s.rocks.push({
        x: Math.random() * cw,
        y: s.cameraY - 30,
        vx: (Math.random() - 0.5) * 200,
        vy: 80 + Math.random() * 120,
        radius: 10 + Math.random() * 10,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }

    for (const r of s.rocks) {
      r.x  += r.vx * dt;
      r.y  += r.vy * dt;
      r.vy += 400 * dt;
      r.rotation += r.rotSpeed * dt;
      if (r.x < 0) r.x = cw;
      if (r.x > cw) r.x = 0;

      // Hit player
      if (s.invincibleTimer <= 0) {
        const rx = r.x;
        const ry = r.y - s.cameraY;
        const px2 = s.px + PLAYER_W / 2;
        const py2 = s.py + PLAYER_H / 2;
        if (Math.hypot(rx - px2, ry - py2) < r.radius + 10) {
          s.lives--;
          s.invincibleTimer = INVINCIBLE_DURATION;
          spawnParticles(s, px2, py2, "#ff4444", 10, 150);
          r.y = s.cameraY + ch + 100; // remove rock
        }
      }
    }
    s.rocks = s.rocks.filter(r => r.y - s.cameraY < ch + 100);

    // ── Snowflakes ─────────────────────────────────────────────────────────
    for (const sf of s.snowflakes) {
      sf.y += sf.speed * dt;
      sf.x += Math.sin(t * 0.5 + sf.opacity * 10) * 15 * dt;
      if (sf.y > ch) { sf.y = 0; sf.x = Math.random() * cw; }
    }

    // ── Particles ──────────────────────────────────────────────────────────
    for (const p of s.particles) {
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    s.particles = s.particles.filter(p => p.life > 0);

    // ── Leg animation ─────────────────────────────────────────────────────
    if (s.onGround && Math.abs(s.pvx) > 10) s.playerLegPhase += dt * 6;
    if (s.pvx !== 0) s.facingRight = s.pvx > 0;

    // ── Fall death ─────────────────────────────────────────────────────────
    if (s.py - s.cameraY > ch + 60) {
      s.lives--;
      s.invincibleTimer = INVINCIBLE_DURATION;
      s.py = s.cameraY + ch * 0.4;
      s.pvy = 0;
      spawnParticles(s, s.px + PLAYER_W / 2, s.py, "#ff8800", 12, 160);
    }

    // ── React state sync ───────────────────────────────────────────────────
    setScore(s.score);
    setLives(s.lives);
    setCoins(s.coins_collected);
    setFizzyActive(s.fizzyTimer > 0);

    if (s.lives <= 0) {
      updateHighScore(s.score);
      setScreen("dead");
      return;
    }

    // ─────────────────────── RENDER ───────────────────────────────────────
    const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[0]!;
    const [bgTop, bgBot] = cfg.bg;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Stars (high altitude)
    if (s.altitude > 500) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min((s.altitude - 500) / 1000, 0.7)})`;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 137 + 17) % cw);
        const sy = ((i * 211 + 31) % ch);
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    ctx.save();
    ctx.translate(0, -s.cameraY);

    // Snowflakes (in world space)
    for (const sf of s.snowflakes) {
      ctx.globalAlpha = sf.opacity;
      ctx.fillStyle = "#fff";
      ctx.fillRect(sf.x, sf.y + s.cameraY, sf.size, sf.size);
    }
    ctx.globalAlpha = 1;

    // Platforms
    for (const p of s.platforms) drawPlatform(ctx, p);

    // Coins
    for (const c of s.coins) {
      if (!c.collected) drawCoin(ctx, c.x, c.y, t + c.bobOffset);
    }

    // Pickups
    for (const p of s.pickups) {
      if (!p.collected) {
        if (p.kind === "fizzy") drawFizzy(ctx, p.x, p.y, t + p.bobOffset);
        else drawMedicine(ctx, p.x, p.y, t + p.bobOffset);
      }
    }

    // Rocks
    for (const r of s.rocks) drawRock(ctx, r.x, r.y, r.radius, r.rotation);

    // Player
    drawPixelChar(
      ctx,
      s.px, s.py,
      s.facingRight,
      gender,
      s.playerLegPhase,
      s.onGround,
      s.fizzyTimer > 0,
      s.invincibleTimer > 0,
    );

    // Particles
    for (const p of s.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ── HUD ────────────────────────────────────────────────────────────────
    // Lives hearts
    for (let i = 0; i < 5; i++) {
      ctx.font = "18px sans-serif";
      ctx.fillText(i < s.lives ? "❤️" : "🖤", 10 + i * 24, 28);
    }

    // Coin count
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(12, 38, 12, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px Manrope, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`× ${s.coins_collected}`, 28, 49);

    // Fizzy boost bar
    if (s.fizzyTimer > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(cw / 2 - 50, 8, 100, 12);
      ctx.fillStyle = "#44ffcc";
      ctx.fillRect(cw / 2 - 50, 8, (s.fizzyTimer / FIZZY_DURATION) * 100, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ FIZZY BOOST", cw / 2, 18);
    }

    // Altitude
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px Manrope, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`⛰ ${Math.floor(s.altitude)}m`, cw - 10, 20);
    ctx.textAlign = "left";

  }, [screen, level, gender, updateHighScore]);

  useGameLoop(tick, screen !== "playing");

  // ── Canvas resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const handleTouchLeft  = (active: boolean) => { if (stateRef.current) stateRef.current.touchLeft  = active; };
  const handleTouchRight = (active: boolean) => { if (stateRef.current) stateRef.current.touchRight = active; };
  const handleTouchJump  = (active: boolean) => {
    if (stateRef.current) {
      stateRef.current.touchJump = active;
      if (active) jumpPressedRef.current = true;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <GameShell topbar={
      <GameTopbar
        title="Climber Adventure"
        score={score}
        highScore={highScore}
      />
    }>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>

        {/* ── HOME ── */}
        {screen === "home" && (
          <HomeScreen
            onPlay={startGame}
            onCharacter={() => setScreen("character")}
            onLevels={() => setScreen("levels")}
          />
        )}

        {/* ── CHARACTER SELECT ── */}
        {screen === "character" && (
          <CharacterScreen
            gender={gender}
            onSelect={(g) => { setGender(g); }}
            onBack={() => setScreen("home")}
          />
        )}

        {/* ── LEVEL SELECT ── */}
        {screen === "levels" && (
          <LevelScreen
            level={level}
            onSelect={(l) => { setLevel(l); }}
            onBack={() => setScreen("home")}
          />
        )}

        {/* ── GAME CANVAS ── */}
        <canvas
          ref={canvasRef}
          style={{
            display: screen === "playing" ? "block" : "none",
            width: "100%", height: "100%",
            imageRendering: "pixelated",
          }}
        />

        {/* ── TOUCH CONTROLS (playing) ── */}
        {screen === "playing" && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
            display: "flex", justifyContent: "space-between", padding: "12px 16px",
            pointerEvents: "none" }}>
            <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
              <button
                onPointerDown={() => handleTouchLeft(true)}
                onPointerUp={() => handleTouchLeft(false)}
                onPointerLeave={() => handleTouchLeft(false)}
                style={{ width: 60, height: 60, borderRadius: 12, fontSize: 24,
                  background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.3)",
                  color: "#fff", cursor: "pointer", userSelect: "none" }}>◀</button>
              <button
                onPointerDown={() => handleTouchRight(true)}
                onPointerUp={() => handleTouchRight(false)}
                onPointerLeave={() => handleTouchRight(false)}
                style={{ width: 60, height: 60, borderRadius: 12, fontSize: 24,
                  background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.3)",
                  color: "#fff", cursor: "pointer", userSelect: "none" }}>▶</button>
            </div>
            <button
              onPointerDown={() => handleTouchJump(true)}
              onPointerUp={() => handleTouchJump(false)}
              onPointerLeave={() => handleTouchJump(false)}
              style={{ width: 70, height: 70, borderRadius: "50%", fontSize: 28,
                background: "rgba(100,200,255,0.25)", border: "2px solid rgba(100,200,255,0.5)",
                color: "#fff", cursor: "pointer", userSelect: "none", pointerEvents: "all" }}>↑</button>
          </div>
        )}

        {/* ── DEAD SCREEN ── */}
        {screen === "dead" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.82)", gap: 14 }}>
            <h2 style={{ fontFamily: "Fraunces, serif", color: "#ff4444", fontSize: 30,
              fontWeight: 900, textShadow: "0 2px 12px #f00a" }}>💀 Game Over</h2>
            <p style={{ color: "#fff", fontFamily: "Manrope, sans-serif", fontSize: 18 }}>
              Score: <strong>{score}</strong>
            </p>
            <p style={{ color: "#ffcc00", fontFamily: "Manrope, sans-serif", fontSize: 15 }}>
              🪙 Coins: {coins}
            </p>
            <p style={{ color: "#aac", fontFamily: "Manrope, sans-serif", fontSize: 14 }}>
              Best: {highScore}
            </p>
            <button onClick={startGame}
              style={{ background: "#22cc55", color: "#fff", border: "none", borderRadius: 12,
                padding: "13px 40px", fontSize: 18, fontWeight: 800, cursor: "pointer",
                fontFamily: "Manrope, sans-serif", boxShadow: "0 4px 0 #118833",
                minHeight: 50, marginTop: 6 }}>
              ▶ Play Again
            </button>
            <button onClick={() => setScreen("home")}
              style={{ background: "#334466", color: "#aac", border: "none", borderRadius: 10,
                padding: "10px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "Manrope, sans-serif", minHeight: 44 }}>
              🏠 Home
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
