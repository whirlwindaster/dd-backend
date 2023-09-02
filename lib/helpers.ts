import { MessageToAPI, MessageToPlayer } from "./types.ts";

export function toMilliseconds(seconds: number) {
  return seconds * 1000;
}

export function toSeconds(milliseconds: number) {
  return milliseconds / 1000;
}

export function wsSend(ws: WebSocket, message: MessageToPlayer) {
  if (ws.readyState !== 1) {
    return;
  }
  ws.send(JSON.stringify(message));
}

export function parseMessage(msg: MessageEvent) {
  return JSON.parse(msg.data) as MessageToAPI;
}