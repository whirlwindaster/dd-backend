import {
  Bid,
  Direction,
  GameInfo,
  GameInsert,
  GameState,
  Goal,
  MessageToAPI,
  MessageToPlayer,
  PlayerInfo,
  RobotColor,
  RobotPositions,
  Stack,
} from "../lib/types.ts";
import { Player } from "./player.ts";
import Board from "./board.ts";
import { shuffleArray, toSeconds } from "../lib/helpers.ts";
import * as db from "../lib/db.ts";

export const active_games = new Map<number, Game>();

export function gameFactory(
  player_info: PlayerInfo,
  config: GameInsert,
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
  config: GameInsert;
  board: Board;
  players = new Map<string, Player>();
  bids = new Stack<Bid>();
  goalStack: Stack<Goal>;
  #state: GameState = {
    phase: "join",
    round: 0,
    timeout_id: 0,
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

  // TODO: implement players as set
  addPlayer(player_info: PlayerInfo, ws: WebSocket) {
    this.players.set(player_info.uuid, new Player(player_info, ws));
    let names = "";
    for (const value of this.players.values()) {
      // this is a really stupid way to implement this lmfao
      // need to make & an invalid character
      names = `${names}${value.name}&`;
    }
    this.#sendToAllPlayers({
      category: "players_update",
      player_names: names.substring(0, names.length - 1),
    });
  }

  deletePlayer(uuid: string) {
    this.players.delete(uuid);
  }

  #sendToAllPlayers(message: MessageToPlayer) {
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
    if (this.#state.round >= this.config.num_rounds || this.goalStack.empty()) {
      this.endGame();
      return;
    }
    this.board.saveRobotPositions();
    this.bids.clear();
    this.#state.round++;
    this.#state.goal = this.goalStack.pop()!;
    this.bidPhase();
    this.#sendToAllPlayers({
      category: "current_goal",
      goal_color: this.#state.goal.color,
      goal_shape: this.#state.goal.shape,
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
    this.players.get(this.#state.bid.uuid)?.send({
      category: "demonstrator",
      demonstrator: this.players.get(this.#state.bid.uuid)?.name,
      log: `${
        this.players.get(this.#state.bid.uuid)?.name
      } demonstrating ${this.#state.bid.moves} moves`,
    });
    this.m_setTimeout(this.demoPhase.bind(this), this.config.demo_timeout);
  }
  endGame() {
    const winners = this.getWinners();
    switch (winners.length) {
      case 0: {
        this.#sendToAllPlayers({
          category: "log",
          log: "where did everyone go?",
        });
        break;
      }
      case 1: {
        this.#sendToAllPlayers({
          category: "log",
          log: `${winners[0].name} wins with ${winners[0].score} point(s)!`,
        });
        break;
      }
      default:
        {
          this.#sendToAllPlayers({
            category: "log",
            log: `${winners.slice(0, -1).join(", ")}, and ${
              winners[winners.length - 1]
            } tie for first with ${winners[0].score} point(s)!}`,
          });
        }
        this.#closeAllConnetions();
    }
  }

  gameEvent(from_uuid: string, message: MessageToAPI) {
    switch (message.category) {
      case "start": {
        if (this.#state.phase !== "join" || from_uuid !== this.host_uuid) {
          return;
        }
        this.sendRobotPositions();
        this.#sendToAllPlayers({
          category: "start",
        });
        this.setupRound();
        break;
      }
      case "bid": {
        if (
          this.#state.phase !== "bid" || !this.players.has(from_uuid) ||
          !message.num_moves || message.num_moves < 2
        ) {
          return;
        }

        const new_bid: Bid = {
          uuid: from_uuid,
          moves: message.num_moves,
          timestamp: Date.now(),
        };
        this.bids.push(new_bid);
        this.#sendToAllPlayers({
          category: "bid",
          bidder: this.players.get(from_uuid)?.name,
          num_moves: message.num_moves,
          log: `${
            this.players.get(from_uuid)?.name
          } bids ${message.num_moves} moves`,
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
          from_uuid !== this.#state.bid.uuid || !message.robot ||
          !message.direction
        ) {
          return;
        }

        this.m_moveRobot(message.robot, message.direction);
        this.#state.bid.moves--;
        if (this.#state.bid.moves < 1) {
          clearTimeout(this.#state.timeout_id);
          if (!this.board.isSolved()) {
            this.demoPhase();
            return;
          }
          this.#sendToAllPlayers({
            category: "score",
            scorer: this.players.get(from_uuid)?.name,
            log: `${this.players.get(from_uuid)?.name} wins this round!`,
          });
          this.setupRound();
        }
        break;
      }
      case "leave": {
        this.players.delete(from_uuid);
        if (!this.players.size) {
          active_games.delete(this.id);
        }
        break;
      }
    }
  }

  /*
  gotoNextRound(message?: MessageToPlayer) {
    if (message) {
      this.#sendToAllPlayers([message]);
    }
    this.gameEvent("0", {
      category: "next_round",
    });
  }

  failedDemoHandler = () => {
    const old_robots = this.board.resetRobotPositions();
    let robot_color: keyof RobotPositions;
    for (robot_color in old_robots) {
      this.#sendToAllPlayers([{
        category: "robot_pos",
        robot_color: robot_color,
        coord: this.board.current_positions[robot_color],
        old_coord: old_robots[robot_color],
      }]);
    }
  };
  preBidTimeoutHandler = () => {
    this.cleanAfterDemo(false);
  };
  postBidTimeoutHanlder = () => {
    this.#state.phase = "demonstrate";
    this.m_setTimeout(this.demoTimeoutHandler, this.config.demo_timeout);
    this.#sendToAllPlayers([{
      category: "log",
      log: `${this.players.get(this.bids.peek().uuid)
        ?.name!} demonstrating ${this.bids.peek().moves} moves`,
    }]);
    this.players.get(this.bids.peek().uuid)?.send([{
      category: "demonstrator",
      is_demonstrator: true,
    }]);
  };
  demoTimeoutHandler = () => {
    this.cleanAfterDemo(false);
  };
  cleanAfterDemo = (could_be_solved: boolean) => {
    clearTimeout(this.#state.timeout);
    if (could_be_solved && this.board.isSolved()) {
      this.players.get(this.bids.peek().uuid)!.score++;
      this.#sendToAllPlayers([{
        category: "new_round",
        round: this.#state.round + 1,
      }, {
        category: "score",
        scorer: this.players.get(this.bids.peek().uuid)?.name!,
        log: `${this.players.get(this.bids.peek().uuid)
          ?.name!} wins this round`,
      }]);
      this.bids.clear();
      this.board.saveRobotPositions();
      this.gameEvent("0", {
        category: "next_round",
      });
      return;
    }

    const old_robots = this.board.resetRobotPositions();
    let robot_color: keyof RobotPositions;
    for (robot_color in old_robots) {
      this.#sendToAllPlayers([{
        category: "robot_pos",
        robot_color: robot_color,
        coord: this.board.current_positions[robot_color],
        old_coord: old_robots[robot_color],
      }]);
    }
    if (this.bids.size() <= 1) {
      this.#sendToAllPlayers([{
        category: "new_round",
        round: this.#state.round + 1,
      }, {
        category: "log",
        log: "no players win this round",
      }]);
      this.bids.clear();
      this.gameEvent("0", {
        category: "next_round",
      });
      return;
    }

    this.bids.pop();

    this.#sendToAllPlayers([{
      category: "log",
      log: `${this.players.get(this.bids.peek().uuid)
        ?.name!} demonstrating ${this.bids.peek().moves} moves`,
    }, {
      category: "demonstrator",
      is_demonstrator: false,
    }]);
    this.players.get(this.bids.peek().uuid)?.send([{
      category: "demonstrator",
      is_demonstrator: true,
    }]);
    this.m_setTimeout(this.demoTimeoutHandler, this.config.demo_timeout);
  };

  // from_uuid of "0" means from game
  gameEvent(from_uuid: string, message: MessageToAPI) {
    switch (message.category) {
      case ("start"): {
        if (this.host_uuid !== from_uuid || this.#state.phase !== "join") {
          return;
        }

        let color: keyof RobotPositions;
        for (color in this.board.current_positions) {
          this.#sendToAllPlayers([{
            category: "robot_pos",
            robot_color: color,
            coord: this.board.current_positions[color],
          }]);
        }
        this.#sendToAllPlayers([{
          category: "start",
        }]);

        this.gameEvent("0", {
          category: "next_round",
        });
        break;
      }

      case ("next_round"): {
        if (from_uuid !== "0") {
          return;
        }

        if (this.#state.round === this.config.num_rounds) {
          const winner = this.getWinner();
          this.#sendToAllPlayers([{
            category: "log",
            log: `${winner.name} wins with ${winner.score} points!`,
          }]);
          this.#closeAllConnetions();
          active_games.delete(this.id);
          db.deleteFromGame(this.id);
          return;
        }

        this.#state.phase = "bid";
        this.#state.round++;
        this.m_setTimeout(
          this.preBidTimeoutHandler,
          this.config.pre_bid_timeout,
        );

        const new_goal = this.goalStack.pop()!;
        this.#sendToAllPlayers([{
          category: "current_goal",
          goal_color: new_goal.color,
          goal_shape: new_goal.shape,
        }]);
        break;
      }

      case ("bid"): {
        if (
          this.#state.phase !== "bid" || !message.num_moves ||
          message.num_moves < 2 || this.bids.some((e) => {
            return e.uuid === from_uuid && e.moves === message.num_moves;
          })
        ) {
          return;
        }

        const new_bid: Bid = {
          uuid: from_uuid,
          moves: message.num_moves,
          timestamp: Date.now(),
        };

        this.bids.push(new_bid, (lhs, rhs) => {
          return lhs.moves <= rhs.moves;
        });

        if (this.bids.size() === 1) {
          clearTimeout(this.#state.timeout);
          this.m_setTimeout(
            this.postBidTimeoutHanlder,
            this.config.post_bid_timeout,
          );
        }

        this.#sendToAllPlayers([{
          category: "bid",
          bidder: this.players.get(from_uuid)?.name,
          num_moves: message.num_moves,
          log: `${this.players.get(from_uuid)?.name} bids ${message.num_moves}`,
          is_best_bid: this.bids.peek() === new_bid,
        }]);
        break;
      }

      case ("move"): {
        if (
          this.#state.phase !== "demonstrate" ||
          from_uuid !== this.bids.peek().uuid || this.bids.peek().moves === 0 ||
          !message.robot
        ) {
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
        }]);

        this.bids.peek().moves--;
        if (this.bids.peek().moves === 0) {
          this.cleanAfterDemo(true);
        }
        break;
      }

      case "leave": {
        this.players.delete(from_uuid);
        if (this.players.size === 0) {
          active_games.delete(this.id);
        }
      }
    }
  }

  */
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
      category: "robot_pos",
      robot_color: color,
      coord: new_coord,
    });
  }

  sendRobotPositions() {
    let color: keyof RobotPositions;
    for (color in this.board.current_positions) {
      this.#sendToAllPlayers({
        category: "robot_pos",
        robot_color: color,
        coord: this.board.current_positions[color],
      });
    }
  }

  getWinners(): Player[] {
    const players_arr = [...this.players.values()];
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
