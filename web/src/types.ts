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
  bobOffset: number;
}

export interface Pickup {
  x: number;
  y: number;
  kind: "fizzy" | "medicine";
  collected: boolean;
  bobOffset: number;
}

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
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
  facingRight: boolean;
  jumpCount: number;
  lives: number;
  invincibleTimer: number;
  // Power-ups
  fizzyTimer: number;   // jump boost active
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
  coins_collected: number;
  maxAltitude: number;
  rockSpawnTimer: number;
  rockSpawnInterval: number;
  altitude: number;
  // Animation
  playerLegPhase: number;
  deathTimer: number;
  // Touch
  touchLeft: boolean;
  touchRight: boolean;
  touchJump: boolean;
}
