// Inworld Realtime Speech-to-Speech WebSocket proxy
// Browser <-> this edge function (WS) <-> Inworld Realtime API (WS)
// INWORLD_API_KEY stays safe on the server.
// Uses npm:ws because Deno's native WebSocket constructor cannot set custom headers.

import WS from "npm:ws@8.18.0";

Deno.serve((req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const INWORLD_API_KEY = Deno.env.get("INWORLD_API_KEY");
  if (!INWORLD_API_KEY) {
    return new Response("INWORLD_API_KEY not configured", { status: 500 });
  }

  const { socket: browser, response } = Deno.upgradeWebSocket(req);

  const sessionId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inworldUrl = `wss://api.inworld.ai/api/v1/realtime/session?key=${sessionId}&protocol=realtime`;

  const SESSION_CFG = JSON.stringify({
    type: "session.update",
    session: {
      instructions:
        "Jsi přátelský AI hlasový asistent pro dětskou sociální síť Kamosféra. Odpovídej česky, krátce, mile a bezpečně pro děti. Používej přirozený konverzační tón.",
    },
  });

  const GREET = JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Pozdrav uživatele krátce česky." }],
    },
  });

  let api: WS | null = null;
  let setup = 0;
  const pending: string[] = [];

  const connectInworld = () => {
    api = new WS(inworldUrl, {
      headers: { Authorization: `Basic ${INWORLD_API_KEY}` },
    });

    api.on("open", () => {
      console.log("Connected to Inworld");
      while (pending.length && api && api.readyState === WS.OPEN) {
        api.send(pending.shift()!);
      }
    });

    api.on("message", (raw: Uint8Array | string) => {
      const data = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      if (setup < 2) {
        try {
          const t = JSON.parse(data).type;
          if (t === "session.created") {
            api!.send(SESSION_CFG);
            setup = 1;
          } else if (t === "session.updated" && setup === 1) {
            api!.send(GREET);
            api!.send('{"type":"response.create"}');
            setup = 2;
          }
        } catch (_) { /* ignore */ }
      }
      if (browser.readyState === WebSocket.OPEN) {
        browser.send(data);
      }
    });

    api.on("error", (e: Error) => console.error("Inworld WS error:", e?.message || e));
    api.on("close", (code: number, reason: Buffer) => {
      console.log("Inworld WS closed:", code, reason?.toString?.());
      if (browser.readyState === WebSocket.OPEN) browser.close();
    });
  };

  browser.onopen = () => {
    connectInworld();
  };

  browser.onmessage = (ev) => {
    const msg = typeof ev.data === "string" ? ev.data : "";
    if (api && api.readyState === WS.OPEN) {
      api.send(msg);
    } else {
      pending.push(msg);
    }
  };

  browser.onclose = () => {
    try { api?.close(); } catch (_) { /* ignore */ }
  };
  browser.onerror = (e) => console.error("Browser WS error:", e);

  return response;
});
