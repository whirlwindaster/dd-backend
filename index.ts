import { Application, Router } from "oak/mod.ts";
import * as db from "./lib/db.ts";
import { DEFAULT, GameInsertValues } from "./lib/types.ts";
import { decode, encode } from "./lib/id_cipher.ts";
import { parseMessage, toMilliseconds, wsSend } from "./lib/helpers.ts";
import "$std/dotenv/load.ts";
import { active_games, gameFactory } from "./game/game.ts";
import { cookieMapHeadersInitSymbol } from "https://deno.land/std@0.188.0/http/cookie_map.ts";

export const ws_uuid_map = new Map<WebSocket, string>();

const router = new Router();
router
  .get("/ws", async (ctx) => {
    if (!ctx.isUpgradable) {
      ctx.throw(501);
    }

    const name = await ctx.cookies.get(`${Deno.env.get("COOKIE_PREFIX")}name`),
      uuid = await ctx.cookies.get(`${Deno.env.get("COOKIE_PREFIX")}uuid`);
    if (!(name && uuid)) {
      ctx.throw(400);
    }
    const player_info = await db.selectFromPlayer({
      column: "uuid",
      equals: uuid!,
    });
    if (!(player_info.game_id)) {
      ctx.throw(403);
    }
    const game = active_games.get(player_info.game_id);
    if (!game) {
      ctx.throw(500);
    }

    const ws = ctx.upgrade();
    ws.onopen = () => {
      game!.addPlayer({
        name: name!,
        uuid: uuid!,
        game_id: player_info.game_id,
      }, ws);

      wsSend(ws, [{
        category: "game_code",
        game_code: encode(player_info.game_id),
      }]);

      if (player_info.is_host) {
        wsSend(ws, [{
          category: "you_are_host",
        }]);
      }

      for (const row of game!.board.tiles) {
        for (const tile of row) {
          if (tile.bottom_wall || tile.right_wall) {
            wsSend(ws, [{
              category: "wall_pos",
              bottom_wall: tile.bottom_wall,
              right_wall: tile.right_wall,
              coord: tile.coord,
            }]);
          }
          if (tile.goal) {
            wsSend(ws, [{
              category: "goal_pos",
              goal_color: tile.goal.color, 
              goal_shape: tile.goal.shape,
              coord: tile.coord
            }]);
          }
        }
      }
    };
    ws.onmessage = (m) => {
      const message = parseMessage(m);
      game!.gameEvent(uuid!, message)
    };
    ws.onclose = async () => {
      try {
        await db.deleteFromPlayer(uuid!);
      }
      catch (err) {
        console.log(err);
      }
      game!.gameEvent(uuid!, {
        category: "leave"
      });

      if (!game) {
        try {
          await db.deleteFromGame(player_info.game_id);
        }
        catch (err) {
          console.log(err);
        }
      }
    }
  })
  .post("/create", async (ctx) => {
    const params: URLSearchParams = await ctx.request.body().value,
      name = params.get("name");
    if (!name || name.length === 0) {
      ctx.response.status = 400;
      ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
      return;
    }
    const game_cfg: GameInsertValues = {
      num_rounds: params.has("num_rounds")
        ? parseInt(params.get("num_rounds")!)
        : DEFAULT.num_rounds,
      board_setup_num: params.has("board_setup_num")
        ? parseInt(params.get("board_setup_num")!)
        : DEFAULT.board_setup_num,
      pre_bid_timeout: toMilliseconds(
        params.has("pre_bid_timeout")
          ? parseInt(params.get("pre_bid_timeout")!)
          : DEFAULT.pre_bid_timeout,
      ),
      post_bid_timeout: toMilliseconds(
        params.has("post_bid_timeout")
          ? parseInt(params.get("post_bid_timeout")!)
          : DEFAULT.post_bid_timeout,
      ),
      demo_timeout: toMilliseconds(
        params.has("pre_big_timeout")
          ? parseInt(params.get("pre_bid_timeout")!)
          : DEFAULT.demo_timeout,
      ),
    };

    try {
      // make game row first (player row needs a matching game_id)
      const game_id_decoded = (await db.insertIntoGame(game_cfg)).id,
        uuid = (await db.insertIntoPlayer({
          name: name,
          game_id: game_id_decoded,
          is_host: true,
        })).uuid;

      // TODO: do game instance stuff
      gameFactory(
        { name: name, game_id: game_id_decoded, uuid: uuid },
        game_cfg,
      );
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}name`, name);
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}uuid`, uuid.toString());
      ctx.response.status = 201;
      ctx.response.redirect(
        // styled url
        `${ctx.request.headers.get("Referer")}er/game`,
      );
    } catch (error) {
      console.log(error);
      ctx.response.status = 400;
      ctx.response.body = error;
      ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
    }
  })
  .post("/join", async (ctx) => {
    const params: URLSearchParams = await ctx.request.body().value,
      name = params.get("name"),
      game_id_encoded = params.get("game_code");
    if (
      !name ||
      !game_id_encoded ||
      name.length === 0 ||
      game_id_encoded.length === 0
    ) {
      ctx.response.status = 400;
      ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
      return;
    }

    try {
      const uuid = (await db.insertIntoPlayer({
        name: name,
        game_id: decode(game_id_encoded)!,
        is_host: false,
      })).uuid;

      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}name`, name);
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}uuid`, uuid.toString());
      ctx.response.status = 201;
      ctx.response.redirect(
        // styled url
        `${ctx.request.headers.get("Referer")}er/game`,
      );
    } catch (error) {
      console.log(error);
      ctx.response.status = 400;
      ctx.response.body = error;
      ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
    }
  });

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", () => {
  console.log(`Listening on localhost:${Deno.env.get("PORT")}`);
});

await app.listen({ port: parseInt(Deno.env.get("PORT")!) });
