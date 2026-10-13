"use client";

import dynamic from "next/dynamic";

/** Boards render in the browser only (drag-and-drop ids and "overdue" depend on the viewer's clock),
 *  with a skeleton for the moment before they appear. */
export const LazyBoard = dynamic(() => import("./board").then((m) => m.Board), {
  ssr: false,
  loading: () => (
    <div className="flex gap-3 overflow-hidden pb-4" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-72 shrink-0 animate-pulse space-y-2 rounded-2xl bg-surface-2/70 p-3">
          <div className="h-4 w-24 rounded bg-line" />
          <div className="h-16 rounded-xl bg-surface" />
          {i % 2 === 0 && <div className="h-16 rounded-xl bg-surface" />}
        </div>
      ))}
    </div>
  ),
});
