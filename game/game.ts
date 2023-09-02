import { KeyStack } from "oak/deps.ts";
import { GameInsertValues, GameState, MessageToPlayer, PlayerInfo } from "../lib/types.ts";
import { Player } from "./player.ts";

export const active_games = new Map<number, Game>();

export function gameFactory( player_info: PlayerInfo, config: GameInsertValues ): Game {
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
  players = new Map<string, Player>();
  state : GameState = {
    phase: 'join',
    round: 0,
    timer: -1
  };

  constructor(host_info: PlayerInfo, config: GameInsertValues) {
    this.id = host_info.game_id;
    this.host_uuid = host_info.uuid;
    this.config = config;
    // prefer to access players by uuid rather than name, id, etc
  }

  addPlayer(player_info: PlayerInfo, ws: WebSocket) {
    this.players.set(player_info.uuid, new Player(player_info, ws));
    let names = "";
    for (const value of this.players.values()) {
      // need to make & an invalid character
      names = `${names}${value.name}&`;
    }
    this.#sendToAllPlayers({
      category: "players_update",
      player_names: names.substring(0, names.length-1)
    });
  }

  #sendToAllPlayers(message: MessageToPlayer) {
    this.players.forEach((p) => p.send(message));
  }


}