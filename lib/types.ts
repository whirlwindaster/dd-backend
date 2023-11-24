export type GamePhase = "join" | "bid" | "demonstrate" | "end";

export type RobotColor = keyof RobotPositions; // "r" | "y" | "g" | "u" | "b"
export type GoalColor = "r" | "y" | "g" | "u" | "m";
export type GoalShape = "vortex" | "crescent" | "star" | "gear" | "planet";

export type Direction = "up" | "down" | "left" | "right";

export interface Coordinate {
  x: number;
  y: number;
}

export interface MessageToPlayer {
  category:
    | "log"
    | "game_code"
    | "you_are_host"
    | "players_update"
    | "wall_pos"
    | "goal_pos"
    | "robot_pos"
    | "start"
    | "bid"
    | "timer"
    | "current_goal"
    | "demonstrator"
    | "score"
    | "new_round";
  log?: string;
  game_code?: string;
  player_names?: string;
  bottom_wall?: boolean;
  right_wall?: boolean;
  goal_color?: GoalColor;
  goal_shape?: GoalShape;
  robot_color?: RobotColor;
  coord?: Coordinate;
  old_coord?: Coordinate;
  num_moves?: number;
  is_best_bid?: boolean;
  demonstrator?: string;
  scorer?: string;
  bidder?: string;
  seconds?: number;
  round?: number;
}

export interface MessageToAPI {
  category: "start" | "next_round" | "bid" | "move" | "leave";
  num_moves?: number;
  robot?: RobotColor;
  direction?: Direction;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  timeout_id: number;
  goal: Goal;
  bid: Bid;
}

export const DEFAULT = {
  num_rounds: 8,
  board_setup_num: 1,
  pre_bid_timeout: 300,
  post_bid_timeout: 60,
  demo_timeout: 30,
} as GameInfo;

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

export interface Bid {
  uuid: string;
  moves: number;
  timestamp: number;
}

export interface BoardSetup {
  tiles: Tile[][];
  goals: Goal[];
  messages: MessageToPlayer[];
}

export interface RobotPositions {
  r: Coordinate;
  y: Coordinate;
  g: Coordinate;
  u: Coordinate;
  b: Coordinate;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      game: {
        Row: {
          board_setup_num: number;
          demo_timeout: number;
          id: number;
          num_rounds: number;
          post_bid_timeout: number;
          pre_bid_timeout: number;
          time_created: string | null;
          time_started: string | null;
        };
        Insert: {
          board_setup_num: number;
          demo_timeout: number;
          id?: number;
          num_rounds: number;
          post_bid_timeout: number;
          pre_bid_timeout: number;
          time_created?: string | null;
          time_started?: string | null;
        };
        Update: {
          board_setup_num?: number;
          demo_timeout?: number;
          id?: number;
          num_rounds?: number;
          post_bid_timeout?: number;
          pre_bid_timeout?: number;
          time_created?: string | null;
          time_started?: string | null;
        };
        Relationships: [];
      };
      player: {
        Row: {
          game_id: number;
          id: number;
          is_host: boolean;
          name: string;
          uuid: string;
        };
        Insert: {
          game_id: number;
          id?: number;
          is_host?: boolean;
          name: string;
          uuid?: string;
        };
        Update: {
          game_id?: number;
          id?: number;
          is_host?: boolean;
          name?: string;
          uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "game";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type PlayerInfo = Database["public"]["Tables"]["player"]["Row"];
export type PlayerInsert = Database["public"]["Tables"]["player"]["Insert"];
export type PlayerColumn = keyof PlayerInfo;

export type GameInfo = Database["public"]["Tables"]["game"]["Row"];
export type GameInsert = Database["public"]["Tables"]["game"]["Insert"];
export type GameColumn = keyof GameInfo;

export class Stack<T> {
  #data: T[];

  constructor(arr?: T[]) {
    this.#data = arr ? arr : [];
  }

  push(value: T, sortCallback?: (lhs: T, rhs: T) => boolean) {
    this.#data.push(value);

    if (!sortCallback) {
      return;
    }

    for (let i = this.#data.length - 1; i > 0; i--) {
      if (sortCallback(this.#data[i], this.#data[i - 1])) {
        // keep element on top if true
        break;
      }
      const tmp = this.#data[i];
      this.#data[i] = this.#data[i - 1];
      this.#data[i - 1] = tmp;
    }
  }

  pop(): T | undefined {
    return this.#data.pop();
  }

  peek(): T {
    return this.#data[this.#data.length - 1];
  }

  clear() {
    this.#data = [];
  }

  size(): number {
    return this.#data.length;
  }

  empty(): boolean {
    return this.#data.length === 0;
  }

  some(callback: (e: T) => boolean): boolean {
    return this.#data.some(callback);
  }
}
