"use client";

import { User, Mail, Shield, BadgeCheck } from "lucide-react";
import type { SessionUser } from "@/lib/api";

interface ProfileSectionProps {
  user: SessionUser | null;
}

/**
 * Read-only profile section showing user data decoded from JWT.
 * Displayed as labelled rows with icons — no edit capability in v1.
 */
export default function ProfileSection({ user }: ProfileSectionProps) {
  if (!user) {
    return (
      <div className="dashboard-card flex flex-col items-center gap-3 py-10 text-center">
        <User className="h-10 w-10 text-leaf-200" />
        <div>
          <p className="text-sm font-medium text-leaf-700">
            Not signed in
          </p>
          <p className="mt-1 text-xs text-soil-400">
            Sign in to view your profile information.
          </p>
        </div>
      </div>
    );
  }

  const roleLabel =
    user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className="space-y-4">
      <div className="dashboard-card space-y-4">
        {/* Name / identifier */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-100">
            <User className="h-5 w-5 text-leaf-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-leaf-800">
              {user.email?.split("@")[0] ?? "User"}
            </p>
            <p className="text-xs text-soil-400">Display name</p>
          </div>
        </div>

        <hr className="border-leaf-50" />

        {/* Email */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
            <Mail className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <p className="text-sm text-leaf-800">{user.email}</p>
            <p className="text-xs text-soil-400">Email address</p>
          </div>
          <div className="ml-auto">
            <BadgeCheck className="h-5 w-5 text-leaf-400" />
          </div>
        </div>

        <hr className="border-leaf-50" />

        {/* Role */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sunlight-100">
            <Shield className="h-5 w-5 text-sunlight-500" />
          </div>
          <div>
            <p className="text-sm capitalize text-leaf-800">
              {roleLabel}
            </p>
            <p className="text-xs text-soil-400">Account role</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center rounded-full bg-leaf-100 px-3 py-0.5 text-xs font-medium capitalize text-leaf-600">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-soil-400">
        Profile information is read from your authentication token and
        cannot be edited here. Contact your administrator to update your
        name, email, or role.
      </p>
    </div>
  );
}
