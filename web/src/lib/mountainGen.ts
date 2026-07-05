import type { Platform, Snowflake, Cloud } from "../types";

/** Generate an initial set of platforms for the mountain */
export function generateInitialPlatforms(canvasW: number, canvasH: number): Platform[] {
  const platforms: Platform[] = [];

  // Starting ground platform
  platforms.push({
    x: 0,
    y: canvasH - 40,
    width: canvasW,
    type: "normal",
    crumbleTimer: 0,
    crumbled: false,
  });

  // Generate platforms going upward
  let lastY = canvasH - 120;
  for (let i = 0; i < 20; i++) {
    platforms.push(...generatePlatformRow(canvasW, lastY, 0));
    lastY -= 100 + Math.random() * 60;
  }

  return platforms;
}

/** Generate a row of platforms at a given Y, based on altitude difficulty */
export function generatePlatformRow(
  canvasW: number,
  y: number,
  altitude: number,
): Platform[] {
  const platforms: Platform[] = [];
  const difficulty = Math.min(altitude / 3000, 1); // 0..1

  // 1–2 platforms per row
  const count = Math.random() < 0.3 + difficulty * 0.3 ? 2 : 1;

  const minWidth = Math.max(60, 140 - difficulty * 70);
  const maxWidth = Math.max(80, 200 - difficulty * 80);

  if (count === 1) {
    const w = minWidth + Math.random() * (maxWidth - minWidth);
    const x = 20 + Math.random() * (canvasW - w - 40);
    platforms.push(makePlatform(x, y, w, altitude));
  } else {
    // Two platforms side by side with a gap
    const w1 = minWidth + Math.random() * (maxWidth - minWidth);
    const w2 = minWidth + Math.random() * (maxWidth - minWidth);
    const gap = 40 + Math.random() * 60;
    const totalW = w1 + gap + w2;
    const startX = Math.max(10, (canvasW - totalW) / 2 + (Math.random() - 0.5) * 80);
    if (startX + totalW < canvasW - 10) {
      platforms.push(makePlatform(startX, y, w1, altitude));
      platforms.push(makePlatform(startX + w1 + gap, y, w2, altitude));
    } else {
      platforms.push(makePlatform(20, y, Math.min(w1, canvasW - 40), altitude));
    }
  }

  return platforms;
}

function makePlatform(x: number, y: number, width: number, altitude: number): Platform {
  const difficulty = Math.min(altitude / 3000, 1);
  const rand = Math.random();
  let type: Platform["type"] = "normal";
  if (altitude > 500) {
    if (rand < difficulty * 0.25) type = "ice";
    else if (rand < difficulty * 0.4) type = "crumble";
    else if (rand < difficulty * 0.45) type = "bounce";
  }
  return { x, y, width, type, crumbleTimer: 0, crumbled: false };
}

export function generateSnowflakes(count: number, canvasW: number, canvasH: number): Snowflake[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * canvasW,
    y: Math.random() * canvasH,
    speed: 20 + Math.random() * 40,
    size: 1 + Math.random() * 2.5,
    opacity: 0.3 + Math.random() * 0.6,
  }));
}

export function generateClouds(count: number, canvasW: number, canvasH: number): Cloud[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * canvasW,
    y: 50 + Math.random() * canvasH * 0.5,
    width: 80 + Math.random() * 120,
    height: 30 + Math.random() * 40,
    speed: 5 + Math.random() * 15,
  }));
}
