import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Welcome to Yuyang's World!",
  description: "Three cities, one personal atlas.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/models/manhattan-roads.glb?v=2026-08-20-manhattan-roads-2600-v1"
          as="fetch"
          type="model/gltf-binary"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
