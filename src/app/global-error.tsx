"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-sm font-semibold">Global error</div>
            <div className="mt-2 text-xs text-zinc-400 break-words">{error.message}</div>
            <button
              className="mt-4 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm"
              onClick={() => reset()}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
