import { useRef, useEffect, useCallback, useState } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import { drawText } from "./lib/canvas";
import {
  generateInitialPlatforms,
  generatePlatformRow,
  generateSnowflakes,
  generateClouds,
} from "./lib/mountainGen";
import type { GameState, Platform, Rock, Particle } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 1400;
const JUMP_FORCE = -560;
const DOUBLE_JUMP_FORCE = -480;
const PLAYER_SPEED = 220;
const ICE_FRICTION = 0.985;
const NORMAL_FRICTION = 0.7;
const ROCK_SPAWN_BASE = 4.5;
const PLATFORM_SPAWN_AHEAD = 600; // px above camera top

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeState(cw: number, ch: number): GameState {
  const platforms = generateInitialPlatforms(cw, ch);
  return {
    phase: "menu",
    px: cw / 2 - 14,
    py: ch - 80,
    pvx: 0,
    pvy: 0,
    onGround: false,
    facingRight: true,
    jumpCount: 0,
    cameraY: 0,
    platforms,
    rocks: [],
    particles: [],
    snowflakes: generateSnowflakes(60, cw, ch),
    clouds: generateClouds(6, cw, ch),
    score: 0,
    maxAltitude: 0,
    rockSpawnTimer: 0,
    rockSpawnInterval: ROCK_SPAWN_BASE,
    altitude: 0,
    playerAnim: 0,
    playerLegPhase: 0,
    deathTimer: 0,
    touchLeft: false,
    touchRight: false,
    touchJump: false,
  };
}

function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 120,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s - 60,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function getPlatformColor(type: Platform["type"]): { top: string; body: string } {
  switch (type) {
    case "ice":
      return { top: "#a8e6f0", body: "#5bbcd4" };
    case "crumble":
      return { top: "#c4956a", body: "#8b5e3c" };
    case "bounce":
      return { top: "#f9e05b", body: "#e6b800" };
    default:
      return { top: "#7ec850", body: "#4a7c2f" };
  }
}

function drawMountainBg(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  cameraY: number,
  altitude: number,
) {
  // Sky gradient based on altitude
  const t = Math.min(altitude / 4000, 1);
  const r1 = Math.round(lerp(135, 30, t));
  const g1 = Math.round(lerp(206, 50, t));
  const b1 = Math.round(lerp(235, 80, t));
  const r2 = Math.round(lerp(80, 10, t));
  const g2 = Math.round(lerp(140, 20, t));
  const b2 = Math.round(lerp(200, 40, t));
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
  grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // Distant mountain silhouettes (parallax)
  const parallax = cameraY * 0.15;
  ctx.fillStyle = `rgba(${Math.round(lerp(100, 40, t))},${Math.round(lerp(160, 60, t))},${Math.round(lerp(180, 90, t))},0.5)`;
  drawMountainSilhouette(ctx, cw, ch, parallax, 0.7, 3);
  ctx.fillStyle = `rgba(${Math.round(lerp(80, 30, t))},${Math.round(lerp(130, 50, t))},${Math.round(lerp(160, 70, t))},0.6)`;
  drawMountainSilhouette(ctx, cw, ch, parallax * 0.5, 0.85, 5);
}

