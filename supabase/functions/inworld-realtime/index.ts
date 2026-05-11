// Inworld Realtime Speech-to-Speech WebSocket proxy
// Browser <-> this edge function (WS) <-> Inworld Realtime API (WS)
// Uses npm:ws because Deno's native WebSocket cannot set custom headers.

import WS from "npm:ws@8.18.0";

const VOICE_BY_LANG: Record<string, string> = {
  cs: "Hana",
  sk: "Hana",
  en: "Ashley",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  cs:
    "Jsi přátelský AI hlasový asistent pro českou dětskou sociální síť Kamosféra. KRITICKÉ: Mluvíš VÝHRADNĚ ČESKY – nikdy nepoužívej angličtinu, slovenštinu ani jiný jazyk. Anglická slova nahrazuj českými ekvivalenty (např. ne 'cool', ale 'super'). Výslovnost musí být česká. Odpovídej krátce, mile a bezpečně pro děti. Pamatuj si průběh konverzace a navazuj na předchozí repliky uživatele.",
};


Deno.serve((req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const INWORLD_API_KEY = Deno.env.get("INWORLD_API_KEY");
  if (!INWORLD_API_KEY) {
    return new Response("INWORLD_API_KEY not configured", { status: 500 });
  }

  const url = new URL(req.url);
  // Vynucená čeština – ignorujeme query parametr lang, aby asistent neměl anglickou výslovnost
  const lang = "cs";
  const voice = url.searchParams.get("voice") || "Hana";
  const instructions = SYSTEM_PROMPTS.cs;

  const { socket: browser, response } = Deno.upgradeWebSocket(req);

  const sessionId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inworldUrl = `wss://api.inworld.ai/api/v1/realtime/session?key=${sessionId}&protocol=realtime`;

  const SESSION_CFG = JSON.stringify({
    type: "session.update",
    session: {
      instructions,
      voice,
      modalities: ["text", "audio"],
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: { model: "whisper-1", language: lang },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
        create_response: true,
      },
    },
  });

  const GREET = JSON.stringify({
    type: "response.create",
    response: {
      modalities: ["audio", "text"],
      instructions:
        lang === "en"
          ? "Greet the user briefly in English."
          : lang === "sk"
          ? "Stručne pozdrav používateľa po slovensky."
          : "Krátce pozdrav uživatele česky.",
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
      console.log("Connected to Inworld", { lang, voice });
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
