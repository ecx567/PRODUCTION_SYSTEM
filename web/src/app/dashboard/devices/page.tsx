"use client";

import { Radio, Wifi, WifiOff, Cpu } from "lucide-react";
import { useSSE } from "@/lib/hooks";

export default function DevicesPage() {
  const { isConnected } = useSSE();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-leaf-700">Devices</h1>
        <p className="text-sm text-soil-500">
          IoT sensor registry, gateways, and connectivity status
        </p>
      </div>

      {/* Connection status */}
      <div className="dashboard-card flex items-center gap-3">
        {isConnected ? (
          <Wifi className="h-5 w-5 text-leaf-500" />
        ) : (
          <WifiOff className="h-5 w-5 text-danger-400" />
        )}
        <div>
          <p className="text-sm font-medium text-leaf-700">
            {isConnected ? "SSE Connected" : "SSE Disconnected"}
          </p>
          <p className="text-xs text-soil-400">
            {isConnected
              ? "Real-time data stream active"
              : "Check MQTT broker and backend status"}
          </p>
        </div>
      </div>

      {/* Placeholder grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <Radio className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Sensor Registry</h3>
          <p className="mt-1 text-xs text-soil-400">
            Register, configure, and manage IoT sensors
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>

        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center">
          <Cpu className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">Gateways</h3>
          <p className="mt-1 text-xs text-soil-400">
            Edge gateway configuration and firmware
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>

        <div className="dashboard-card flex flex-col items-center justify-center py-10 text-center sm:col-span-2 lg:col-span-1">
          <Wifi className="mb-3 h-8 w-8 text-leaf-300" />
          <h3 className="text-sm font-semibold text-leaf-700">MQTT Broker</h3>
          <p className="mt-1 text-xs text-soil-400">
            Message queue status, topics, and throughput
          </p>
          <span className="mt-3 inline-block rounded-full bg-leaf-100 px-3 py-1 text-[10px] text-leaf-600">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
