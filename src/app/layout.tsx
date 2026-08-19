import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuyang — A Personal Atlas",
  description: "Three cities, one personal atlas.",
};

export const viewport: Viewport = {
  themeColor: "#f7f7f3",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
