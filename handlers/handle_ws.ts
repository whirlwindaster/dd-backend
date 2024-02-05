import * as db from "../lib/db.ts";
import { Game } from "../game/game.ts";
import { parseMessage, wsSend } from "../lib/helpers.ts";
import { encode } from "../lib/id_cipher.ts";
import {
  GenericMessageToAPI,
  MessageSchemas,
  PlayerInfo,
} from "../lib/types.ts";
import {
  isSchema,
  isValidSchema,
  validate,
} from "https://deno.land/x/jtd@v0.1.0/mod.ts";

export const onOpen = (player_info: PlayerInfo, game: Game, ws: WebSocket) => {
  return () => {
    game.addPlayer(player_info, ws);

    const players: string[] = [];
    for (const [_, v] of game.players) {
      players.push(v.name);
    }
    
    wsSend(ws, {
      name: player_info.name,
      category: "check_in",
      game_code: encode(player_info.game_id),
      is_host: player_info.is_host,
      players: players,
      right_walls: game.board.right_walls,
      bottom_walls: game.board.bottom_walls,
      goals: game.board.goals,
    });
  };
};

export const onMessage = (uuid: string, game: Game) => {
  return (m: MessageEvent) => {
    const message = parseMessage(m);
    console.log(`message received: ${JSON.stringify(message)}`);
    // schema is validated but NOT values
    console.log(`isSchema: ${isSchema(message)} isValidSchema: ${isValidSchema(message)}}`)
    if (
      //!isSchema(message) || !isValidSchema(message) ||
      MessageSchemas.some((schema) => {
        validate(schema, message, { maxDepth: 3, maxErrors: 1 }).length > 0;
      })
    ) {
      return;
    }
    console.log("message accepted");
    game.gameEvent(uuid, message as GenericMessageToAPI);
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
