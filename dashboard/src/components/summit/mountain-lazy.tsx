"use client";

import dynamic from "next/dynamic";

/** three.js only downloads on screens that show the mountain; the contour pattern holds its place meanwhile. */
export const MountainLazy = dynamic(() => import("./mountain"), {
  ssr: false,
  loading: () => <div className="contours size-full" aria-hidden />,
});

/** Data terrain (3D columns on a contour plate) — same lazy loading as the mountain. */
export const TerrainLazy = dynamic(() => import("./terrain"), {
  ssr: false,
  loading: () => <div className="contours size-full opacity-60" aria-hidden />,
});
