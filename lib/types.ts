export type Table = "game" | "player";

export type GameTableColumn =
  | "id"
  | "time_started"
  | "num_rounds"
  | "time_created"
  | "board_setup_num"
  | "pre_bid_timeout"
  | "post_bid_timeout"
  | "demo_timeout";
export type PlayerTableColumn = "id" | "game_id" | "name" | "is_host" | "uuid";

export type GamePhase = "join" | "guess" | "demonstrate" | "cleanup" | "end";

export type RobotColor = keyof RobotPositions; // "r" | "y" | "g" | "u" | "b"
export type GoalColor = "r" | "y" | "g" | "u" | "m";
export type GoalShape = "vortex" | "crescent" | "star" | "gear" | "planet";

export type Direction = "up" | "down" | "left" | "right";

export interface Coordinate {
  x: number;
  y: number;
}

export interface PlayerInsertValues {
  name: string;
  game_id: number;
  is_host?: boolean;
}

export interface GameInsertValues {
  num_rounds: number;
  board_setup_num: number;
  pre_bid_timeout: number;
  post_bid_timeout: number;
  demo_timeout: number;
}

export interface PlayerInfo extends PlayerInsertValues {
  uuid: string;
}

export interface MessageToPlayer {
  category:
    | "log"
    | "game_code"
    | "you_are_host"
    | "players_update"
    | "wall_pos"
    | "goal_pos"
    | "robot_pos";
  log?: string;
  game_code?: string;
  player_names?: string;
  bottom_wall?: boolean;
  right_wall?: boolean;
  goal_specs?: GoalSpecs;
  robot_color?: RobotColor | "";
  coord?: Coordinate;
  old_coord?: Coordinate;
}

export interface GoalSpecs {
  color: GoalColor | "";
  shape: GoalShape | "";
}

export interface MessageToAPI {
  category: "start";
}

export interface GameState {
  phase: GamePhase;
  round: number;
  timer: number;
}

export const DEFAULT: GameInsertValues = {
  num_rounds: 8,
  board_setup_num: 1,
  pre_bid_timeout: 300,
  post_bid_timeout: 60,
  demo_timeout: 30,
};

export interface Goal {
  color: GoalColor;
  shape: GoalShape;
  coord: Coordinate;
}

export interface Tile {
  right_wall: boolean;
  bottom_wall: boolean;
  robot: RobotColor | null;
  goal: Goal | null;
  coord: Coordinate;
}

export interface Guess {
  uuid: string;
  moves: number;
  timestamp: number;
}

export interface BoardSetup {
  tiles: Tile[][];
  goals: Goal[];
}

export interface RobotPositions {
  r: Coordinate;
  y: Coordinate;
  g: Coordinate;
  u: Coordinate;
  b: Coordinate;
}
