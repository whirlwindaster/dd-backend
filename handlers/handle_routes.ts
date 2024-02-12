import * as db from '../lib/db.ts';
import { active_games, gameFactory } from '../game/game.ts';
import { onClose, onMessage, onOpen } from './handle_ws.ts';
import { toMilliseconds } from '../lib/helpers.ts';
import { Body } from 'oak/body.ts';
import {
    CreateRouteContext,
    GameInsert,
    JoinRouteContext,
    WSRouteContext,
} from '../lib/types.ts';
import { decode } from '../lib/id_cipher.ts';
import { logger } from '../index.ts';

async function unpackFields(body: Body): Promise<Record<string, string> | null> {
    let fields: Record<string, string> = {};
    const body_type = body.type();
    logger.debug(`unpacking body type ${body_type}`);
    switch (body_type) {
        case ('form'): {
            (await body.form()).forEach((k, v) => fields[k] = v);
            break;
        }
        case ('form-data'): {
            (await body.formData()).forEach((k: FormDataEntryValue, v) => {
                if (!(k instanceof File)) fields[k] = v;
            });
            break;
        }
        case ('json'): {
            fields = await body.json();
            break;
        }
        case ('text'): {
            fields = JSON.parse(await body.text());
            break;
        }
        default: {
            logger.warn(`rejecting body type ${body_type}`);
            return null;
        }
    }
    logger.debug(`got fields ${JSON.stringify(fields)}`);
    return fields;
}

export const get_ws = async (ctx: WSRouteContext) => {
    if (!ctx.isUpgradable) {
        ctx.response.status = 400;
        ctx.response.body = 'not upgradable';
        return;
    }

    const params: URLSearchParams = ctx.request.url.searchParams,
        uuid = params.get('uuid');
    if (!uuid) {
        ctx.response.status = 400;
        ctx.response.body = 'no uuid';
        return;
    }
    const player_info = await db.selectFromPlayer({
        column: 'uuid',
        equals: uuid,
    });
    if (player_info.length > 1) {
        ctx.response.status = 403;
        ctx.response.body = 'player already in game';
    }
    if (!player_info[0] || !(player_info[0].game_id)) {
        ctx.response.status = 403;
        ctx.response.body = 'player not found';
        return;
    }
    const game = active_games.get(player_info[0].game_id);
    if (!game) {
        ctx.response.status = 500;
        ctx.response.body = 'internal server error';
        return;
    }

    const ws = ctx.upgrade();
    ws.onopen = onOpen(player_info[0], game, ws);
    ws.onmessage = onMessage(player_info[0].uuid, game);
    ws.onclose = onClose(player_info[0], game);
};

export const post_create = async (ctx: CreateRouteContext) => {
    const fields = await unpackFields(ctx.request.body);
    if (fields === null) {
        ctx.response.status = 400;
        ctx.response.body = 'not supported';
        return;
    }

    const name = fields['name'];
    if (!name) {
        ctx.response.status = 400;
        ctx.response.body = 'no name';
        return;
    }

    const game_cfg: GameInsert = {
        num_rounds: parseInt(fields['num_rounds']) || undefined,
        board_setup_num: parseInt(fields['board_setup_num']) || undefined,
        pre_bid_timeout: toMilliseconds(parseInt(fields['pre_bid_timeout'])) || undefined,
        post_bid_timeout: toMilliseconds(parseInt(fields['post_bid_timeout'])) || undefined,
        demo_timeout: toMilliseconds(parseInt(fields['demo_timeout'])) || undefined,
    };

    try {
        // make game row first (player row needs a matching game_id)
        const game_info = (await db.insertIntoGame(game_cfg))[0],
            player_info = (await db.insertIntoPlayer({
                name: name,
                game_id: game_info.id,
                is_host: true,
            }))[0];

        gameFactory(player_info, game_info);

        ctx.response.status = 201;
        ctx.response.body = player_info.uuid;
    } catch (err) {
        logger.warn(err);
        ctx.response.status = 400;
        ctx.response.body = 'database error. check config fields';
    }
};

export const post_join = async (ctx: JoinRouteContext) => {
    const fields = await unpackFields(ctx.request.body);
    if (fields === null) {
        ctx.response.status = 400;
        ctx.response.body = 'not supported';
        return;
    }

    const name = fields['name'], game_id_encoded = fields['game_code'];

    if (!name || !game_id_encoded) {
        ctx.response.status = 400;
        ctx.response.body = `${name ? '' : 'no name '}${game_id_encoded ? '' : 'no game code'}`;
        return;
    }

    try {
        const uuid = (await db.insertIntoPlayer({
            name: name,
            game_id: decode(game_id_encoded)!,
            is_host: false,
        }))[0].uuid;

        ctx.response.status = 201;
        ctx.response.body = uuid;
    } catch (err) {
        logger.warn(err);
        ctx.response.status = 400;
        ctx.response.body = 'database error. name may be taken';
    }
};
