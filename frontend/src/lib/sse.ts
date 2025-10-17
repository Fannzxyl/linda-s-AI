type ChatPayload = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  persona?: string;
  use_memory: boolean;
};

type StreamHandlers = {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export const streamChat = (
  payload: ChatPayload,
  handlers: StreamHandlers,
) => {
  const { onToken, onDone, onError } = handlers;
  const controller = new AbortController();

  (async () => {
    const endpoint =
      import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";
    try {
      const response = await fetch(`${endpoint}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finished = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          if (!rawEvent.trim() || rawEvent.startsWith(":")) {
            continue;
          }
          const parsed = parseSseEvent(rawEvent);
          if (!parsed) continue;

          if (parsed.event === "token") {
            onToken(parsed.data);
          } else if (parsed.event === "done" && !finished) {
            finished = true;
            onDone();
          } else if (parsed.event === "error") {
            onError(parsed.data);
          }
        }
      }

      if (!finished) {
        onDone();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      onError(error instanceof Error ? error.message : "Streaming error");
    }
  })();

  return {
    cancel: () => controller.abort(),
  };
};

const parseSseEvent = (
  raw: string,
): { event: string; data: string } | null => {
  const lines = raw.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.replace("event:", "").trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.replace("data:", "").trim());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  return {
    event: eventName,
    data: dataLines.join("\n"),
  };
};
