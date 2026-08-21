"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import AvatarIdleView from "./avatar-idle-view";

export default function AvatarCall() {
  const [expanded, setExpanded] = useState(true);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const dockOriginRef = useRef<DOMRect | null>(null);

  const close = useCallback(() => {
    const modal = modalRef.current;
    if (closing || !modal) return;
    setClosing(true);
    const bounds = modal.getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 600px)").matches;
    const dockSize = mobile ? 112 : 144;
    const dockInset = mobile ? 12 : 20;
    const targetLeft = window.innerWidth - dockInset - dockSize;
    const targetTop = dockInset;
    const scaleX = dockSize / bounds.width;
    const scaleY = dockSize / bounds.height;
    const animation = modal.animate(
      [
        { transform: "translate(0, 0) scale(1, 1)", transformOrigin: "top left" },
        {
          transform: `translate(${targetLeft - bounds.left}px, ${targetTop - bounds.top}px) scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
          borderRadius: `${22 / scaleX}px / ${22 / scaleY}px`,
          borderColor: "rgba(69, 74, 71, 0.35)",
        },
      ],
      { duration: 460, easing: "cubic-bezier(0.64, 0, 0.3, 1)", fill: "forwards" },
    );
    animation.onfinish = () => {
      setExpanded(false);
      setClosing(false);
    };
  }, [closing]);

  useLayoutEffect(() => {
    const modal = modalRef.current;
    const origin = dockOriginRef.current;
    if (!expanded || !opening || !modal || !origin) return;
    const bounds = modal.getBoundingClientRect();
    const scaleX = origin.width / bounds.width;
    const scaleY = origin.height / bounds.height;
    const animation = modal.animate(
      [
        {
          transform: `translate(${origin.left - bounds.left}px, ${origin.top - bounds.top}px) scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
          borderRadius: `${22 / scaleX}px / ${22 / scaleY}px`,
          borderColor: "rgba(69, 74, 71, 0.35)",
        },
        { transform: "translate(0, 0) scale(1, 1)", transformOrigin: "top left" },
      ],
      { duration: 460, easing: "cubic-bezier(0.64, 0, 0.3, 1)", fill: "forwards" },
    );
    animation.onfinish = () => {
      setOpening(false);
      dockOriginRef.current = null;
      window.dispatchEvent(new Event("avatar-call-resize"));
    };
    return () => animation.cancel();
  }, [expanded, opening]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  if (!expanded) {
    return (
      <button
        type="button"
        className="avatar-call avatar-call--docked"
        onClick={(event) => {
          dockOriginRef.current = event.currentTarget.getBoundingClientRect();
          setClosing(false);
          setOpening(true);
          setExpanded(true);
        }}
        aria-label="Open Yuyang's guide window"
      >
        <span className="avatar-call__screen" aria-hidden="true">
          <AvatarIdleView framing="bust" />
        </span>
      </button>
    );
  }

  return (
    <section
      className={`avatar-call avatar-call--expanded${closing ? " is-closing" : ""}${opening ? " is-opening" : ""}`}
      aria-label="Yuyang video guide"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        ref={modalRef}
        className="avatar-call__modal"
        onClick={(event) => event.stopPropagation()}
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
