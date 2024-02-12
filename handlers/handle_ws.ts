import { Game } from '../game/game.ts';
import { parseMessage, wsSend } from '../lib/helpers.ts';
import { encode } from '../lib/id_cipher.ts';
import { GenericMessageToAPI, MessageToAPISchemas, PlayerInfo } from '../lib/types.ts';
import { logger } from '../index.ts';

export const onOpen = (player_info: PlayerInfo, game: Game, ws: WebSocket) => {
    return () => {
        logger.info(`player ${player_info.name} joined game ${game.id}`);
        game.addPlayer(player_info, ws);

        wsSend(ws, {
            name: player_info.name,
            category: 'check_in',
            game_config: {
                num_rounds: game.config.num_rounds,
                pre_bid_timeout: game.config.pre_bid_timeout,
                post_bid_timeout: game.config.post_bid_timeout,
                demo_timeout: game.config.demo_timeout,
            },
            game_code: encode(player_info.game_id),
            is_host: player_info.is_host,
            players: Array.from(game.players.values(), (player) => [player.name, player.score]),
            right_walls: game.board.right_walls,
            bottom_walls: game.board.bottom_walls,
            goals: game.board.goals,
        });
    };
};

export const onMessage = (uuid: string, game: Game) => {
    return (m: MessageEvent) => {
        const message = parseMessage(m);
        if (!(MessageToAPISchemas.some((schema) => schema.safeParse(message).success))) {
            logger.warn('message failed schema check');
            return;
        }
        game.gameEvent(uuid, message as GenericMessageToAPI);
    };
};

export const onClose = (player_info: PlayerInfo, game: Game) => {
    return () => {
        logger.info(`player ${player_info.name} left game ${game.id}`);
        game.gameEvent(player_info.uuid, {
            category: 'leave',
        });
    };
};
