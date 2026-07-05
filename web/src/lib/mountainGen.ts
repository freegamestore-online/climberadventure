import type { Platform, Coin, Pickup, Snowflake } from "../types";

export function generateInitialPlatforms(canvasW: number, canvasH: number): Platform[] {
  const platforms: Platform[] = [];
  platforms.push({ x: 0, y: canvasH - 40, width: canvasW, type: "normal", crumbleTimer: 0, crumbled: false });
  let lastY = canvasH - 130;
  for (let i = 0; i < 22; i++) {
    platforms.push(...generatePlatformRow(canvasW, lastY, 0));
    lastY -= 110 + Math.random() * 50;
  }
  return platforms;
}

export function generatePlatformRow(canvasW: number, y: number, altitude: number): Platform[] {
  const platforms: Platform[] = [];
  const difficulty = Math.min(altitude / 4000, 1);
  const count = Math.random() < 0.35 ? 2 : 1;
  const minW = Math.max(70, 160 - difficulty * 70);
  const maxW = Math.max(90, 220 - difficulty * 80);

  if (count === 1) {
    const w = minW + Math.random() * (maxW - minW);
    const x = 20 + Math.random() * (canvasW - w - 40);
    platforms.push(makePlatform(x, y, w, altitude));
  } else {
    const w1 = minW + Math.random() * (maxW - minW);
    const w2 = minW + Math.random() * (maxW - minW);
    const gap = 40 + Math.random() * 50;
    const startX = Math.max(10, (canvasW - w1 - gap - w2) / 2 + (Math.random() - 0.5) * 60);
    if (startX + w1 + gap + w2 < canvasW - 10) {
      platforms.push(makePlatform(startX, y, w1, altitude));
      platforms.push(makePlatform(startX + w1 + gap, y, w2, altitude));
    } else {
      platforms.push(makePlatform(20, y, Math.min(w1, canvasW - 40), altitude));
    }
  }
  return platforms;
}

function makePlatform(x: number, y: number, w: number, altitude: number): Platform {
  const difficulty = Math.min(altitude / 4000, 1);
  const r = Math.random();
  let type: Platform["type"] = "normal";
  if (altitude > 500) {
    if (r < difficulty * 0.15) type = "crumble";
    else if (r < difficulty * 0.25) type = "bounce";
    else if (r < difficulty * 0.35) type = "ice";
  }
  return { x, y, width: w, type, crumbleTimer: 0, crumbled: false };
}

export function generateCoins(platforms: Platform[], existingCoins: Coin[]): Coin[] {
  const coins: Coin[] = [...existingCoins];
  for (const p of platforms) {
    if (p.type === "crumble" || p.crumbled) continue;
    if (Math.random() < 0.45) {
      const cx = p.x + p.width / 2 + (Math.random() - 0.5) * (p.width * 0.5);
      coins.push({ x: cx, y: p.y - 22, collected: false, bobOffset: Math.random() * Math.PI * 2 });
    }
  }
  return coins;
}

export function generatePickups(platforms: Platform[], existingPickups: Pickup[]): Pickup[] {
  const pickups: Pickup[] = [...existingPickups];
  for (const p of platforms) {
    if (p.crumbled) continue;
    const r = Math.random();
    if (r < 0.08) {
      pickups.push({ x: p.x + p.width / 2, y: p.y - 24, kind: "fizzy", collected: false, bobOffset: Math.random() * Math.PI * 2 });
    } else if (r < 0.13) {
      pickups.push({ x: p.x + p.width / 2, y: p.y - 24, kind: "medicine", collected: false, bobOffset: Math.random() * Math.PI * 2 });
    }
  }
  return pickups;
}

export function generateSnowflakes(count: number, w: number, h: number): Snowflake[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    speed: 30 + Math.random() * 50,
    size: 1 + Math.random() * 2.5,
    opacity: 0.3 + Math.random() * 0.5,
  }));
}
