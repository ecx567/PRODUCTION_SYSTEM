"use client";

import { Users, Shield, UserPlus } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-leaf-700">Users</h1>
        <p className="text-sm text-soil-500">
          Team members, roles, and access control
        </p>
      </div>

      {/* Placeholder */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <Users className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">User Directory</h3>
          <p className="mt-1 text-xs text-soil-400">
            Manage user accounts, roles, and permissions
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>

        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <Shield className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Role Management</h3>
          <p className="mt-1 text-xs text-soil-400">
            RBAC configuration: admin, agronomist, farmer roles
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
