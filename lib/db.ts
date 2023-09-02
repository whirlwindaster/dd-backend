// deno-lint-ignore-file no-explicit-any
// TODO: fix types here. i know you can do it
import { createClient } from "supabase";
import "$std/dotenv/load.ts";
import { Table, GameTableColumn, PlayerTableColumn, GameInsertValues, PlayerInsertValues } from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY")!;
const supabase_client = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function selectFromGame(
  where: { column: GameTableColumn; equals: string | number | boolean }
) {
  const { data, error } = await supabase_client
    .from("game")
    .select()
    .eq(where.column, where.equals);

  if (error) throw new Error(error.message);
  return data[0];
}

export async function selectFromPlayer(
  where: { column: PlayerTableColumn; equals: string | number | boolean }
) {
  const { data, error } = await supabase_client
    .from("player")
    .select()
    .eq(where.column, where.equals);

  if (error) throw new Error(error.message);
  return data[0];
}

export async function insertIntoGame(
  values: GameInsertValues
) {
  const { data, error } = await supabase_client
    .from("game")
    .insert([
      values,
    ])
    .select();

  if (error) throw new Error(error.message);
  return data[0];
}

export async function insertIntoPlayer(
  values: PlayerInsertValues
) {
  const { data, error } = await supabase_client
    .from("player")
    .insert([
      values,
    ])
    .select();

  if (error) throw new Error(error.message);
  return data[0];
}
