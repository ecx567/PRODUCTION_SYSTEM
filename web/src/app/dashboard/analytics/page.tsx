"use client";

import { TrendingUp, BarChart3, LineChart, PieChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-leaf-700">Analytics</h1>
        <p className="text-sm text-soil-500">
          Historical trends, ML predictions, and crop intelligence
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Crop Trends</h3>
          <p className="mt-1 text-xs text-soil-400">
            Historical sensor data, GDD tracking, and growth stage analysis
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>

        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Yield Prediction</h3>
          <p className="mt-1 text-xs text-soil-400">
            ML-based harvest forecasting and anomaly detection
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>

        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <LineChart className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Pest Risk</h3>
          <p className="mt-1 text-xs text-soil-400">
            GDD-based pest prediction (FAW, Sigatoka, Blast, Witches&apos; Broom)
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
