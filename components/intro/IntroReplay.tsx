"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { playIntro } from "@/lib/intro/shouldPlay";

export function IntroReplay({ children }: { children: ReactNode }) {
  const scene = useRef<HTMLElement>(null);
  useLayoutEffect(() => playIntro(scene.current!), []);
  return <section ref={scene} data-home-intro className="bg-earth">{children}</section>;
}
