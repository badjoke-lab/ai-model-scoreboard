"use client";

import type { V4ErrorInfo } from "@/lib/v4/useV4StateMachine";

export default function V4ErrorState({
  error,
  onRetry,
  onReload,
}: {
  error: V4ErrorInfo | null;
  onRetry: () => void;
  onReload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
      <div className="text-base font-semibold">Something went wrong.</div>
      <p className="mt-2 text-sm text-rose-100/80">
        We could not load the leaderboard data. You can retry the request or reload the
        page.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-rose-400/50 px-3 py-1 text-xs font-medium text-rose-100 hover:border-rose-300"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onReload}
          className="rounded-full border border-rose-400/50 px-3 py-1 text-xs font-medium text-rose-100 hover:border-rose-300"
        >
          Reload page
        </button>
      </div>
      {error ? (
        <details className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-50">
          <summary className="cursor-pointer text-xs font-semibold">
            Debug details
          </summary>
          <div className="mt-2 space-y-1 text-rose-50/80">
            <div>Error: {error.message}</div>
            <div>Endpoint: {error.endpoint}</div>
            <div>Timestamp: {error.timestamp}</div>
            {error.expectedPath ? (
              <div>Expected path: {error.expectedPath}</div>
            ) : null}
            {error.detail ? <div>Details: {error.detail}</div> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
