import { get_ws, post_create, post_join } from "./handlers/handle_routes.ts";
import { toMilliseconds } from "./lib/helpers.ts";
import { Application, Router } from "oak/mod.ts";
import { oakCors } from "cors/mod.ts";
import * as log from "$std/log/mod.ts"
import "$std/dotenv/load.ts";

const logFileHandler = new log.RotatingFileHandler("INFO", {
  filename: './logs/log.txt',
  maxBytes: 1000000,
  maxBackupCount: 5,
  formatter: (record) => `${record.datetime.toUTCString()} ${record.levelName} ${record.msg}`
});
log.setup({
  handlers: {
    console: new log.ConsoleHandler("DEBUG"),
    
    file: logFileHandler
  },
  
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"]
    },
    "dev": {
      level: "DEBUG",
      handlers: ["console", "file"]
    },
    "prod": {
      level: "INFO",
      handlers: ["console", "file"]
    }
  }
});
export const logger = log.getLogger(Deno.env.get("ENVIRONMENT"));
setInterval(() => { logFileHandler.flush(); }, toMilliseconds(30));

export const ws_uuid_map = new Map<WebSocket, string>();

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
  logger.info(`Listening on https://dd-api.whirlwinda.st}`);
});

await app.listen({ port: 443, secure: true, cert: Deno.readTextFileSync(Deno.env.get("CERT_PATH") || ""), key: Deno.readTextFileSync(Deno.env.get("KEY_PATH") || "") });
