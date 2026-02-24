import { useEffect, useRef, useState } from "react";

export type HandPosition = { x: number; y: number; z: number; pinch: number } | null;

export type HandSample = {
  x: number;
  y: number;
  z: number;
  pinch: number;
  palm_x: number;
  palm_y: number;
  palm_z: number;
  is_open_palm: boolean;
  palm_hold_duration: number;
  is_grabbing: boolean;
  hand: number;
  handedness: string;
};

export function useHandTracking(
  wsUrl = "ws://localhost:8765",
  enabled = false,
) {
  const [handPos, setHandPos] = useState<HandPosition>(null);
  const [hands, setHands] = useState<HandSample[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setHandPos(null);
      setHands([]);
      return;
    }

    let alive = true;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!alive) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (alive) setConnected(true);
      };

      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        setHandPos(null);
        setHands([]);
        retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        if (!alive) return;
        try {
          const data = JSON.parse(event.data as string);

          // New protocol: { hands: [...] }
          if (Array.isArray(data.hands)) {
            const parsedHands: HandSample[] = data.hands
              .filter((h: unknown): h is HandSample => !!h && typeof h === "object")
              .map((h: any) => ({
                x: Number(h.x) || 0,
                y: Number(h.y) || 0,
                z: Number(h.z) || 0,
                pinch: typeof h.pinch === "number" ? h.pinch : 0.2,
                palm_x: Number(h.palm_x) || 0,
                palm_y: Number(h.palm_y) || 0,
                palm_z: Number(h.palm_z) || 0,
                is_open_palm: Boolean(h.is_open_palm),
                palm_hold_duration: typeof h.palm_hold_duration === "number"
                  ? h.palm_hold_duration
                  : 0,
                is_grabbing: Boolean(h.is_grabbing),
                hand: typeof h.hand === "number" ? h.hand : 0,
                handedness: typeof h.handedness === "string" ? h.handedness : "",
              }));

            if (!parsedHands.length) {
              setHands([]);
              setHandPos(null);
              return;
            }

            // Expose all detected hands so any hand can trigger open-palm grab.
            setHands(parsedHands);

            // Camera / cursor: first hand that is NOT in open-palm state.
            // If every hand is open-palm (grabbing), camera stays frozen — intentional.
            const cameraHand = parsedHands.find((h) => !h.is_open_palm) ?? null;
            setHandPos(
              cameraHand
                ? {
                    x: cameraHand.x,
                    y: cameraHand.y,
                    z: cameraHand.z,
                    pinch: cameraHand.pinch,
                  }
                : null,
            );
            return;
          }

          // Legacy protocol: { x, y, z, pinch }
          if (
            typeof data.x === "number" &&
            typeof data.y === "number" &&
            typeof data.z === "number"
          ) {
            setHands([]);
            setHandPos({
              x: data.x,
              y: data.y,
              z: data.z,
              pinch: typeof data.pinch === "number" ? data.pinch : 0.2,
            });
          }
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      alive = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, wsUrl]);

  return { handPos, hands, connected };
}
