# Case Study: Cultivo de Maize (Zea mays)

## 1. Descripcion General

El maiz es el cultivo de grano mas producido a nivel mundial, con origen en
Mesoamerica. Pertenece a la familia Poaceae y se cultiva en una amplia variedad
de condiciones climaticas. En el proyecto Crop Production System, el maiz
representa un cultivo anual de ciclo corto con alta demanda de nitrogeno y
vulnerabilidad al ataque de plagas, especialmente el FAW (Fall Armyworm).

## 2. Requerimientos Ambientales

| Parametro           | Valor Optimo        | Rango Critico       |
|---------------------|---------------------|---------------------|
| Temperatura         | 18 - 32 °C          | < 10 °C o > 38 °C   |
| Humedad Relativa    | 60 - 80 %           | < 40 % o > 90 %     |
| Precipitacion       | 50 - 100 mm/mes     | < 30 mm/mes         |
| Altitud             | 0 - 2500 msnm       | > 3000 msnm         |
| pH del Suelo        | 5.5 - 7.5           | < 4.5 o > 8.5       |
| Profundidad Suelo   | > 0.6 m             | < 0.3 m             |

## 3. Ciclo de Cultivo

El ciclo del maiz varia entre 3 y 5 meses segun la variedad (precoz, semitardia,
tardia). Crop Production System ajusta los umbrales de GDD y alertas segun la
variedad registrada en el sistema.

| Etapa             | Duracion (dias) | GDD Acumulado  | Actividades Clave              |
|-------------------|-----------------|----------------|--------------------------------|
| Emergencia        | 5 - 10          | 50 - 100       | Riego de germinacion           |
| Crecimiento vegetativo (V1-V10) | 30 - 45 | 100 - 500       | 1a aplicacion N, control malezas |
| Crecimiento vegetativo (V10-VT) | 20 - 30 | 500 - 750       | 2a aplicacion N, monitoreo FAW |
| Floracion (VT-R2) | 15 - 20         | 750 - 850      | Riego critico, 3a aplicacion N |
| Llenado de grano (R2-R6) | 35 - 50  | 850 - 1200     | Monitoreo de plagas            |
| Madurez (R6)      | 5 - 10          | > 1200         | Secado y cosecha               |

## 4. Plagas y Enfermedades

| Plaga/Enfermedad  | Agente Causal             | GDD Umbral       | Ventana de Riesgo              |
|-------------------|---------------------------|------------------|--------------------------------|
| FAW (Cogollero)   | Spodoptera frugiperda     | > 800 GDD        | Etapa V2-V8, temp > 25 °C      |
| Tizon foliar      | Exserohilum turcicum      | > 600 GDD        | Humedad > 80%                  |
| Roya comun        | Puccinia sorghi           | > 700 GDD        | Temperatura 16-23 °C           |
| Midew pulverulento| Peronosclerospora sorghi  | > 400 GDD        | HR > 85 %                      |
| Gusano barrenador | Diatraea saccharalis      | > 500 GDD        | Etapa vegetativa tardia        |

### 4.1 FAW -- Spodoptera frugiperda

El cogollero del maiz (FAW) es la plaga mas destructiva del cultivo. Crop
Production System utiliza GDD con umbral de 800 para predecir picos poblacionales.

**Sintomas iniciales:** Ventanas en hojas nuevas (raspadura), excremento en el
cogollo. Larvas de 1-3 cm color verde claro a marron con linea blanca dorsal.

**Condiciones favorables:**
- Temperatura > 25 °C
- Humedad relativa moderada
- Presencia de malezas hospederas

**Control recomendado:**
- Monitoreo semanal en etapa V2-V8
- Aplicacion de insecticidas biologicos (Bacillus thuringiensis) en infestation
  temprana (< 20 %)
- Aplicacion de insecticidas quimicos (spinetoram, clorantraniliprol) en
  infestation severa (> 20 %)
- Control biologico con Trichogramma spp. y liberacion de parasitoides

