import { useCallback, useRef } from "react";
import type { StreamMutation } from "@/hooks/use-agent-stream";

const DEFAULT_BUFFER_MS = 1000;

export function useMutationBuffer(options: {
  onFlush: (mutations: StreamMutation[]) => void;
  bufferMs?: number;
}) {
  const { bufferMs = DEFAULT_BUFFER_MS } = options;
  const onFlushRef = useRef(options.onFlush);
  onFlushRef.current = options.onFlush;

  const bufferRef = useRef<StreamMutation[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    (mutation: StreamMutation) => {
      bufferRef.current.push(mutation);

      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          const batch = bufferRef.current;
          bufferRef.current = [];
          timerRef.current = null;
          onFlushRef.current(batch);
        }, bufferMs);
      }
    },
    [bufferMs],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (bufferRef.current.length > 0) {
      const batch = bufferRef.current;
      bufferRef.current = [];
      onFlushRef.current(batch);
    }
  }, []);

  return { push, flush };
}
