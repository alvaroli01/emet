"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders pop-up windows on <body>. Glass cards (backdrop-blur) trap `position: fixed` children inside them,
 * which left forms hidden under the top bar's search box. Waits for the browser so it is safe in server rendering.
 */
export function BodyPortal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}
