# Delta for Crop Types

## MODIFIED Requirements

### Requirement: R3 — Pydantic — Expand ALLOWED_CROP_TYPES

The system MUST expand the `ALLOWED_CROP_TYPES` set to contain 20-30 crop types including the current 10 plus: `"pineapple", "papaya", "mango", "avocado", "citrus", "tomato", "chili_pepper", "onion", "cassava", "sweet_potato", "peanut", "sorghum", "millet", "coconut", "rubber", "vanilla", "ginger", "turmeric"`. Existing validators MUST remain unchanged.
(Previously: added 6 new crop types — coffee, sugarcane, soybean, wheat, cotton, palm_oil)

#### Scenario: Happy path — new crop types accepted
- GIVEN the ALLOWED_CROP_TYPES set contains 20-30 values
- WHEN a FieldCreate request has crop_type="pineapple"
- THEN the request passes validation and the field is created

#### Scenario: Edge case — unknown crop type still rejected
- GIVEN the expanded ALLOWED_CROP_TYPES
- WHEN a FieldCreate request has crop_type="lavender"
- THEN the request returns 400: "Invalid crop type 'lavender'"

## ADDED Requirements

### Requirement: R5 — Cross-validate with Crop Profiles

The system MUST validate that a field's `crop_type` has a matching entry in `crop_profiles.json` before generating recommendations. If no profile exists, a warning MUST be logged and recommendations fall back to hardcoded defaults.

#### Scenario: Profile exists — use dynamic data
- GIVEN a field with crop_type="coffee" and `crop_profiles.json` has a "coffee" entry
- WHEN recommendations are generated
- THEN the engine reads FAO-56 Kc values from the profile
- AND the recommendation uses dynamic parameters

#### Scenario: Profile missing — log warning
- GIVEN a field with crop_type="vanilla" and no "vanilla" entry in `crop_profiles.json`
- WHEN recommendations are generated
- THEN a warning is logged: "No crop profile for 'vanilla', using defaults"
- AND the engine falls back to hardcoded generic constants
