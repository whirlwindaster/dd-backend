import { get_ws, post_create, post_join } from "./handlers/handle_routes.ts";
import { Application, Router } from "oak/mod.ts";
import { oakCors } from "cors/mod.ts";
import * as log from "$std/log/mod.ts"
import "$std/dotenv/load.ts";

export const ws_uuid_map = new Map<WebSocket, string>();

log.setup({
  handlers: {
    console: new log.ConsoleHandler("DEBUG"),

    file: new log.RotatingFileHandler("INFO", {
      filename: './logs/log.txt',
      maxBytes: 1000000,
      maxBackupCount: 5,
      formatter: (record) => `${record.datetime.toUTCString()} ${record.level} ${record.msg}`
    })
  },
  
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console", "file"]
    }
  }
});

export const logger = log.getLogger();

const router = new Router();
router
  .get("/", (ctx) => {
    ctx.response.redirect("/er");
  })
  .get("/er", (ctx) => {
    ctx.response.body = "hi";
  })
  .get("/er/ws", get_ws)
  .post("/er/create", post_create)
  .post("/er/join", post_join);

const app = new Application();
app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", () => {
  console.log(`Listening on https://dd-api.whirlwinda.st}`);
});

await app.listen({ port: 443, secure: true, cert: Deno.readTextFileSync('./cert'), key: Deno.readTextFileSync('./key') });
