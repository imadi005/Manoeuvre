import type { Metadata } from "next";
import Script from "next/script";
import { Orbitron, Chakra_Petch, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import IntroSequence from "@/components/IntroSequence";

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const chakra = Chakra_Petch({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const shareTech = Share_Tech_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "MANOEUVRE 2026 — KJIT Presents — 21st Edition",
  description:
    "MANOEUVRE 2026, Kristu Jayanti Institute of Technology's flagship fest, 21st edition. 未来をハックする — Hack the Future. 17–24 August 2026.",
  openGraph: {
    title: "MANOEUVRE 2026",
    description: "KJIT's flagship fest, 21st edition. 17–24 August 2026.",
    images: ["/logo.png"],
  },
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("manoeuvre-theme");
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${orbitron.variable} ${chakra.variable} ${shareTech.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-fog">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <IntroSequence />
        {children}
      </body>
    </html>
  );
}
