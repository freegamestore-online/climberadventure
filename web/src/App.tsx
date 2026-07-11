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
import { CustomizeScreen } from "./screens/CustomizeScreen";

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
    cameraY: ch,
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
    bonusZone: false,
    bonusZoneTimer: 0,
    lastBonusAlt: 0,
    rainbowT: 0,
  };
}

function updateGame(s: GameState, dt: number, cw: number, ch: number) {
  // Update player position
  s.px += s.pvx * dt;
  s.py += s.pvy * dt;
  s.pvy += GRAVITY * dt;

  // Camera follows player
  const targetY = s.py - ch * 0.5;
  s.cameraY = s.cameraY + (targetY - s.cameraY) * 0.1;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");

  const renderScreen = () => {
    switch (screen) {
      case "menu":
        return (
          <div className="menu flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-4">Climber Adventure</h1>
            <button
              onClick={() => setScreen("game")}
              className="bg-blue-500 text-white py-2 px-4 rounded mb-3"
            >
              Start Game
            </button>
            <button
              onClick={() => setScreen("customize")}
              className="bg-green-500 text-white py-2 px-4 rounded"
            >
              Customize Character
            </button>
          </div>
        );
      case "game":
        return <GameScreen onExit={() => setScreen("menu")} />;
      case "customize":
        return <CustomizeScreen onClose={() => setScreen("menu")} />;
      default:
        return null;
    }
  };

  return (
    <GameShell topbar={<GameTopbar title="Climber Adventure" />}>{renderScreen()}</GameShell>
  );
}