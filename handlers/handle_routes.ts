import * as db from "../lib/db.ts";
import { RouterContext } from "oak/mod.ts";
import { active_games, Game } from "../game/game.ts";
import { parseMessage, wsSend } from "../lib/helpers.ts";
import { encode } from "../lib/id_cipher.ts";
import { PlayerInfo } from "../lib/types.ts";

export const get_ws = async (
  ctx: RouterContext<
    "/ws",
    Record<string | number, string | undefined>,
    // deno-lint-ignore no-explicit-any
    Record<string, any>
  >,
) => {
  if (!ctx.isUpgradable) {
    ctx.throw(501);
  }

  const name = await ctx.cookies.get(`${Deno.env.get("COOKIE_PREFIX")}name`),
    uuid = await ctx.cookies.get(`${Deno.env.get("COOKIE_PREFIX")}uuid`);
  if (!name || !uuid) {
    ctx.throw(400);
  }
  const player_info = (await db.selectFromPlayer({
    column: "uuid",
    equals: uuid,
  }))[0];
  if (!(player_info.game_id)) {
    ctx.throw(403);
  }
  const game = active_games.get(player_info.game_id);
  if (!game) {
    ctx.throw(500);
  }

  const ws = ctx.upgrade();
  ws.onopen = onOpen(player_info, game, ws);
  ws.onmessage = onMessage(player_info.uuid, game);
  ws.onclose = onClose(player_info, game);
};

const onOpen = (player_info: PlayerInfo, game: Game, ws: WebSocket) => {
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

    // TODO: add message templates so we don't have to do this loop for every new player
    for (const row of game.board.tiles) {
      for (const tile of row) {
        if (tile.bottom_wall || tile.right_wall) {
          wsSend(ws, {
            category: "wall_pos",
            bottom_wall: tile.bottom_wall,
            right_wall: tile.right_wall,
            coord: tile.coord,
          });
        }
        if (tile.goal) {
          wsSend(ws, {
            category: "goal_pos",
            goal_color: tile.goal.color,
            goal_shape: tile.goal.shape,
            coord: tile.coord,
          });
        }
      }
    }
  };
};

const onMessage = (uuid: string, game: Game) => {
  return (m: MessageEvent) => {
    const message = parseMessage(m);
    game.gameEvent(uuid, message);
  };
};
const onClose = (player_info: PlayerInfo, game: Game) => {
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
