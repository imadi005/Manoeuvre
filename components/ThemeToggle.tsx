"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "manoeuvre-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const isLight = theme === "light";

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-7 w-7 items-center justify-center border border-panel-line text-fog-dim transition-colors hover:border-cyan hover:text-cyan"
    >
      {isLight ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  );
}
