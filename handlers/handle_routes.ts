import * as db from "../lib/db.ts";
import { RouterContext } from "oak/mod.ts";
import { active_games, gameFactory } from "../game/game.ts";
import { onClose, onMessage, onOpen } from "./handle_ws.ts";
import { toMilliseconds } from "../lib/helpers.ts";
import { DEFAULT, GameInsert } from "../lib/types.ts";
import { decode } from "../lib/id_cipher.ts";

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

  console.log("upgrading to ws");
  const ws = ctx.upgrade();
  console.log("done");
  ws.onopen = onOpen(player_info, game, ws);
  ws.onmessage = onMessage(player_info.uuid, game);
  ws.onclose = onClose(player_info, game);
};

export const post_create = async (
  ctx: RouterContext<
    "/create",
    Record<string | number, string | undefined>,
    // deno-lint-ignore no-explicit-any
    Record<string, any>
  >,
) => {
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
      // TODO: this should not be my-interface-specific
      // give some success flag and let front end handle redirection
      `${ctx.request.headers.get("Referer")}er/game`,
    );
  } catch (error) {
    console.log(error);
    ctx.response.status = 400;
    ctx.response.body = error;
    ctx.response.redirect(`${ctx.request.headers.get("Referer")}`);
  }
};

export const post_join = async (
  ctx: RouterContext<
    "/join",
    Record<string | number, string | undefined>,
    // deno-lint-ignore no-explicit-any
    Record<string, any>
  >,
) => {
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
};
