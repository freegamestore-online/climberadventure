import type { Gender } from "../types";

export type Hat = "none" | "star" | "cap" | "bow";

const PW = 22;
const PH = 30;

export function drawPixelChar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: boolean,
  gender: Gender,
  hat: Hat,
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
  px(l,      7, pants);
  px(r2 + 2, 7, pants);
  px(l,      8, shoe);
  px(r2 + 2, 8, shoe);

  ctx.shadowBlur = 0;

  // ── Accessories ─────────────────────────────────────────────────────────────
  const headCx = ox + 2 * P; // center of head x
  const headTop = oy;        // top of head y

  if (hat === "star") {
    drawStar(ctx, headCx, headTop - 8, 9, 5, "#FFD700", "#FFA500");
  } else if (hat === "cap") {
    // Baseball cap brim
    ctx.fillStyle = gender === "boy" ? "#e74c3c" : "#e91e8c";
    ctx.fillRect(ox - 2, headTop + P, 4 * P + 4, P);
    // Cap top
    ctx.fillStyle = gender === "boy" ? "#c0392b" : "#c0186e";
    ctx.fillRect(ox + P, headTop - P, 2 * P, P + 2);
    // Cap button
    ctx.fillStyle = "#fff";
    ctx.fillRect(headCx, headTop - P - 2, 3, 3);
  } else if (hat === "bow") {
    // Bow tie on head
    ctx.fillStyle = "#ff69b4";
    // Left wing
    ctx.beginPath();
    ctx.moveTo(headCx - 10, headTop - 6);
    ctx.lineTo(headCx - 2,  headTop - 2);
    ctx.lineTo(headCx - 10, headTop + 2);
    ctx.closePath();
    ctx.fill();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(headCx + 10, headTop - 6);
    ctx.lineTo(headCx + 2,  headTop - 2);
    ctx.lineTo(headCx + 10, headTop + 2);
    ctx.closePath();
    ctx.fill();
    // Centre knot
    ctx.fillStyle = "#ff1493";
    ctx.beginPath();
    ctx.arc(headCx, headTop - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  outerR: number, points: number,
  fill: string, stroke: string,
) {
  const innerR = outerR * 0.45;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
