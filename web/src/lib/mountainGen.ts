import { GameState } from "../types";
import { randomInRange } from "./canvas";

export function generateRocks(level: number, dt: number, state: GameState) {
  const rockSpawnRate = Math.max(0.5, 5 / level);
  state.rockSpawnTimer += dt;

  if (state.rockSpawnTimer >= rockSpawnRate) {
    state.rockSpawnTimer = 0;
    const rockX = randomInRange(0, state.cw);
    const rockSpeed = randomInRange(200, 400);

    state.rocks.push({ x: rockX, y: state.cameraY - state.ch, vy: rockSpeed });
  }
}

export function generateInitialPlatforms(cw: number, ch: number) {
  const platforms = [];
  for (let i = 0; i < 10; i++) {
    platforms.push({
      x: randomInRange(0, cw),
      y: ch - i * 100,
      type: "normal",
    });
  }
  return platforms;
}