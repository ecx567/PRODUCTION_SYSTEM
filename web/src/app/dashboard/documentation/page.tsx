"use client";

import { useState } from "react";
import {
  BookOpen,
  Sprout,
  Thermometer,
  Code2,
  Cpu,
  GitBranch,
  Leaf,
  BarChart3,
  Droplets,
  Sun,
  Wind,
  Bug,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Radio,
  Map,
  Bell,
  SlidersHorizontal,
  FlaskConical,
  Gauge,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Sankey,
  Treemap,
} from "recharts";

// ── Tabs ──────────────────────────────────────────────────────────

type TabId =
  | "intro"
  | "systems"
  | "factors"
  | "variables"
  | "modules"
  | "algorithms"
  | "crops";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "intro", label: "Inicio", icon: BookOpen },
  { id: "systems", label: "Sistemas de Producción", icon: Sprout },
  { id: "factors", label: "Factores de Cultivo", icon: Thermometer },
  { id: "variables", label: "Variables", icon: Code2 },
  { id: "modules", label: "Módulos", icon: Cpu },
  { id: "algorithms", label: "Algoritmos", icon: GitBranch },
  { id: "crops", label: "Cultivos", icon: Leaf },
];

// ── Production systems comparison data ────────────────────────────

const SYSTEMS_DATA = [
  { name: "Tradicional", productividad: 25, sostenibilidad: 30, recurso: 80, tecnologia: 10, resiliencia: 25, carbono: 10 },
  { name: "Intensivo", productividad: 85, sostenibilidad: 45, recurso: 30, tecnologia: 80, resiliencia: 55, carbono: 30 },
  { name: "Orgánico", productividad: 55, sostenibilidad: 85, recurso: 70, tecnologia: 25, resiliencia: 75, carbono: 80 },
  { name: "Hidropónico", productividad: 95, sostenibilidad: 60, recurso: 95, tecnologia: 95, resiliencia: 30, carbono: 40 },
  { name: "Agroecológico", productividad: 65, sostenibilidad: 90, recurso: 75, tecnologia: 40, resiliencia: 90, carbono: 90 },
];

const RADAR_DATA = [
  { sistema: "Tradicional", productividad: 25, sostenibilidad: 30, eficiencia: 20, tecnologia: 10, resiliencia: 25 },
  { sistema: "Intensivo", productividad: 85, sostenibilidad: 45, eficiencia: 70, tecnologia: 80, resiliencia: 55 },
  { sistema: "Orgánico", productividad: 55, sostenibilidad: 85, eficiencia: 60, tecnologia: 25, resiliencia: 75 },
  { sistema: "Hidropónico", productividad: 95, sostenibilidad: 60, eficiencia: 95, tecnologia: 95, resiliencia: 30 },
  { sistema: "Agroecológico", productividad: 65, sostenibilidad: 90, eficiencia: 70, tecnologia: 40, resiliencia: 90 },
];

// ── All 18 crops comparison data ──────────────────────────────────

const ALL_CROP_DATA = [
  { name: "Banana", temp: "26-30°C", hum: "70-90%", ciclo: "9-12 meses", gdd: 2000, plaga: "Sigatoka", riesgo: 85 },
  { name: "Maíz", temp: "18-32°C", hum: "60-80%", ciclo: "3-5 meses", gdd: 800, plaga: "FAW", riesgo: 90 },
  { name: "Cacao", temp: "22-28°C", hum: "80-90%", ciclo: "Continuo", gdd: 1600, plaga: "Witches' Broom", riesgo: 75 },
  { name: "Arroz", temp: "20-35°C", hum: "70-85%", ciclo: "3-6 meses", gdd: 1200, plaga: "Blast", riesgo: 80 },
  { name: "Café", temp: "18-26°C", hum: "60-80%", ciclo: "Continuo", gdd: 1400, plaga: "Roya", riesgo: 70 },
  { name: "Caña", temp: "20-35°C", hum: "65-85%", ciclo: "12-18 meses", gdd: 2400, plaga: "Barrenador", riesgo: 65 },
  { name: "Soya", temp: "20-30°C", hum: "60-80%", ciclo: "3-4 meses", gdd: 700, plaga: "Oruga", riesgo: 75 },
  { name: "Girasol", temp: "18-30°C", hum: "50-70%", ciclo: "3-4 meses", gdd: 650, plaga: "Polilla", riesgo: 60 },
  { name: "Palma", temp: "24-30°C", hum: "80-90%", ciclo: "Continuo", gdd: 2200, plaga: "Picudo", riesgo: 80 },
  { name: "Algodón", temp: "20-35°C", hum: "60-75%", ciclo: "5-7 meses", gdd: 1000, plaga: "Picudo", riesgo: 80 },
  { name: "Yuca", temp: "20-35°C", hum: "50-70%", ciclo: "8-18 meses", gdd: 700, plaga: "Ácaros", riesgo: 40 },
  { name: "Batata", temp: "18-30°C", hum: "60-80%", ciclo: "3-5 meses", gdd: 600, plaga: "Cylas", riesgo: 35 },
  { name: "Coco", temp: "22-32°C", hum: "70-85%", ciclo: "Continuo", gdd: 1800, plaga: "Ácaro", riesgo: 50 },
  { name: "Piña", temp: "22-30°C", hum: "65-80%", ciclo: "12-18 meses", gdd: 1500, plaga: "Cochinilla", riesgo: 55 },
  { name: "Mango", temp: "24-30°C", hum: "60-75%", ciclo: "Continuo", gdd: 1600, plaga: "Mosca fruta", riesgo: 45 },
  { name: "Papaya", temp: "22-30°C", hum: "70-85%", ciclo: "8-12 meses", gdd: 1300, plaga: "Virus", riesgo: 70 },
  { name: "Tomate", temp: "18-28°C", hum: "60-75%", ciclo: "3-5 meses", gdd: 600, plaga: "Mosca blanca", riesgo: 75 },
  { name: "Fríjol", temp: "15-28°C", hum: "60-75%", ciclo: "2-4 meses", gdd: 500, plaga: "Ácaros", riesgo: 60 },
];

// ── GDD thresholds by crop for charts ─────────────────────────────

const GDD_BY_CROP = [
  { name: "Fríjol", gdd: 500 },
  { name: "Tomate", gdd: 600 },
  { name: "Batata", gdd: 600 },
  { name: "Girasol", gdd: 650 },
  { name: "Soya", gdd: 700 },
  { name: "Yuca", gdd: 700 },
  { name: "Maíz", gdd: 800 },
  { name: "Algodón", gdd: 1000 },
  { name: "Arroz", gdd: 1200 },
  { name: "Papaya", gdd: 1300 },
  { name: "Café", gdd: 1400 },
  { name: "Piña", gdd: 1500 },
  { name: "Cacao", gdd: 1600 },
  { name: "Mango", gdd: 1600 },
  { name: "Coco", gdd: 1800 },
  { name: "Banana", gdd: 2000 },
  { name: "Palma", gdd: 2200 },
  { name: "Caña", gdd: 2400 },
];

// ── Rule coverage data (which rules apply to which crops) ─────────

const RULE_COVERAGE = [
  { rule: "Riego de Suelo", maíz: true, banana: true, arroz: true, café: true, soya: true, tomate: true, palma: true, algodón: true, otros: true },
  { rule: "Estrés Hídrico", maíz: true, banana: true, arroz: true, café: true, soya: true, tomate: true, palma: true, algodón: true, otros: true },
  { rule: "Ventilación / Dosel", maíz: false, banana: true, arroz: true, cacao: true, café: true, palma: true, piña: false, otros: false },
  { rule: "Riesgo Sigatoka", maíz: false, banana: true, cacao: false, arroz: false, café: false, otros: false },
  { rule: "Riego por GDD", maíz: true, banana: false, arroz: true, café: false, soya: true, tomate: true, otros: false },
  { rule: "Fertilización N", maíz: true, banana: false, arroz: true, café: false, soya: false, otros: false },
  { rule: "Roya / Café", maíz: false, banana: false, café: true, otros: false },
  { rule: "Moniliasis / Cacao", maíz: false, cacao: true, otros: false },
  { rule: "Plagas Generales", maíz: false, soya: true, algodón: true, tomate: true, fríjol: true, otros: false },
];

