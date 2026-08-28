"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AvatarIdle } from "./avatar-view";
import AgentChat from "./agent-chat";
import type { MapDestination } from "@/agent/types";

type DockPosition = { left: number; top: number };
type DockPlacement = { horizontal: "left" | "right"; vertical: "top" | "bottom" };

const getDockMargin = () => window.matchMedia("(max-width: 600px)").matches ? 12 : 20;
const MINIMIZE_TRANSITION_MS = 460;

export default function AvatarCall({ currentView, experienceStarted }: { currentView: MapDestination; experienceStarted: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedSettled, setExpandedSettled] = useState(true);
  const [avatarReady, setAvatarReady] = useState(false);
  const [introWaveComplete, setIntroWaveComplete] = useState(false);
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [dockedCaptionVisible, setDockedCaptionVisible] = useState(false);
  const [dockPosition, setDockPosition] = useState<DockPosition | null>(null);
  const [dockPlacement, setDockPlacement] = useState<DockPlacement>({ horizontal: "right", vertical: "top" });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ pointerId: -1, offsetX: 0, offsetY: 0, startX: 0, startY: 0, moved: false });
  const suppressNextClickRef = useRef(false);
  const expandedRef = useRef(expanded);
  const dockedCaptionDismissedRef = useRef(false);
  const dockedCaptionRevealTimerRef = useRef<number | null>(null);
  const expandedCaptionRevealTimerRef = useRef<number | null>(null);
  const dockedStreamRevealFrameRef = useRef<number | null>(null);
  const dockSettledRef = useRef(false);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    const clampDockToViewport = () => {
      setDockPosition((position) => {
        if (!position || expandedRef.current) return position;
        const modal = document.querySelector<HTMLElement>(".avatar-call--docked .avatar-call__modal");
        if (!modal) return position;
        const margin = getDockMargin();
        const width = modal.getBoundingClientRect().width;
        const height = modal.getBoundingClientRect().height;
        const left = Math.min(Math.max(position.left, margin), Math.max(margin, window.innerWidth - width - margin));
        const top = Math.min(Math.max(position.top, margin), Math.max(margin, window.innerHeight - height - margin));
        setDockPlacement({
          horizontal: left + width / 2 < window.innerWidth / 2 ? "left" : "right",
          vertical: top + height / 2 < window.innerHeight / 2 ? "top" : "bottom",
        });
        return left === position.left && top === position.top ? position : { left, top };
      });
    };
    window.addEventListener("resize", clampDockToViewport);
    window.visualViewport?.addEventListener("resize", clampDockToViewport);
    return () => {
      window.removeEventListener("resize", clampDockToViewport);
      window.visualViewport?.removeEventListener("resize", clampDockToViewport);
    };
  }, []);

  const agentReady = avatarReady && introWaveComplete && experienceStarted;

  const open = useCallback(() => {
    if (dockedCaptionRevealTimerRef.current !== null) window.clearTimeout(dockedCaptionRevealTimerRef.current);
    dockedCaptionRevealTimerRef.current = null;
    dockSettledRef.current = false;
    expandedRef.current = true;
    setExpandedSettled(false);
    setExpanded(true);
    setDockedCaptionVisible(false);
    if (expandedCaptionRevealTimerRef.current !== null) window.clearTimeout(expandedCaptionRevealTimerRef.current);
    expandedCaptionRevealTimerRef.current = window.setTimeout(() => {
      expandedCaptionRevealTimerRef.current = null;
      setExpandedSettled(true);
    }, MINIMIZE_TRANSITION_MS);
  }, []);

  const close = useCallback(() => {
    if (!expandedRef.current) return;
    expandedRef.current = false;
    dockSettledRef.current = false;
    setExpandedSettled(false);
    setExpanded(false);
    setDockedCaptionVisible(false);
    if (dockedCaptionRevealTimerRef.current !== null) window.clearTimeout(dockedCaptionRevealTimerRef.current);
    if (expandedCaptionRevealTimerRef.current !== null) window.clearTimeout(expandedCaptionRevealTimerRef.current);
    expandedCaptionRevealTimerRef.current = null;
    dockedCaptionRevealTimerRef.current = window.setTimeout(() => {
      dockedCaptionRevealTimerRef.current = null;
      dockSettledRef.current = true;
      if (agentReady && !dockedCaptionDismissedRef.current) setDockedCaptionVisible(true);
    }, MINIMIZE_TRANSITION_MS);
  }, [agentReady]);

  const handleAgentStreamingChange = useCallback((streaming: boolean) => {
    setAgentStreaming(streaming);
    if (streaming) dockedCaptionDismissedRef.current = false;
    if (dockedStreamRevealFrameRef.current !== null) cancelAnimationFrame(dockedStreamRevealFrameRef.current);
    dockedStreamRevealFrameRef.current = null;
    if (streaming && !expandedRef.current && dockSettledRef.current) {
      dockedStreamRevealFrameRef.current = requestAnimationFrame(() => {
        dockedStreamRevealFrameRef.current = null;
        setDockedCaptionVisible(true);
      });
    }
  }, []);

  const dismissDockedCaption = useCallback(() => {
    dockedCaptionDismissedRef.current = true;
    setDockedCaptionVisible(false);
  }, []);
  const revealDockedCaption = useCallback(() => {
    dockedCaptionDismissedRef.current = false;
    if (!expandedRef.current && dockSettledRef.current) setDockedCaptionVisible(true);
  }, []);

  const handleAvatarReady = useCallback(() => {
    setAvatarReady(true);
  }, []);
  const handleIntroWaveComplete = useCallback(() => {
    setIntroWaveComplete(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dismissDockedCaption();
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, dismissDockedCaption]);

  useEffect(() => () => {
    if (dockedCaptionRevealTimerRef.current !== null) window.clearTimeout(dockedCaptionRevealTimerRef.current);
    if (expandedCaptionRevealTimerRef.current !== null) window.clearTimeout(expandedCaptionRevealTimerRef.current);
    if (dockedStreamRevealFrameRef.current !== null) cancelAnimationFrame(dockedStreamRevealFrameRef.current);
  }, []);

  const handleDockPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (expanded || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(".agent-chat")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handleDockPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (expanded || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const margin = getDockMargin();
    const left = Math.min(Math.max(event.clientX - drag.offsetX, margin), window.innerWidth - bounds.width - margin);
    const top = Math.min(Math.max(event.clientY - drag.offsetY, margin), window.innerHeight - bounds.height - margin);
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    setDockPosition({ left, top });
    setDockPlacement({
      horizontal: left + bounds.width / 2 < window.innerWidth / 2 ? "left" : "right",
      vertical: top + bounds.height / 2 < window.innerHeight / 2 ? "top" : "bottom",
    });
    event.preventDefault();
  };

  const finishDockDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    suppressNextClickRef.current = drag.moved;
    if (drag.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const margin = getDockMargin();
      const horizontal = bounds.left + bounds.width / 2 < window.innerWidth / 2 ? "left" : "right";
      const vertical = bounds.top + bounds.height / 2 < window.innerHeight / 2 ? "top" : "bottom";
      const left = horizontal === "left"
        ? margin
        : window.innerWidth - bounds.width - margin;
      const top = vertical === "top"
        ? margin
        : window.innerHeight - bounds.height - margin;
      setDockPosition({ left, top });
      setDockPlacement({ horizontal, vertical });
    }
    drag.pointerId = -1;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const dockStyle = !expanded && dockPosition
    ? ({ left: `${dockPosition.left}px`, top: `${dockPosition.top}px` } satisfies CSSProperties)
    : undefined;

  return (
    <section
      className={`avatar-call ${expanded ? `avatar-call--expanded${expandedSettled ? " avatar-call--expanded-settled" : ""}` : `avatar-call--docked avatar-call--dock-${dockPlacement.horizontal} avatar-call--dock-${dockPlacement.vertical}`}`}
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
        className={`avatar-call__modal${dragging ? " avatar-call__modal--dragging" : ""}`}
        style={dockStyle}
        onPointerDown={handleDockPointerDown}
        onPointerMove={handleDockPointerMove}
        onPointerUp={finishDockDrag}
        onPointerCancel={finishDockDrag}
        onClick={(event) => {
          event.stopPropagation();
          if (event.target instanceof Element && event.target.closest(".agent-chat")) return;
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }
          if (!expanded) open();
        }}
      >
        <div className="avatar-call__glass-surface" aria-hidden="true" />
        <button type="button" className="avatar-call__close" onClick={close} aria-label="Close expanded guide">
          ×
        </button>
        <div className="avatar-call__avatar-stage">
          <AvatarIdle onReady={handleAvatarReady} onWaveComplete={handleIntroWaveComplete} talking={agentStreaming} />
        </div>
        {agentReady && (
          <AgentChat
            currentView={currentView}
            expanded={expanded}
            dockedCaptionVisible={dockedCaptionVisible}
            onDismissDockedCaption={dismissDockedCaption}
            onRevealDockedCaption={revealDockedCaption}
            onStreamingChange={handleAgentStreamingChange}
            onMinimize={close}
          />
        )}
      </div>
    </section>
  );
}
