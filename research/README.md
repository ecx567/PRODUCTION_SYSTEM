# Crop Production System -- Documentacion Tecnica

## Resumen del Proyecto

Crop Production System es una plataforma integral de monitoreo y gestion agricola
disenada para cultivos tropicales de alto valor: banana, maize (maiz), cacao y rice
(arroz). El sistema integra sensores IoT desplegados en campo para capturar variables
ambientales en tiempo real (temperatura, humedad, humedad del suelo, lluvia),
modelos de Machine Learning para prediccion de enfermedades y recomendaciones de
manejo, un dashboard web para visualizacion de datos historicos y alertas, y una
aplicacion mobile para notificaciones en campo. La plataforma opera sobre un
backend en la nube con almacenamiento de series temporales, calculo de Grados Dias
de Desarrollo (GDD) y umbrales fitosanitarios especificos por cultivo.

El objetivo principal es reducir perdidas por enfermedades mediante deteccion
temprana, optimizar el uso de insumos (agua, fertilizantes, fungicidas) a traves
de recomendaciones basadas en datos, y centralizar la informacion de multiples
lotes en una unica interfaz. El sistema esta disenado para escalar desde parcelas
individuales hasta operaciones regionales, soportando configuraciones de alertas
personalizables por cultivo, variedad y etapa fenologica.

## Indice de Documentacion

### Case Studies por Cultivo

| Cultivo | Archivo | Cultivo | Ciclo | GDD Clave |
|---------|---------|---------|-------|-----------|
| Banana | [case-studies/banana.md](case-studies/banana.md) | Perenne | 9-12 meses | > 2000 (Sigatoka) |
| Maize | [case-studies/maize.md](case-studies/maize.md) | Anual | 3-5 meses | 800 (FAW) |
| Cacao | [case-studies/cacao.md](case-studies/cacao.md) | Perenne | Continuo | 1600 (Witches' Broom) |
| Rice | [case-studies/rice.md](case-studies/rice.md) | Anual | 3-6 meses | 1200 (Blast) |

### Sistemas de Produccion

| Sistema | Archivo |
|---------|---------|
| Comparacion de 5 sistemas | [production-systems.md](production-systems.md) |

## Estructura del Repositorio

```
research/
  README.md               -- Este archivo, indice general
  case-studies/
    banana.md             -- Case study: cultivo de banana
    maize.md              -- Case study: cultivo de maiz
    cacao.md              -- Case study: cultivo de cacao
    rice.md               -- Case study: cultivo de arroz
  production-systems.md   -- Comparacion de sistemas de produccion
```

## Convenciones

- Temperatura en grados Celsius (°C)
- Humedad relativa en porcentaje (%)
- Lluvia en milimetros por mes (mm/mes)
- GDD: Growing Degree Days (Grados Dias de Desarrollo)
- Sensores: referencias estandar de industria IoT agricola
