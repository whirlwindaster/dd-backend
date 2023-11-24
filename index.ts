import { Application, Router } from "oak/mod.ts";
import "$std/dotenv/load.ts";
import { get_ws, post_create, post_join } from "./handlers/handle_routes.ts";

export const ws_uuid_map = new Map<WebSocket, string>();

const router = new Router();
router
  .get("/ws", get_ws)
  .post("/create", post_create)
  .post("/join", post_join);

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", () => {
  console.log(`Listening on localhost:${Deno.env.get("PORT")}`);
});

await app.listen({ port: parseInt(Deno.env.get("PORT")!) });
