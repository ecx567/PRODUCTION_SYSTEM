/**
 * Login screen: email + password authentication.
 *
 * - Form validation with error display
 * - Loading state during auth
 * - Redirects to dashboard on success
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Redirect } from "expo-router";
import { useStore } from "@/lib/store";

export default function LoginScreen() {
  const { login, isAuthenticated, isAuthLoading, authError } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password.");
      return;
    }

    try {
      await login(email.trim(), password);
      // Navigation handled by the auth guard in _layout.tsx
    } catch {
      // Error is captured in the store
    }
  };

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-leaf-dark"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="mb-10 items-center">
          <View className="h-16 w-16 rounded-full bg-leaf-light items-center justify-center mb-4">
            <Text className="text-3xl text-white font-bold">C</Text>
          </View>
          <Text className="text-3xl font-bold text-white">CropMonitor</Text>
          <Text className="text-leaf-light mt-2 text-base">
            Digital Agriculture Platform
          </Text>
        </View>

        {/* Form */}
        <View className="bg-white rounded-2xl p-6 shadow-lg">
          <Text className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign In
          </Text>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-600 mb-1">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-800 bg-gray-50"
              placeholder="farmer@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!isAuthLoading}
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-600 mb-1">Password</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-800 bg-gray-50"
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isAuthLoading}
            />
          </View>

          {/* Error */}
          {authError && (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm">{authError}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            className="bg-leaf rounded-lg py-3 items-center disabled:opacity-50"
            onPress={handleLogin}
            disabled={isAuthLoading}
          >
            {isAuthLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text className="text-center text-gray-400 text-xs mt-8">
          Version 1.0.0
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
