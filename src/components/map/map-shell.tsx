"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { primeAgentDialogueAudio } from "../agent-chat";
import WorldLoader from "../world-loader";
import "@/styles/map-shell.css";

const BYPASS_WORLD_LOADER = process.env.NODE_ENV !== "production";

const GlobalMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <main className="washington-study" />,
});

export default function MapShell() {
  const [buildComplete, setBuildComplete] = useState(BYPASS_WORLD_LOADER);
  const [experienceStarted, setExperienceStarted] = useState(BYPASS_WORLD_LOADER);

  const handleWorldReady = useCallback(() => setBuildComplete(true), []);

  const continueToWorld = async () => {
    const audioPriming = primeAgentDialogueAudio().catch(() => {
      // Continue even if this browser or device declines the audio unlock.
    });
    const loaderFade = new Promise<void>((resolve) => window.setTimeout(resolve, 380));
    await Promise.all([audioPriming, loaderFade]);
    setExperienceStarted(true);
  };

  return (
    <>
      <GlobalMap experienceStarted={experienceStarted} onReady={handleWorldReady} />
      {!experienceStarted && <WorldLoader ready={buildComplete} onContinue={continueToWorld} />}
    </>
  );
}
