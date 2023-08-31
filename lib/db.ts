// deno-lint-ignore-file no-explicit-any
import { createClient } from "supabase";
import "$std/dotenv/load.ts";
import { Table } from "./types.ts";

const supabase_url = Deno.env.get("SUPABASE_URL")!;
const supabase_key = Deno.env.get("SUPABASE_KEY")!;
const supabase_client = createClient(supabase_url, supabase_key);

export async function select(
  table: Table,
  select_columns: string[],
  where: { column: string; equals: string | number | boolean },
) {
  let select_string = "";
  for (const col of select_columns) {
    select_string = `${select_string}${col},`;
  }

  const { data, error } = await supabase_client
    .from(`${table}`)
    .select(select_string)
    .eq(where.column, where.equals);

  if (error) throw new Error(error.message);
  return data;
}

export async function insert(
  table: Table,
  values: any,
  select_columns?: string[],
) {
  if (select_columns) {
    let select_string = "";
    for (const col of select_columns) {
      select_string = `${select_string}${col},`;
    }
    select_string = select_string.substring(0, select_string.length - 1);

    const { data, error } = await supabase_client
      .from(`${table}`)
      .insert([
        values,
      ])
      .select(select_string);

    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase_client
    .from(`${table}`)
    .insert([
      values,
    ])
    .select();

  if (error) throw new Error(error.message);
  return data;
}
