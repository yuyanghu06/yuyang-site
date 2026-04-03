import type { NavigateFunction } from "react-router-dom";

console.log("[chatActions] module loaded");

// ── External URL map — add project links here ────────────────────────────────
// Keys must match exactly what the model outputs in the redirect parameters array.
export const REDIRECT_MAP: Record<string, string> = {
  github:            "https://github.com/yuyanghu06",
  linkedin:          "https://www.linkedin.com/in/yuyanghu06/",
  instagram:         "https://www.instagram.com/yuyanghu06/",
  "project:journey": "https://github.com/yuyanghu06/journey",
  "project:nootes":  "https://nootes-beryl.vercel.app/",
  "project:cronicl": "https://cronicl-production.up.railway.app/",
  "project:presidential speech analysis": "https://github.com/yuyanghu06/presidentialSpeechAnalysis",
  "project:all others": "https://github.com/yuyanghu06",
};

// ── Internal page map — maps model page names to React Router paths ──────────
export const PAGE_MAP: Record<string, string> = {
  home:     "/",
  about:    "/about",
  projects: "/projects",
  contact:  "/contact",
};

// ── Discriminated union of all possible agent actions ───────────────────────
export type AgentAction =
  | { type: "navigate"; page: string; path: string }
  | { type: "redirect"; key: string; url: string }
  | { type: "contact" };

/**
 * buildAction
 * -----------
 * Convert the raw `{ tool, parameters }` object sent by the backend into a
 * typed AgentAction, resolving page/URL lookups in the process.
 * Returns null for unknown tools or missing map entries.
 */
export function buildAction(
  raw: { tool: string; parameters: string[] } | null,
): AgentAction | null {
  console.log("[buildAction] called with:", raw);
  if (!raw) return null;

  const params = raw.parameters.map((p) => p.toLowerCase());

  switch (raw.tool) {
    case "navigate": {
      const page = params[0];
      const path = page ? PAGE_MAP[page] : undefined;
      console.log("[buildAction] navigate — page:", page, "| path:", path);
      if (page && path) return { type: "navigate", page, path };
      return null;
    }
    case "redirect": {
      const key = params[0];
      const url = key ? REDIRECT_MAP[key] : undefined;
      console.log("[buildAction] redirect — key:", key, "| url:", url);
      if (key && url) return { type: "redirect", key, url };
      return null;
    }
    case "contact":
      return { type: "contact" };
    case "message":
    default:
      return null;
  }
}

/**
 * executeAction
 * -------------
 * Execute a single AgentAction. Contact is NOT handled here — ChatContext
 * owns that state machine.
 */
export function executeAction(action: AgentAction, navigate: NavigateFunction): void {
  console.log("[executeAction] executing:", action);
  if (action.type === "navigate") {
    console.log("[executeAction] calling navigate to", action.path);
    setTimeout(() => navigate(action.path), 420);
  } else if (action.type === "redirect") {
    console.log("[executeAction] opening url", action.url);
    const a = document.createElement("a");
    a.href = action.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
}

/**
 * actionLabel
 * -----------
 * Human-readable hint shown beneath a bubble when an action fired.
 */
export function actionLabel(action: AgentAction): string {
  if (action.type === "navigate") return `→ Navigated to ${action.page}`;
  if (action.type === "redirect") return `↗ Opened ${action.key}`;
  return "";
}
