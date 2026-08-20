"use client";

import dynamic from "next/dynamic";

const GlobalMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <main className="washington-study" />,
});

export default function MapShell() {
  return <GlobalMap />;
}
