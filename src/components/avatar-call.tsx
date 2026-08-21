"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiquidGlass } from "simple-liquid-glass";
import { AvatarIdle } from "./avatar-view";

export default function AvatarCall() {
  const [expanded, setExpanded] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginTransition = useCallback((nextExpanded: boolean) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTransitioning(true);
    setExpanded(nextExpanded);
    transitionTimerRef.current = setTimeout(() => {
      setTransitioning(false);
      transitionTimerRef.current = null;
    }, 500);
  }, []);

  const open = useCallback(() => {
    beginTransition(true);
  }, [beginTransition]);

  const close = useCallback(() => {
    beginTransition(false);
  }, [beginTransition]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  return (
    <section
      className={`avatar-call ${expanded ? "avatar-call--expanded" : "avatar-call--docked"}${transitioning ? " avatar-call--transitioning" : ""}`}
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
        <LiquidGlass
          className="avatar-call__glass"
          mode="custom"
          radius={32}
          scale={96}
          border={0.08}
          lightness={52}
          displace={4}
          alpha={0.78}
          blur={12}
          dispersion={18}
          saturation={105}
          aberrationIntensity={0.08}
          frost={0.34}
          glassColor="rgba(232, 230, 221, 0.3)"
          borderColor="rgba(255, 255, 255, 0)"
          lens="convex"
          lensStrength={0.72}
          quality="standard"
          iosMinBlur={18}
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "var(--avatar-glass-width)",
            height: "var(--avatar-glass-height)",
            transform: "translate(-50%, -50%)",
          }}
        />
        {transitioning ? <div className="avatar-call__glass-placeholder" aria-hidden="true" /> : null}
        <button type="button" className="avatar-call__close" onClick={close} aria-label="Close expanded guide">
          ×
        </button>
        <div className="avatar-call__avatar-stage">
          <AvatarIdle />
        </div>
      </div>
    </section>
  );
}
