import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TakaPay Pulse — Social Listening Dashboard",
  description:
    "660 raw social posts about TakaPay turned into what a brand manager should act on. Take-home task for Markopolo AI (DeepDive).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
