# Case Study: Cultivo de Rice (Oryza sativa)

## 1. Descripcion General

El arroz es el cultivo alimenticio mas importante del mundo, base de la dieta
de mas de la mitad de la poblacion global. Pertenece a la familia Poaceae y se
cultiva principalmente en condiciones de anegamiento (arroz irrigado). En Crop
Production System, el arroz representa un cultivo con manejo hidrico intensivo,
alta dependencia de nitrogeno y susceptibilidad a enfermedades fungicas
favorecidas por la alta humedad del microclima del cultivo.

## 2. Requerimientos Ambientales

| Parametro           | Valor Optimo        | Rango Critico       |
|---------------------|---------------------|---------------------|
| Temperatura         | 20 - 35 °C          | < 15 °C o > 40 °C   |
| Humedad Relativa    | 70 - 85 %           | < 50 %              |
| Precipitacion       | 100 - 200 mm/mes    | < 60 mm/mes         |
| Lamina de agua      | 5 - 10 cm           | < 2 cm o > 20 cm    |
| pH del Suelo        | 5.0 - 6.5           | < 4.0 o > 8.0       |
| Contenido de arcilla | > 30 %             | < 15 % (suelo arenoso) |

## 3. Ciclo de Cultivo

El ciclo del arroz irrigado varia entre 3 y 6 meses segun la variedad (precoz
120-130 dias, tardia 150-180 dias).

| Etapa             | Duracion (dias) | GDD Acumulado  | Lamina de Agua | Actividades Clave          |
|-------------------|-----------------|----------------|----------------|----------------------------|
| Germinacion       | 7 - 14          | 100 - 150      | 2 - 5 cm       | Drenaje parcial            |
| Macollamiento     | 20 - 35         | 150 - 450      | 5 - 10 cm      | 1a fertilizacion N         |
| Diferenciacion    | 15 - 20         | 450 - 650      | 10 - 15 cm     | 2a fertilizacion N         |
| Floracion         | 10 - 15         | 650 - 850      | 5 - 10 cm      | Riego constante, monitoreo |
| Llenado de grano  | 25 - 35         | 850 - 1100     | 5 cm           | Reducir lamina             |
| Madurez           | 10 - 15         | 1100 - 1300    | Secar          | Drenaje total + cosecha    |

## 4. Enfermedades y Plagas

| Enfermedad/Plaga | Agente Causal             | GDD Umbral       | Ventana de Riesgo              |
|------------------|---------------------------|------------------|--------------------------------|
| Blast (Pyricularia) | Pyricularia oryzae     | > 1200 GDD       | HR > 85 %, N excesivo          |
| Tizon bacterial  | Xanthomonas oryzae pv. oryzae | N/A          | Viento + lluvia, heridas       |
| Helminthosporium | Bipolaris oryzae          | > 800 GDD        | Deficiencia K, temperatura 25-30|
| Sogata (Sogatodes)| Tagosodes orizicolus     | N/A              | Etapa vegetativa               |
| Acaro del arroz  | Steneotarsonemus spinki   | > 900 GDD        | Plantas densas, HR > 80 %      |

### 4.1 Blast (Pyricularia oryzae)

Es la enfermedad mas destructiva del arroz a nivel global. Crop Production
System utiliza GDD con umbral de 1200 y monitoreo de humedad foliar para
predecir brotes del patogeno.

**Sintomas:** Lesiones ovoides con centro gris y borde marron en hojas,
estrangulamiento del cuello de la panicula (neck blast), granos vanos.

**Condiciones favorables:**
- Humedad relativa > 85 % por mas de 10 horas
- Temperatura entre 24 y 28 °C
- Exceso de nitrogeno
- Rocios prolongados

**Control recomendado:**
- Variedades resistentes (genes Pi)
- Fertilizacion nitrogenada fraccionada (evitar excesos)
- Aplicacion de fungicidas (triciclazol, isoprotiolano) al superar 1000 GDD
- Manejo de lamina de agua constante (evitar estres hidrico)

### 4.2 Sogata (Tagosodes orizicolus)

Vector del virus de la hoja blanca del arroz (RHBV) y causante de dano directo.

