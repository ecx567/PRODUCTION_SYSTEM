"use client";

import { Sprout, MapPin } from "lucide-react";
import { getCropEmoji } from "@/lib/crop-icons";

interface FieldCardProps {
  name: string;
  cropType: string;
  areaHa: number;
  plantedAt?: string | null;
  sensorCount?: number;
  alertCount?: number;
  onClick?: () => void;
}

export default function FieldCard({
  name,
  cropType,
  areaHa,
  plantedAt,
  sensorCount,
  alertCount,
  onClick,
}: FieldCardProps) {
  return (
    <div
      className="dashboard-card cursor-pointer transition-all hover:border-leaf-300 hover:shadow-md"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) onClick();
      }}
      tabIndex={0}
      role="button"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {getCropEmoji(cropType)}
          </span>
          <div>
            <p className="text-sm font-semibold text-leaf-800">{name}</p>
            <p className="text-xs capitalize text-soil-500">{cropType}</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-medium text-leaf-600">
          {areaHa} ha
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-leaf-50 pt-3 text-xs text-soil-400">
        {plantedAt && (
          <span className="flex items-center gap-1">
            <Sprout className="h-3 w-3" />
            {new Date(plantedAt).toLocaleDateString()}
          </span>
        )}
        {sensorCount !== undefined && (
          <span>{sensorCount} sensors</span>
        )}
        {alertCount !== undefined && alertCount > 0 && (
          <span className="font-medium text-danger-500">
            {alertCount} alert{alertCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
