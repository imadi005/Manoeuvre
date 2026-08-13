import Image from "next/image";
import HappeningNowBar from "./HappeningNowBar";
import ThemeToggle from "./ThemeToggle";
import { getSession } from "@/lib/auth/session";
import { DASHBOARD_BY_ROLE } from "@/lib/dashboardPath";
import { logout } from "@/app/login/actions";

const links = [
  { label: "Events", href: "/#events" },
  { label: "Factions", href: "/#factions" },
  { label: "Schedule", href: "/#schedule" },
  { label: "Leaderboard", href: "/leaderboard" },
];

export default async function Navbar() {
  const session = await getSession();
  const dashboardHref = session ? (session.mustReset ? "/verify-otp" : DASHBOARD_BY_ROLE[session.role]) : null;

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <HappeningNowBar />
      <div className="border-b border-panel-line/80 bg-void-deep/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="relative h-7 w-28 shrink-0 sm:h-8 sm:w-32">
            <Image src="/logo.png" alt="MANŒUVRE" fill sizes="128px" className="object-contain object-left" priority />
          </a>

          <div className="hidden items-center gap-8 font-mono-fx text-xs uppercase tracking-widest text-fog-dim sm:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-cyan">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {session ? (
              <>
                <a
                  href={dashboardHref!}
                  className="inline-block border border-cyan/60 px-3 py-1.5 font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan hover:text-void sm:px-4"
                >
                  <span className="sm:hidden">Dashboard</span>
                  <span className="hidden sm:inline">
                    {session.name.split(" ")[0]}&rsquo;s Dashboard
                  </span>
                </a>
                <form action={logout}>
                  <button
                    type="submit"
                    className="border border-magenta/60 px-4 py-1.5 font-mono-fx text-xs uppercase tracking-widest text-magenta transition-colors hover:bg-magenta hover:text-void box-glow-magenta"
                  >
                    Log Out
                  </button>
                </form>
              </>
            ) : (
              <a
                href="/login"
                className="border border-magenta/60 px-4 py-1.5 font-mono-fx text-xs uppercase tracking-widest text-magenta transition-colors hover:bg-magenta hover:text-void box-glow-magenta"
              >
                Login
              </a>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
