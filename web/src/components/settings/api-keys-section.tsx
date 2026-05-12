"use client";

import { useState } from "react";
import { Key, Copy, Check, Eye, EyeOff } from "lucide-react";

/**
 * Mock API keys for display purposes.
 * In v1 these are hard-coded — a future version will fetch from a backend endpoint.
 */
const MOCK_API_KEYS: Array<{
  id: string;
  name: string;
  keyValue: string;
  created: string;
  status: "active" | "expired" | "revoked";
}> = [
  {
    id: "key-001",
    name: "Production API Key",
    keyValue: "crop_prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p",
    created: "2026-01-15",
    status: "active",
  },
  {
    id: "key-002",
    name: "Staging API Key",
    keyValue: "crop_staging_q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1",
    created: "2026-03-01",
    status: "active",
  },
  {
    id: "key-003",
    name: "Development Key",
    keyValue: "crop_dev_g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7",
    created: "2026-02-10",
    status: "expired",
  },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-leaf-100 text-leaf-600",
  expired: "bg-sunlight-50 text-sunlight-600",
  revoked: "bg-danger-50 text-danger-600",
};

/**
 * Read-only API key table with copy-to-clipboard functionality.
 * Shows mock keys for demonstration in v1.
 */
export default function ApiKeysSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  async function handleCopy(key: (typeof MOCK_API_KEYS)[0]) {
    try {
      await navigator.clipboard.writeText(key.keyValue);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers or insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = key.keyValue;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(key.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  function maskKey(key: string): string {
    return `${key.slice(0, 12)}${"•".repeat(20)}${key.slice(-4)}`;
  }

  return (
    <div className="space-y-4">
      <div className="dashboard-card overflow-hidden">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-leaf-500" />
          <h3 className="text-sm font-semibold text-leaf-800">
            API Keys
          </h3>
        </div>

        {MOCK_API_KEYS.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Key className="h-8 w-8 text-leaf-200" />
            <p className="text-sm text-soil-400">No API keys created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="api-keys-table">
              <thead>
                <tr className="border-b border-leaf-100 text-xs text-soil-400">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Key</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_API_KEYS.map((apiKey) => (
                  <tr
                    key={apiKey.id}
                    className="border-b border-leaf-50 last:border-none hover:bg-leaf-50/50"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-medium text-leaf-800">
                        {apiKey.name}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-soil-500">
                        {visibleId === apiKey.id
                          ? apiKey.keyValue
                          : maskKey(apiKey.keyValue)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-soil-500">
                      {apiKey.created}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[apiKey.status]}`}
                      >
                        {apiKey.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {/* Toggle visibility */}
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleId(
                              visibleId === apiKey.id ? null : apiKey.id,
                            )
                          }
                          className="rounded-md p-1.5 text-soil-400 transition-colors hover:bg-leaf-100 hover:text-leaf-600"
                          title={visibleId === apiKey.id ? "Hide key" : "Show key"}
                        >
                          {visibleId === apiKey.id ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>

                        {/* Copy */}
                        <button
                          type="button"
                          onClick={() => handleCopy(apiKey)}
                          className="rounded-md p-1.5 text-soil-400 transition-colors hover:bg-leaf-100 hover:text-leaf-600"
                          title="Copy to clipboard"
                          data-testid={`copy-key-${apiKey.id}`}
                        >
                          {copiedId === apiKey.id ? (
                            <Check className="h-4 w-4 text-leaf-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-soil-400">
        API keys shown here are for demonstration purposes only. A
        production API key management endpoint will be available in a
        future release.
      </p>
    </div>
  );
}
