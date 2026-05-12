# Crop Types Expansion — Specification

## Purpose

Expand crop type support from the current 4-type enum to an extensible `String(50)` model, allowing dynamic addition of new crop types without schema migrations. Add 6 new crop types to the Pydantic `ALLOWED_CROP_TYPES` set.

## Requirements

### R1: Database — Change Column Type

The system MUST change the `crop_type` column in the `fields` table from SQLAlchemy `Enum("banana","maize","cacao","rice")` to `String(50)`. An Alembic migration MUST handle this change, preserving all existing data.

#### Scenario: Happy path — migration succeeds
- GIVEN the fields table has rows with existing enum values (banana, maize, cacao, rice)
- WHEN the Alembic migration runs
- THEN the column type changes to VARCHAR(50)
- AND all existing values remain intact

#### Scenario: Edge case — migration with NULL crop_type
- GIVEN a field row has `crop_type IS NULL`
- WHEN the migration runs
- THEN the column converts to String(50) with NULL preserved
- AND no error is raised

### R2: Model — Update SQLAlchemy

The system MUST change `crop_type` in `Field` model from `Enum(...)` to `mapped_column(String(50))`. The comment MUST be updated to reflect the new validation mechanism.

#### Scenario: Happy path — model validation
- GIVEN the Field model is updated
- WHEN a new field is created with crop_type "coffee"
- THEN the ORM accepts the value (no Enum constraint)
- AND the row is written successfully

### R3: Pydantic — Expand ALLOWED_CROP_TYPES

The system MUST add 6 new crop types to the `ALLOWED_CROP_TYPES` set: `"coffee", "sugarcane", "soybean", "wheat", "cotton", "palm_oil"`. Existing validators MUST remain unchanged.

#### Scenario: Happy path — new crop type accepted
- GIVEN the Pydantic schema is updated
- WHEN a FieldCreate request has crop_type="coffee"
- THEN the request passes validation
- AND the field is created

#### Scenario: Edge case — unknown crop type still rejected
- GIVEN the updated ALLOWED_CROP_TYPES
- WHEN a FieldCreate request has crop_type="lavender"
- THEN the request returns 400: "Invalid crop type 'lavender'"

### R4: Seed Script — Include New Crops

The system MUST update the seed script to create fields with the new crop types alongside existing ones.

#### Scenario: Happy path — seed runs
- GIVEN the seed script is updated
- WHEN it runs
- THEN fields with crop types "coffee", "sugarcane", etc. are created
- AND no validation errors occur

## Acceptance Criteria

| ID | Criterion | Pass/Fail |
|----|-----------|-----------|
| AC1 | All existing fields retain their crop_type after migration | Pass if `SELECT DISTINCT crop_type FROM fields` returns same values before/after |
| AC2 | New fields can use any of the 10 crop types | Pass if creating a field with each new type succeeds |
| AC3 | Unknown crop types are rejected at Pydantic level | Pass if "lavender" returns 400 |
| AC4 | Alembic downgrade restores enum without data loss | Pass if downgrade + upgrade preserves all rows |

## Non-functional Requirements

- **Migration speed**: Should complete in <1s for typical tables (<100k rows)
- **Backward compatibility**: Existing API consumers sending "banana"/"maize"/"cacao"/"rice" MUST continue to work
- **Extensibility**: Future crop additions MUST require only changing `ALLOWED_CROP_TYPES` set — no migration needed

## Validation Rules

| Field | Rule | Location |
|-------|------|----------|
| crop_type | Must be in ALLOWED_CROP_TYPES (10 values) | Pydantic schema |
| crop_type | Must be lowercase string | Pydantic validator |
| crop_type | Length 1-50 chars | DB column + Pydantic |