**Control:**
- Monitoreo con red entomologica (umbral: 10 adultos/m2)
- Insecticidas sistemicos (pymetrozina) en etapas tempranas
- Control biologico con avispas parasitoides (Anagrus spp.)
- Siembra sincronizada en la zona para evitar hospederos puente

## 5. Sensores y Monitoreo

| Sensor                | Variable           | Ubicacion               | Frecuencia |
|-----------------------|--------------------|-------------------------|------------|
| DHT22 / BME280        | Temperatura        | 1.5 m sobre el cultivo  | 15 min     |
| DHT22 / BME280        | Humedad relativa   | 1.5 m sobre el cultivo  | 15 min     |
| Capacitivo / TDR      | Humedad del suelo  | 5-10 cm (bajo lamina)   | 30 min     |
| Pluviometro digital   | Precipitacion      | Abierto, 1.5 m altura   | 1 hora     |
| Sensor de nivel       | Lamina de agua     | En la parcela           | 15 min     |

### Alertas Configuradas

| Alerta                    | Condicion                           | Accion                        |
|---------------------------|-------------------------------------|-------------------------------|
| Riesgo Blast              | GDD > 1200 y HR > 85 % por 10h     | Fungicida preventivo          |
| Lamina baja               | Lamina agua < 3 cm                 | Abrir compuerta entrada       |
| Lamina alta               | Lamina agua > 15 cm                | Abrir compuerta salida        |
| Exceso N                  | GDD en floracion y N foliar alto   | Suspender fertilizacion       |
| Ventana fertilizacion     | GDD en 150-200                     | Aplicar 1a dosis N            |

## 6. Recomendaciones de Manejo

### Manejo de Agua

El manejo del agua en arroz es critico para productividad, control de malezas
y mitigacion de emisiones de metano.

| Etapa             | Lamina (cm) | Estrategia                              |
|-------------------|-------------|-----------------------------------------|
| Germinacion       | 2 - 5       | Suelo saturado, no anegado              |
| Macollamiento     | 5 - 10      | Anegamiento continuo                    |
| Diferenciacion    | 10 - 15     | Aumentar lamina para control malezas    |
| Floracion - Llenado| 5 - 10     | Riego intermitente si es posible        |
| Madurez           | Secar       | Drenar 15-20 dias antes de cosecha      |

**Tecnicas de ahorro de agua:**
- Riego alternado por humedecimiento y secado (AWD)
- Nivelacion laser de parcelas
- Uso de sensores de lamina para cierre automatico de compuertas

### Fertilizacion (N Sincronizada)

El arroz requiere nitrogeno sincronizado con la demanda del cultivo para
maximizar eficiencia y minimizar perdidas por lixiviacion y volatilizacion.

| Aplicacion | Etapa           | GDD    | % N total | Dosis (kg N/ha) | Metodo               |
|------------|-----------------|--------|-----------|-----------------|----------------------|
| Base      | Siembra - 7 dds | 0-100  | 30 %      | 30 - 45         | Incorporado al suelo |
| 1a cobertera | Macollamiento activo | 150-300 | 40 % | 40 - 60    | Al voleo con lamina  |
| 2a cobertera | Diferenciacion floral | 450-650 | 30 % | 30 - 45  | Al voleo con lamina  |

**Dosis total recomendada por hectarea:**
- Nitrogeno: 100 - 150 kg N/ha
- Fosforo: 40 - 60 kg P205/ha (toda en base)
- Potasio: 50 - 80 kg K20/ha (fraccionado con N)
- Zinc: 5 - 10 kg Zn/ha (aplicacion foliar)

### Manejo de Malezas

- Lamina de agua continua como supresor de malezas
- Herbicidas pre-emergentes: pendimetalina, clomazona
- Herbicidas post-emergentes selectivos (bispiribac, cihalofop)
- Control manual de arroz rojo (Oryza sativa f. spontanea)

## 7. Referencias

- IRRI (2021). Rice Knowledge Bank. International Rice Research Institute.
- FAO (2020). Rice Production and Management.
- Ou, S. H. (1985). Rice Diseases. Commonwealth Mycological Institute.