### 4.2 Tizon Foliar (Northern Corn Leaf Blight)

Enfermedad fungica favorecida por temperaturas moderadas y alta humedad.

**Control:**
- Variedades resistentes
- Rotacion de cultivos
- Fungicidas protectantes (clorotalonil) al alcanzar 600 GDD

## 5. Sensores y Monitoreo

| Sensor                | Variable           | Ubicacion               | Frecuencia |
|-----------------------|--------------------|-------------------------|------------|
| DHT22 / BME280        | Temperatura        | 1.5 m sobre el suelo    | 15 min     |
| DHT22 / BME280        | Humedad relativa   | 1.5 m sobre el suelo    | 15 min     |
| Capacitivo / TDR      | Humedad del suelo  | 15-20 cm profundidad    | 30 min     |
| Pluviometro digital   | Precipitacion      | Abierto, 1.5 m altura   | 1 hora     |
| Sensor de viento      | Velocidad viento   | 2 m altura              | 1 hora     |

### Alertas Configuradas

| Alerta                    | Condicion                           | Accion                        |
|---------------------------|-------------------------------------|-------------------------------|
| Riesgo FAW                | GDD > 800 y fase V2-V8             | Monitoreo intensivo           |
| Estrés hidrico            | Humedad suelo < 35 % en floracion  | Riego inmediato               |
| Exceso hidrico            | Lluvia > 120 mm en 7 dias          | Verificar drenaje             |
| Ventana fertilizacion N   | GDD en 150-200                     | Aplicar 1a dosis N            |
| Riesgo tizon              | GDD > 600 y HR > 80 % por 8h      | Aplicar fungicida protectante |

## 6. Recomendaciones de Manejo

### Riego

| Etapa             | Lámina (mm) | Frecuencia        | Observaciones              |
|-------------------|-------------|-------------------|----------------------------|
| Emergencia        | 20 - 30     | Cada 3 - 5 dias   | Mantener humedad uniforme |
| Vegetativo        | 30 - 40     | Cada 5 - 7 dias   | Profundidad 30 cm         |
| Floracion         | 40 - 50     | Cada 3 - 5 dias   | Periodo CRITICO           |
| Llenado de grano  | 30 - 40     | Cada 7 dias       | Reducir gradualmente      |
| Madurez           | 0 - 15      | Solo si necesario | Suspender antes de cosecha|

### Fertilizacion (Split-N)

El maiz requiere nitrogeno fraccionado en 3 aplicaciones (split-N) para
maximizar eficiencia y minimizar lixiviacion.

| Aplicacion | Etapa           | GDD    | % N total | Dosis (kg N/ha) |
|------------|-----------------|--------|-----------|-----------------|
| 1a (base)  | Siembra - V2    | 0-100  | 30 %      | 45 - 60         |
| 2a         | V4 - V6         | 150-300| 40 %      | 60 - 80         |
| 3a         | V10 - VT        | 500-750| 30 %      | 45 - 60         |

**Formula completa por hectarea:**
- Nitrogeno: 150 - 200 kg N/ha
- Fosforo: 60 - 100 kg P205/ha (aplicacion total en siembra)
- Potasio: 80 - 120 kg K20/ha (fraccionado con N)
- Zinc: 5 - 10 kg Zn/ha (aplicacion foliar en V4-V6)

### Manejo Integrado de Plagas (MIP)

- Monitoreo semanal sistematico (5 puntos por hectarea, 10 plantas por punto)
- Umbral de accion FAW: 20 % de plantas con dano foliar activo
- Control biologico preventivo en zonas endemicas
- Rotacion de mecanismos de accion en insecticidas quimicos
- Refugios de plantas no Bt en cultivos geneticamente modificados

## 7. Referencias

- CIMMYT (2019). Maize Crop Management: Best Practices.
- FAO (2020). Maize Production Guide for Smallholders.
- Overton, J. (1996). Fall Armyworm: A Review of Control Methods. Journal of
  Agricultural Entomology.
