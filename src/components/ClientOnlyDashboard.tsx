"use client";

import dynamic from "next/dynamic";

// Dynamically import the Dashboard with SSR disabled
const Dashboard = dynamic(() => import("./Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto mb-4" />
        <p className="text-zinc-500 text-sm">Loading Mission Control...</p>
      </div>
    </div>
  ),
});

export default function ClientOnlyDashboard() {
  return <Dashboard />;
}
