"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { primeAgentDialogueAudio } from "../agent-chat";
import WorldLoader from "../world-loader";

const BYPASS_WORLD_LOADER = process.env.NODE_ENV !== "production";

const GlobalMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <main className="washington-study" />,
});

export default function MapShell() {
  const [buildComplete, setBuildComplete] = useState(BYPASS_WORLD_LOADER);
  const [experienceStarted, setExperienceStarted] = useState(BYPASS_WORLD_LOADER);

  useEffect(() => {
    if (BYPASS_WORLD_LOADER) return;
    const timer = window.setTimeout(() => setBuildComplete(true), 2_000);
    return () => window.clearTimeout(timer);
  }, []);

  const continueToWorld = async () => {
    try {
      await primeAgentDialogueAudio();
    } catch {
      // Continue even if this browser or device declines the audio unlock.
    }
    setExperienceStarted(true);
  };

  return (
    <>
      <GlobalMap experienceStarted={experienceStarted} />
      {!experienceStarted && <WorldLoader ready={buildComplete} onContinue={continueToWorld} />}
    </>
  );
}
