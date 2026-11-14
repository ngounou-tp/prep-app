"use client";

import { useEffect, useRef } from "react";
import { PRINT_AREA, printScale } from "@/lib/client/printFit";

// The report is hidden on screen, so it is laid out off-screen at the page width to be measured.
function measuredHeight(node: HTMLElement): number {
  const inline = node.style.cssText;
  node.style.cssText = `display:block;position:absolute;left:-10000px;top:0;visibility:hidden;width:${PRINT_AREA.width}px`;
  const height = node.scrollHeight;
  node.style.cssText = inline;
  return height;
}

export function usePrintFit() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const fit = () => {
      const node = ref.current;
      if (node !== null) {
        node.style.zoom = "";
        const scale = printScale(measuredHeight(node));
        node.style.zoom = scale === 1 ? "" : String(scale);
      }
    };
    const reset = () => {
      if (ref.current !== null) {
        ref.current.style.zoom = "";
      }
    };
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", reset);
    return () => {
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", reset);
    };
  }, []);
  return ref;
}
