import * as db from "../lib/db.ts";
import { Game } from "../game/game.ts";
import { parseMessage, wsSend } from "../lib/helpers.ts";
import { encode } from "../lib/id_cipher.ts";
import { PlayerInfo } from "../lib/types.ts";

export const onOpen = (player_info: PlayerInfo, game: Game, ws: WebSocket) => {
  return () => {
    game.addPlayer(player_info, ws);

    wsSend(ws, {
      category: "game_code",
      game_code: encode(player_info.game_id),
    });

    if (player_info.is_host) {
      wsSend(ws, {
        category: "you_are_host",
      });
    }

    for (const message of game.board.message_template) {
      wsSend(ws, message);
    }
  };
};

export const onMessage = (uuid: string, game: Game) => {
  return (m: MessageEvent) => {
    const message = parseMessage(m);
    game.gameEvent(uuid, message);
  };
};

export const onClose = (player_info: PlayerInfo, game: Game) => {
  return async () => {
    try {
      await db.deleteFromPlayer(player_info.uuid);
    } catch (err) {
      console.log(err);
    }
    game.gameEvent(player_info.uuid, {
      category: "leave",
    });

    if (game.players.size === 0) {
      try {
        await db.deleteFromGame(player_info.game_id);
      } catch (err) {
        console.log(err);
      }
    }
  };
};
