export type Table = "game" | "player";

export type GameTableColumn = "id" | "time_started" | "num_rounds" | "time_created" | "board_setup_num" | "pre_bid_timeout" | "post_bid_timeout" | "demo_timeout";
export type PlayerTableColumn = "id" | "game_id" | "name" | "is_host" | "uuid";

export type GamePhase =  'join' | 'guess' | 'demonstrate' | 'cleanup' | 'end'

export interface PlayerInsertValues {
  name: string,
  game_id: number,
  is_host?: boolean
}

export interface GameInsertValues {
  num_rounds: number,
  board_setup_num: number,
  pre_bid_timeout: number,
  post_bid_timeout: number,
  demo_timeout: number;
}

export interface PlayerInfo extends PlayerInsertValues {
  uuid: string
}

export interface MessageToPlayer {
  category: "log" | "game_code" | "you_are_host" | "players_update",
  log?: string
  game_code?: string
  player_names?: string
}

export interface MessageToAPI {
  category: "start",
}

export interface GameState {
    phase: GamePhase
    round: number
    timer: number
}

export const DEFAULT: GameInsertValues = {
  num_rounds: 8,
  board_setup_num: 1,
  pre_bid_timeout: 300,
  post_bid_timeout: 60,
  demo_timeout: 30,
};