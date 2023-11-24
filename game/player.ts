import { wsSend } from "../lib/helpers.ts";
import { MessageToPlayer, PlayerInfo } from "../lib/types.ts";

export class Player {
  name: string;
  game_id: number;
  uuid: string;
  #ws: WebSocket;
  score = 0;

  constructor(player_info: PlayerInfo, ws: WebSocket) {
    this.name = player_info.name;
    this.game_id = player_info.game_id;
    this.uuid = player_info.uuid;
    this.#ws = ws;
  }

  send(message: MessageToPlayer) {
    wsSend(this.#ws, message);
  }

  disconnect() {
    this.#ws.close();
  }
}
