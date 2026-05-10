/**
 * Loading skeleton: pulsing placeholder cards for initial load state.
 */

import React from "react";
import { View } from "react-native";

interface LoadingSkeletonProps {
  count?: number;
}

function SkeletonCard() {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
      <View className="flex-row items-center">
        <View className="h-12 w-12 rounded-full bg-gray-200 mr-4 animate-pulse" />
        <View className="flex-1">
          <View className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
          <View className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </View>
      </View>
    </View>
  );
}

export default function LoadingSkeleton({ count = 5 }: LoadingSkeletonProps) {
  return (
    <View className="p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
