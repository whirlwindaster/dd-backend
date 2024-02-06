import * as db from "../lib/db.ts";
import { RouterContext } from "oak/mod.ts";
import { active_games, gameFactory } from "../game/game.ts";
import { onClose, onMessage, onOpen } from "./handle_ws.ts";
import { toMilliseconds } from "../lib/helpers.ts";
import { DEFAULT_CONFIG, GameInsert } from "../lib/types.ts";
import { decode } from "../lib/id_cipher.ts";
import { cloneState } from "oak/structured_clone.ts";

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
  
  const params: URLSearchParams = await ctx.request.url.searchParams,
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
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "POST");
  
  const body = ctx.request.body();
  let fields: Record<string, string> = {};
  switch (body.type) {
    case ("form"): {
      for (const [k, v] of (await body.value).entries()) {
        fields[k] = v;
      }
      break;
    }
    case ("form-data"): {
      fields = (await (await body.value.read())).fields;
      break;
    }
    case ("json"): {
      fields = await body.value;
      break;
    }
    case ("text"): {
      fields = JSON.parse(await body.value);
      break;
    }
    default: {
      ctx.response.status = 400;
      ctx.response.body = "not supported"
      return;
    }
  }

  console.log(JSON.stringify(fields));
    const name = fields["name"];
  if (!name) {
    ctx.response.status = 400;
    ctx.response.body = "no name";
    return;
  }
  const game_cfg: GameInsert = {
    num_rounds: parseInt(fields["num_rounds"] || "") || DEFAULT_CONFIG.num_rounds,
    board_setup_num: parseInt(fields["board_setup_num"] || "") || DEFAULT_CONFIG.board_setup_num,
    pre_bid_timeout: toMilliseconds(parseInt(fields["pre_bid_timeout"] || "") || DEFAULT_CONFIG.pre_bid_timeout),
    post_bid_timeout: toMilliseconds(parseInt(fields["post_bid_timeout"] || "") || DEFAULT_CONFIG.post_bid_timeout),
    demo_timeout: toMilliseconds(parseInt(fields["demo_timeout"] || "") || DEFAULT_CONFIG.demo_timeout)
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
