import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
  title: { default: "Welcome to Yuyang's World!", template: "%s | Yuyang Hu" },
  description: "Explore Yuyang Hu's work in robotics, technology, startups, and student leadership at NYU.",
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
