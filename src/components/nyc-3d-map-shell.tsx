"use client";

import dynamic from "next/dynamic";

const Nyc3dMap = dynamic(() => import("./nyc-3d-map"), {
  ssr: false,
  loading: () => <main className="washington-study" />,
});

export default function Nyc3dMapShell() {
  return <Nyc3dMap />;
}
