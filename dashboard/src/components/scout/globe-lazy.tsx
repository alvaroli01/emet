"use client";

import dynamic from "next/dynamic";

/** three.js + map outlines only download on the Scout page; the contour pattern holds the place meanwhile. */
export const GlobeLazy = dynamic(() => import("./globe"), {
  ssr: false,
  loading: () => <div className="contours size-full rounded-full opacity-40" aria-hidden />,
});
