import type { Platform, Coin, Pickup, Snowflake } from "../types";

export function generateInitialPlatforms(cw: number, ch: number): Platform[] {
  const out: Platform[] = [];
  out.push({ x: 0, y: ch - 40, width: cw, type: "normal", crumbleTimer: 0, crumbled: false });
  let lastY = ch - 140;
  for (let i = 0; i < 24; i++) {
    out.push(...generatePlatformRow(cw, lastY, 0));
    lastY -= 110 + Math.random() * 50;
  }
  return out;
}

export function generatePlatformRow(cw: number, y: number, altitude: number): Platform[] {
  const out: Platform[] = [];
  const diff = Math.min(altitude / 4000, 1);
  const count = Math.random() < 0.35 ? 2 : 1;
  const minW = Math.max(70, 160 - diff * 70);
  const maxW = Math.max(90, 220 - diff * 80);

  if (count === 1) {
    const w = minW + Math.random() * (maxW - minW);
    const x = 20 + Math.random() * (cw - w - 40);
    out.push(makePlat(x, y, w, altitude));
  } else {
    const w1 = minW + Math.random() * (maxW - minW);
    const w2 = minW + Math.random() * (maxW - minW);
    const gap = 40 + Math.random() * 50;
    const sx = Math.max(10, (cw - w1 - gap - w2) / 2 + (Math.random() - 0.5) * 60);
    if (sx + w1 + gap + w2 < cw - 10) {
      out.push(makePlat(sx, y, w1, altitude));
      out.push(makePlat(sx + w1 + gap, y, w2, altitude));
    } else {
      out.push(makePlat(20, y, Math.min(w1, cw - 40), altitude));
    }
  }
  return out;
}

function makePlat(x: number, y: number, w: number, altitude: number): Platform {
  const diff = Math.min(altitude / 4000, 1);
  const r = Math.random();
  let type: Platform["type"] = "normal";
  if (altitude > 400) {
    if (r < diff * 0.15) type = "crumble";
    else if (r < diff * 0.28) type = "bounce";
    else if (r < diff * 0.38) type = "ice";
  }
  return { x, y, width: w, type, crumbleTimer: 0, crumbled: false };
}

export function generateCoins(platforms: Platform[]): Coin[] {
  const coins: Coin[] = [];
  for (const p of platforms) {
    if (p.type === "crumble") continue;
    if (Math.random() < 0.45) {
      coins.push({ x: p.x + p.width / 2, y: p.y - 22, collected: false, anim: Math.random() * Math.PI * 2 });
    }
  }
  return coins;
}

export function generatePickups(platforms: Platform[]): Pickup[] {
  const picks: Pickup[] = [];
  for (const p of platforms) {
    if (Math.random() < 0.12) {
      picks.push({ x: p.x + p.width * 0.3, y: p.y - 26, kind: "fizzy", collected: false, anim: Math.random() * Math.PI * 2 });
    } else if (Math.random() < 0.08) {
      picks.push({ x: p.x + p.width * 0.7, y: p.y - 26, kind: "medicine", collected: false, anim: Math.random() * Math.PI * 2 });
    }
  }
  return picks;
}

export function generateSnowflakes(count: number, cw: number, ch: number): Snowflake[] {
  const out: Snowflake[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: Math.random() * cw, y: Math.random() * ch, speed: 30 + Math.random() * 50, size: 1 + Math.random() * 2 });
  }
  return out;
}
