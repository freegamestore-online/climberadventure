import { describe, expect, it } from "vitest";
import { handleRainbowBonus } from "./game";
import type { GameState } from "../types";

const at = (metres: number, s: Partial<GameState> = {}) =>
  ({ altitude: metres * 10, bonusZone: false, bonusZoneTimer: 0, lastBonusAlt: 0, rainbowT: 0, ...s }) as GameState;

describe("handleRainbowBonus", () => {
  it("starts a 10s bonus zone every 2000m", () => {
    const s = at(1999);
    handleRainbowBonus(s, 0.016);
    expect(s.bonusZone).toBe(false);

    s.altitude = 2000 * 10;
    handleRainbowBonus(s, 0.016);
    expect(s.bonusZone).toBe(true);
    expect(s.lastBonusAlt).toBe(2000);

    // Lasts ten seconds, then ends, and doesn't restart before 4000m.
    for (let t = 0; t < 10; t += 0.5) handleRainbowBonus(s, 0.5);
    expect(s.bonusZone).toBe(false);
    s.altitude = 3999 * 10;
    handleRainbowBonus(s, 0.5);
    expect(s.bonusZone).toBe(false);

    s.altitude = 4100 * 10;
    handleRainbowBonus(s, 0.5);
    expect(s.bonusZone).toBe(true);
    expect(s.lastBonusAlt).toBe(4000);
  });

  it("snaps to the 2000m mark when a jump skips past it", () => {
    const s = at(2150);
    handleRainbowBonus(s, 0.016);
    expect(s.bonusZone).toBe(true);
    expect(s.lastBonusAlt).toBe(2000);
  });

  it("animates the rainbow only while the zone is active", () => {
    const s = at(10);
    handleRainbowBonus(s, 1);
    expect(s.rainbowT).toBe(0);
    s.altitude = 20000;
    handleRainbowBonus(s, 1);
    expect(s.rainbowT).toBe(1);
  });
});
