import type { NavigateFunction } from "react-router-dom";

// ── External URL map — add project links here ────────────────────────────────
// Keys must match exactly what the model outputs after [redirect].
export const REDIRECT_MAP: Record<string, string> = {
  github:            "https://github.com/yuyanghu06",
  linkedin:          "https://www.linkedin.com/in/yuyanghu06/",
  instagram:         "https://www.instagram.com/yuyanghu06/",
  "project:journey": "https://github.com/yuyanghu06/journey",
  "project:nootes":  "https://nootes-beryl.vercel.app/",
  "project:cronicl": "https://cronicl-production.up.railway.app/",
  "project:presidential speech analysis": "https://github.com/yuyanghu06/presidentialSpeechAnalysis",
  "project:all others":"https://github.com/yuyanghu06"
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
 * parseActions
 * ------------
 * Strip action tags from the raw model output and collect them as structured
 * AgentAction objects. Tags are always at the end of the response on their
 * own line (e.g. "[navigate] projects" or "[redirect] github").
 *
 * Returns:
 *   display  — cleaned text shown in the chat bubble (no tags)
 *   actions  — ordered list of actions to execute after displaying the message
 */
export function parseActions(raw: string): { display: string; actions: AgentAction[] } {
  const actions: AgentAction[] = [];
  let display = raw;

  // [navigate] <page> — route the user to an internal page
  display = display.replace(/\[navigate\]\s+(\w+)/gi, (_, page) => {
    const p = page.toLowerCase();
    const path = PAGE_MAP[p];
    if (path) actions.push({ type: "navigate", page: p, path });
    return "";
  });

  // [contact] — trigger the frontend contact-collection flow
  display = display.replace(/\[contact\]/gi, () => {
    actions.push({ type: "contact" });
    return "";
  });

  // [redirect] <key> — open an external URL in a new tab
  display = display.replace(/\[redirect\]\s+([\w:./-]+)/gi, (_, key) => {
    const k = key.toLowerCase();
    const url = REDIRECT_MAP[k];
    if (url) actions.push({ type: "redirect", key: k, url });
    return "";
  });

  // [message] — explicit "no action" tag; strip it so it never appears in the bubble
  display = display.replace(/\[message\]/gi, "");

  // Trim any trailing whitespace / blank lines left behind after tag removal
  return { display: display.trim(), actions };
}

/**
 * executeAction
 * -------------
 * Execute a single parsed action. Navigate and redirect are handled here.
 * Contact actions are deliberately NOT handled here — the caller (Home.tsx)
 * manages that state machine to keep UI logic in one place.
 */
export function executeAction(action: AgentAction, navigate: NavigateFunction): void {
  if (action.type === "navigate") {
    // Small delay so the assistant message renders before the page changes
    setTimeout(() => navigate(action.path), 420);
  } else if (action.type === "redirect") {
    window.open(action.url, "_blank", "noopener,noreferrer");
  }
  // contact: handled by caller
}

/**
 * actionLabel
 * -----------
 * Human-readable indicator appended to a bubble when an action fires,
 * so the user knows what happened (e.g. "→ Navigated to projects").
 */
export function actionLabel(action: AgentAction): string {
  if (action.type === "navigate") return `→ Navigated to ${action.page}`;
  if (action.type === "redirect") return `↗ Opened ${action.key}`;
  return "";
}
