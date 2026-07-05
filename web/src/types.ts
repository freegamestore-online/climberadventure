export interface Platform {
  x: number;
  y: number;
  width: number;
  type: "normal" | "ice" | "crumble" | "bounce";
  crumbleTimer: number; // countdown after player lands
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

export interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
}

export interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
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

export type GamePhase = "menu" | "playing" | "dead";

export interface GameState {
  phase: GamePhase;
  // Player
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  onGround: boolean;
  facingRight: boolean;
  jumpCount: number;
  // Camera
  cameraY: number;
  // World
  platforms: Platform[];
  rocks: Rock[];
  particles: Particle[];
  snowflakes: Snowflake[];
  clouds: Cloud[];
  // Score / altitude
  score: number;
  maxAltitude: number;
  rockSpawnTimer: number;
  rockSpawnInterval: number;
  // Difficulty
  altitude: number; // increases as player climbs
  // Animation
  playerAnim: number;
  playerLegPhase: number;
  deathTimer: number;
  // Touch controls
  touchLeft: boolean;
  touchRight: boolean;
  touchJump: boolean;
}