function drawMountainSilhouette(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  offsetY: number,
  heightFactor: number,
  seed: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, ch);
  const peaks = 5;
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * cw;
    const peakH = ch * heightFactor * (0.5 + 0.5 * Math.sin(i * seed + seed));
    const midX = x - cw / peaks / 2;
    ctx.lineTo(midX, ch - peakH + offsetY);
    ctx.lineTo(x, ch - peakH * 0.6 + offsetY);
  }
  ctx.lineTo(cw, ch);
  ctx.closePath();
  ctx.fill();
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"menu" | "playing" | "dead">("menu");
  const [highScore, updateHighScore] = useHighScore("climberadventure_highscore");

  // ── Init / resize ────────────────────────────────────────────────────────
  const initState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;
    stateRef.current = makeState(cw, ch);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (stateRef.current) {
        const s = stateRef.current;
        if (s.phase !== "playing") {
          stateRef.current = makeState(canvas.width, canvas.height);
          stateRef.current.phase = s.phase;
        }
      } else {
        initState();
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [initState]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w"].includes(e.key))
        e.preventDefault();

      // Jump on keydown (not held)
      const s = stateRef.current;
      if (!s) return;
      if (s.phase === "menu") {
        s.phase = "playing";
        setPhase("playing");
        return;
      }
      if (s.phase === "dead") return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        tryJump(s);
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ── Touch controls ───────────────────────────────────────────────────────
  const handleTouchStart = useCallback((zone: "left" | "right" | "jump") => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === "menu") {
      s.phase = "playing";
      setPhase("playing");
      return;
    }
    if (s.phase === "dead") {
      restartGame();
      return;
    }
    if (zone === "left") s.touchLeft = true;
    if (zone === "right") s.touchRight = true;
    if (zone === "jump") tryJump(s);
  }, []);

  const handleTouchEnd = useCallback((zone: "left" | "right" | "jump") => {
    const s = stateRef.current;
    if (!s) return;
    if (zone === "left") s.touchLeft = false;
    if (zone === "right") s.touchRight = false;
    if (zone === "jump") s.touchJump = false;
  }, []);

  function tryJump(s: GameState) {
    if (s.onGround) {
      s.pvy = JUMP_FORCE;
      s.onGround = false;
      s.jumpCount = 1;
      spawnParticles(s, s.px + 14, s.py + 28, "#a8e6f0", 6, 80);
    } else if (s.jumpCount < 2) {
      s.pvy = DOUBLE_JUMP_FORCE;
      s.jumpCount = 2;
      spawnParticles(s, s.px + 14, s.py + 14, "#f9e05b", 8, 100);
    }
  }

  function restartGame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ns = makeState(canvas.width, canvas.height);
    ns.phase = "playing";
    stateRef.current = ns;
    setPhase("playing");
    setScore(0);
  }

  // ── Game loop ────────────────────────────────────────────────────────────
  useGameLoop(
    useCallback(
      (dt: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const s = stateRef.current;
        if (!canvas || !ctx || !s) return;

        const cw = canvas.width;
        const ch = canvas.height;
        const keys = keysRef.current;

        // ── Update ───────────────────────────────────────────────────────
        if (s.phase === "playing") {
          // Horizontal movement
          const left =
            keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || s.touchLeft;
          const right =
            keys.has("ArrowRight") || keys.has("d") || keys.has("D") || s.touchRight;

          const friction = s.onGround
            ? s.platforms.find(
                (p) =>
                  !p.crumbled &&
                  s.py + 28 >= p.y &&
                  s.py + 28 <= p.y + 12 &&
                  s.px + 4 < p.x + p.width &&
                  s.px + 24 > p.x,
              )?.type === "ice"
              ? ICE_FRICTION
              : NORMAL_FRICTION
            : 0.95;

          if (left) {
            s.pvx -= PLAYER_SPEED * dt * (s.onGround ? 1 : 0.7);
            s.facingRight = false;
          }
          if (right) {
            s.pvx += PLAYER_SPEED * dt * (s.onGround ? 1 : 0.7);
            s.facingRight = true;
          }

          if (!left && !right && s.onGround) {
            s.pvx *= Math.pow(friction, dt * 60);
          } else if (!left && !right) {
            s.pvx *= Math.pow(0.97, dt * 60);
          }

          s.pvx = Math.max(-300, Math.min(300, s.pvx));

          // Gravity
          s.pvy += GRAVITY * dt;

          // Move player
          s.px += s.pvx * dt;
          s.py += s.pvy * dt;

          // Wrap horizontally
          if (s.px + 28 < 0) s.px = cw;
          if (s.px > cw) s.px = -28;

          // Platform collision (only when falling)
          s.onGround = false;
          if (s.pvy >= 0) {
            for (const p of s.platforms) {
              if (p.crumbled) continue;
              const prevBottom = s.py + 28 - s.pvy * dt;
              const bottom = s.py + 28;
              if (
                bottom >= p.y &&
                prevBottom <= p.y + 4 &&
                s.px + 4 < p.x + p.width &&
                s.px + 24 > p.x
              ) {
                s.py = p.y - 28;
                if (p.type === "bounce") {
                  s.pvy = JUMP_FORCE * 1.15;
                  s.jumpCount = 0;
                  spawnParticles(s, s.px + 14, s.py + 28, "#f9e05b", 10, 120);
                } else {
                  s.pvy = 0;
                  s.onGround = true;
                  s.jumpCount = 0;
                }

                // Crumble logic
                if (p.type === "crumble" && p.crumbleTimer === 0) {
                  p.crumbleTimer = 0.001; // start timer
                }
                break;
              }
            }
          }

          // Crumble timers
          for (const p of s.platforms) {
            if (p.crumbleTimer > 0) {
              p.crumbleTimer += dt;
              if (p.crumbleTimer > 0.8) {
                if (!p.crumbled) {
                  spawnParticles(s, p.x + p.width / 2, p.y, "#c4956a", 12, 100);
                }
                p.crumbled = true;
              }
            }
          }

          // Camera: smoothly follow player upward
          const targetCamY = s.py - ch * 0.45;
          if (targetCamY < s.cameraY) {
            s.cameraY += (targetCamY - s.cameraY) * Math.min(1, dt * 6);
          }

          // Altitude & score
          const altitudeNow = -s.cameraY;
          s.altitude = Math.max(0, altitudeNow);
          if (s.altitude > s.maxAltitude) {
            s.maxAltitude = s.altitude;
            const newScore = Math.floor(s.maxAltitude / 10);
            s.score = newScore;
            setScore(newScore);
            updateHighScore(newScore);
          }

          // Generate new platforms ahead
          const topOfScreen = s.cameraY - PLATFORM_SPAWN_AHEAD;
          const highestPlatform = Math.min(...s.platforms.map((p) => p.y));
          if (highestPlatform > topOfScreen) {
            let y = highestPlatform - (80 + Math.random() * 70);
            while (y > topOfScreen) {
              const rows = generatePlatformRow(cw, y, s.altitude);
              s.platforms.push(...rows);
              y -= 80 + Math.random() * 70;
            }
          }

          // Remove platforms far below camera
          s.platforms = s.platforms.filter((p) => p.y < s.cameraY + ch + 200);

          // Spawn rocks
          s.rockSpawnTimer += dt;
          s.rockSpawnInterval = Math.max(1.2, ROCK_SPAWN_BASE - s.altitude / 1000);
          if (s.rockSpawnTimer >= s.rockSpawnInterval) {
            s.rockSpawnTimer = 0;
            const rx = Math.random() * cw;
            const ry = s.cameraY - 40;
            s.rocks.push({
              x: rx,
              y: ry,
              vx: (Math.random() - 0.5) * 120,
              vy: 60 + Math.random() * 80,
              radius: 8 + Math.random() * 10,
              rotation: 0,
              rotSpeed: (Math.random() - 0.5) * 6,
            });
          }

          // Update rocks
          for (const r of s.rocks) {
            r.vy += GRAVITY * 0.3 * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.rotation += r.rotSpeed * dt;
            if (r.x < 0) r.x = cw;
            if (r.x > cw) r.x = 0;
          }

          // Rock-player collision
          for (const r of s.rocks) {
            const dx = s.px + 14 - r.x;
            const dy = s.py + 14 - r.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r.radius + 12) {
              spawnParticles(s, s.px + 14, s.py + 14, "#ff4444", 14, 150);
              s.phase = "dead";
              s.deathTimer = 0;
              setPhase("dead");
              break;
            }
          }

          // Remove rocks far below
          s.rocks = s.rocks.filter((r) => r.y < s.cameraY + ch + 100);

          // Fall off bottom = death
          if (s.py - s.cameraY > ch + 60) {
            spawnParticles(s, s.px + 14, s.py + 14, "#ff4444", 10, 120);
            s.phase = "dead";
            s.deathTimer = 0;
            setPhase("dead");
          }

          // Player animation
          if (Math.abs(s.pvx) > 20 && s.onGround) {
            s.playerLegPhase += dt * 8;
          }
          s.playerAnim += dt;
        } else if (s.phase === "dead") {
          s.deathTimer += dt;
        }

        // Update particles
        for (const p of s.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 200 * dt;
          p.life -= dt;
        }
        s.particles = s.particles.filter((p) => p.life > 0);

        // Update snowflakes
        for (const sf of s.snowflakes) {
          sf.y += sf.speed * dt;
          sf.x += Math.sin(s.playerAnim + sf.speed) * 0.3;
          if (sf.y > ch) {
            sf.y = -4;
            sf.x = Math.random() * cw;
          }
        }

        // Update clouds
        for (const c of s.clouds) {
          c.x -= c.speed * dt;
          if (c.x + c.width < 0) {
            c.x = cw + 10;
            c.y = 50 + Math.random() * ch * 0.4;
          }
        }

        // ── Render ───────────────────────────────────────────────────────
        ctx.save();

        // Background
        drawMountainBg(ctx, cw, ch, s.cameraY, s.altitude);

        // Clouds
        ctx.save();
        for (const c of s.clouds) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = "#ffffff";
          drawCloud(ctx, c.x, c.y, c.width, c.height);
        }
        ctx.restore();

        // Camera transform
        ctx.save();
        ctx.translate(0, -s.cameraY);

        // Platforms
        for (const p of s.platforms) {
          if (p.y < s.cameraY - 20 || p.y > s.cameraY + ch + 20) continue;
          if (p.crumbled) continue;
          const colors = getPlatformColor(p.type);
          const shake =
            p.crumbleTimer > 0 ? Math.sin(p.crumbleTimer * 40) * 3 : 0;
          const alpha = p.crumbleTimer > 0.4 ? 1 - (p.crumbleTimer - 0.4) / 0.4 : 1;
          ctx.globalAlpha = alpha;

          // Platform body
          ctx.fillStyle = colors.body;
          roundRect(ctx, p.x + shake, p.y + 6, p.width, 14, 4);
          ctx.fill();

          // Platform top
          ctx.fillStyle = colors.top;
          roundRect(ctx, p.x + shake, p.y, p.width, 8, 4);
          ctx.fill();

          // Ice shine
          if (p.type === "ice") {
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            roundRect(ctx, p.x + shake + 4, p.y + 1, p.width * 0.3, 3, 2);
            ctx.fill();
          }

          // Bounce spring
          if (p.type === "bounce") {
            ctx.strokeStyle = "#ff8800";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
              const bx = p.x + p.width / 2 - 8 + i * 8;
              ctx.moveTo(bx, p.y);
              ctx.lineTo(bx + 4, p.y - 6);
              ctx.lineTo(bx + 8, p.y);
            }
            ctx.stroke();
          }

          ctx.globalAlpha = 1;
        }

        // Rocks
        for (const r of s.rocks) {
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.rotate(r.rotation);
          ctx.fillStyle = "#8b7355";
          ctx.beginPath();
          ctx.ellipse(0, 0, r.radius, r.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#a89070";
          ctx.beginPath();
          ctx.ellipse(-r.radius * 0.2, -r.radius * 0.2, r.radius * 0.4, r.radius * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Player
        if (s.phase !== "dead" || s.deathTimer < 0.5) {
          drawPlayer(ctx, s.px, s.py, s.facingRight, s.onGround, s.playerLegPhase, s.pvy);
        }

        // Particles
        for (const p of s.particles) {
          const alpha = Math.max(0, p.life / p.maxLife);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.restore(); // end camera transform

        // Snowflakes (UI layer, no camera)
        ctx.save();
        for (const sf of s.snowflakes) {
          ctx.globalAlpha = sf.opacity * Math.min(1, s.altitude / 300);
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(sf.x, sf.y, sf.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // Altitude indicator (right side)
        if (s.phase === "playing" || s.phase === "dead") {
          const altM = Math.floor(s.maxAltitude / 10);
          drawText(ctx, `🏔 ${altM}m`, cw - 10, 16, {
            font: "bold 14px Manrope, sans-serif",
            color: "#ffffff",
            align: "right",
            baseline: "top",
            shadow: "#000000",
            shadowBlur: 6,
          });
        }

        // Platform type legend hints
        if (s.altitude < 200 && s.phase === "playing") {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - s.altitude / 200);
          drawText(ctx, "← → Move   Space/↑ Jump (double jump!)", cw / 2, ch - 20, {
            font: "13px Manrope, sans-serif",
            color: "#ffffff",
            align: "center",
            shadow: "#000000",
            shadowBlur: 4,
          });
          ctx.restore();
        }

        // Menu overlay
        if (s.phase === "menu") {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fillRect(0, 0, cw, ch);

          drawText(ctx, "⛰ CLIMBER", cw / 2, ch / 2 - 80, {
            font: "bold 52px Fraunces, serif",
            color: "#ffffff",
            align: "center",
            shadow: "#000000",
            shadowBlur: 16,
          });
          drawText(ctx, "Scale the mountain!", cw / 2, ch / 2 - 28, {
            font: "20px Manrope, sans-serif",
            color: "#e0f4ff",
            align: "center",
          });
          drawText(ctx, "Press SPACE or tap to start", cw / 2, ch / 2 + 20, {
            font: "16px Manrope, sans-serif",
            color: "#b0d8f0",
            align: "center",
          });
          if (highScore > 0) {
            drawText(ctx, `Best: ${highScore}m`, cw / 2, ch / 2 + 60, {
              font: "bold 18px Manrope, sans-serif",
              color: "#f9e05b",
              align: "center",
              shadow: "#000000",
              shadowBlur: 6,
            });
          }
          drawLegend(ctx, cw, ch);
          ctx.restore();
        }

        // Dead overlay
        if (s.phase === "dead" && s.deathTimer > 0.4) {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, 0, cw, ch);
          drawText(ctx, "YOU FELL!", cw / 2, ch / 2 - 60, {
            font: "bold 44px Fraunces, serif",
            color: "#ff6666",
            align: "center",
            shadow: "#000000",
            shadowBlur: 12,
          });
          drawText(ctx, `Altitude: ${Math.floor(s.maxAltitude / 10)}m`, cw / 2, ch / 2, {
            font: "bold 24px Manrope, sans-serif",
            color: "#ffffff",
            align: "center",
          });
          if (highScore > 0) {
            drawText(ctx, `Best: ${highScore}m`, cw / 2, ch / 2 + 36, {
              font: "18px Manrope, sans-serif",
              color: "#f9e05b",
              align: "center",
            });
          }
          drawText(ctx, "Press SPACE or tap to retry", cw / 2, ch / 2 + 80, {
            font: "16px Manrope, sans-serif",
            color: "#b0d8f0",
            align: "center",
          });
          ctx.restore();
        }

        ctx.restore();
      },
      [highScore, updateHighScore],
    ),
  );

  // Space/tap to restart on dead
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && stateRef.current?.phase === "dead") {
        restartGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="Climber Adventure" score={score} />}>
      {/* Canvas */}
      <div className="relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onClick={() => {
            const s = stateRef.current;
            if (!s) return;
            if (s.phase === "menu") {
              s.phase = "playing";
              setPhase("playing");
            } else if (s.phase === "dead") {
              restartGame();
            }
          }}
        />

        {/* Touch controls */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end">
          <div className="flex w-full pointer-events-auto" style={{ height: "120px" }}>
            {/* Left */}
            <button
              className="flex-1 flex items-center justify-center text-white text-3xl select-none active:bg-white/10 rounded-tr-2xl"
              style={{ background: "rgba(255,255,255,0.08)", touchAction: "none" }}
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart("left"); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd("left"); }}
              onMouseDown={() => handleTouchStart("left")}
              onMouseUp={() => handleTouchEnd("left")}
              onMouseLeave={() => handleTouchEnd("left")}
              aria-label="Move left"
            >
              ◀
            </button>
            {/* Jump */}
            <button
              className="flex items-center justify-center text-white text-3xl select-none active:bg-white/10"
              style={{ width: "120px", background: "rgba(255,255,255,0.12)", touchAction: "none" }}
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart("jump"); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd("jump"); }}
              onMouseDown={() => handleTouchStart("jump")}
              onMouseUp={() => handleTouchEnd("jump")}
              aria-label="Jump"
            >
              🦘
            </button>
            {/* Right */}
            <button
              className="flex-1 flex items-center justify-center text-white text-3xl select-none active:bg-white/10 rounded-tl-2xl"
              style={{ background: "rgba(255,255,255,0.08)", touchAction: "none" }}
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart("right"); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd("right"); }}
              onMouseDown={() => handleTouchStart("right")}
              onMouseUp={() => handleTouchEnd("right")}
              onMouseLeave={() => handleTouchEnd("right")}
              aria-label="Move right"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </GameShell>
  );
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.6, w * 0.5, h * 0.4, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.3, y + h * 0.5, w * 0.28, h * 0.45, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.7, y + h * 0.5, w * 0.25, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  facingRight: boolean,
  onGround: boolean,
  legPhase: number,
  pvy: number,
) {
  ctx.save();
  ctx.translate(px + 14, py + 14);
  if (!facingRight) ctx.scale(-1, 1);

  // Body
  ctx.fillStyle = "#e63946";
  roundRect(ctx, -8, -6, 16, 18, 4);
  ctx.fill();

  // Jacket stripe
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(-8, 0, 16, 3);

  // Head
  ctx.fillStyle = "#f4a261";
  ctx.beginPath();
  ctx.arc(0, -12, 8, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(3, -13, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = "#2196f3";
  ctx.beginPath();
  ctx.arc(0, -14, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#1565c0";
  ctx.fillRect(-8, -14, 16, 3);

  // Arms
  ctx.strokeStyle = "#e63946";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const armSwing = onGround ? Math.sin(legPhase) * 0.4 : pvy < 0 ? -0.6 : 0.3;
  ctx.save();
  ctx.translate(-8, -2);
  ctx.rotate(-0.4 - armSwing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, 10);
  ctx.stroke();
  // Ice axe
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(-14, 6);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(8, -2);
  ctx.rotate(0.4 + armSwing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(8, 10);
  ctx.stroke();
  ctx.restore();

  // Legs
  ctx.strokeStyle = "#1a1a2e";
  ctx.lineWidth = 5;
  const legSwing = onGround ? Math.sin(legPhase) * 0.5 : 0.2;
  ctx.save();
  ctx.translate(-4, 12);
  ctx.rotate(-legSwing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-2, 12);
  ctx.stroke();
  // Boot
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-2, 12);
  ctx.lineTo(-6, 14);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(4, 12);
  ctx.rotate(legSwing);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, 12);
  ctx.stroke();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, 12);
  ctx.lineTo(6, 14);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawLegend(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  const items = [
    { color: "#7ec850", label: "Normal" },
    { color: "#a8e6f0", label: "Ice (slippery)" },
    { color: "#c4956a", label: "Crumbles!" },
    { color: "#f9e05b", label: "Bouncy" },
  ];
  const startX = cw / 2 - 160;
  const y = ch / 2 + 110;
  ctx.save();
  ctx.font = "13px Manrope, sans-serif";
  ctx.textBaseline = "middle";
  items.forEach((item, i) => {
    const x = startX + i * 82;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 6, 16, 12);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(item.label, x + 20, y);
  });
  ctx.restore();
}
