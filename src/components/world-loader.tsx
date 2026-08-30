"use client";

import { useEffect, useState } from "react";
import "@/styles/world-loader.css";

const LOADING_LOG = [
  "Locating meaningful places",
  "Gathering stories",
  "Connecting memories",
  "Plotting experiences",
  "Mapping communities",
  "Loading landmarks",
  "Adding conversations",
  "Finishing your world",
] as const;

export default function WorldLoader({ ready, onContinue }: { ready: boolean; onContinue: () => void | Promise<void> }) {
  const [visibleLogCount, setVisibleLogCount] = useState(1);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = window.setInterval(() => {
      setVisibleLogCount((count) => Math.min(count + 1, LOADING_LOG.length));
    }, 560);
    return () => window.clearInterval(timer);
  }, [ready]);

  const visibleLog = LOADING_LOG.slice(Math.max(0, visibleLogCount - 3), visibleLogCount);

  return (
    <div className={`world-loader${exiting ? " world-loader--exiting" : ""}`} role="dialog" aria-label="Building Yuyang's world" aria-live="polite">
      <div className="world-loader__content">
        <svg className="world-loader__globe" viewBox="0 0 120 120" role="img" aria-label="Animated globe">
          <defs>
            <clipPath id="world-loader-globe-clip"><circle cx="60" cy="60" r="43" /></clipPath>
          </defs>
          <circle className="world-loader__ocean" cx="60" cy="60" r="43" />
          <g className="world-loader__continents" clipPath="url(#world-loader-globe-clip)">
            <path d="M18 42c12-12 22-15 34-11 5 2 6 8 2 12-7 7-11 10-9 18 2 9-5 17-13 12-5-3-7-12-14-15Z" />
            <path d="M66 22c14 1 26 7 36 18l-8 10-14-2-7 8 5 11-9 15-13-8 2-15-7-9 9-8Z" />
            <path d="M88 77c12 0 20 6 25 15l-13 13-17-8Z" />
            <path d="M3 55h18v13H4Z" />
          </g>
          <ellipse className="world-loader__orbit" cx="60" cy="60" rx="54" ry="18" />
          <circle className="world-loader__satellite" cx="114" cy="60" r="3" />
        </svg>
        <p className="world-loader__eyebrow">{ready ? "Ready to go?" : "Now loading"}</p>
        {!ready && (
          <div className="world-loader__log" aria-live="polite">
            {visibleLog.map((entry) => <p key={entry}>{entry}<span aria-hidden="true">…</span></p>)}
          </div>
        )}
        {ready && (
          <button
            type="button"
            disabled={exiting}
            onClick={() => {
              setExiting(true);
              void onContinue();
            }}
          >
            Dive in!
          </button>
        )}
      </div>
    </div>
  );
}
