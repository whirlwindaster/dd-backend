import { Application, Router } from "oak/mod.ts";
import * as db from "./lib/db.ts";
import { COOKIE_PREFIX, DEFAULT, PORT, GameCfg } from "./lib/types.ts";
import { decode, encode } from "./lib/id_cipher.ts";
import { toMilliseconds } from "./lib/helpers.ts";

const router = new Router();
router
  .get("/ws", async (ctx) => {
    if (!ctx.isUpgradable) {
      ctx.throw(501);
    }

    const ws = ctx.upgrade();
    ws.onopen = () => {
      console.log('ws opend');
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
    const game_cfg: GameCfg = {
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
      // make game first (player row needs a matching game_id)
      const game_id_decoded = (await db.insert("game", game_cfg, ["id"]))[0].id,
        uuid = (await db.insert("player", {
          name: name,
          game_id: game_id_decoded,
          is_host: true,
        }, ["uuid"]))[0].uuid;

      ctx.cookies.set(`${COOKIE_PREFIX}name`, name);
      ctx.cookies.set(`${COOKIE_PREFIX}uuid`, uuid.toString());
      ctx.response.status = 201;
      ctx.response.redirect(
        // styled url
        `${ctx.request.headers.get("Referer")}er/${encode(game_id_decoded)}`,
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
      const uuid = (await db.insert("player", {
        name: name,
        game_id: decode(game_id_encoded),
        is_host: false,
      }, ["uuid"]))[0].uuid;

      ctx.cookies.set(`${COOKIE_PREFIX}name`, name);
      ctx.cookies.set(`${COOKIE_PREFIX}uuid`, uuid.toString());
      ctx.response.status = 201;
      ctx.response.redirect(
        // styled url
        `${ctx.request.headers.get("Referer")}er/${game_id_encoded}`,
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
  console.log(`Listening on localhost:${PORT}`);
});

await app.listen({ port: PORT });
