/**
 * Crop profile data for all 18 supported crops.
 * Used across the mobile app for crop profiles, field cards, and documentation.
 */

export interface CropProfile {
  id: string;
  name: string;
  emoji: string;
  scientific: string;
  family: string;
  type: "Anual" | "Perenne";
  desc: string;
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
  rainMin: number;
  rainMax: number;
  phMin: number;
  phMax: number;
  gddTotal: number;
  cycle: string;
  diseases: DiseaseInfo[];
  extra?: { param: string; value: string }[];
}

export interface DiseaseInfo {
  name: string;
  gdd: number | null;
  condition: string;
}

export const CROP_PROFILES: CropProfile[] = [
  {
    id: "banana",
    name: "Banana",
    emoji: "🍌",
    scientific: "Musa spp.",
    family: "Musaceae",
    type: "Perenne",
    desc: "Cuarto cultivo alimenticio más importante del mundo. Alta susceptibilidad a Sigatoka negra. Requiere temperaturas cálidas constantes y alta humedad.",
    tempMin: 26, tempMax: 30,
    humidityMin: 70, humidityMax: 90,
    rainMin: 100, rainMax: 200,
    phMin: 5.5, phMax: 7.0,
    gddTotal: 2000,
    cycle: "9-12 meses",
    diseases: [
      { name: "Sigatoka negra", gdd: 2000, condition: "HR > 80%, 25-28°C" },
      { name: "Fusarium R4T", gdd: null, condition: "Suelo anegado, pH ácido" },
      { name: "Trips", gdd: null, condition: "Época seca" },
    ],
  },
  {
    id: "maize",
    name: "Maíz",
    emoji: "🌽",
    scientific: "Zea mays",
    family: "Poaceae",
    type: "Anual",
    desc: "Cultivo de grano más producido globalmente. Alta demanda de nitrógeno. Vulnerable al FAW (Fall Armyworm) en etapas tempranas. Responde muy bien a riego por goteo.",
    tempMin: 18, tempMax: 32,
    humidityMin: 60, humidityMax: 80,
    rainMin: 50, rainMax: 100,
    phMin: 5.5, phMax: 7.5,
    gddTotal: 800,
    cycle: "3-5 meses",
    diseases: [
      { name: "FAW (Cogollero)", gdd: 800, condition: "Etapa V2-V8, temp > 25°C" },
      { name: "Tizón foliar", gdd: 600, condition: "Humedad > 80%" },
      { name: "Roya común", gdd: 700, condition: "Temperatura 16-23°C" },
    ],
  },
  {
    id: "cacao",
    name: "Cacao",
    emoji: "🍫",
    scientific: "Theobroma cacao",
    family: "Malvaceae",
    type: "Perenne",
    desc: "Cultivo de alto valor para chocolate. Requiere sombra (50-70%). Ideal para sistemas agroforestales. Altamente sensible a Moniliasis y Witches' Broom.",
    tempMin: 22, tempMax: 28,
    humidityMin: 80, humidityMax: 90,
    rainMin: 125, rainMax: 200,
    phMin: 6.0, phMax: 7.0,
    gddTotal: 1600,
    cycle: "Continuo",
    diseases: [
      { name: "Witches' Broom", gdd: 1600, condition: "HR > 85%, sombra > 70%" },
      { name: "Moniliasis", gdd: 1400, condition: "Lluvias > 200 mm/mes" },
      { name: "Phytophthora", gdd: null, condition: "Anegamiento, HR > 90%" },
    ],
  },
  {
    id: "rice",
    name: "Arroz",
    emoji: "🌾",
    scientific: "Oryza sativa",
    family: "Poaceae",
    type: "Anual",
    desc: "Base alimenticia de más de la mitad de la población global. Manejo hídrico intensivo con lámina de agua controlada. Susceptible a Blast en condiciones de alta humedad.",
    tempMin: 20, tempMax: 35,
    humidityMin: 70, humidityMax: 85,
    rainMin: 100, rainMax: 200,
    phMin: 5.0, phMax: 6.5,
    gddTotal: 1200,
    cycle: "3-6 meses",
    diseases: [
      { name: "Blast (Pyricularia)", gdd: 1200, condition: "HR > 85%, N excesivo" },
      { name: "Helminthosporium", gdd: 800, condition: "Deficiencia K, 25-30°C" },
      { name: "Sogata", gdd: null, condition: "Etapa vegetativa" },
    ],
  },
  {
    id: "coffee",
    name: "Café",
    emoji: "☕",
    scientific: "Coffea arabica / robusta",
    family: "Rubiaceae",
    type: "Perenne",
    desc: "Cultivo de exportación de alto valor. Arábica requiere altitudes > 800 msnm. Sensible a Roya de las hojas. Requiere sombra moderada (30-50%).",
    tempMin: 18, tempMax: 26,
    humidityMin: 60, humidityMax: 80,
    rainMin: 120, rainMax: 180,
    phMin: 5.0, phMax: 6.5,
    gddTotal: 1400,
    cycle: "Continuo",
    diseases: [
      { name: "Roya (Hemileia)", gdd: 1400, condition: "HR > 75%, 18-22°C" },
      { name: "CBD (Anthracnose)", gdd: null, condition: "Lluvias intensas, 20-25°C" },
      { name: "Broca", gdd: null, condition: "Humedad > 80%, sombra densa" },
    ],
    extra: [{ param: "Altitud", value: "800-2000 msnm" }],
  },
  {
    id: "sugarcane",
    name: "Caña",
    emoji: "🎋",
    scientific: "Saccharum officinarum",
    family: "Poaceae",
    type: "Perenne",
    desc: "Cultivo industrial de alta biomasa. Alta eficiencia fotosintética (C4). Varios cortes por ciclo de siembra. Alta demanda hídrica y de potasio.",
    tempMin: 20, tempMax: 35,
    humidityMin: 65, humidityMax: 85,
    rainMin: 100, rainMax: 180,
    phMin: 5.5, phMax: 7.5,
    gddTotal: 2400,
    cycle: "12-18 meses",
    diseases: [
      { name: "Barrenador del tallo", gdd: null, condition: "Etapa de macollamiento" },
      { name: "Roya anaranjada", gdd: 1500, condition: "Temp 22-28°C, HR > 80%" },
      { name: "Carbón", gdd: null, condition: "Suelo seco, temperatura alta" },
    ],
  },
  {
    id: "soybean",
    name: "Soya",
    emoji: "🫘",
    scientific: "Glycine max",
    family: "Fabaceae",
    type: "Anual",
    desc: "Leguminosa de grano de alto contenido proteico. Fija nitrógeno atmosférico. Sensible a fotoperíodo. Alta demanda de fósforo y potasio.",
    tempMin: 20, tempMax: 30,
    humidityMin: 60, humidityMax: 80,
    rainMin: 80, rainMax: 120,
    phMin: 5.5, phMax: 7.0,
    gddTotal: 700,
    cycle: "3-4 meses",
    diseases: [
      { name: "Oruga medidora", gdd: 700, condition: "Etapa vegetativa tardía" },
      { name: "Roya asiática", gdd: 650, condition: "HR > 80%, 18-25°C" },
      { name: "Nematodo del quiste", gdd: null, condition: "Suelo arenoso, monocultivo" },
    ],
  },
  {
    id: "sunflower",
    name: "Girasol",
    emoji: "🌻",
    scientific: "Helianthus annuus",
    family: "Asteraceae",
    type: "Anual",
    desc: "Oleaginosa con sistema radicular profundo (hasta 2 m) que mejora la estructura del suelo. Heliotrópico en etapas tempranas. Tolerante a sequía moderada.",
    tempMin: 18, tempMax: 30,
    humidityMin: 50, humidityMax: 70,
    rainMin: 60, rainMax: 100,
    phMin: 5.5, phMax: 7.5,
    gddTotal: 650,
    cycle: "3-4 meses",
    diseases: [
      { name: "Polilla del girasol", gdd: 650, condition: "Etapa de floración" },
      { name: "Mildeu velloso", gdd: null, condition: "Suelo frío y húmedo" },
      { name: "Podredumbre gris", gdd: null, condition: "HR > 85%" },
    ],
  },
  {
    id: "palm_oil",
    name: "Palma",
    emoji: "🌴",
    scientific: "Elaeis guineensis",
    family: "Arecaceae",
    type: "Perenne",
    desc: "Oleaginosa más productiva del mundo (4-6 t aceite/ha/año). Ciclo productivo de 25+ años. Alta demanda de potasio y magnesio.",
    tempMin: 24, tempMax: 30,
    humidityMin: 80, humidityMax: 90,
    rainMin: 150, rainMax: 250,
    phMin: 4.5, phMax: 6.5,
    gddTotal: 2200,
    cycle: "Continuo (25+ años)",
    diseases: [
      { name: "Picudo rojo", gdd: 2200, condition: "Heridas en tronco, estrés hídrico" },
      { name: "Pudrición del cogollo", gdd: null, condition: "Anegamiento, deficiencia de B" },
      { name: "Marchitez sorpresiva", gdd: null, condition: "Transmitido por insectos" },
    ],
  },
  {
    id: "cotton",
    name: "Algodón",
    emoji: "🌿",
    scientific: "Gossypium hirsutum",
    family: "Malvaceae",
    type: "Anual",
    desc: "Fibra textil natural más importante. Cultivo de alto riesgo por presión de plagas. Requiere manejo fitosanitario intensivo.",
    tempMin: 20, tempMax: 35,
    humidityMin: 60, humidityMax: 75,
    rainMin: 70, rainMax: 120,
    phMin: 5.5, phMax: 8.0,
    gddTotal: 1000,
    cycle: "5-7 meses",
    diseases: [
      { name: "Picudo del algodonero", gdd: 1000, condition: "Etapa reproductiva" },
      { name: "Mancha angular", gdd: null, condition: "HR > 80%" },
      { name: "Fusarium", gdd: null, condition: "Suelo ácido" },
    ],
  },
  {
    id: "cassava",
    name: "Yuca",
    emoji: "🥔",
    scientific: "Manihot esculenta",
    family: "Euphorbiaceae",
    type: "Perenne",
    desc: "Raíz amilácea tolerante a sequía y suelos pobres. Cultivo de seguridad alimentaria. Alta eficiencia hídrica. Resistente a plagas.",
    tempMin: 20, tempMax: 35,
    humidityMin: 50, humidityMax: 70,
    rainMin: 50, rainMax: 120,
    phMin: 4.5, phMax: 7.5,
    gddTotal: 700,
    cycle: "8-18 meses",
    diseases: [
      { name: "Ácaros", gdd: 700, condition: "Época seca, temp > 30°C" },
      { name: "Mosaico africano", gdd: null, condition: "Transmitido por mosca blanca" },
      { name: "Podredumbre radicular", gdd: null, condition: "Suelo anegado" },
    ],
  },
  {
    id: "sweet_potato",
    name: "Batata",
    emoji: "🍠",
    scientific: "Ipomoea batatas",
    family: "Convolvulaceae",
    type: "Anual",
    desc: "Raíz reservante de alto valor nutricional. Alta tolerancia a estrés hídrico y suelos marginales. Ciclo corto ideal para rotación.",
    tempMin: 18, tempMax: 30,
    humidityMin: 60, humidityMax: 80,
    rainMin: 50, rainMax: 100,
    phMin: 4.5, phMax: 7.0,
    gddTotal: 600,
    cycle: "3-5 meses",
    diseases: [
      { name: "Cylas", gdd: 600, condition: "Suelo agrietado, época seca" },
      { name: "Costra negra", gdd: null, condition: "HR > 85%" },
      { name: "Virus del moteado", gdd: null, condition: "Transmitido por áfidos" },
    ],
  },
  {
    id: "coconut",
    name: "Coco",
    emoji: "🥥",
    scientific: "Cocos nucifera",
    family: "Arecaceae",
    type: "Perenne",
    desc: "Palmera tropical multipropósito. Ciclo productivo de 60+ años. Requiere alta luminosidad y brisa marina. Tolerante a salinidad costera.",
    tempMin: 22, tempMax: 32,
    humidityMin: 70, humidityMax: 85,
    rainMin: 100, rainMax: 200,
    phMin: 5.0, phMax: 7.5,
    gddTotal: 1800,
    cycle: "Continuo (60+ años)",
    diseases: [
      { name: "Ácaro del cocotero", gdd: null, condition: "Época seca prolongada" },
      { name: "Amarillamiento letal", gdd: null, condition: "Transmitido por vectores" },
      { name: "Pudrición del cogollo", gdd: null, condition: "Exceso de humedad" },
    ],
  },
  {
    id: "pineapple",
    name: "Piña",
    emoji: "🍍",
    scientific: "Ananas comosus",
    family: "Bromeliaceae",
    type: "Perenne",
    desc: "Fruta tropical de metabolismo CAM (alta eficiencia hídrica). Ciclo único por planta. Sensible a cochinillas y nematodos.",
    tempMin: 22, tempMax: 30,
    humidityMin: 65, humidityMax: 80,
    rainMin: 80, rainMax: 150,
    phMin: 4.5, phMax: 6.0,
    gddTotal: 1500,
    cycle: "12-18 meses",
    diseases: [
      { name: "Cochinilla harinosa", gdd: 1500, condition: "HR > 75%" },
      { name: "Fusariosis", gdd: null, condition: "Suelo ácido, heridas en fruto" },
      { name: "Podredumbre del corazón", gdd: null, condition: "Anegamiento" },
    ],
  },
  {
    id: "mango",
    name: "Mango",
    emoji: "🥭",
    scientific: "Mangifera indica",
    family: "Anacardiaceae",
    type: "Perenne",
    desc: "Fruta tropical de alta demanda internacional. Requiere período seco para inducción floral. Variedades injertadas producen en 3-4 años.",
    tempMin: 24, tempMax: 30,
    humidityMin: 60, humidityMax: 75,
    rainMin: 60, rainMax: 120,
    phMin: 5.5, phMax: 7.5,
    gddTotal: 1600,
    cycle: "Continuo (40+ años)",
    diseases: [
      { name: "Mosca de la fruta", gdd: 1600, condition: "Maduración, temp > 25°C" },
      { name: "Antracnosis", gdd: null, condition: "Lluvias en floración" },
      { name: "Oídio", gdd: null, condition: "HR > 70%, 20-25°C" },
    ],
  },
  {
    id: "papaya",
    name: "Papaya",
    emoji: "🧡",
    scientific: "Carica papaya",
    family: "Caricaceae",
    type: "Perenne",
    desc: "Fruta tropical de crecimiento rápido. Produce a los 8-10 meses. Altamente susceptible a virus PRSV-P. Requiere renovación cada 2-3 años.",
    tempMin: 22, tempMax: 30,
    humidityMin: 70, humidityMax: 85,
    rainMin: 100, rainMax: 180,
    phMin: 5.5, phMax: 7.0,
    gddTotal: 1300,
    cycle: "8-12 meses",
    diseases: [
      { name: "Virus PRSV-P", gdd: 1300, condition: "Transmitido por áfidos" },
      { name: "Antracnosis", gdd: null, condition: "Fruto maduro, HR > 85%" },
      { name: "Mancha foliar", gdd: null, condition: "HR > 80%" },
    ],
  },
  {
    id: "tomato",
    name: "Tomate",
    emoji: "🍅",
    scientific: "Solanum lycopersicum",
    family: "Solanaceae",
    type: "Anual",
    desc: "Hortaliza de mayor valor comercial global. Alta susceptibilidad a mosca blanca y virosis. Requiere tutorado y manejo fitosanitario intensivo.",
    tempMin: 18, tempMax: 28,
    humidityMin: 60, humidityMax: 75,
    rainMin: 60, rainMax: 100,
    phMin: 5.5, phMax: 7.0,
    gddTotal: 600,
    cycle: "3-5 meses",
    diseases: [
      { name: "Mosca blanca", gdd: 600, condition: "HR > 70%, temp > 28°C" },
      { name: "Tizón temprano", gdd: 500, condition: "HR > 80%, 22-28°C" },
      { name: "Gusano del fruto", gdd: null, condition: "Fructificación" },
    ],
  },
  {
    id: "beans",
    name: "Fríjol",
    emoji: "🫛",
    scientific: "Phaseolus vulgaris",
    family: "Fabaceae",
    type: "Anual",
    desc: "Leguminosa de grano de alta importancia nutricional. Ciclo corto (60-120 días). Fija nitrógeno. Ideal para rotación con maíz.",
    tempMin: 15, tempMax: 28,
    humidityMin: 60, humidityMax: 75,
    rainMin: 60, rainMax: 100,
    phMin: 5.5, phMax: 7.0,
    gddTotal: 500,
    cycle: "2-4 meses",
    diseases: [
      { name: "Ácaros / Araña roja", gdd: 500, condition: "Época seca" },
      { name: "Antracnosis", gdd: null, condition: "HR > 80%, 15-20°C" },
      { name: "Roya del fríjol", gdd: 400, condition: "HR > 75%" },
    ],
  },
];

export const CROP_MAP: Record<string, CropProfile> = {};
for (const crop of CROP_PROFILES) {
  CROP_MAP[crop.id] = crop;
}

export const CROP_EMOJI_MAP: Record<string, string> = {};
for (const crop of CROP_PROFILES) {
  CROP_EMOJI_MAP[crop.name.toLowerCase()] = crop.emoji;
}

export function getCropEmoji(cropType: string): string {
  return CROP_EMOJI_MAP[cropType.toLowerCase()] ?? "🌱";
}

export function getCropById(id: string): CropProfile | undefined {
  return CROP_MAP[id];
}

export function getCropByName(name: string): CropProfile | undefined {
  return CROP_PROFILES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
}