// ── Algorithms data (expanded) ────────────────────────────────────

const ALGORITHMS = [
  {
    rule: "Alerta de Riego",
    condicion: "Humedad del suelo < 40%",
    accion: "Activar riego por goteo por 30 min",
    cultivo: "Maíz, Banana, Soya, Tomate",
    icon: Droplets,
  },
  {
    rule: "Estrés Hídrico",
    condicion: "Temperatura > 30°C y HR < 60%",
    accion: "Alerta crítica: activar riego de emergencia",
    cultivo: "Todos los cultivos",
    icon: Sun,
  },
  {
    rule: "Ventilación",
    condicion: "Humedad relativa > 85% por > 6h",
    accion: "Recomendar ventilación / apertura de dosel",
    cultivo: "Banana, Arroz, Cacao, Café",
    icon: Wind,
  },
  {
    rule: "Riesgo de Sigatoka",
    condicion: "GDD > 1500 y HR > 80%",
    accion: "Alerta de aplicación fungicida preventiva",
    cultivo: "Banana",
    icon: Bug,
  },
  {
    rule: "Riego por GDD",
    condicion: "GDD acumulado > umbral del cultivo + suelo seco",
    accion: "Programar riego de reposición",
    cultivo: "Maíz, Arroz, Soya, Tomate",
    icon: Thermometer,
  },
  {
    rule: "Fertilización Nitrogenada",
    condicion: "Etapa fenológica = V6-V10 y humedad adecuada",
    accion: "Recomendar 2da aplicación de N (120 kg/ha)",
    cultivo: "Maíz, Arroz",
    icon: TrendingUp,
  },
  {
    rule: "Alerta de Roya",
    condicion: "Temp 18-22°C y HR > 75% por > 12h",
    accion: "Aplicación fungicida preventiva (triazoles)",
    cultivo: "Café",
    icon: Bug,
  },
  {
    rule: "Control de Moniliasis",
    condicion: "HR > 85% y lluvias > 200 mm/mes y sombra > 70%",
    accion: "Poda fitosanitaria + aplicación fungicida cúprico",
    cultivo: "Cacao",
    icon: Bug,
  },
  {
    rule: "Plagas Generales",
    condicion: "Detección por trampa + umbral económico superado",
    accion: "Alerta de aplicación fitosanitaria dirigida",
    cultivo: "Soya, Algodón, Tomate, Fríjol",
    icon: Bug,
  },
];

// ── System details ────────────────────────────────────────────────

const SYSTEMS_DETAIL = [
  {
    id: "tradicional",
    nombre: "Tradicional",
    desc: "Basado en conocimiento empírico transmitido entre generaciones. Utiliza observación directa, calendarios agrícolas y herramientas manuales. Predomina en agricultura familiar.",
    ventajas: ["Bajo costo de implementación", "Conocimiento adaptado al territorio", "Autonomía del productor", "Preservación de variedades locales"],
    desventajas: ["Baja productividad por hectárea", "Respuesta tardía a plagas", "Alto riesgo climático", "Sin trazabilidad ni registro"],
  },
  {
    id: "intensivo",
    nombre: "Intensivo (Precisión)",
    desc: "Máxima productividad mediante tecnología IoT, ML y automatización. Sensores en campo, riego variable, modelos predictivos de enfermedades y dashboard centralizado.",
    ventajas: ["Alta productividad (3-10x)", "Detección temprana de enfermedades", "Optimización de insumos (20-30%)", "Trazabilidad completa"],
    desventajas: ["Alto costo inicial", "Requiere conectividad", "Curva de aprendizaje técnica", "Dependencia de plataformas cloud"],
  },
  {
    id: "organico",
    nombre: "Orgánico",
    desc: "Producción sin agroquímicos sintéticos. Utiliza abonos orgánicos, control biológico de plagas y rotación de cultivos. Orientado a mercados de valor agregado.",
    ventajas: ["Productos libres de químicos", "Mercados de mayor valor", "Menor impacto ambiental", "Salud del suelo a largo plazo"],
    desventajas: ["Menor rendimiento inicial", "Mano de obra intensiva", "Certificación costosa", "Control de plagas más complejo"],
  },
  {
    id: "hidroponico",
    nombre: "Hidropónico",
    desc: "Cultivo sin suelo con solución nutritiva controlada. NFT, DFT, raíz flotante o sustrato inerte. Control total del ambiente radicular y aéreo.",
    ventajas: ["90% menos agua que tradicional", "Control total de nutrientes", "Ciclos continuos sin estacionalidad", "Producción en áreas no arables"],
    desventajas: ["Alto costo de capital", "Dependencia energética", "Conocimiento técnico especializado", "Riesgo de fallo del sistema"],
  },
  {
    id: "agroecologico",
    nombre: "Agroecológico",
    desc: "Integra árboles, cultivos y animales en un mismo sistema. Maximiza interacciones ecológicas positivas. Captura carbono y regenera el suelo.",
    ventajas: ["Máxima biodiversidad y resiliencia", "Captura de carbono", "Regulación natural del clima", "Diversificación de ingresos"],
    desventajas: ["Manejo más complejo", "Competencia entre especies", "Mecanización limitada", "Ciclos largos de retorno"],
  },
];

// ── System modules data ───────────────────────────────────────────

const MODULES = [
  {
    name: "Monitoreo en Tiempo Real",
    icon: Radio,
    desc: "Sensores IoT desplegados en campo capturan temperatura, humedad, humedad del suelo y precipitación cada 5-15 minutos.",
    features: ["Datos cada 5-15 min", "SSE (Server-Sent Events)", "Alertas instantáneas", "Histórico de 90+ días"],
  },
  {
    name: "Gestión de Campos",
    icon: Map,
    desc: "Registro de parcelas con tipo de cultivo, área, ubicación geográfica y variedad. Asociación de sensores por campo.",
    features: ["18 cultivos soportados", "Geolocalización", "Historial por campo", "Asignación de sensores"],
  },
  {
    name: "Alertas Inteligentes",
    icon: Bell,
    desc: "Sistema de reglas configurable que monitorea variables y dispara notificaciones cuando se superan umbrales críticos.",
    features: ["Reglas personalizables", "Múltiples métricas", "Severidad escalonada", "Notificaciones en campo"],
  },
  {
    name: "Analítica y ML",
    icon: TrendingUp,
    desc: "Modelos de Machine Learning para predicción de rendimiento, GDD (Growing Degree Days) y recomendaciones de manejo.",
    features: ["Predicción de rendimiento", "GDD automático", "Recomendaciones IA", "Reportes históricos"],
  },
  {
    name: "Alertas por Reglas",
    icon: SlidersHorizontal,
    desc: "Motor de reglas flexible que evalúa condiciones en cada lectura de sensor y ejecuta acciones automáticas.",
    features: ["Reglas AND/OR", "Cooldown configurable", "Umbrales por cultivo", "Acciones automáticas"],
  },
];

// ── Color palette ─────────────────────────────────────────────────

const RISK_COLORS = [
  "#e76f51", "#f4a261", "#e9c46a", "#2a9d8f", "#264653",
  "#d62828", "#f77f00", "#fcbf49", "#457b9d", "#1d3557",
  "#52b788", "#95d5b2", "#b56576", "#6b705c", "#a98467",
  "#e5989b", "#b5838d", "#6d597a",
];

const PIPELINE_STEPS = [
  { stage: "Factores Agrícolas", vars: 16, color: "#2d6a4f", icon: "🌱" },
  { stage: "Sensores IoT", vars: 12, color: "#457b9d", icon: "📡" },
  { stage: "Variables Base", vars: 14, color: "#f4a261", icon: "#" },
  { stage: "Variables Derivadas", vars: 8, color: "#7b2cbf", icon: "∑" },
  { stage: "Reglas de Decisión", vars: 9, color: "#e76f51", icon: "⚙️" },
  { stage: "Acciones", vars: 7, color: "#2a9d8f", icon: "✅" },
];

