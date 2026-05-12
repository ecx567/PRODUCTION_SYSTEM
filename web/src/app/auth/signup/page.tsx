"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signupUser } from "@/lib/api";
import { Sprout } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      await signupUser(email, password, name || undefined);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Signup failed. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-leaf-600 bg-white/95 p-8 shadow-xl backdrop-blur">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-leaf-500">
          <Sprout className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-leaf-700">
            Crop Production
          </h1>
          <p className="text-xs text-soil-500">
            Precision Agriculture Platform
          </p>
        </div>
      </div>

      <h2 className="mb-6 text-center text-lg font-semibold text-leaf-800">
        Create your account
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-soil-600"
          >
            Full name <span className="text-soil-400">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-soil-600"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@crop.com"
            className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-soil-600"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-soil-600"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="mt-1 block w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm text-leaf-900 placeholder-soil-300 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-leaf-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-soil-500">
        {"Already have an account? "}
        <a
          href="/auth/login"
          className="font-medium text-leaf-500 hover:text-leaf-600"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
