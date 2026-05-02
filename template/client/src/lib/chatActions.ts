import type { NavigateFunction } from "react-router-dom";

// ── CUSTOMIZE: Add your external URLs here ────────────────────────────────────
// Keys must match exactly what the model outputs in the redirect parameters.
export const REDIRECT_MAP: Record<string, string> = {
  github:            "https://github.com/YOUR_USERNAME",
  linkedin:          "https://www.linkedin.com/in/YOUR_USERNAME/",
  instagram:         "https://www.instagram.com/YOUR_USERNAME/",
  twitter:           "https://twitter.com/YOUR_USERNAME",
  // Add project-specific links:
  // "project:my-app": "https://github.com/YOUR_USERNAME/my-app",
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
 * buildAction — convert raw backend action into a typed AgentAction.
 */
export function buildAction(
  raw: { tool: string; parameters: string[] } | null,
): AgentAction | null {
  if (!raw) return null;

  const params = raw.parameters.map((p) => p.toLowerCase());

  switch (raw.tool) {
    case "navigate": {
      const page = params[0];
      const path = page ? PAGE_MAP[page] : undefined;
      if (page && path) return { type: "navigate", page, path };
      return null;
    }
    case "redirect": {
      const key = params[0];
      const url = key ? REDIRECT_MAP[key] : undefined;
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
 * executeAction — execute a single AgentAction.
 * Contact is NOT handled here — ChatContext owns that state machine.
 */
export function executeAction(action: AgentAction, navigate: NavigateFunction): void {
  if (action.type === "navigate") {
    setTimeout(() => navigate(action.path), 420);
  } else if (action.type === "redirect") {
    const a = document.createElement("a");
    a.href = action.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
}

/**
 * actionLabel — human-readable hint shown beneath a bubble when an action fired.
 */
export function actionLabel(action: AgentAction): string {
  if (action.type === "navigate") return `→ Navigated to ${action.page}`;
  if (action.type === "redirect") return `↗ Opened ${action.key}`;
  return "";
}
