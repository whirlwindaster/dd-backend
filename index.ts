import { Application, Context, Router } from "oak/mod.ts";
import "$std/dotenv/load.ts";
import { get_ws, post_create, post_join } from "./handlers/handle_routes.ts";

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
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", () => {
  console.log(`Listening on dd-api.whirlwinda.st}`);
});

await app.listen({ port: 80 });