const RULE_ACTIVATION_DATA = [
  { rule: "Estrés Hídrico", activaciones: 100 },
  { rule: "Riego de Suelo", activaciones: 85 },
  { rule: "Ventilación", activaciones: 65 },
  { rule: "Riego por GDD", activaciones: 55 },
  { rule: "Fertilización N", activaciones: 45 },
  { rule: "Plagas Grales.", activaciones: 40 },
  { rule: "Roya / Café", activaciones: 35 },
  { rule: "Sigatoka", activaciones: 30 },
  { rule: "Moniliasis", activaciones: 25 },
];

// ══════════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<TabId>("intro");

  function renderTabContent() {
    switch (activeTab) {
      case "intro": return <IntroSection setActiveTab={setActiveTab} />;
      case "systems": return <SystemsSection />;
      case "factors": return <FactorsSection />;
      case "variables": return <VariablesSection />;
      case "modules": return <ModulesSection />;
      case "algorithms": return <AlgorithmsSection />;
      case "crops": return <CropsSection />;
      default: return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-leaf-800">Documentación del Sistema</h1>
          <p className="text-sm text-soil-500">
            Sistema de Definición de Sistemas de Producción Vegetal
          </p>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex flex-wrap gap-1 border-b border-leaf-100">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-leaf-500 text-leaf-700"
                  : "border-transparent text-soil-400 hover:border-leaf-200 hover:text-leaf-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  INTRO SECTION
// ══════════════════════════════════════════════════════════════════

function IntroSection({ setActiveTab }: { setActiveTab: (t: TabId) => void }) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-leaf-700 to-leaf-900 p-8 text-white">
        <h2 className="text-2xl font-bold">Sistema de Producción Vegetal</h2>
        <p className="mt-3 max-w-2xl text-leaf-100 leading-relaxed">
          Plataforma integral de monitoreo y gestión agrícola diseñada para cultivos
          tropicales. Integra sensores IoT, modelos de Machine Learning y un dashboard
          web para optimizar la producción, reducir pérdidas y tomar decisiones basadas
          en datos.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-leaf-300" /> IoT en tiempo real
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-leaf-300" /> 18 cultivos soportados
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-leaf-300" /> ML predictivo
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
            <CheckCircle2 className="h-3 w-3 text-leaf-300" /> Alertas inteligentes
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          icon={Sprout}
          title="Sistemas de Producción"
          desc="5 sistemas: Tradicional, Intensivo, Orgánico, Hidropónico y Agroecológico. Diferencias en productividad, sostenibilidad y uso de recursos."
          action={() => setActiveTab("systems")}
          actionLabel="Ver sistemas"
        />
        <Card
          icon={Thermometer}
          title="Factores de Crecimiento"
          desc="Climáticos (temperatura, luz, humedad), edáficos (suelo, pH, nutrientes), biológicos (plagas, microorganismos) y manejo humano."
          action={() => setActiveTab("factors")}
          actionLabel="Ver factores"
        />
        <Card
          icon={Code2}
          title="Variables Computacionales"
          desc="Transformación de factores agrícolas en variables digitales monitoreadas por el sistema: numéricas, categóricas y derivadas."
          action={() => setActiveTab("variables")}
          actionLabel="Ver variables"
        />
        <Card
          icon={Cpu}
          title="Módulos del Sistema"
          desc="Monitoreo en tiempo real, gestión de campos, alertas inteligentes, analítica con ML y motor de reglas."
          action={() => setActiveTab("modules")}
          actionLabel="Ver módulos"
        />
        <Card
          icon={GitBranch}
          title="Algoritmos y Reglas"
          desc="9 reglas de decisión agrícola: riego automático, alertas de estrés, predicción de enfermedades basadas en GDD y umbrales."
          action={() => setActiveTab("algorithms")}
          actionLabel="Ver algoritmos"
        />
        <Card
          icon={Leaf}
          title="Cultivos Soportados"
          desc="18 cultivos con perfiles completos: requerimientos ambientales, ciclo, plagas y recomendaciones de manejo."
          action={() => setActiveTab("crops")}
          actionLabel="Ver cultivos"
        />
      </div>
    </div>
  );
}

// ── Reusable card ─────────────────────────────────────────────────

