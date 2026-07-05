export interface Platform {
  x: number;
  y: number;
  width: number;
  type: "normal" | "ice" | "crumble" | "bounce";
  crumbleTimer: number;
  crumbled: boolean;
}

export interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  anim: number;
}

export interface Pickup {
  x: number;
  y: number;
  kind: "fizzy" | "medicine";
  collected: boolean;
  anim: number;
}

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type Gender = "boy" | "girl";
export type Screen = "home" | "character" | "levels" | "playing" | "dead";

export interface GameState {
  // Player
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  onGround: boolean;
  facing: boolean;
  jumpCount: number;
  lives: number;
  invincibleTimer: number;
  fizzyTimer: number;
  // Camera
  cameraY: number;
  // World
  platforms: Platform[];
  rocks: Rock[];
  coins: Coin[];
  pickups: Pickup[];
  particles: Particle[];
  snowflakes: Snowflake[];
  // Score
  score: number;
  coinsCollected: number;
  altitude: number;
  maxAltitude: number;
  rockSpawnTimer: number;
  rockSpawnInterval: number;
  // Animation
  legPhase: number;
  deathTimer: number;
  prevJump: boolean;
  // Touch
  touchLeft: boolean;
  touchRight: boolean;
  touchJump: boolean;
}
