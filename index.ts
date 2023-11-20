import { Application, Router } from "oak/mod.ts";
import * as db from "./lib/db.ts";
import { DEFAULT, GameInsert } from "./lib/types.ts";
import { decode, encode } from "./lib/id_cipher.ts";
import { parseMessage, toMilliseconds, wsSend } from "./lib/helpers.ts";
import "$std/dotenv/load.ts";
import { active_games, gameFactory } from "./game/game.ts";
import { get_ws } from "./handlers/handle_routes.ts";

export const ws_uuid_map = new Map<WebSocket, string>();

const router = new Router();
router
  .get("/ws", get_ws)
  .post("/create", async (ctx) => {
    const params: URLSearchParams = await ctx.request.body().value,
      name = params.get("name");
    if (!name) {
      ctx.response.status = 400;
      ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
      return;
    }
    const game_cfg: GameInsert = {
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
      const game_id_decoded = (await db.insertIntoGame(game_cfg))[0].id,
        player_info = (await db.insertIntoPlayer({
          name: name,
          game_id: game_id_decoded,
          is_host: true,
        }))[0];

      // TODO: do game instance stuff
      gameFactory(
        player_info,
        game_cfg,
      );
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}name`, name);
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}uuid`, player_info.uuid);
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
      !game_id_encoded
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
      }))[0].uuid;

      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}name`, name);
      ctx.cookies.set(`${Deno.env.get("COOKIE_PREFIX")}uuid`, uuid);
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
