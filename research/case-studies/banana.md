# Case Study: Cultivo de Banana (Musa spp.)

## 1. Descripcion General

La banana es un cultivo perenne tropical de la familia Musaceae, ampliamente
cultivado en regiones humedas y calidas de Centroamerica, Sudamerica, Africa y
Asia. Es el cuarto cultivo alimenticio mas importante del mundo despues del
arroz, trigo y maiz. En el marco del proyecto Crop Production System, la banana
representa un caso de alto valor comercial con requerimientos ambientales
estrictos y alta susceptibilidad a enfermedades fungicas.

## 2. Requerimientos Ambientales

| Parametro           | Valor Optimo        | Rango Critico       |
|---------------------|---------------------|---------------------|
| Temperatura         | 26 - 30 °C          | < 15 °C o > 38 °C   |
| Humedad Relativa    | 70 - 90 %           | < 60 %              |
| Precipitacion       | 100 - 200 mm/mes    | < 50 mm/mes         |
| Altitud             | 0 - 1000 msnm       | > 1500 msnm         |
| pH del Suelo        | 5.5 - 7.0           | < 4.5 o > 8.0       |
| Profundidad Suelo   | > 1.0 m             | < 0.5 m             |

## 3. Ciclo de Cultivo

La banana tiene un ciclo de 9 a 12 meses desde la siembra hasta la cosecha,
dependiendo de la variedad y las condiciones ambientales.

| Etapa             | Duracion       | Actividades Clave                    |
|-------------------|----------------|--------------------------------------|
| Crecimiento vegetativo | 4 - 6 meses | Riego, fertilizacion, control malezas |
| Diferenciacion floral | 2 - 3 meses | Monitoreo de Sigatoka, ajuste NPK    |
| Llenado de frutos     | 2 - 3 meses | Riego constante, control de trips    |
| Cosecha               | 1 - 2 semanas | Corte, desmane, empaque              |

## 4. Enfermedades y Plagas

| Enfermedad        | Agente Causal             | GDD Umbral       | Ventana de Riesgo        |
|-------------------|---------------------------|------------------|--------------------------|
| Sigatoka negra    | Pseudocercospora fijiensis | > 2000 GDD       | Humedad > 80 %, 25-28 °C |
| Fusarium R4T      | Fusarium oxysporum f. sp. cubense | N/A     | Suelo anegado, pH acido  |
| Moko              | Ralstonia solanacearum    | N/A              | Temperatura > 28 °C      |
| Trips             | Frankliniella parvula     | N/A              | Epoca seca               |

### 4.1 Sigatoka Negra

La Sigatoka negra es la enfermedad mas destructiva del cultivo de banana a nivel
global. El modelo de prediccion en Crop Production System utiliza GDD (Growing
Degree Days) acumulados con un umbral de 2000 GDD para activar alertas de
aplicacion fungicida.

**Sintomas iniciales:** Rayas cloroticas en hojas jovenes (hojas 2-4).

**Condiciones favorables:**
- Humedad relativa > 80 % por mas de 6 horas
- Temperatura entre 25 y 28 °C
- Rango optimo: periodo lluvioso con temperaturas moderadas

**Control recomendado:**
- Aplicacion de fungicidas protectantes al superar 1500 GDD
- Aplicacion de fungicidas sistemicos al superar 2000 GDD
- Deshoje sanitario semanal
- Monitoreo de esporas en trampas volumetricas

### 4.2 Fusarium R4T (Tropical Race 4)

El Fusarium R4T es una enfermedad vascular sin cura conocida. Crop Production
System monitorea condiciones de riesgo (suelo anegado, pH acido, temperaturas
elevadas) y emite alertas preventivas.

**Control:** Exclusivamente preventivo: drenaje optimo, material vegetal
certificado, cuarentena de areas infectadas.

## 5. Sensores y Monitoreo

| Sensor                | Variable           | Ubicacion               | Frecuencia |
|-----------------------|--------------------|-------------------------|------------|
| DHT22 / SHT30         | Temperatura        | Dosel del cultivo       | 15 min     |
| DHT22 / SHT30         | Humedad relativa   | Dosel del cultivo       | 15 min     |
| Capacitivo / TDR      | Humedad del suelo  | 20-30 cm profundidad    | 30 min     |
| Pluviometro digital   | Precipitacion      | Abierto, 1.5 m altura   | 1 hora     |
| Anemometro            | Velocidad viento   | 2 m altura              | 1 hora     |

### Alertas Configuradas

| Alerta                    | Condicion                           | Accion                        |
|---------------------------|-------------------------------------|-------------------------------|
| Riesgo Sigatoka           | GDD > 2000 y HR > 80 % por 6h      | Notificar aplicacion fungicida|
| Estrés hidrico            | Humedad suelo < 40 %               | Activar riego por goteo       |
| Exceso hidrico            | Humedad suelo > 90 %               | Verificar drenaje             |
| Temperatura extrema       | Temp > 38 °C o < 15 °C             | Alerta en dashboard y app     |

## 6. Recomendaciones de Manejo

### Riego

| Tipo             | Frecuencia         | Lámina (mm/dia) | Observaciones              |
|------------------|--------------------|------------------|----------------------------|
| Goteo            | Diario o alterno   | 4 - 6            | Ideal para pendientes      |
| Aspersion        | 2 - 3 veces/semana | 6 - 8            | Mayor riesgo foliar        |
| Gravedad (surcos)| Semanal            | 8 - 10           | Bajo eficiencia, anegamiento|

**Recomendacion principal:** Riego por goteo con cintas a 20 cm del pseudotallo,
2 laterales por hilera.

### Fertilizacion

El cultivo de banana es exigente en nutrientes, especialmente potasio.

| Elemento | Relacion NPK | Dosis anual (kg/ha) | Epoca                       |
|----------|--------------|----------------------|-----------------------------|
| Nitrogeno (N) | 1        | 300 - 400            | Fraccionado cada 30-45 dias |
| Fosforo (P)   | 0.5      | 150 - 200            | Base + 2 aplicaciones       |
| Potasio (K)   | 2        | 600 - 800            | Cada 30 dias durante toda la campaña |

**Formula recomendada:** NPK 1-0.5-2

**Epocas de aplicacion:**
- A los 30 dias post-siembra: 1/3 de N y P, 1/4 de K
- Cada 45 dias: restante en dosis iguales
- Potasio: incrementar durante llenado de frutos

### Manejo del Suelo

- Cobertura organica (mulch) en epoca seca
- Drenaje superficial e interno en epoca lluviosa
- Deshoje sanitario cada 15-21 dias
- Control de malezas con herbicidas selectivos o coberturas vivas

## 7. Referencias

- Ploetz, R. C. (2015). Management of Fusarium wilt of banana. Acta Horticulturae.
- Marin, D. H. et al. (2003). Black Sigatoka of banana. Annual Review of Phytopathology.
- Robinson, J. C. & Sauco, V. G. (2010). Bananas and Plantains. CABI.
