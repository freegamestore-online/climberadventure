import { GameState } from "../types";
import { randomColor } from "./canvas";

export function handleRainbowBonus(s: GameState) {
  const RAINBOW_INTERVAL = 2000;
  const BONUS_DURATION = 10; // 10 seconds

  if (s.altitude - s.lastBonusAlt >= RAINBOW_INTERVAL) {
    s.bonusZone = true;
    s.bonusZoneTimer = BONUS_DURATION;
    s.lastBonusAlt = s.altitude;
  }

  if (s.bonusZone) {
    s.bonusZoneTimer -= 1 / 60;
    if (s.bonusZoneTimer <= 0) {
      s.bonusZone = false;
    }
  }
}