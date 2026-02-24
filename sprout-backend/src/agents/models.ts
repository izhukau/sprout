// Defaults aim for free/low-cost tiers; override via env when you have quota.
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export const GEMINI_MODEL_SMALL =
  process.env.GEMINI_MODEL_SMALL?.trim() || "gemini-2.5-flash";

// Anthropic: default to the cheapest generally-available Claude (Haiku 4.5).
// Override via CLAUDE_MODEL / CLAUDE_MODEL_SMALL env vars if you want higher quality.
export const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL?.trim() || "claude-haiku-4-5-20251001";

export const CLAUDE_MODEL_SMALL =
  process.env.CLAUDE_MODEL_SMALL?.trim() || CLAUDE_MODEL;
