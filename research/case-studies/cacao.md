# Case Study: Cultivo de Cacao (Theobroma cacao)

## 1. Descripcion General

El cacao es un cultivo perenne tropical originario de la cuenca del Amazonas,
perteneciente a la familia Malvaceae. Es la materia prima para la produccion de
chocolate y uno de los cultivos de mayor valor economico en agricultura familiar
de paises tropicales. En Crop Production System, el cacao representa un cultivo
de sotobosque con requerimientos estrictos de sombra y humedad, ideal para
sistemas agroforestales.

## 2. Requerimientos Ambientales

| Parametro           | Valor Optimo        | Rango Critico       |
|---------------------|---------------------|---------------------|
| Temperatura         | 22 - 28 °C          | < 18 °C o > 33 °C   |
| Humedad Relativa    | 80 - 90 %           | < 70 %              |
| Precipitacion       | 125 - 200 mm/mes    | < 80 mm/mes         |
| Sombra              | 50 - 70 %           | < 30 % o > 80 %     |
| pH del Suelo        | 6.0 - 7.0           | < 5.0 o > 8.0       |
| Profundidad Suelo   | > 1.5 m             | < 0.8 m             |
| Altitud             | 0 - 800 msnm        | > 1200 msnm         |

## 3. Ciclo de Cultivo

El cacao es un cultivo permanente que inicia produccion comercial entre los
2 y 4 anos, con picos de cosecha bimensuales (cosecha continua).

| Etapa               | Duracion       | Actividades Clave                    |
|---------------------|----------------|--------------------------------------|
| Vivero              | 5 - 6 meses    | Riego, sombra 70 %, seleccion clones |
| Desarrollo (1-2 anios) | 12 - 24 meses | Establecimiento sombra, fertilizacion |
| Inicio produccion   | 3 - 4 anios    | Cosecha inicial, poda formacion      |
| Plena produccion    | 5 - 25 anios   | Cosecha continua, manejo fitosanitario |
| Declive             | > 25 anios     | Renovacion o replantacion            |

## 4. Enfermedades y Plagas

| Enfermedad        | Agente Causal                 | GDD Umbral       | Ventana de Riesgo              |
|-------------------|-------------------------------|------------------|--------------------------------|
| Witches' Broom    | Moniliophthora perniciosa     | > 1600 GDD       | HR > 85 %, sombra excesiva     |
| Moniliasis        | Moniliophthora roreri         | > 1400 GDD       | Lluvias continuas > 200 mm/mes |
| Phytophthora      | Phytophthora palmivora        | N/A              | Anegamiento, HR > 90 %         |
| Ceratocystis      | Ceratocystis cacaofunesta     | N/A              | Heridas de poda, insectos      |
| Escoba de bruja    | Moniliophthora perniciosa     | > 1600 GDD       | Tejidos jovenes                |

### 4.1 Witches' Broom (Escoba de Bruja)

Es la enfermedad mas limitante del cacao en Sudamerica. Causada por el hongo
Moniliophthora perniciosa, afecta brotes jovenes, cojines florales y frutos.

**Sintomas:** Hipertrofia de brotes vegetativos (escoba vegetativa),
engrosamiento de cojines florales, frutos con formas deformes.

**Condiciones favorables:**
- Humedad relativa > 85 %
- Temperatura entre 22 y 26 °C
- Exceso de sombra (> 70 %)
- GDD acumulado > 1600

**Control recomendado:**
- Poda fitosanitaria cada 30-45 dias en epoca lluviosa
- Aplicacion de fungicidas cupricos (500 g/ha) al superar 1200 GDD
- Eliminacion de frutos afectados y escobas vegetativas
- Manejo de sombra para mantenerla en 50 %
- Clones resistentes (CCN-51, CEPEC-2004)

### 4.2 Moniliasis (Moniliophthora roreri)

Enfermedad que afecta exclusivamente los frutos del cacao, causando perdidas de
hasta 90 % en zonas endemicas.

**Sintomas:** Manchas aceitosas en mazorcas verdes, deformacion, necrosis
interna del grano.

**Control:**
- Cosecha semanal de frutos maduros
- Eliminacion de frutos enfermos cada 7-15 dias
- Fungicidas protectantes (oxicloruro de cobre)
- Aplicacion de Trichoderma spp. como biocontrolador

