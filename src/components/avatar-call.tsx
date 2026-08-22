"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AvatarIdle } from "./avatar-view";
import AgentChat from "./agent-chat";
import type { MapDestination } from "@/agent/types";

type DockPosition = { left: number; top: number };

const getDockMargin = () => window.matchMedia("(max-width: 600px)").matches ? 12 : 20;

export default function AvatarCall({ currentView, experienceStarted }: { currentView: MapDestination; experienceStarted: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [avatarReady, setAvatarReady] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [agentStreaming, setAgentStreaming] = useState(false);
  const [dockedCaptionVisible, setDockedCaptionVisible] = useState(false);
  const [dockPosition, setDockPosition] = useState<DockPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ pointerId: -1, offsetX: 0, offsetY: 0, startX: 0, startY: 0, moved: false });
  const suppressNextClickRef = useRef(false);
  const expandedRef = useRef(expanded);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    if (!avatarReady || !experienceStarted) return;
    const timer = window.setTimeout(() => setAgentReady(true), 500);
    return () => window.clearTimeout(timer);
  }, [avatarReady, experienceStarted]);

  const open = useCallback(() => {
    setExpanded(true);
    setDockedCaptionVisible(false);
  }, []);

  const close = useCallback(() => {
    setExpanded(false);
    if (agentStreaming) setDockedCaptionVisible(true);
  }, [agentStreaming]);

  const handleAgentStreamingChange = useCallback((streaming: boolean) => {
    setAgentStreaming(streaming);
    if (streaming && !expandedRef.current) setDockedCaptionVisible(true);
  }, []);

  const dismissDockedCaption = useCallback(() => setDockedCaptionVisible(false), []);

  const handleAvatarReady = useCallback(() => {
    setAvatarReady(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

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
    event.preventDefault();
  };

  const finishDockDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    suppressNextClickRef.current = drag.moved;
    if (drag.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const margin = getDockMargin();
      const left = bounds.left + bounds.width / 2 < window.innerWidth / 2
        ? margin
        : window.innerWidth - bounds.width - margin;
      const top = bounds.top + bounds.height / 2 < window.innerHeight / 2
        ? margin
        : window.innerHeight - bounds.height - margin;
      setDockPosition({ left, top });
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
          <AvatarIdle onReady={handleAvatarReady} talking={agentStreaming} />
        </div>
        {agentReady && (
          <AgentChat
            currentView={currentView}
            expanded={expanded}
            dockedCaptionVisible={dockedCaptionVisible}
            onDismissDockedCaption={dismissDockedCaption}
            onStreamingChange={handleAgentStreamingChange}
            onMinimize={close}
          />
        )}
      </div>
    </section>
  );
}
