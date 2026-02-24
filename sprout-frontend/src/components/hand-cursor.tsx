"use client";

import type { HandPosition } from "@/hooks/use-hand-tracking";

type HandCursorProps = {
  handPos: HandPosition;
  connected: boolean;
};

export function HandCursor({ handPos, connected }: HandCursorProps) {
  if (!connected) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {handPos && (
        <div
          className="absolute"
          style={{
            left: `${handPos.x * 100}%`,
            top: `${handPos.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Ping ring */}
          <div
            className="absolute animate-ping rounded-full border-2 border-green-400/50"
            style={{ width: 36, height: 36, marginLeft: -18, marginTop: -18 }}
          />
          {/* Core dot */}
          <div
            className="absolute rounded-full bg-green-400"
            style={{
              width: 12,
              height: 12,
              marginLeft: -6,
              marginTop: -6,
              boxShadow: "0 0 10px 2px #4ade80",
            }}
          />
        </div>
      )}
    </div>
  );
}
