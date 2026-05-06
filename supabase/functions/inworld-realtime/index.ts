// Inworld Realtime Speech-to-Speech WebSocket proxy
// Browser <-> this edge function (WS) <-> Inworld Realtime API (WS)
// Keeps INWORLD_API_KEY safe on the server.

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

  // Default session config (can be overridden via client message after connect)
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

  let api: WebSocket | null = null;
  let setup = 0;
  const pending: string[] = [];

  const connectInworld = () => {
    // Deno's WebSocket constructor supports the headers option in edge runtime
    // via the second arg in some runtimes; fallback to query auth not supported,
    // so we rely on Deno.upgrade-style by passing headers using fetch+Sec-WebSocket.
    // Supabase Edge (Deno deploy) supports `new WebSocket(url, { headers })` extension.
    // @ts-ignore - Deno extension
    api = new WebSocket(inworldUrl, {
      headers: { Authorization: `Basic ${INWORLD_API_KEY}` },
    });

    api.onopen = () => {
      console.log("Connected to Inworld");
      while (pending.length && api && api.readyState === WebSocket.OPEN) {
        api.send(pending.shift()!);
      }
    };

    api.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      if (setup < 2 && data) {
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
    };

    api.onerror = (e) => console.error("Inworld WS error:", e);
    api.onclose = (e) => {
      console.log("Inworld WS closed:", e.code, e.reason);
      if (browser.readyState === WebSocket.OPEN) browser.close();
    };
  };

  browser.onopen = () => {
    connectInworld();
  };

  browser.onmessage = (ev) => {
    const msg = typeof ev.data === "string" ? ev.data : "";
    if (api && api.readyState === WebSocket.OPEN) {
      api.send(msg);
    } else {
      pending.push(msg);
    }
  };

  browser.onclose = () => {
    if (api && api.readyState === WebSocket.OPEN) api.close();
  };
  browser.onerror = (e) => console.error("Browser WS error:", e);

  return response;
});
