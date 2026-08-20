"use client";

import dynamic from "next/dynamic";
import MapLoadingScreen from "./map-loading-screen";

const Nyc3dMap = dynamic(() => import("./nyc-3d-map"), {
  ssr: false,
  loading: () => (
    <main className="washington-study">
      <MapLoadingScreen />
    </main>
  ),
});

export default function Nyc3dMapShell() {
  return <Nyc3dMap />;
}
