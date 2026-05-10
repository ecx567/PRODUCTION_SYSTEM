"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sprout } from "lucide-react";
import { useFields } from "@/lib/hooks";

const CROP_EMOJIS: Record<string, string> = {
  banana: "🍌",
  maize: "🌽",
  cacao: "🍫",
  rice: "🌾",
};

export default function FieldsPage() {
  const router = useRouter();
  const { fields, isLoading, error, total } = useFields();
  const [search, setSearch] = useState("");

  const filtered = search
    ? fields.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.crop_type.toLowerCase().includes(search.toLowerCase()),
      )
    : fields;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-leaf-800">Fields</h1>
        <p className="text-sm text-soil-500">
          {total} active field{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soil-400" />
        <input
          type="text"
          placeholder="Search fields by name or crop type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-leaf-200 bg-white py-2.5 pl-10 pr-4 text-sm text-leaf-900 placeholder-soil-300 focus:border-leaf-400 focus:outline-none focus:ring-2 focus:ring-leaf-200"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dashboard-card">
              <div className="space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-leaf-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-leaf-50" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-leaf-50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="dashboard-card flex flex-col items-center gap-3 py-12 text-center">
          <Sprout className="h-10 w-10 text-leaf-200" />
          <p className="text-sm text-soil-400">
            {search ? "No fields match your search" : "No fields yet"}
          </p>
        </div>
      )}

      {/* Fields grid */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((field) => (
            <div
              key={field.id}
              className="dashboard-card cursor-pointer transition-all hover:border-leaf-300 hover:shadow-md"
              onClick={() => router.push(`/dashboard/fields/${field.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {CROP_EMOJIS[field.crop_type] ?? "🌱"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-leaf-800">
                      {field.name}
                    </p>
                    <p className="text-xs capitalize text-soil-500">
                      {field.crop_type}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-leaf-50 pt-3">
                <div>
                  <p className="text-xs text-soil-400">Area</p>
                  <p className="text-sm font-medium text-leaf-700">
                    {field.area_ha} ha
                  </p>
                </div>
                <div>
                  <p className="text-xs text-soil-400">Planted</p>
                  <p className="text-sm font-medium text-leaf-700">
                    {field.planted_at
                      ? new Date(field.planted_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
