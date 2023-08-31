export type Table = "game" | "player";

export interface GameCfg {
  num_rounds: number;
  board_setup_num: number;
  pre_bid_timeout: number;
  post_bid_timeout: number;
  demo_timeout: number;
}

export const DEFAULT: GameCfg = {
  num_rounds: 8,
  board_setup_num: 1,
  pre_bid_timeout: 300,
  post_bid_timeout: 60,
  demo_timeout: 30,
};

export const COOKIE_PREFIX = "DEFDRONES_";
