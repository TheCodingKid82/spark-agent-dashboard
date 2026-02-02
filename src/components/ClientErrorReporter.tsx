"use client";

import { useEffect } from "react";

export function ClientErrorReporter() {
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      try {
        fetch("/api/client-errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
          }),
        });
      } catch {
        // ignore
      }
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      try {
        const reason: any = event.reason;
        fetch("/api/client-errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "UnhandledPromiseRejection",
            reason: typeof reason === "string" ? reason : reason?.message,
            stack: reason?.stack,
          }),
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  return null;
}
