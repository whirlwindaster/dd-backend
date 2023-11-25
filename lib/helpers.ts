import { GenericMessageToPlayer } from "./types.ts";

export function toMilliseconds(seconds: number) {
  return seconds * 1000;
}

export function toSeconds(milliseconds: number) {
  return milliseconds / 1000;
}

export function wsSend(
  ws: WebSocket,
  message: GenericMessageToPlayer,
) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(JSON.stringify(message));
}

export function parseMessage(msg: MessageEvent) {
  return JSON.parse(msg.data);
}

export function shuffleArray<T>(arr: T[]) {
  // shuffles array in-place and returns it.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}