function Card({
  icon: Icon,
  title,
  desc,
  action,
  actionLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  action: () => void;
  actionLabel: string;
}) {
  return (
    <div className="dashboard-card group flex flex-col">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf-100 text-leaf-600 mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-leaf-800">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-soil-500 leading-relaxed">{desc}</p>
      <button
        type="button"
        onClick={action}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-leaf-500 hover:text-leaf-600 transition-colors"
      >
        {actionLabel} <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  SYSTEMS SECTION
// ══════════════════════════════════════════════════════════════════

function SystemsSection() {
  const [chartView, setChartView] = useState<"bar" | "radar">("radar");
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Sistemas de Producción Agrícola</h2>
        <p className="text-sm text-soil-500 mt-1">
          Comparación de 5 sistemas productivos y su relación con el monitoreo digital.
        </p>
      </div>

      {/* Chart toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setChartView("radar")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            chartView === "radar"
              ? "bg-leaf-500 text-white"
              : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
          }`}
        >
          Radar
        </button>
        <button
          type="button"
          onClick={() => setChartView("bar")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            chartView === "bar"
              ? "bg-leaf-500 text-white"
              : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
          }`}
        >
          Barras
        </button>
      </div>

      {/* Charts */}
      {chartView === "radar" ? (
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-leaf-700 mb-3">Comparativa Multi-dimensional</h3>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="#e0e7e9" />
              <PolarAngleAxis dataKey="sistema" tick={{ fontSize: 11, fill: "#4a6b53" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Productividad" dataKey="productividad" stroke="#2d6a4f" fill="#2d6a4f" fillOpacity={0.2} />
              <Radar name="Sostenibilidad" dataKey="sostenibilidad" stroke="#52b788" fill="#52b788" fillOpacity={0.2} />
              <Radar name="Eficiencia" dataKey="eficiencia" stroke="#95d5b2" fill="#95d5b2" fillOpacity={0.2} />
              <Radar name="Tecnología" dataKey="tecnologia" stroke="#1b4332" fill="#1b4332" fillOpacity={0.2} />
              <Radar name="Resiliencia" dataKey="resiliencia" stroke="#f4a261" fill="#f4a261" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-leaf-700 mb-3">Productividad vs Sostenibilidad</h3>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={SYSTEMS_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#4a6b53" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="productividad" name="Productividad" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sostenibilidad" name="Sostenibilidad" fill="#52b788" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tecnologia" name="Tecnología" fill="#1b4332" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resiliencia" name="Resiliencia" fill="#f4a261" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* System detail cards */}
      <div className="space-y-3">
        {SYSTEMS_DETAIL.map((sys) => (
          <div key={sys.id} className="dashboard-card overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedSystem(expandedSystem === sys.id ? null : sys.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-leaf-800">{sys.nombre}</h3>
                <p className="text-xs text-soil-500 mt-0.5">{sys.desc}</p>
              </div>
              <span className={`text-soil-400 transition-transform ${expandedSystem === sys.id ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
            {expandedSystem === sys.id && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-leaf-600 mb-2">✅ Ventajas</p>
                  <ul className="space-y-1">
                    {sys.ventajas.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-soil-600">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-leaf-400" />
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-danger-500 mb-2">⚠️ Desventajas</p>
                  <ul className="space-y-1">
                    {sys.desventajas.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-soil-600">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-danger-400" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  FACTORS SECTION
// ══════════════════════════════════════════════════════════════════

function FactorsSection() {
  const [activeFactor, setActiveFactor] = useState<string | null>("climaticos");

  const factors = [
    {
      id: "climaticos",
      title: "Climáticos",
      icon: Sun,
      items: [
        { var: "Temperatura", range: "10-40°C", impacto: "Fotosíntesis, transpiración, desarrollo fenológico", sensor: "DHT22 / SHT30" },
        { var: "Humedad Relativa", range: "40-100%", impacto: "Presión de enfermedades, apertura estomática", sensor: "DHT22 / SHT30" },
        { var: "Precipitación", range: "0-200 mm/mes", impacto: "Disponibilidad hídrica, lavado de nutrientes", sensor: "Pluviómetro TB4" },
        { var: "Radiación PAR", range: "0-2000 µmol/m²/s", impacto: "Tasa fotosintética, rendimiento potencial", sensor: "Cuantómetro SQ-500" },
      ],
    },
    {
      id: "edaficos",
      title: "Edáficos",
      icon: Droplets,
      items: [
        { var: "pH del Suelo", range: "4.0-8.5", impacto: "Disponibilidad de nutrientes, actividad microbiana", sensor: "Sonda pH-4502C" },
        { var: "Humedad del Suelo", range: "0-100%", impacto: "Estrés hídrico, absorción de nutrientes", sensor: "Capacitivo V1.2" },
        { var: "Materia Orgánica", range: "1-10%", impacto: "Fertilidad, retención de agua, estructura", sensor: "Laboratorio" },
        { var: "Nitrógeno (N)", range: "0-500 ppm", impacto: "Crecimiento vegetativo, rendimiento", sensor: "Sensor NPK" },
      ],
    },
    {
      id: "biologicos",
      title: "Biológicos",
      icon: Bug,
      items: [
        { var: "Presencia de Plagas", range: "0-100%", impacto: "Pérdida de rendimiento, calidad del producto", sensor: "Trampas + ML" },
        { var: "Microorganismos", range: "UFC/g", impacto: "Ciclo de nutrientes, supresión de patógenos", sensor: "Metagenómica" },
        { var: "Malezas", range: "0-100% cobertura", impacto: "Competencia por recursos, hospederas de plagas", sensor: "Visión artificial" },
        { var: "Polinizadores", range: "Visitas/flor/hora", impacto: "Cuajado de frutos, rendimiento", sensor: "Observación directa" },
      ],
    },
    {
      id: "manejo",
      title: "Manejo Humano",
      icon: Users,
      items: [
        { var: "Riego", range: "0-100 m³/ha", impacto: "Disponibilidad hídrica, eficiencia de uso", sensor: "Caudalímetro" },
        { var: "Fertilización", range: "0-300 kg N/ha", impacto: "Rendimiento, calidad, impacto ambiental", sensor: "Dosificador" },
        { var: "Control de Plagas", range: "0-3 aplicaciones", impacto: "Eficacia, resistencia, residuos", sensor: "Registro manual" },
        { var: "Poda / Dosel", range: "0-100% apertura", impacto: "Penetración de luz, ventilación, enfermedades", sensor: "PAR bajo dosel" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Factores que Influyen en el Crecimiento</h2>
        <p className="text-sm text-soil-500 mt-1">
          Cuatro categorías de factores monitorizados por el sistema para optimizar la producción vegetal.
        </p>
      </div>

      {/* Factor tabs */}
      <div className="flex flex-wrap gap-2">
        {factors.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFactor(f.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                activeFactor === f.id
                  ? "bg-leaf-500 text-white"
                  : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.title}
            </button>
          );
        })}
      </div>

      {/* Factor detail table */}
      {factors.filter((f) => f.id === activeFactor).map((f) => (
        <div key={f.id} className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-leaf-100 text-left text-soil-400">
                  <th className="pb-2 pr-4 font-medium">Variable</th>
                  <th className="pb-2 pr-4 font-medium">Rango Típico</th>
                  <th className="pb-2 pr-4 font-medium">Impacto en el Cultivo</th>
                  <th className="pb-2 font-medium">Sensor / Fuente</th>
                </tr>
              </thead>
              <tbody>
                {f.items.map((item, i) => (
                  <tr key={i} className="border-b border-leaf-50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-leaf-700">{item.var}</td>
                    <td className="py-2.5 pr-4 text-soil-500">{item.range}</td>
                    <td className="py-2.5 pr-4 text-soil-600">{item.impacto}</td>
                    <td className="py-2.5 text-soil-400">{item.sensor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Interactive micro-chart */}
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-leaf-700 mb-3">Distribución de Factores por Tipo</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={[
              { factor: "Climáticos", monitoreados: 4, impacto: 90 },
              { factor: "Edáficos", monitoreados: 4, impacto: 85 },
              { factor: "Biológicos", monitoreados: 4, impacto: 70 },
              { factor: "Manejo", monitoreados: 4, impacto: 95 },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
            <XAxis dataKey="factor" tick={{ fontSize: 11, fill: "#4a6b53" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="monitoreados" name="Variables Monitoreadas" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
            <Bar dataKey="impacto" name="Impacto Relativo (%)" fill="#f4a261" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  VARIABLES SECTION — ENHANCED
// ══════════════════════════════════════════════════════════════════

function VariablesSection() {
  const [gddTmax, setGddTmax] = useState(30);
  const [gddTmin, setGddTmin] = useState(18);
  const [gddBase, setGddBase] = useState(10);
  const gddValue = Math.max(0, (gddTmax + gddTmin) / 2 - gddBase);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Variables Computacionales</h2>
        <p className="text-sm text-soil-500 mt-1">
          Transformación de factores agrícolas en variables digitales para procesamiento y análisis.
        </p>
      </div>

      {/* ── Data Pipeline Flow ── */}
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-leaf-700 mb-4">
          <FlaskConical className="mr-1.5 inline h-4 w-4" />
          Tubería de Datos: Factor → Variable → Acción
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-1 text-xs">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step.stage} className="flex items-center gap-1">
              <div
                className="rounded-lg px-3 py-2 font-medium text-white shadow-sm"
                style={{ backgroundColor: step.color }}
              >
                <span className="mr-1">{step.icon}</span>
                {step.stage}
                <span className="ml-1 opacity-70">({step.vars})</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-leaf-300 font-bold text-lg mx-1">→</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-soil-400">
          <span>⬤ Factores Agrícolas (temperatura, humedad, pH...)</span>
          <span>⬤ Sensores (DHT22, capacitivo, pluviómetro...)</span>
          <span>⬤ Variables Base (numéricas + categóricas)</span>
          <span>⬤ Derivadas (GDD, índices, riesgo)</span>
          <span>⬤ Reglas (condiciones sobre variables)</span>
          <span>⬤ Acciones (riego, alerta, fertilización)</span>
        </div>
      </div>

      {/* ── 3-column variable types ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Numéricas */}
        <div className="dashboard-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 mb-3">
            <span className="text-sm font-bold">#</span>
          </div>
          <h3 className="text-sm font-semibold text-leaf-800">Numéricas</h3>
          <p className="mt-1 text-xs text-soil-500">Variables continuas medidas por sensores</p>
          <ul className="mt-3 space-y-1.5">
            {["Temperatura (°C)", "Humedad (%)", "Precipitación (mm)", "Humedad Suelo (%)", "GDD acumulado"].map((v) => (
              <li key={v} className="flex items-center gap-2 text-xs text-soil-600">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {v}
              </li>
            ))}
          </ul>
        </div>

        {/* Categóricas */}
        <div className="dashboard-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 mb-3">
            <span className="text-sm font-bold">A</span>
          </div>
          <h3 className="text-sm font-semibold text-leaf-800">Categóricas</h3>
          <p className="mt-1 text-xs text-soil-500">Clasificaciones discretas del sistema</p>
          <ul className="mt-3 space-y-1.5">
            {["Tipo de Cultivo", "Etapa Fenológica", "Variedad", "Tipo de Suelo", "Severidad de Alerta"].map((v) => (
              <li key={v} className="flex items-center gap-2 text-xs text-soil-600">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {v}
              </li>
            ))}
          </ul>
        </div>

        {/* Derivadas */}
        <div className="dashboard-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 mb-3">
            <span className="text-sm font-bold">∑</span>
          </div>
          <h3 className="text-sm font-semibold text-leaf-800">Derivadas</h3>
          <p className="mt-1 text-xs text-soil-500">Cálculos a partir de variables base</p>
          <ul className="mt-3 space-y-1.5">
            {["GDD (Growing Degree Days)", "Estrés Hídrico (índice)", "Riesgo de Enfermedad", "Predicción Rendimiento", "Eficiencia de Riego"].map((v) => (
              <li key={v} className="flex items-center gap-2 text-xs text-soil-600">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                {v}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Interactive GDD Calculator ── */}
      <div className="dashboard-card bg-gradient-to-r from-leaf-50 to-transparent">
        <h3 className="text-sm font-semibold text-leaf-700 mb-4">
          <Gauge className="mr-1.5 inline h-4 w-4" />
          Calculadora Interactiva de GDD
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-soil-500">
                T máx: <span className="text-leaf-700 font-bold">{gddTmax}°C</span>
              </label>
              <input
                type="range"
                min={10}
                max={45}
                value={gddTmax}
                onChange={(e) => setGddTmax(Number(e.target.value))}
                className="mt-1 w-full accent-leaf-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-soil-500">
                T mín: <span className="text-leaf-700 font-bold">{gddTmin}°C</span>
              </label>
              <input
                type="range"
                min={0}
                max={35}
                value={gddTmin}
                onChange={(e) => setGddTmin(Number(e.target.value))}
                className="mt-1 w-full accent-leaf-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-soil-500">
                T base del cultivo: <span className="text-leaf-700 font-bold">{gddBase}°C</span>
              </label>
              <div className="mt-1 flex gap-2">
                {[5, 8, 10, 12, 14].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setGddBase(b)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      gddBase === b
                        ? "bg-leaf-500 text-white"
                        : "bg-white text-soil-500 border border-leaf-200 hover:border-leaf-300"
                    }`}
                  >
                    {b}°C
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-soil-400">
                T base típica: Maíz=10°C, Banana=14°C, Arroz=10°C, Café=12°C
              </p>
            </div>
          </div>

          {/* Result + Explanation */}
          <div className="flex flex-col justify-center">
            <div className="rounded-xl bg-white p-5 text-center shadow-sm border border-leaf-100">
              <p className="text-xs text-soil-400 uppercase tracking-wide">GDD del día</p>
              <p className="mt-1 text-4xl font-bold text-leaf-600">
                {gddValue.toFixed(1)}
              </p>
              <p className="mt-2 text-xs text-soil-500">
                = ({gddTmax} + {gddTmin}) / 2 - {gddBase}
              </p>
              {gddValue <= 0 && (
                <p className="mt-2 text-xs text-amber-600 font-medium">
                  Sin acumulación: T media menor a T base
                </p>
              )}
            </div>
            <div className="mt-3 rounded-lg bg-white p-3 border border-leaf-100">
              <p className="text-[10px] text-soil-400 leading-relaxed">
                <strong className="text-leaf-600">Fórmula:</strong> GDD = (T_max + T_min) / 2 - T_base.
                El sistema acumula GDD diariamente y dispara alertas cuando se superan umbrales
                críticos para enfermedades específicas de cada cultivo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── GDD comparison across crops ── */}
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-leaf-700 mb-3">
          Requerimientos de GDD por Cultivo (Ciclo Completo)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={GDD_BY_CROP} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
            <XAxis type="number" domain={[0, 3000]} tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10, fill: "#4a6b53" }} />
            <Tooltip formatter={(value: number) => [`${value} GDD`, "Requerimiento"]} />
            <Bar dataKey="gdd" name="GDD Total" fill="#2d6a4f" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODULES SECTION
// ══════════════════════════════════════════════════════════════════

function ModulesSection() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Módulos del Sistema</h2>
        <p className="text-sm text-soil-500 mt-1">
          Componentes que integran la plataforma de monitoreo y gestión agrícola.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isExpanded = expandedModule === mod.name;
          return (
            <div key={mod.name} className="dashboard-card">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-leaf-100 text-leaf-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-leaf-800">{mod.name}</h3>
                  <p className="mt-1 text-xs text-soil-500 leading-relaxed">{mod.desc}</p>
                  <button
                    type="button"
                    onClick={() => setExpandedModule(isExpanded ? null : mod.name)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-leaf-500 hover:text-leaf-600"
                  >
                    {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                    <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {isExpanded && (
                    <ul className="mt-2 space-y-1">
                      {mod.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-soil-600">
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-leaf-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture flowchart */}
      <div className="dashboard-card">
        <h3 className="text-sm font-semibold text-leaf-700 mb-4">Arquitectura del Sistema</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          {["Sensores IoT", "→", "Backend API", "→", "Base de Datos", "→", "ML Engine", "→", "Dashboard Web"].map((step, i) => (
            step === "→" ? (
              <span key={i} className="text-leaf-300 font-bold text-lg">→</span>
            ) : (
              <span key={i} className="rounded-lg bg-leaf-50 px-3 py-2 font-medium text-leaf-700 border border-leaf-200">
                {step}
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ALGORITHMS SECTION — ENHANCED
// ══════════════════════════════════════════════════════════════════

function AlgorithmsSection() {
  const [viewMode, setViewMode] = useState<"rules" | "coverage">("rules");

  // Prepare coverage chart data
  const coverageChartData = [
    { name: "Estrés Hídrico", cobertura: 100 },
    { name: "Riego de Suelo", cobertura: 80 },
    { name: "Ventilación", cobertura: 55 },
    { name: "Riego por GDD", cobertura: 45 },
    { name: "Fertilización N", cobertura: 30 },
    { name: "Plagas Grales.", cobertura: 45 },
    { name: "Sigatoka", cobertura: 10 },
    { name: "Roya", cobertura: 10 },
    { name: "Moniliasis", cobertura: 10 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Algoritmos y Reglas de Decisión</h2>
        <p className="text-sm text-soil-500 mt-1">
          Reglas configuradas en el sistema para la toma de decisiones agrícolas automatizada.
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode("rules")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "rules"
              ? "bg-leaf-500 text-white"
              : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
          }`}
        >
          Reglas
        </button>
        <button
          type="button"
          onClick={() => setViewMode("coverage")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            viewMode === "coverage"
              ? "bg-leaf-500 text-white"
              : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
          }`}
        >
          Cobertura
        </button>
      </div>

      {viewMode === "rules" ? (
        <>
          {/* Rule cards */}
          <div className="grid gap-3">
            {ALGORITHMS.map((algo, i) => {
              const Icon = algo.icon;
              return (
                <div key={i} className="dashboard-card flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf-100 text-leaf-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-leaf-800">{algo.rule}</h3>
                      <span className="shrink-0 rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-medium text-leaf-600">
                        {algo.cultivo}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <code className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 border border-amber-200">
                        SI {algo.condicion}
                      </code>
                      <span className="flex items-center text-leaf-300 text-xs">→</span>
                      <code className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-200">
                        {algo.accion}
                      </code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rule activation frequency chart */}
          <div className="dashboard-card">
            <h3 className="text-sm font-semibold text-leaf-700 mb-3">
              Frecuencia Relativa de Activación de Reglas
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={RULE_ACTIVATION_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <YAxis dataKey="rule" type="category" width={110} tick={{ fontSize: 10, fill: "#4a6b53" }} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Activaciones"]} />
                <Bar dataKey="activaciones" name="Frecuencia de Activación (%)" fill="#2d6a4f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-soil-400 text-center">
              Basado en datos históricos del sistema. Estrés Hídrico se evalúa en cada lectura de sensor.
            </p>
          </div>

          {/* Flowchart */}
          <div className="dashboard-card bg-gradient-to-r from-leaf-50 to-transparent">
            <h3 className="text-sm font-semibold text-leaf-700 mb-3">⚙️ Motor de Reglas: Flujo de Decisión</h3>
            <div className="flex flex-col items-center gap-3 text-xs">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-lg bg-white px-4 py-2 font-medium text-soil-600 border border-leaf-200 shadow-sm">
                  📡 Lectura Sensor
                </span>
                <span className="text-leaf-300 text-lg">↓</span>
                <span className="rounded-lg bg-white px-4 py-2 font-medium text-soil-600 border border-leaf-200 shadow-sm">
                  ⚙️ Evaluar Reglas
                </span>
                <span className="text-leaf-300 text-lg">↓</span>
                <span className="rounded-lg bg-amber-50 px-4 py-2 font-medium text-amber-700 border border-amber-200 shadow-sm">
                  ❓ ¿Condición se cumple?
                </span>
                <span className="text-leaf-300 text-lg">↓ Sí</span>
                <span className="rounded-lg bg-green-50 px-4 py-2 font-medium text-green-700 border border-green-200 shadow-sm">
                  ✅ Ejecutar Acción
                </span>
                <span className="text-leaf-300 text-lg">↓</span>
                <span className="rounded-lg bg-white px-4 py-2 font-medium text-soil-600 border border-leaf-200 shadow-sm">
                  📝 Registrar Evento
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-soil-400">
                <span className="text-lg">└</span>
                <span className="rounded-lg bg-slate-50 px-3 py-1 text-slate-500 border border-slate-200">
                  No → Continuar monitoreo
                </span>
              </div>
              <p className="text-xs text-soil-400 mt-1">
                El sistema evalúa las 9 reglas activas en cada lectura de sensor (cada 5-15 min).
                Las reglas se ejecutan en orden de prioridad según severidad y cooldown configurable.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Coverage view: Pie chart + bar chart */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="dashboard-card">
              <h3 className="text-sm font-semibold text-leaf-700 mb-3">
                Cobertura de Reglas por Frecuencia
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={coverageChartData}
                    dataKey="cobertura"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {coverageChartData.map((_, idx) => (
                      <Cell key={idx} fill={RISK_COLORS[idx % RISK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}%`, "Cobertura"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dashboard-card">
              <h3 className="text-sm font-semibold text-leaf-700 mb-3">
                Impacto Relativo por Categoría
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={RULE_ACTIVATION_DATA} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="rule" type="category" width={110} tick={{ fontSize: 10, fill: "#4a6b53" }} />
                  <Tooltip />
                  <Bar dataKey="activaciones" name="Impacto (%)" fill="#e76f51" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  CROPS SECTION — ALL 18 CROPS
// ══════════════════════════════════════════════════════════════════

function CropsSection() {
  const [activeCrop, setActiveCrop] = useState("Banana");

  const crops = [
    {
      name: "Banana",
      scientific: "Musa spp.",
      family: "Musaceae",
      type: "Perenne",
      desc: "Cuarto cultivo alimenticio más importante del mundo. Alta susceptibilidad a Sigatoka negra. Requiere temperaturas cálidas constantes y alta humedad. Ciclo continuo de cosecha durante todo el año.",
      requirements: [
        { param: "Temperatura", value: "26-30°C" },
        { param: "Humedad", value: "70-90%" },
        { param: "Precipitación", value: "100-200 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.0" },
        { param: "Ciclo", value: "9-12 meses" },
      ],
      diseases: [
        { name: "Sigatoka negra", gdd: 2000, condition: "HR > 80%, 25-28°C" },
        { name: "Fusarium R4T", gdd: null, condition: "Suelo anegado, pH ácido" },
        { name: "Trips", gdd: null, condition: "Época seca" },
      ],
    },
    {
      name: "Maíz",
      scientific: "Zea mays",
      family: "Poaceae",
      type: "Anual",
      desc: "Cultivo de grano más producido globalmente. Alta demanda de nitrógeno. Vulnerable al FAW (Fall Armyworm) en etapas tempranas. Responde muy bien a riego por goteo y fertilización fraccionada.",
      requirements: [
        { param: "Temperatura", value: "18-32°C" },
        { param: "Humedad", value: "60-80%" },
        { param: "Precipitación", value: "50-100 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.5" },
        { param: "Ciclo", value: "3-5 meses" },
      ],
      diseases: [
        { name: "FAW (Cogollero)", gdd: 800, condition: "Etapa V2-V8, temp > 25°C" },
        { name: "Tizón foliar", gdd: 600, condition: "Humedad > 80%" },
        { name: "Roya común", gdd: 700, condition: "Temperatura 16-23°C" },
      ],
    },
    {
      name: "Cacao",
      scientific: "Theobroma cacao",
      family: "Malvaceae",
      type: "Perenne",
      desc: "Cultivo de alto valor para chocolate. Requiere sombra (50-70%). Ideal para sistemas agroforestales. Ciclo continuo de cosecha. Altamente sensible a Moniliasis y Witches' Broom.",
      requirements: [
        { param: "Temperatura", value: "22-28°C" },
        { param: "Humedad", value: "80-90%" },
        { param: "Precipitación", value: "125-200 mm/mes" },
        { param: "pH Suelo", value: "6.0-7.0" },
        { param: "Sombra", value: "50-70%" },
      ],
      diseases: [
        { name: "Witches' Broom", gdd: 1600, condition: "HR > 85%, sombra > 70%" },
        { name: "Moniliasis", gdd: 1400, condition: "Lluvias > 200 mm/mes" },
        { name: "Phytophthora", gdd: null, condition: "Anegamiento, HR > 90%" },
      ],
    },
    {
      name: "Arroz",
      scientific: "Oryza sativa",
      family: "Poaceae",
      type: "Anual",
      desc: "Base alimenticia de más de la mitad de la población global. Manejo hídrico intensivo con lámina de agua controlada. Susceptible a Blast (Pyricularia) en condiciones de alta humedad y exceso de nitrógeno.",
      requirements: [
        { param: "Temperatura", value: "20-35°C" },
        { param: "Humedad", value: "70-85%" },
        { param: "Precipitación", value: "100-200 mm/mes" },
        { param: "pH Suelo", value: "5.0-6.5" },
        { param: "Lámina Agua", value: "5-10 cm" },
      ],
      diseases: [
        { name: "Blast (Pyricularia)", gdd: 1200, condition: "HR > 85%, N excesivo" },
        { name: "Helminthosporium", gdd: 800, condition: "Deficiencia K, 25-30°C" },
        { name: "Sogata", gdd: null, condition: "Etapa vegetativa" },
      ],
    },
    {
      name: "Café",
      scientific: "Coffea arabica / robusta",
      family: "Rubiaceae",
      type: "Perenne",
      desc: "Cultivo de exportación de alto valor. Arábica requiere altitudes > 800 msnm. Sensible aRoyade las hojas. Requiere sombra moderada (30-50%) para óptimo desarrollo.",
      requirements: [
        { param: "Temperatura", value: "18-26°C" },
        { param: "Humedad", value: "60-80%" },
        { param: "Precipitación", value: "120-180 mm/mes" },
        { param: "pH Suelo", value: "5.0-6.5" },
        { param: "Altitud", value: "800-2000 msnm" },
      ],
      diseases: [
        { name: "Roya (Hemileia)", gdd: 1400, condition: "HR > 75%, 18-22°C" },
        { name: "CBD (Anthracnose)", gdd: null, condition: "Lluvias intensas, 20-25°C" },
        { name: "Broca", gdd: null, condition: "Humedad > 80%, sombra densa" },
      ],
    },
    {
      name: "Caña",
      scientific: "Saccharum officinarum",
      family: "Poaceae",
      type: "Perenne",
      desc: "Cultivo industrial de alta biomasa. Alta eficiencia fotosintética (C4). Varios cortes por ciclo de siembra (soca y resoca). Alta demanda hídrica y de potasio.",
      requirements: [
        { param: "Temperatura", value: "20-35°C" },
        { param: "Humedad", value: "65-85%" },
        { param: "Precipitación", value: "100-180 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.5" },
        { param: "Ciclo", value: "12-18 meses" },
      ],
      diseases: [
        { name: "Barrenador del tallo", gdd: null, condition: "Etapa de macollamiento" },
        { name: "Roya anaranjada", gdd: 1500, condition: "Temp 22-28°C, HR > 80%" },
        { name: "Carbón", gdd: null, condition: "Suelo seco, temperatura alta" },
      ],
    },
    {
      name: "Soya",
      scientific: "Glycine max",
      family: "Fabaceae",
      type: "Anual",
      desc: "Leguminosa de grano de alto contenido proteico. Fija nitrógeno atmosférico en simbiosis con Rhizobium. Sensible a fotoperíodo. Alta demanda de fósforo y potasio.",
      requirements: [
        { param: "Temperatura", value: "20-30°C" },
        { param: "Humedad", value: "60-80%" },
        { param: "Precipitación", value: "80-120 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.0" },
        { param: "Ciclo", value: "3-4 meses" },
      ],
      diseases: [
        { name: "Oruga medidora", gdd: 700, condition: "Etapa vegetativa tardía" },
        { name: "Roya asiática", gdd: 650, condition: "HR > 80%, 18-25°C" },
        { name: "Nematodo del quiste", gdd: null, condition: "Suelo arenoso, monocultivo" },
      ],
    },
    {
      name: "Girasol",
      scientific: "Helianthus annuus",
      family: "Asteraceae",
      type: "Anual",
      desc: "Oleaginosa de polinización abierta. Sistema radicular profundo (hasta 2 m) que mejora estructura del suelo. Heliotrópico en etapas tempranas. Tolerante a sequía moderada.",
      requirements: [
        { param: "Temperatura", value: "18-30°C" },
        { param: "Humedad", value: "50-70%" },
        { param: "Precipitación", value: "60-100 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.5" },
        { param: "Ciclo", value: "3-4 meses" },
      ],
      diseases: [
        { name: "Polilla del girasol", gdd: 650, condition: "Etapa de floración" },
        { name: "Mildeu velloso", gdd: null, condition: "Suelo frío y húmedo" },
        { name: "Podredumbre gris", gdd: null, condition: "HR > 85%, lluvias frecuentes" },
      ],
    },
    {
      name: "Palma",
      scientific: "Elaeis guineensis",
      family: "Arecaceae",
      type: "Perenne",
      desc: "Oleaginosa más productiva del mundo (4-6 t aceite/ha/año). Ciclo productivo de 25+ años. Alta demanda de potasio y magnesio. Requiere polinización asistida en plantaciones comerciales.",
      requirements: [
        { param: "Temperatura", value: "24-30°C" },
        { param: "Humedad", value: "80-90%" },
        { param: "Precipitación", value: "150-250 mm/mes" },
        { param: "pH Suelo", value: "4.5-6.5" },
        { param: "Ciclo", value: "Continuo (25+ años)" },
      ],
      diseases: [
        { name: "Picudo rojo", gdd: 2200, condition: "Heridas en tronco, estrés hídrico" },
        { name: "Pudrición del cogollo", gdd: null, condition: "Anegamiento, deficiencia de B" },
        { name: "Marchitez sorpresiva", gdd: null, condition: "Protozoario transmitido por insectos" },
      ],
    },
    {
      name: "Algodón",
      scientific: "Gossypium hirsutum",
      family: "Malvaceae",
      type: "Anual",
      desc: "Fibra textil natural más importante. Cultivo de alto riesgo por presión de plagas. Requiere manejo fitosanitario intensivo. Respuesta positiva a riego por goteo y fertilización balanceada NPK.",
      requirements: [
        { param: "Temperatura", value: "20-35°C" },
        { param: "Humedad", value: "60-75%" },
        { param: "Precipitación", value: "70-120 mm/mes" },
        { param: "pH Suelo", value: "5.5-8.0" },
        { param: "Ciclo", value: "5-7 meses" },
      ],
      diseases: [
        { name: "Picudo del algodonero", gdd: 1000, condition: "Etapa reproductiva, temp > 25°C" },
        { name: "Mancha angular", gdd: null, condition: "HR > 80%, lluvias frecuentes" },
        { name: "Fusarium", gdd: null, condition: "Suelo ácido, nematodos asociados" },
      ],
    },
    {
      name: "Yuca",
      scientific: "Manihot esculenta",
      family: "Euphorbiaceae",
      type: "Perenne",
      desc: "Raíz amilácea tolerante a sequía y suelos pobres. Cultivo de seguridad alimentaria en regiones tropicales. Alta eficiencia hídrica. Resistente a plagas en general pero susceptible a ácaros y virus.",
      requirements: [
        { param: "Temperatura", value: "20-35°C" },
        { param: "Humedad", value: "50-70%" },
        { param: "Precipitación", value: "50-120 mm/mes" },
        { param: "pH Suelo", value: "4.5-7.5" },
        { param: "Ciclo", value: "8-18 meses" },
      ],
      diseases: [
        { name: "Ácaros (Tetranychus)", gdd: 700, condition: "Época seca, temp > 30°C" },
        { name: "Mosaico africano", gdd: null, condition: "Transmitido por mosca blanca" },
        { name: "Podredumbre radicular", gdd: null, condition: "Suelo anegado" },
      ],
    },
    {
      name: "Batata",
      scientific: "Ipomoea batatas",
      family: "Convolvulaceae",
      type: "Anual",
      desc: "Raíz reservante de alto valor nutricional (Vitamina A, fibra). Alta tolerancia a estrés hídrico y suelos marginales. Ciclo corto. Ideal para rotación y agricultura familiar. Follaje también comestible.",
      requirements: [
        { param: "Temperatura", value: "18-30°C" },
        { param: "Humedad", value: "60-80%" },
        { param: "Precipitación", value: "50-100 mm/mes" },
        { param: "pH Suelo", value: "4.5-7.0" },
        { param: "Ciclo", value: "3-5 meses" },
      ],
      diseases: [
        { name: "Cylas (Tetranychus)", gdd: 600, condition: "Suelo agrietado, época seca" },
        { name: "Costra negra", gdd: null, condition: "HR > 85%, suelo húmedo" },
        { name: "Virus del moteado", gdd: null, condition: "Transmitido por áfidos" },
      ],
    },
    {
      name: "Coco",
      scientific: "Cocos nucifera",
      family: "Arecaceae",
      type: "Perenne",
      desc: "Palmera tropical multipropósito (agua, leche, aceite, fibra). Ciclo productivo de 60+ años. Requiere alta luminosidad y brisa marina para óptima producción. Tolerante a salinidad costera.",
      requirements: [
        { param: "Temperatura", value: "22-32°C" },
        { param: "Humedad", value: "70-85%" },
        { param: "Precipitación", value: "100-200 mm/mes" },
        { param: "pH Suelo", value: "5.0-7.5" },
        { param: "Ciclo", value: "Continuo (60+ años)" },
      ],
      diseases: [
        { name: "Ácaro del cocotero", gdd: null, condition: "Época seca prolongada" },
        { name: "Amarillamiento letal", gdd: null, condition: "Transmitido por insectos vectores" },
        { name: "Pudrición del cogollo", gdd: null, condition: "Exceso de humedad, drenaje pobre" },
      ],
    },
    {
      name: "Piña",
      scientific: "Ananas comosus",
      family: "Bromeliaceae",
      type: "Perenne",
      desc: "Fruta tropical de metabolismo CAM (alta eficiencia hídrica). Ciclo único por planta (produce un solo fruto). Sensible a cochinillas y nematodos. Requiere inducción floral con etileno/calcio.",
      requirements: [
        { param: "Temperatura", value: "22-30°C" },
        { param: "Humedad", value: "65-80%" },
        { param: "Precipitación", value: "80-150 mm/mes" },
        { param: "pH Suelo", value: "4.5-6.0" },
        { param: "Ciclo", value: "12-18 meses" },
      ],
      diseases: [
        { name: "Cochinilla harinosa", gdd: 1500, condition: "HR > 75%, asociación con hormigas" },
        { name: "Fusariosis", gdd: null, condition: "Suelo ácido, heridas en fruto" },
        { name: "Podredumbre del corazón", gdd: null, condition: "Anegamiento, drenaje deficiente" },
      ],
    },
    {
      name: "Mango",
      scientific: "Mangifera indica",
      family: "Anacardiaceae",
      type: "Perenne",
      desc: "Fruta tropical de alta demanda internacional. Requiere período seco para inducción floral. Variedades injertadas producen en 3-4 años. Alta eficiencia de transpiración. Sensible a antracnosis en poscosecha.",
      requirements: [
        { param: "Temperatura", value: "24-30°C" },
        { param: "Humedad", value: "60-75%" },
        { param: "Precipitación", value: "60-120 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.5" },
        { param: "Ciclo", value: "Continuo (40+ años)" },
      ],
      diseases: [
        { name: "Mosca de la fruta", gdd: 1600, condition: "Maduración de frutos, temp > 25°C" },
        { name: "Antracnosis", gdd: null, condition: "Lluvias en floración, HR > 80%" },
        { name: "Oídio", gdd: null, condition: "HR > 70%, temperatura 20-25°C" },
      ],
    },
    {
      name: "Papaya",
      scientific: "Carica papaya",
      family: "Caricaceae",
      type: "Perenne",
      desc: "Fruta tropical de crecimiento rápido. Produce frutos a los 8-10 meses de siembra. Altamente susceptible a virus (PRSV-P). Requiere renovación cada 2-3 años por pérdida de productividad. Manejo intensivo.",
      requirements: [
        { param: "Temperatura", value: "22-30°C" },
        { param: "Humedad", value: "70-85%" },
        { param: "Precipitación", value: "100-180 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.0" },
        { param: "Ciclo", value: "8-12 meses" },
      ],
      diseases: [
        { name: "Virus PRSV-P", gdd: 1300, condition: "Transmitido por áfidos, calor húmedo" },
        { name: "Antracnosis", gdd: null, condition: "Fruto maduro, HR > 85%" },
        { name: "Mancha foliar", gdd: null, condition: "HR > 80%, hojas viejas" },
      ],
    },
    {
      name: "Tomate",
      scientific: "Solanum lycopersicum",
      family: "Solanaceae",
      type: "Anual",
      desc: "Hortaliza de mayor valor comercial global. Alta susceptibilidad a mosca blanca y virosis asociadas. Requiere tutorado y poda. Manejo fitosanitario intensivo. Responde muy bien a fertirriego.",
      requirements: [
        { param: "Temperatura", value: "18-28°C" },
        { param: "Humedad", value: "60-75%" },
        { param: "Precipitación", value: "60-100 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.0" },
        { param: "Ciclo", value: "3-5 meses" },
      ],
      diseases: [
        { name: "Mosca blanca / Virosis", gdd: 600, condition: "HR > 70%, temp > 28°C" },
        { name: "Tizón temprano", gdd: 500, condition: "HR > 80%, 22-28°C" },
        { name: "Gusano del fruto", gdd: null, condition: "Etapa de fructificación" },
      ],
    },
    {
      name: "Fríjol",
      scientific: "Phaseolus vulgaris",
      family: "Fabaceae",
      type: "Anual",
      desc: "Leguminosa de grano de alta importancia nutricional. Ciclo corto (60-120 días). Fija nitrógeno atmosférico. Sensible a exceso de humedad radicular. Responde a fósforo y potasio. Ideal para rotación con maíz.",
      requirements: [
        { param: "Temperatura", value: "15-28°C" },
        { param: "Humedad", value: "60-75%" },
        { param: "Precipitación", value: "60-100 mm/mes" },
        { param: "pH Suelo", value: "5.5-7.0" },
        { param: "Ciclo", value: "2-4 meses" },
      ],
      diseases: [
        { name: "Ácaros / Araña roja", gdd: 500, condition: "Época seca, temp > 28°C" },
        { name: "Antracnosis", gdd: null, condition: "HR > 80%, 15-20°C" },
        { name: "Roya del fríjol", gdd: 400, condition: "HR > 75%, 18-25°C" },
      ],
    },
  ];

  const activeCropData = crops.find((c) => c.name === activeCrop);
  const otherCrops = crops.filter((c) => c.name !== activeCrop);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-leaf-800">Cultivos Soportados</h2>
        <p className="text-sm text-soil-500 mt-1">
          18 cultivos con perfiles completos: requerimientos ambientales, ciclo, plagas y recomendaciones.
        </p>
      </div>

      {/* Crop selector */}
      <div className="flex flex-wrap gap-2">
        {crops.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActiveCrop(c.name)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              activeCrop === c.name
                ? "bg-leaf-500 text-white"
                : "bg-leaf-50 text-leaf-600 hover:bg-leaf-100"
            }`}
          >
            <Sprout className="h-3.5 w-3.5" />
            {c.name}
          </button>
        ))}
      </div>

      {/* Active crop detail */}
      {activeCropData && (
        <div className="space-y-4">
          <div className="dashboard-card">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-leaf-600">
                <Sprout className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-leaf-800">{activeCropData.name}</h3>
                  <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[10px] font-medium text-leaf-600">
                    {activeCropData.scientific}
                  </span>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                    {activeCropData.family}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                    {activeCropData.type}
                  </span>
                </div>
                <p className="mt-2 text-xs text-soil-600 leading-relaxed">{activeCropData.desc}</p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="dashboard-card">
            <h4 className="text-sm font-semibold text-leaf-700 mb-3">Requerimientos Ambientales</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {activeCropData.requirements.map((req) => (
                <div key={req.param} className="rounded-lg bg-leaf-50 p-3 text-center">
                  <p className="text-[10px] font-medium text-soil-400 uppercase">{req.param}</p>
                  <p className="mt-1 text-sm font-bold text-leaf-700">{req.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Diseases */}
          <div className="dashboard-card">
            <h4 className="text-sm font-semibold text-leaf-700 mb-3">Enfermedades y Plagas</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-leaf-100 text-left text-soil-400">
                    <th className="pb-2 pr-4 font-medium">Plaga / Enfermedad</th>
                    <th className="pb-2 pr-4 font-medium">GDD Umbral</th>
                    <th className="pb-2 font-medium">Ventana de Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCropData.diseases.map((d, i) => (
                    <tr key={i} className="border-b border-leaf-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-leaf-700">{d.name}</td>
                      <td className="py-2.5 pr-4 text-soil-500">{d.gdd ? `> ${d.gdd} GDD` : "N/A"}</td>
                      <td className="py-2.5 text-soil-600">{d.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Global charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-leaf-700 mb-3">Índice de Riesgo por Cultivo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[...ALL_CROP_DATA].sort((a, b) => b.riesgo - a.riesgo)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#4a6b53" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="riesgo" name="Índice de Riesgo" radius={[4, 4, 0, 0]}>
                {[...ALL_CROP_DATA].sort((a, b) => b.riesgo - a.riesgo).map((entry, idx) => (
                  <Cell key={idx} fill={entry.riesgo > 75 ? "#e76f51" : entry.riesgo > 55 ? "#f4a261" : "#52b788"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="dashboard-card">
          <h3 className="text-sm font-semibold text-leaf-700 mb-3">Temperatura y Humedad por Cultivo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ALL_CROP_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7e9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#4a6b53" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="gdd" name="GDD Total (/100)" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="riesgo" name="Riesgo Relativo" fill="#e76f51" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Other crops quick reference */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {otherCrops.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => setActiveCrop(c.name)}
            className="dashboard-card text-left hover:border-leaf-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-leaf-500" />
              <h4 className="text-sm font-semibold text-leaf-700">{c.name}</h4>
            </div>
            <p className="mt-1 text-xs text-soil-500 line-clamp-2">{c.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.requirements.slice(0, 3).map((r) => (
                <span key={r.param} className="rounded bg-leaf-50 px-1.5 py-0.5 text-[10px] text-leaf-600">
                  {r.value}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
