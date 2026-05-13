/**
 * Mock data for development without backend API.
 *
 * Provides realistic data for fields, alerts, sensors, and analytics
 * so the dashboard is functional without the Django backend running.
 *
 * Toggle with NEXT_PUBLIC_USE_MOCK=true in .env.local
 */

import type {
  FieldResponse,
  AlertEventResponse,
  SensorReadingResponse,
  SensorReadingSummary,
  HourlyRollup,
  RecommendationSummary,
  YieldPredictionResponse,
} from "./api";

// ── Utility ─────────────────────────────────────────────────────

function random(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

// ── 12 Realistic Fields ─────────────────────────────────────────

export const MOCK_FIELDS: FieldResponse[] = [
  { id: "f1", tenant_id: "t1", name: "Campo Norte", crop_type: "maize", planted_at: "2025-10-15T00:00:00Z", area_ha: 42.5, location: "-34.92,-56.17", created_at: "2025-09-01T00:00:00Z", deleted_at: null },
  { id: "f2", tenant_id: "t1", name: "Lote Sur", crop_type: "soybean", planted_at: "2025-11-01T00:00:00Z", area_ha: 38.0, location: "-35.10,-56.30", created_at: "2025-09-01T00:00:00Z", deleted_at: null },
  { id: "f3", tenant_id: "t1", name: "Parcela Este", crop_type: "wheat", planted_at: "2025-06-20T00:00:00Z", area_ha: 25.3, location: "-34.85,-56.05", created_at: "2025-06-01T00:00:00Z", deleted_at: null },
  { id: "f4", tenant_id: "t1", name: "Terreno Oeste", crop_type: "rice", planted_at: "2025-10-20T00:00:00Z", area_ha: 18.7, location: "-35.02,-56.40", created_at: "2025-10-01T00:00:00Z", deleted_at: null },
  { id: "f5", tenant_id: "t1", name: "Quinta A", crop_type: "sunflower", planted_at: "2025-11-15T00:00:00Z", area_ha: 12.0, location: "-34.78,-56.12", created_at: "2025-11-01T00:00:00Z", deleted_at: null },
  { id: "f6", tenant_id: "t1", name: "Huerta Central", crop_type: "tomato", planted_at: "2025-12-01T00:00:00Z", area_ha: 8.5, location: "-34.95,-56.22", created_at: "2025-11-15T00:00:00Z", deleted_at: null },
  { id: "f7", tenant_id: "t1", name: "Viñedo B", crop_type: "grape", planted_at: "2024-03-10T00:00:00Z", area_ha: 15.2, location: "-34.88,-56.10", created_at: "2024-03-01T00:00:00Z", deleted_at: null },
  { id: "f8", tenant_id: "t1", name: "Parcela C", crop_type: "cotton", planted_at: "2025-09-15T00:00:00Z", area_ha: 22.0, location: "-35.05,-56.35", created_at: "2025-09-01T00:00:00Z", deleted_at: null },
  { id: "f9", tenant_id: "t1", name: "Campo Chico", crop_type: "potato", planted_at: "2025-08-20T00:00:00Z", area_ha: 6.3, location: "-34.72,-56.08", created_at: "2025-08-01T00:00:00Z", deleted_at: null },
  { id: "f10", tenant_id: "t1", name: "Lote de Prueba", crop_type: "sugarcane", planted_at: "2025-05-01T00:00:00Z", area_ha: 30.0, location: "-35.15,-56.45", created_at: "2025-04-15T00:00:00Z", deleted_at: null },
  { id: "f11", tenant_id: "t1", name: "Parcela D", crop_type: "coffee", planted_at: "2023-02-10T00:00:00Z", area_ha: 10.8, location: "-34.80,-56.15", created_at: "2023-02-01T00:00:00Z", deleted_at: null },
  { id: "f12", tenant_id: "t1", name: "Campo Experimental", crop_type: "maize", planted_at: "2025-10-01T00:00:00Z", area_ha: 55.0, location: "-34.98,-56.28", created_at: "2025-09-15T00:00:00Z", deleted_at: null },
];

// ── 10 Realistic Alerts ─────────────────────────────────────────

export const MOCK_ALERTS: AlertEventResponse[] = [
  { id: "a1", rule_id: "r1", field_id: "f1", metric_type: "soil_moisture", actual_value: 18.2, threshold: 25.0, severity: "warning", message: "Low soil moisture in Campo Norte", triggered_at: hoursAgo(2), acknowledged_at: null },
  { id: "a2", rule_id: "r2", field_id: "f3", metric_type: "temp", actual_value: 38.5, threshold: 35.0, severity: "critical", message: "Heat stress detected in Parcela Este", triggered_at: hoursAgo(5), acknowledged_at: hoursAgo(3) },
  { id: "a3", rule_id: "r3", field_id: "f2", metric_type: "humidity", actual_value: 92.0, threshold: 85.0, severity: "warning", message: "High humidity in Lote Sur — disease risk", triggered_at: hoursAgo(1), acknowledged_at: null },
  { id: "a4", rule_id: "r1", field_id: "f6", metric_type: "soil_moisture", actual_value: 15.0, threshold: 25.0, severity: "critical", message: "Critical soil moisture in Huerta Central", triggered_at: hoursAgo(8), acknowledged_at: hoursAgo(6) },
  { id: "a5", rule_id: "r4", field_id: "f4", metric_type: "rain", actual_value: 0.0, threshold: 5.0, severity: "warning", message: "No rainfall detected in Terreno Oeste", triggered_at: hoursAgo(12), acknowledged_at: null },
  { id: "a6", rule_id: "r5", field_id: "f8", metric_type: "temp", actual_value: 40.1, threshold: 38.0, severity: "critical", message: "Extreme temperature in Parcela C", triggered_at: hoursAgo(3), acknowledged_at: hoursAgo(1) },
  { id: "a7", rule_id: "r6", field_id: "f7", metric_type: "soil_moisture", actual_value: 55.0, threshold: 40.0, severity: "info", message: "Soil moisture optimal in Viñedo B", triggered_at: hoursAgo(4), acknowledged_at: null },
  { id: "a8", rule_id: "r7", field_id: "f5", metric_type: "humidity", actual_value: 35.0, threshold: 50.0, severity: "warning", message: "Low humidity in Quinta A — irrigation needed", triggered_at: hoursAgo(6), acknowledged_at: null },
  { id: "a9", rule_id: "r3", field_id: "f10", metric_type: "humidity", actual_value: 88.0, threshold: 85.0, severity: "warning", message: "High humidity in Lote de Prueba", triggered_at: hoursAgo(10), acknowledged_at: null },
  { id: "a10", rule_id: "r8", field_id: "f12", metric_type: "temp", actual_value: 36.2, threshold: 35.0, severity: "warning", message: "Elevated temperature in Campo Experimental", triggered_at: hoursAgo(0.5), acknowledged_at: null },
];

// ── Sensor Readings ─────────────────────────────────────────────

export function getMockSensors(fieldId: string): SensorReadingResponse[] {
  const now = Date.now();
  return [
    { time: new Date(now - 120_000).toISOString(), tenant_id: "t1", sensor_id: `${fieldId}-s1`, field_id: fieldId, temp: random(22, 32), humidity: random(45, 85), soil_moisture: random(15, 45), rain: random(0, 2), ingestion_ts: new Date().toISOString(), validation_status: "valid" },
    { time: new Date(now - 60_000).toISOString(), tenant_id: "t1", sensor_id: `${fieldId}-s2`, field_id: fieldId, temp: random(23, 33), humidity: random(42, 80), soil_moisture: random(18, 48), rain: random(0, 1), ingestion_ts: new Date().toISOString(), validation_status: "valid" },
    { time: new Date().toISOString(), tenant_id: "t1", sensor_id: `${fieldId}-s3`, field_id: fieldId, temp: random(22, 31), humidity: random(48, 82), soil_moisture: random(20, 42), rain: 0, ingestion_ts: new Date().toISOString(), validation_status: "valid" },
  ];
}

export function getMockSensorSummary(_fieldId: string): SensorReadingSummary {
  return {
    period_start: hoursAgo(24),
    period_end: new Date().toISOString(),
    avg_temp: random(24, 30),
    avg_humidity: random(55, 75),
    avg_soil_moisture: random(22, 38),
    total_rain: random(0, 12),
    reading_count: random(500, 2000, 0),
    sensor_count: 3,
  };
}

export function getMockHourlyRollup(_fieldId: string): HourlyRollup[] {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: hoursAgo(23 - i),
    avg_temp: random(20, 35),
    min_temp: random(15, 22),
    max_temp: random(28, 38),
    avg_humidity: random(40, 90),
    avg_soil_moisture: random(20, 45),
    total_rain: i % 6 === 0 ? random(0.5, 5) : 0,
  }));
}

