"use client";

import dynamic from "next/dynamic";

/** three.js only downloads on screens that show the mountain; the contour pattern holds its place meanwhile. */
export const MountainLazy = dynamic(() => import("./mountain"), {
  ssr: false,
  loading: () => <div className="contours size-full" aria-hidden />,
});
