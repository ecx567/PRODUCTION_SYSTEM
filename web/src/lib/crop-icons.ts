/**
 * Shared crop emoji map and helpers.
 *
 * Provides a single source of truth for crop type → emoji mapping across
 * all components. Falls back to 🌱 (seedling) for unknown crop types.
 */

/**
 * Unique emoji for each supported crop type.
 * Covers all 18 crop types from ALLOWED_CROP_TYPES.
 */
export const CROP_EMOJIS: Record<string, string> = {
  banana: "🍌",
  maize: "🌽",
  cacao: "🍫",
  rice: "🌾",
  coffee: "☕",
  sugarcane: "🎋",
  soybean: "🟢",
  sunflower: "🌻",
  palm_oil: "🌴",
  cotton: "☁️",
  cassava: "🥔",
  sweet_potato: "🍠",
  coconut: "🥥",
  pineapple: "🍍",
  mango: "🥭",
  papaya: "🧡",
  tomato: "🍅",
  beans: "🫘",
};

/**
 * Get the emoji for a given crop type.
 * Trims whitespace and lowercases before lookup.
 * Falls back to 🌱 (seedling) for unknown or unrecognised types.
 */
export function getCropEmoji(cropType: string): string {
  return CROP_EMOJIS[cropType.trim().toLowerCase()] ?? "🌱";
}

/**
 * Reference list of all allowed crop type keys.
 * Useful for iteration or validation in components.
 */
export const ALLOWED_CROP_TYPES: string[] = Object.keys(CROP_EMOJIS);
