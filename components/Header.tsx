"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { shellClass } from "@/lib/layout";

const navItems = [
  { href: "/v4", label: "SCORES" },
  { href: "/methodology", label: "METHODOLOGY" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-background/80 backdrop-blur">
      <div className={`${shellClass} flex items-center justify-between py-3 sm:py-3.5`}>
        <Link aria-label="AI Model Scoreboard home" href="/" className="flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="AI Model Scoreboard"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <div className="leading-tight">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-50">
              <span>AI Model Scoreboard</span>
            </div>
            <div className="text-sm font-medium text-slate-400">
              Evidence-first scoring for AI models.
            </div>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-3 sm:gap-4 text-sm">
          {navItems.map((item) => {
            const active =
              item.href === "/v4"
                ? pathname === "/" ||
                  pathname?.startsWith(item.href) ||
                  pathname?.startsWith("/scores")
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={`Navigate to ${item.label}`}
                className={`hidden text-[0.75rem] font-semibold uppercase tracking-wide sm:inline ${
                  active
                    ? "text-slate-50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
