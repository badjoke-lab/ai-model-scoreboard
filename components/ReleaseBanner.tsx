"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { shellClass } from "@/lib/layout";

const DISMISS_KEY = "aims-v4-banner-dismissed";

export default function ReleaseBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "true");
  };

  return (
    <div className="border-b border-accent/40 bg-accent/10 text-accent">
      <div
        className={`${shellClass} flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="space-y-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em]">Update</p>
          <p className="text-sm font-semibold text-accent">
            AMS v4 is live — scores are updated from the latest snapshot.
          </p>
          <div className="flex flex-wrap gap-3 text-[0.85rem]">
            <Link href="/docs" className="underline underline-offset-4 hover:text-accent/80">
              Read the docs
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="self-start rounded-full border border-accent/40 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.15em] hover:bg-accent/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
