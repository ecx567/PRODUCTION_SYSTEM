"use client";

import { useRouter } from "next/navigation";
import { Leaf } from "lucide-react";
import { useEffect } from "react";

export default function LockScreen() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        router.push("/dashboard");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-leaf-800 via-leaf-700 to-soil-700">
      <div className="flex flex-col items-center gap-6">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
          <Leaf className="h-10 w-10 text-white" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Crop Production System</h1>
          <p className="mt-1 text-sm text-white/60">Precision Agriculture Platform</p>
        </div>

        {/* Iniciar button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-lg bg-white/10 px-8 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
        >
          Iniciar
        </button>

        <p className="mt-2 text-xs text-white/40">Press Enter to continue</p>
      </div>
    </div>
  );
}
