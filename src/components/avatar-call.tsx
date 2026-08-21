"use client";

import { useCallback, useEffect, useState } from "react";
import { AvatarIdleView } from "./avatar-view";

export default function AvatarCall() {
  const [expanded, setExpanded] = useState(true);

  const open = useCallback(() => {
    setExpanded(true);
  }, []);

  const close = useCallback(() => {
    setExpanded(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  return (
    <section
      className={`avatar-call ${expanded ? "avatar-call--expanded" : "avatar-call--docked"}`}
      aria-label={expanded ? "Yuyang video guide" : "Open Yuyang's guide window"}
      role={expanded ? "dialog" : "button"}
      aria-modal={expanded ? "true" : undefined}
      tabIndex={expanded ? undefined : 0}
      onClick={expanded ? close : open}
      onKeyDown={(event) => {
        if (!expanded && (event.key === "Enter" || event.key === " ")) open();
      }}
    >
      <div
        className="avatar-call__modal"
        onClick={(event) => {
          event.stopPropagation();
          if (!expanded) open();
        }}
      >
        <button type="button" className="avatar-call__close" onClick={close} aria-label="Close expanded guide">
          ×
        </button>
        <div className="avatar-call__avatar-stage">
          <AvatarIdleView />
        </div>
      </div>
    </section>
  );
}
