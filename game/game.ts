import {
  Bid,
  Coordinate,
  Direction,
  GameInsert,
  GameState,
  GenericMessageToAPI,
  GenericMessageToPlayer,
  Goal,
  PlayerInfo,
  RobotColor,
  Stack,
} from "../lib/types.ts";
import { Player } from "./player.ts";
import Board from "./board.ts";
import { shuffleArray, toMilliseconds, toSeconds } from "../lib/helpers.ts";
import * as db from "../lib/db.ts";
import { logger } from "../index.ts";

export const active_games = new Map<number, Game>();

export function gameFactory(
  player_info: PlayerInfo,
  config: GameInsert,
): Game {
  if (!active_games.has(player_info.game_id)) {
    const game = new Game(player_info, config);
    active_games.set(player_info.game_id, game);
    logger.info(`created new game ${game.id}`);
  }
  return active_games.get(player_info.game_id)!;
}

export class Game {
  id: number;
  host_uuid: string;
  config: GameInsert;
  board: Board;
  players = new Map<string, Player>();
  bids = new Stack<Bid>();
  goalStack: Stack<Goal>;
  #state: GameState = {
    phase: "join",
    round: 0,
    timeout_id: setTimeout(async () => {
      logger.warn(`deleting idle game ${this.id}`);
      await this.delete()
    }, toMilliseconds(60 * 30)),
    goal: {
      color: "m",
      shape: "vortex",
      coord: {
        x: -1,
        y: -1,
      },
    },
    bid: {
      uuid: "",
      moves: 0,
      timestamp: 0,
    },
  };

  constructor(host_info: PlayerInfo, config: GameInsert) {
    this.id = host_info.game_id;
    this.host_uuid = host_info.uuid;
    this.config = config;
    this.board = new Board(config.board_setup_num);
    this.goalStack = new Stack<Goal>(shuffleArray(this.board.goals));
    // prefer to access players by uuid rather than name, id, etc
  }

  addPlayer(player_info: PlayerInfo, ws: WebSocket) {
    this.#sendToAllPlayers({
      category: "player_update",
      name: player_info.name,
      add: true,
    });
    this.players.set(player_info.uuid, new Player(player_info, ws));
  }

  async delete() {
    // players will be deleted when their game is deleted
    logger.info(`deleting game ${this.id}`);
    
    try {
      await db.deleteFromGame(this.id);
    } catch (err) {
      logger.warn(err);
    }

    clearTimeout(this.#state.timeout_id);

    this.#closeAllConnetions();

    active_games.delete(this.id);
  }

  async #deletePlayer(uuid: string) {
    try {
      await db.deleteFromPlayer(uuid);
    }
    catch (err) {
      logger.warn(err);
    }
    this.players.get(uuid)?.disconnect();
    this.players.delete(uuid);
  }

  #sendToAllPlayers(message: GenericMessageToPlayer) {
    this.players.forEach((p) => p.send(message));
  }

  #closeAllConnetions() {
    this.players.forEach((p) => p.disconnect);
  }

  //#################################################################################//
  // Section: Game Event Handlers                                                    //
  //#################################################################################//
  // PHILOSOPHY: the phase functions shall be able to run a complete game without outside intervention.
  setupRound() {
    if (this.#state.round >= this.config.num_rounds || this.players.size === 0 || this.goalStack.empty()) {
      this.endGame();
      return;
    }
    this.sendRobotPositions();
    this.board.saveRobotPositions();
    this.bids.clear();
    this.#state.round++;
    this.#state.goal = this.goalStack.pop()!;
    this.bidPhase();
    this.#sendToAllPlayers({
      category: "new_round",
      goal: this.#state.goal,
      log: `beginning round ${this.#state.round}`,
    });
  }
  bidPhase() {
    this.#state.phase = "bid";
    this.m_setTimeout(this.demoPhase.bind(this), this.config.pre_bid_timeout);
  }
  demoPhase() {
    this.board.resetRobotPositions();
    this.sendRobotPositions();
    if (this.bids.empty()) {
      this.#sendToAllPlayers({
        category: "log",
        log: "no points awarded this round.",
      });
      this.setupRound();
      return;
    }
    this.#state.phase = "demonstrate";
    this.#state.bid = this.bids.pop()!;
    this.#sendToAllPlayers({
      category: "demonstrator",
      name: this.players.get(this.#state.bid.uuid)!.name,
      moves: this.#state.bid.moves,
      log: `${
        this.players.get(this.#state.bid.uuid)!.name
      } demonstrating ${this.#state.bid.moves} moves`,
    });
    this.m_setTimeout(() => {
      if (this.players.has(this.#state.bid.uuid)) {
        this.players.get(this.#state.bid.uuid)!.score--;
      }
      this.#sendToAllPlayers({
        category: "score",
        name: this.players.get(this.#state.bid.uuid)?.name || "unknown",
        points: -1,
        log: `${
          this.players.get(this.#state.bid.uuid)?.name
        } failed the demonstration`,
      });
      this.demoPhase.bind(this)();
    }, this.config.demo_timeout);
  }
  endGame() {
    const winners = this.getWinners();
    switch (winners.length) {
      case 0: {
        logger.warn(`no players at end of game ${this.id}`);
        break;
      }
      case 1: {
        this.#sendToAllPlayers({
          category: "log",
          log: `${winners[0].name} wins with ${winners[0].score} point(s)!`,
        });
        break;
      }
      default: {
        this.#sendToAllPlayers({
          category: "log",
          log: `${winners.slice(0, -1).map((w) => w.name).join(", ")} and ${
            winners[winners.length - 1].name
          } tie for first with ${winners[0].score} point(s)!`,
        });
        break;
      }
    }
    this.delete();
  }

  gameEvent(from_uuid: string, message: GenericMessageToAPI) {
    switch (message.category) {
      case "chat": {
        if (
          message.msg.length > 200 || !this.players.has(from_uuid)
        ) {
          logger.info('rejecting chat message');
        }
        
        this.#sendToAllPlayers({
          category: "chat",
          name: this.players.get(from_uuid)?.name || "unknown",
          msg: message.msg,
        });
        break;
      }
      case "start": {
        if (this.#state.phase !== "join" || from_uuid !== this.host_uuid) {
          logger.warn(`rejecting start message: ${JSON.stringify(message)}`);
          return;
        }
        logger.info(`starting game ${this.id}`);

        clearTimeout(this.#state.timeout_id);
        this.#sendToAllPlayers({
          category: "start",
        });
        this.setupRound();
        break;
      }
      case "bid": {
        if (
          this.#state.phase !== "bid" || !this.players.has(from_uuid) ||
          this.bids.some((b) =>
            from_uuid === b.uuid && message.moves === b.moves
          )
        ) {
          logger.info(`rejecting bid: ${JSON.stringify(message)}`);
          return;
        }

        const new_bid: Bid = {
          uuid: from_uuid,
          moves: message.moves,
          timestamp: Date.now(),
        };
        this.bids.push(new_bid, (high, low) => high.moves < low.moves);
        this.#sendToAllPlayers({
          category: "bid",
          name: this.players.get(from_uuid)?.name || "unknown",
          moves: message.moves,
          log: `${
            this.players.get(from_uuid)?.name
          } bids ${message.moves} moves`,
        });

        if (this.bids.size() === 1) {
          this.m_setTimeout(
            this.demoPhase.bind(this),
            this.config.post_bid_timeout,
          );
        }
        break;
      }
      case "move": {
        if (
          this.#state.phase !== "demonstrate" ||
          from_uuid !== this.#state.bid.uuid
        ) {
          logger.warn("rejecting move");
          return;
        }

        this.m_moveRobot(message.robot, message.direction);
        this.#state.bid.moves--;
        if (this.#state.bid.moves < 1) {
          clearTimeout(this.#state.timeout_id);
          if (!this.board.isSolved(this.#state.goal)) {
            if (this.players.has(from_uuid)) {
              this.players.get(this.#state.bid.uuid)!.score--;
            }
            this.#sendToAllPlayers({
              category: "score",
              name: this.players.get(from_uuid)?.name || "unknown",
              points: -1,
              log: `${
                this.players.get(from_uuid)?.name
              } failed the demonstration`,
            });
            this.demoPhase();
            return;
          }

          if (this.players.has(from_uuid)) {
            this.players.get(this.#state.bid.uuid)!.score++;
          }
          this.#sendToAllPlayers({
            category: "score",
            name: this.players.get(from_uuid)?.name || "unknown",
            points: 1,
            log: `${this.players.get(from_uuid)?.name} wins this round!`,
          });
          this.setupRound();
        }
        break;
      }
      case "leave": {
        this.#sendToAllPlayers({
          category: "player_update",
          name: this.players.get(from_uuid)?.name || "",
          add: false,
        });
        this.#deletePlayer(from_uuid);
        break;
      }
    }
  }

  m_setTimeout(
    callback: () => void,
    time: number,
  ) {
    clearTimeout(this.#state.timeout_id);
    this.#state.timeout_id = setTimeout(callback, time);
    this.#sendToAllPlayers({
      category: "timer",
      seconds: toSeconds(time),
    });
  }

  m_moveRobot(color: RobotColor, direction: Direction) {
    const new_coord = this.board.moveRobot(color, direction);
    if (!new_coord) {
      return;
    }

    this.#sendToAllPlayers({
      category: "robot_update",
      robots: [[color, new_coord]],
    });
  }

  sendRobotPositions() {
    this.#sendToAllPlayers({
      category: "robot_update",
      robots: Object.entries(this.board.current_positions) as [
        RobotColor,
        Coordinate,
      ][],
    });
  }

  getWinners(): Player[] {
    const players_arr = [...this.players.values()];
    if (players_arr.length === 0) return [];

    let winners = [players_arr[0]];

    for (let i = 1; i < players_arr.length; i++) {
      if (players_arr[i].score > winners[0].score) {
        winners = [players_arr[i]];
      } else if (players_arr[i].score === winners[0].score) {
        winners.push(players_arr[i]);
      }
    }

    return winners;
  }
}
