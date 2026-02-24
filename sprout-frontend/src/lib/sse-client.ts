export type SSEEvent = {
  event: string;
  data: unknown;
};

export type SSECallbacks = {
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
};

/**
 * Opens a POST-based SSE stream. Parses `event: <type>\ndata: <json>\n\n` frames.
 *
 * If the response Content-Type is not `text/event-stream` (e.g. the concept
 * endpoint returning JSON for "awaiting_answers"), the body is parsed as JSON
 * and emitted as a single `__json_response__` event.
 */
export async function openSSEStream(
  url: string,
  body: object,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = `SSE request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody?.error) message = errBody.error;
    } catch {
      /* keep fallback */
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const json: unknown = await response.json();
    callbacks.onEvent({ event: "__json_response__", data: json });
    callbacks.onClose?.();
    return;
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) continue;

        let eventType = "message";
        let dataStr = "";

        for (const line of frame.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);
          }
        }

        if (dataStr) {
          try {
            const parsed: unknown = JSON.parse(dataStr);
            callbacks.onEvent({ event: eventType, data: parsed });
          } catch {
            callbacks.onError?.(
              new Error(`Failed to parse SSE data: ${dataStr}`),
            );
          }
        }
      }
    }
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") {
      // Expected cancellation
    } else {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    callbacks.onClose?.();
  }
}
