import { MessageToAPI, MessageToPlayer } from "./types.ts";

export function toMilliseconds(seconds: number) {
  return seconds * 1000;
}

export function toSeconds(milliseconds: number) {
  return milliseconds / 1000;
}

// we could make this take an array of messages in order to send multiple messages at once
export function wsSend(
  ws: WebSocket,
  message: MessageToPlayer | MessageToPlayer[],
) {
  if (ws.readyState !== 1) {
    return;
  }

  if (Array.isArray(message)) {
    for (const msg of message) {
      ws.send(JSON.stringify(msg));
    }
  } else {
    ws.send(JSON.stringify(message));
  }
}

export function parseMessage(msg: MessageEvent) {
  return JSON.parse(msg.data) as MessageToAPI;
}
