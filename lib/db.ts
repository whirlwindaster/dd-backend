import { createClient } from 'supabase';
import '$std/dotenv/load.ts';
import {
    Database,
    GameColumn,
    GameInfo,
    GameInsert,
    PlayerColumn,
    PlayerInfo,
    PlayerInsert,
} from './types.ts';
import { logger } from '../index.ts';
import { GameDBUpdate } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_KEY')!;
const supabase_client = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

export async function selectFromGame(
    where: { column: GameColumn; equals: string | number | boolean },
): Promise<GameInfo[]> {
    const { data, error } = await supabase_client
        .from('game')
        .select('*')
        .eq(where.column, where.equals);

    if (error) throw new Error(error.message);
    return data;
}

export async function selectFromPlayer(
    where: { column: PlayerColumn; equals: string | number | boolean },
): Promise<PlayerInfo[]> {
    const { data, error } = await supabase_client
        .from('player')
        .select('*')
        .eq(where.column, where.equals);

    if (error) throw new Error(error.message);
    return data;
}

export async function insertIntoGame(
    values: GameInsert,
): Promise<GameInfo[]> {
    const { data, error } = await supabase_client
        .from('game')
        .insert([
            values,
        ])
        .select();

    if (error) throw new Error(error.message);
    return data;
}

export async function insertIntoPlayer(
    values: PlayerInsert,
): Promise<PlayerInfo[]> {
    if (
        (await selectFromPlayer({ column: 'game_id', equals: values.game_id }))
            .some((e) => {
                e.name === values.name;
            })
    ) {
        throw new Error('duplicate names');
    }
    const { data, error } = await supabase_client
        .from('player')
        .insert([
            values,
        ])
        .select();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteFromGame(id: number) {
    const { error } = await supabase_client
        .from('game')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    logger.info(`deleted game ${id} from database`);
}

export async function deleteFromPlayer(uuid: string) {
    const { error } = await supabase_client
        .from('player')
        .delete()
        .eq('uuid', uuid);

    if (error) throw new Error(error.message);
    logger.info(`deleted player ${uuid} from database`);
}

export async function updateGame(id: number, update: GameDBUpdate) {
    if (update.id || update.board_setup_num) throw new Error('invalid update');

    const { data, error } = await supabase_client
        .from('game')
        .update(update)
        .eq('id', id)
        .select();

    if (error) throw new Error(error.message);
    return data;
}
