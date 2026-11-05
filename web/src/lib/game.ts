import type { GameState } from "../types";

const RAINBOW_INTERVAL = 2000; // metres (HUD shows altitude / 10)
const BONUS_DURATION = 10; // seconds

export function handleRainbowBonus(s: GameState, dt: number) {
  const metres = Math.floor(s.altitude / 10);
  if (metres - s.lastBonusAlt >= RAINBOW_INTERVAL) {
    s.bonusZone = true;
    s.bonusZoneTimer = BONUS_DURATION;
    s.lastBonusAlt = metres - (metres % RAINBOW_INTERVAL);
  }

  if (s.bonusZone) {
    s.rainbowT += dt;
    s.bonusZoneTimer -= dt;
    if (s.bonusZoneTimer <= 0) s.bonusZone = false;
  }
}
