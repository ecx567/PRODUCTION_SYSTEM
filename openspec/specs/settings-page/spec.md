# Settings Page Specification

## Purpose

Provide a sectioned settings page for user profile, notification preferences, display customization, and API key management. Persisted via localStorage (v1). No backend dependency.

## Requirements

### R1: Profile Section

The system MUST display a Profile section with editable fields: name, email, and role (read-only). Changes MUST be saved to localStorage on submit.

#### Scenario: Happy path — user updates profile name
- GIVEN the user is on the Settings page
- WHEN they edit their display name and click Save
- THEN the name is persisted to localStorage
- AND the page shows a success toast

#### Scenario: Edge case — empty name submitted
- GIVEN the user has cleared the name field
- WHEN they click Save
- THEN the field shows a validation error: "Name is required"
- AND no data is saved

### R2: Notification Preferences Section

The system MUST display toggle switches for: email alerts, SMS alerts, push notifications, and daily summary. Each toggle MUST persist to localStorage immediately on change.

#### Scenario: Happy path — toggling notification
- GIVEN notification prefs are loaded from localStorage
- WHEN the user toggles "Email Alerts" off
- THEN the toggle updates visually
- AND the new state is written to localStorage

#### Scenario: Edge case — corrupted localStorage data
- GIVEN localStorage has malformed notification prefs
- WHEN the page loads
- THEN defaults (all enabled) are applied
- AND corrupted data is replaced with valid defaults

### R3: Display Section

The system MUST display controls for: theme (light/dark/system), language, timezone, and measurement units (metric/imperial). Changes MUST persist to localStorage.

#### Scenario: Happy path — theme change
- GIVEN the user opens Display settings
- WHEN they select "Dark" theme
- THEN the theme class is applied immediately
- AND preference is saved to localStorage

#### Scenario: Edge case — unsupported language selected
- GIVEN the language dropdown is populated from a supported list
- WHEN the user selects "es"
- THEN the selection is saved
- AND future navigation respects the locale

### R4: API Keys Section

The system MUST display a read-only list of API keys with name, prefix (last 4 chars), created date, and status. No create/revoke in v1 — display mock data only.

#### Scenario: Happy path — viewing API keys
- GIVEN the user navigates to Settings > API Keys
- WHEN the section renders
- THEN it displays a table with key name, masked token, and creation date
- AND a placeholder note: "Full key management coming in v2"

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | Profile saves and reloads from localStorage across page refreshes | Pass if data persists after F5 |
| AC2 | Notification toggles persist immediately without Save button | Pass if toggle state survives page reload |
| AC3 | Theme change applies globally and persists | Pass if dark/light class is set on `<html>` and survives reload |
| AC4 | Corrupted localStorage falls back to defaults without crash | Pass if page renders with defaults |
| AC5 | API Keys section renders without error despite mock data | Pass if table displays without console errors |

## Non-functional Requirements

- **Performance**: Settings page MUST render in <500ms on a mid-range device
- **UX**: Section navigation via anchor links or tabs; active section highlighted
- **Error handling**: All localStorage reads wrapped in try/catch; failures fall back to defaults and log a warning
- **Accessibility**: Toggles MUST be keyboard-accessible and labeled

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Name | Required, max 255 chars | "Name is required" / "Name is too long" |
| Email | Must match email regex if provided | "Invalid email format" |
| Theme | Must be one of: light, dark, system | Silently ignore invalid values |
| Language | Must be from supported list | Silently ignore invalid values |
| Units | Must be: metric or imperial | Silently ignore invalid values |
