"use client";

import { ReactNode, useEffect, useState, createElement, Fragment } from "react";

// This component only loads Convex on the client side
// to avoid errors during static site generation
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [ConvexWrapper, setConvexWrapper] = useState<React.FC<{children: ReactNode}>>(
    () => ({ children }: {children: ReactNode}) => createElement(Fragment, null, children)
  );
  
  useEffect(() => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      console.warn("[Convex] No NEXT_PUBLIC_CONVEX_URL set, skipping Convex initialization");
      return;
    }
    
    // Dynamically import Convex only on client
    import("convex/react").then(({ ConvexProvider, ConvexReactClient }) => {
      const client = new ConvexReactClient(convexUrl);
      setConvexWrapper(() => ({ children }: {children: ReactNode}) =>
        createElement(ConvexProvider, { client }, children)
      );
    }).catch(err => {
      console.error("[Convex] Failed to load:", err);
    });
  }, []);
  
  return createElement(ConvexWrapper, null, children);
}
