import { assert } from "$std/_util/asserts.ts";
import { decode, encode } from "../lib/id_cipher.ts";

function testEncodeDecode() {
  const num = Math.floor(Math.random() * 10);
  assert(num === decode(encode(num)));
}
