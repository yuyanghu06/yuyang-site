import type { CSSProperties } from "react";
import type { AgentStatus } from "@/agent/contracts/types";

export function AnimatedAgentStatus({ status }: { status: AgentStatus }) {
  const label = status === "remembering" ? "Remembering…" : status === "researching" ? "Researching…" : "Thinking…";
  return (
    <span className="agent-chat__thinking" role="status" aria-live="polite" aria-label={label}>
      {Array.from(label).map((character, index) => (
        <span key={`${character}-${index}`} aria-hidden="true" style={{ "--agent-wave-index": index } as CSSProperties}>
          {character}
        </span>
      ))}
    </span>
  );
}
