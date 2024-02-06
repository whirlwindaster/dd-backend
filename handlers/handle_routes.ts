import * as db from "../lib/db.ts";
import { RouterContext } from "oak/mod.ts";
import { active_games, gameFactory } from "../game/game.ts";
import { onClose, onMessage, onOpen } from "./handle_ws.ts";
import { toMilliseconds } from "../lib/helpers.ts";
import { DEFAULT_CONFIG, GameInsert } from "../lib/types.ts";
import { decode } from "../lib/id_cipher.ts";

export const get_ws = async (
  ctx: RouterContext<
    "/ws",
    Record<string | number, string | undefined>,
    // deno-lint-ignore no-explicit-any
    Record<string, any>
  >,
) => {
  // TODO this error handling is so dogshit lmao
  if (!ctx.isUpgradable) {
    ctx.response.status = 400;
    ctx.response.body = "not upgradable";
    return;
  }

  // TODO these need to come from params of request
  
  const params: URLSearchParams = await ctx.request.body().value,
    name = params.get("name"),
    uuid = params.get("uuid");
  if (!name || !uuid) {
    ctx.response.status = 400;
    ctx.response.body = `${name ? "" : "no name "}${uuid ? "" : "no uuid"}`;
    return;
  }
  const player_info = (await db.selectFromPlayer({
    column: "uuid",
    equals: uuid,
  }))[0];
  if (!player_info || !(player_info.game_id)) {
    ctx.response.status = 403;
    ctx.response.body = "player not found";
    return;
  }
  const game = active_games.get(player_info.game_id);
  if (!game) {
    ctx.response.status = 500;
    ctx.response.body = "internal server error";
    return;
  }

  const ws = ctx.upgrade();
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
  const params = (await (await ctx.request.body({ type: "form-data" })).value.read()).fields;

  console.log(JSON.stringify(params));
    const name = params["name"];
  if (!name) {
    ctx.response.status = 400;
    ctx.response.body = "no name";
    return;
  }
  const game_cfg: GameInsert = {
    num_rounds: parseInt(params["num_rounds"] || "") || DEFAULT_CONFIG.num_rounds,
    board_setup_num: parseInt(params["board_setup_num"] || "") || DEFAULT_CONFIG.board_setup_num,
    pre_bid_timeout: toMilliseconds(parseInt(params["pre_bid_timeout"] || "") || DEFAULT_CONFIG.pre_bid_timeout),
    post_bid_timeout: toMilliseconds(parseInt(params["post_bid_timeout"] || "") || DEFAULT_CONFIG.post_bid_timeout),
    demo_timeout: toMilliseconds(parseInt(params["demo_timeout"] || "") || DEFAULT_CONFIG.demo_timeout)
  };

  console.log(`game insert: ${JSON.stringify(game_cfg)}`);

  try {
    // make game row first (player row needs a matching game_id)
    const game_id_decoded = (await db.insertIntoGame(game_cfg))[0].id,
      player_info = (await db.insertIntoPlayer({
        name: name,
        game_id: game_id_decoded,
        is_host: true,
      }))[0];

    gameFactory(
      player_info,
      game_cfg,
    );
    ctx.response.status = 201;
    ctx.response.body = player_info.uuid;
  } catch (error) {
    console.log(error);
    ctx.response.status = 400;
    ctx.response.body = error;
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
    ctx.response.body = `${name? "" : "no name "}${game_id_encoded? "" : "no game code"}`
    return;
  }

  try {
    const uuid = (await db.insertIntoPlayer({
      name: name,
      game_id: decode(game_id_encoded)!,
      is_host: false,
    }))[0].uuid;

    // TODO no cookies
    ctx.response.status = 201;
    ctx.response.body = uuid;
  } catch (error) {
    console.log(error);
    ctx.response.status = 400;
    ctx.response.body = error;
  }
};
