import { serve } from "std/http/mod.ts";

function reqHandler(req: Request) {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response(null, { status: 501 });
  }
  const { socket: ws, response } = Deno.upgradeWebSocket(req);

  ws.onopen = () => {
    console.log("ws opened");
  };

  ws.onmessage = (m) => {
    console.log(m);
  };

  ws.onerror = (err) => {
    console.log(err);
  };

  ws.onclose = () => {
    console.log("ws closed");
  };

  return response;
}

serve(reqHandler, { port: 8020 });
