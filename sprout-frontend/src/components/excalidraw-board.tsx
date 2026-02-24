"use client";

import { Check, PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full items-center justify-center text-sm"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        <PenLine className="mr-2 h-4 w-4 animate-pulse" />
        Loading whiteboard…
      </div>
    ),
  },
);

export type DrawSubmissionPayload = {
  imageDataUrl: string;
};
type ExcalidrawApiLike = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert drawing to data URL"));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read drawing blob"));
    reader.readAsDataURL(blob);
  });
}

export function ExcalidrawBoard({
  onSubmit,
  isSubmitted,
}: {
  onSubmit: (payload: DrawSubmissionPayload) => void | Promise<void>;
  isSubmitted: boolean;
}) {
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawApiLike | null>(null);

  const handleSubmit = async () => {
    if (!excalidrawApiRef.current || isSubmitting) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: excalidrawApiRef.current.getSceneElements(),
        appState: {
          ...excalidrawApiRef.current.getAppState(),
          exportBackground: true,
        },
        files: excalidrawApiRef.current.getFiles(),
        mimeType: "image/png",
      });
      const imageDataUrl = await blobToDataUrl(blob);
      await onSubmit({ imageDataUrl });
    } catch {
      setSubmitError("Failed to export drawing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Canvas fills all remaining space */}
      <div className="relative min-h-0 flex-1">
        <Excalidraw
          theme="dark"
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api as unknown as ExcalidrawApiLike;
          }}
          initialData={{
            appState: {
              viewBackgroundColor: "#16213e",
              currentItemFontFamily: 1,
            },
          }}
          onChange={(elements) => {
            if (elements.length > 0) setHasDrawn(true);
          }}
          UIOptions={{
            canvasActions: {
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
        />
      </div>

      {/* Footer bar */}
      <div
        className="flex shrink-0 items-center border-t px-6 py-4"
        style={{ borderColor: "rgba(244,114,182,0.18)", background: "#16213e" }}
      >
        {!isSubmitted ? (
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!hasDrawn || isSubmitting}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-all hover:opacity-88 active:scale-[0.98] disabled:opacity-30"
            style={{ background: "#ffa025", color: "#070d06" }}
          >
            {isSubmitting ? "Preparing..." : "Submit Answer"}
          </button>
        ) : (
          <div
            className="flex items-center gap-3 rounded-xl px-5 py-3"
            style={{
              background: "rgba(28,72,21,0.35)",
              border: "1px solid rgba(28,72,21,0.7)",
            }}
          >
            <Check className="h-4 w-4" style={{ color: "#4ade80" }} />
            <span className="text-sm font-medium" style={{ color: "#4ade80" }}>
              Answer submitted
            </span>
          </div>
        )}
        {submitError && (
          <div
            className="ml-4 text-xs"
            style={{ color: "rgba(248,113,113,0.9)" }}
          >
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
}