## 5. Sensores y Monitoreo

| Sensor                | Variable           | Ubicacion               | Frecuencia |
|-----------------------|--------------------|-------------------------|------------|
| DHT22 / BME280        | Temperatura        | Bajo dosel, 1.5 m       | 15 min     |
| DHT22 / BME280        | Humedad relativa   | Bajo dosel, 1.5 m       | 15 min     |
| Capacitivo / TDR      | Humedad del suelo  | 20-30 cm profundidad    | 30 min     |
| Radiometro            | Radiacion PAR      | Bajo y sobre dosel      | 1 hora     |
| Pluviometro digital   | Precipitacion      | Sobre dosel             | 1 hora     |
| Anemometro            | Velocidad viento   | Sobre dosel             | 1 hora     |

### Alertas Configuradas

| Alerta                    | Condicion                           | Accion                        |
|---------------------------|-------------------------------------|-------------------------------|
| Riesgo Witches' Broom     | GDD > 1600 y HR > 85 %              | Poda fitosanitaria urgente    |
| Riesgo Moniliasis         | GDD > 1400 y lluvia > 200 mm/mes   | Cosecha frecuente + fungicida |
| Estrés hidrico            | Humedad suelo < 45 %               | Riego de emergencia           |
| Sombra excesiva           | PAR bajo dosel < 15 %              | Poda de arboles de sombra     |
| Sombra insuficiente       | PAR bajo dosel > 50 %              | Establecer sombra temporal    |

## 6. Recomendaciones de Manejo

### Manejo de Sombra

El cacao requiere sombra regulada durante todo su ciclo. Crop Production System
monitorea la radiacion PAR bajo dosel para recomendar ajustes.

| Etapa            | Sombra Optima | Arboles/ha recomendados | Especies Sugeridas      |
|------------------|---------------|-------------------------|-------------------------|
| Establecimiento  | 60 - 70 %     | 100 - 150               | Platano, Erythrina      |
| Desarrollo       | 50 - 60 %     | 50 - 80                 | Inga, Gliricidia        |
| Plena produccion | 40 - 50 %     | 30 - 60                 | Cedro, Laurel           |

### Fertilizacion

El cacao responde bien a la fertilizacion organica complementada con
fertilizantes minerales.

| Elemento | Dosis (kg/ha/anio) | Epoca de Aplicacion       |
|----------|--------------------|----------------------------|
| Nitrogeno (N) | 100 - 150      | Inicio y mitad de lluvias  |
| Fosforo (P)   | 30 - 50        | Total al inicio lluvias    |
| Potasio (K)   | 120 - 180      | Fraccionado en 3-4 dosis   |
| Magnesio (Mg) | 20 - 40        | Con cada dosis de K        |
| Materia organica | 3 - 5 t/ha  | Cada 6 meses               |

**Practicas recomendadas:**
- Acolchado organico permanente (hojarasca + cascara de cacao)
- Compostaje de residuos de cosecha
- Aplicacion de microorganismos beneficos (Micorrizas, Trichoderma)
- Cal dolomitica para correccion de pH cada 2-3 anios

### Drenaje

- Drenaje superficial: canales cada 20-30 m en pendiente
- Drenaje interno: suelo profundo > 1.5 m
- Evitar anegamiento prolongado (> 48 horas) que favorece Phytophthora
- Camellones en zonas con nivel freatico alto

### Poda

| Tipo              | Frecuencia          | Proposito                        |
|-------------------|---------------------|----------------------------------|
| Poda de formacion | 1-2 por anio (1-3 anios)| Estructura, 3-4 ramas principales |
| Poda fitosanitaria| Cada 30-45 dias     | Eliminar escobas, frutos enfermos|
| Poda de mantencion| 1-2 por anio        | Aireacion, entrada de luz        |
| Poda de rehabilitacion | Cada 3-5 anios | Renovacion de copa               |

## 7. Referencias

- Wood, G. A. R. & Lass, R. A. (2008). Cocoa. Tropical Agriculture Series.
- ICCO (2021). International Cocoa Organization: Growing Cocoa.
- Purdy, L. H. & Schmidt, R. A. (1996). Cocoa Diseases: Status and Control.
  Annual Review of Phytopathology.
