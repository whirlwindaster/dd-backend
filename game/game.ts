import {
  Bid,
  Coordinate,
  GameInsertValues,
  GameState,
  MessageToAPI,
  MessageToPlayer,
  PlayerInfo,
  RobotColor,
  RobotPositions,
} from "../lib/types.ts";
import { Player } from "./player.ts";
import Board from "./board.ts";
import { toSeconds } from "../lib/helpers.ts";

export const active_games = new Map<number, Game>();

export function gameFactory(
  player_info: PlayerInfo,
  config: GameInsertValues,
): Game {
  if (!active_games.has(player_info.game_id)) {
    const game = new Game(player_info, config);
    active_games.set(player_info.game_id, game);
  }
  return active_games.get(player_info.game_id)!;
}

export class Game {
  id: number;
  host_uuid: string;
  config: GameInsertValues;
  board: Board;
  players = new Map<string, Player>();
  bids: Bid[] = [];
  #state: GameState = {
    phase: "join",
    round: 0,
    timeout: -1,
    interval: -1
  };

  constructor(host_info: PlayerInfo, config: GameInsertValues) {
    this.id = host_info.game_id;
    this.host_uuid = host_info.uuid;
    this.config = config;
    this.board = new Board(config.board_setup_num);
    // prefer to access players by uuid rather than name, id, etc
  }

  addPlayer(player_info: PlayerInfo, ws: WebSocket) {
    this.players.set(player_info.uuid, new Player(player_info, ws));
    let names = "";
    for (const value of this.players.values()) {
      // need to make & an invalid character
      names = `${names}${value.name}&`;
    }
    this.#sendToAllPlayers([{
      category: "players_update",
      player_names: names.substring(0, names.length - 1),
    }]);
  }

  deletePlayer(uuid: string) {
    this.players.delete(uuid);
  }

  #sendToAllPlayers(messages: MessageToPlayer[]) {
    this.players.forEach((p) => p.send(messages));
  }

  // from_uuid of "0" means from game
  gameEvent(from_uuid: string, message: MessageToAPI) {
    const preBidTimeoutHandler = () => {
      cleanAfterDemo(false);
    },
    postBidTimeoutHanlder = () => {
      this.#state.phase = "demonstrate"
      this.m_setTimeout(demoTimeoutHandler, this.config.demo_timeout);
      // TODO: message first demonstrator
    },
    demoTimeoutHandler = () => {
      cleanAfterDemo(false);
    },
    cleanAfterDemo = (could_be_solved: boolean) => {
      clearTimeout(this.#state.timeout);
      if (could_be_solved && this.board.isSolved()) {
        this.players.get(this.bids[0].uuid)!.score++;
        // TODO: message pts
        this.bids = [];
        this.board.goals.shift();
        this.board.saveRobotPositions();
        this.gameEvent("0", {
          category: "next_round"
        });
        return;
      }

      const old_robots = this.board.resetRobotPositions();
      let robot_color: keyof RobotPositions
      for (robot_color in old_robots) {
        this.#sendToAllPlayers([{
          category: "robot_pos",
          robot_color: robot_color,
          coord: this.board.current_positions[robot_color],
          old_coord: old_robots[robot_color]
        }]);
      }
      if (this.bids.length <= 1) {
        // TODO: message no pts
        this.bids = [];
        this.board.goals.shift();
        this.gameEvent("0", {
          category: "next_round"
        });
        return;
      }

      this.bids.shift();
      // TODO: message new demonstrator
      this.m_setTimeout(demoTimeoutHandler, this.config.demo_timeout);
    };

    switch (message.category) {
      case ("start"): {
        if (this.host_uuid !== from_uuid || this.#state.phase !== "join") {
          return;
        }

        this.board.shuffleGoals();
        let color: keyof RobotPositions
        for (color in this.board.current_positions) {
          this.#sendToAllPlayers([{
            category: "robot_pos",
            robot_color: color,
            coord: this.board.current_positions[color]
          }]);
        }
        this.#sendToAllPlayers([{
          category: "start"
        }])

        this.gameEvent("0", {
          category: "next_round"
        });
        break;
      }

      case ("next_round"): {
        if (from_uuid !== "0") {
          return;
        }

        // TODO: end game

        this.#state.phase = "bid";
        this.#state.round++;
        this.m_setTimeout(preBidTimeoutHandler, this.config.pre_bid_timeout);

        this.#sendToAllPlayers([{
          category: "current_goal",
          goal_color: this.board.goals[0].color,
          goal_shape: this.board.goals[0].shape
        }])
        break;
      }

      case ("bid"): {
        if (this.#state.phase !== "bid" || !message.num_moves || message.num_moves < 2) {
          return;
        }

        this.bids.unshift({
          uuid: from_uuid,
          moves: message.num_moves,
          timestamp: Date.now()
        });

        if (this.bids.length === 1) {
          clearTimeout(this.#state.timeout);
          this.m_setTimeout(postBidTimeoutHanlder, this.config.post_bid_timeout);
        }

        this.#sendToAllPlayers([{
          category: "bid",
          num_moves: message.num_moves,
          log: `${this.players.get(from_uuid)?.name} bids ${message.num_moves}`
        }]);
        // TODO: sort bids
        break;
      }

      case ("move"): {
        if (this.#state.phase !== "demonstrate" || from_uuid !== this.bids[0].uuid || this.bids[0].moves === 0 || !message.robot) {
          return;
        }

        const old_coord = this.board.current_positions[message.robot],
          new_coord = this.board.moveRobot(message.robot!, message.direction!);
        if (!new_coord) {
          return;
        }
        
        this.#sendToAllPlayers([{
          category: "robot_pos",
          robot_color: message.robot!,
          old_coord: old_coord,
          coord: new_coord, 
        }])

        this.bids[0].moves--;
        if (this.bids[0].moves === 0) {
          cleanAfterDemo(true);
        }
        break;
      }
    }
  }

  m_setTimeout(callback: () => void, time: number) {
    this.#state.timeout = setTimeout(callback, time);
    this.#sendToAllPlayers([{
      category: "timer",
      log: `timer set for ${toSeconds(time)}`
    }]);
  }
}