// ── Yield Prediction ────────────────────────────────────────────

export function getMockPrediction(): YieldPredictionResponse {
  return {
    field_id: "f1",
    predicted_yield_kg_ha: random(4500, 8500, 0),
    lower_bound: random(3800, 5000, 0),
    upper_bound: random(5500, 9500, 0),
    model_version: "v2.1.0",
    data_quality: "high",
    features_used: ["ndvi", "soil_moisture", "temp_avg", "rain_total", "gdd"],
    generated_at: new Date().toISOString(),
  };
}

// ── Recommendation Summary ──────────────────────────────────────

export function getMockRecommendation(fieldId: string): RecommendationSummary {
  return {
    field_id: fieldId,
    irrigation: {
      field_id: fieldId,
      timestamp: new Date().toISOString(),
      eto_mm: random(3, 7),
      etc_mm: random(4, 9),
      effective_rain_mm: random(0, 3),
      irrigation_needed_mm: random(0, 15),
      soil_moisture_current: random(18, 42),
      soil_moisture_target: random(35, 50),
      depletion_percent: random(20, 60),
      recommendation: Math.random() > 0.5 ? "water" : "monitor",
      confidence: random(70, 95),
    },
    fertilization: {
      field_id: fieldId,
      crop_type: "maize",
      growth_stage: "vegetative",
      n_kg_ha: random(40, 80),
      p_kg_ha: random(15, 30),
      k_kg_ha: random(20, 45),
      recommendation: "apply",
      reasoning: "Vegetative stage requires balanced NPK application",
    },
    pest_risk: [
      {
        field_id: fieldId,
        crop_type: "maize",
        pest_name: "Fall Armyworm",
        risk_level: "medium",
        conditions_favorable: true,
        accumulated_gdd: 450,
        gdd_threshold: 400,
        temperature_avg: random(24, 30),
        humidity_avg: random(60, 80),
        leaf_wetness_hours: random(8, 14),
        recommendation: "Monitor fields closely; apply biocontrol if larvae detected",
      },
    ],
    generated_at: new Date().toISOString(),
  };
}
