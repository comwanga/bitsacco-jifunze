"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { playIntro } from "@/lib/intro/shouldPlay";

export function IntroReplay({ children }: { children: ReactNode }) {
  const scene = useRef<HTMLElement>(null);
  useLayoutEffect(() => playIntro(scene.current!), []);
  // The pre-paint script adds the animation class before React hydrates this section.
  return <section ref={scene} data-home-intro suppressHydrationWarning className="bg-earth">{children}</section>;
}
