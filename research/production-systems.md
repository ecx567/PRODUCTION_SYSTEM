# Sistemas de Produccion Agricola

## Comparacion de 5 Sistemas para el Proyecto Crop Production System

Este documento compara cinco sistemas de produccion agricola con enfoque en su
aplicabilidad al monitoreo digital de cultivos tropicales (banana, maize, cacao,
rice) en el marco del proyecto Crop Production System.

---

## 1. Agricultura de Precision

### Descripcion General

La agricultura de precision es un enfoque de gestion agricola basado en la
observacion, medicion y respuesta a la variabilidad espacial y temporal de los
cultivos. Utiliza tecnologias de informacion para optimizar el uso de insumos
(agua, fertilizantes, pesticidas) en funcion de las condiciones especificas de
cada punto del lote.

### Tecnologia Utilizada

| Componente          | Ejemplos                                      |
|---------------------|-----------------------------------------------|
| Sensores IoT        | Temperatura, humedad, humedad suelo, lluvia   |
| Estaciones meteorologicas | Davis, Campbell Scientific              |
| Teledeteccion       | NDVI satelital (Sentinel-2), drones con camara multiespectral |
| ML predictivo       | Modelos de GDD para enfermedades, prediccion de rendimiento |
| Riego variable      | Valvulas proporcionales, mapas de prescripcion |
| Dashboard web       | Visualizacion de series temporales y alertas  |
| Aplicacion mobile   | Notificaciones en campo, registro de labores  |

### Ventajas

- Reduccion de insumos: 20-30 % menos agua y fertilizantes
- Deteccion temprana de enfermedades mediante modelos GDD
- Trazabilidad completa de operaciones
- Toma de decisiones basada en datos objetivos
- Escalabilidad a operaciones de cualquier tamano

### Desventajas

- Alto costo inicial en sensores e infraestructura
- Requiere conectividad a internet en campo
- Curva de aprendizaje para productores (alfabetizacion digital)
- Mantenimiento tecnico especializado
- Dependencia de plataformas cloud y almacenamiento de datos

### Relevancia para Crop Production System

Este es el sistema base del proyecto. Crop Production System es, por definicion,
una plataforma de agricultura de precision. Los cuatro cultivos (banana, maize,
cacao, rice) se benefician directamente del monitoreo IoT + ML para predecir
enfermedades (Sigatoka, FAW, Witches' Broom, Blast) usando GDD y recomendaciones
de manejo especificas. El dashboard y la app mobile son los canales de entrega
de valor al productor.

---

## 2. Agricultura Tradicional

### Descripcion General

La agricultura tradicional se basa en el conocimiento empirico acumulado por
generaciones de agricultores. Utiliza practicas heredadas, observacion directa
del clima y decisiones basadas en experiencia en lugar de datos cuantitativos.
Es el sistema predominante en pequena agricultura familiar.

### Tecnologia Utilizada

| Componente              | Descripcion                                     |
|-------------------------|-------------------------------------------------|
| Observacion visual      | Inspeccion ocular de cultivos                   |
| Conocimiento local      | Calendarios agricolas, fases lunares            |
| Herramientas manuales   | Machete, azada, bomba de mochila                |
| Semillas criollas       | Variedades adaptadas localmente                 |
| Abonos organicos        | Estiercol, compost, ceniza                      |
| Riego por gravedad      | Surcos, melgas, canales abiertos                |

### Ventajas

- Bajo costo de implementacion
- Conocimiento adaptado al territorio
- Autonomia del productor (no depende de tecnologia externa)
- Sostenible en sistemas de baja escala
- Preservacion de variedades locales y biodiversidad

### Desventajas

- Baja productividad por hectarea
- Dificultad para escalar a superficies mayores
- Respuesta tardia a brotes de plagas y enfermedades
- Alto riesgo climatico (no hay datos predictivos)
- Sin trazabilidad ni registro sistematico

### Relevancia para Crop Production System

Crop Production System no busca reemplazar este sistema sino complementarlo.
Los productores tradicionales pueden adoptar selectivamente sensores de bajo
costo y recibir alertas en la app mobile sin cambiar sus practicas culturales.
El sistema esta disenado con una interfaz simple que no asume alfabetizacion
digital avanzada. Para cacao y banana, donde predomina la agricultura familiar,
esta integracion es clave para la adopcion.

---

## 3. Hidroponia

### Descripcion General

La hidroponia es un sistema de produccion sin suelo donde las raices de las
plantas reciben una solucion nutritiva balanceada en un sustrato inerte o
directamente en agua. Permite control total del ambiente radicular y, en
sistemas de invernadero, del ambiente aereo. Es el sistema mas intensivo en
tecnologia y capital.

### Tecnologia Utilizada

| Componente              | Descripcion                                     |
|-------------------------|-------------------------------------------------|
| Sistemas hidroponicos   | NFT, DFT, raiz flotante, sustrato (fibra coco)  |
| Sensores IoT            | CE, pH, temperatura solucion, oxigeno disuelto  |
| Bombas dosificadoras    | Inyeccion de nutrientes automatizada            |
| Iluminacion LED         | Espectro ajustable para fotosintesis            |
| Control climatico       | Ventilacion, calefaccion, CO2, humedad          |
| Esterilizacion UV       | Control de patogenos en solucion                |

### Ventajas

- Mayor productividad por metro cuadrado (3-10x vs. tradicional)
- Uso eficiente de agua (90 % menos que riego tradicional)
- Control total de nutrientes y pH
- Ciclos de cultivo continuos sin dependencia de estacionalidad
- Sin erosion del suelo ni contaminacion por agroquimicos
- Produccion en areas no arables (urbanos, deserticos)

### Desventajas

- Alto costo de capital e instalacion
- Alta dependencia de energia electrica (bombas, luces, control)
- Conocimiento tecnico especializado requerido
- Riesgo de fallo del sistema (bomba, electricidad) en horas
- Enfermedades se propagan rapidamente en sistema cerrado
- No viable para cultivos de raiz profunda o gran tamano

### Relevancia para Crop Production System

La hidroponia tiene aplicacion limitada en los cultivos del proyecto. Banana
puede cultivarse en sustrato (fibra de coco) en invernadero para exportacion de
alta calidad, pero a costos elevados. Maize y rice NO son viables
economicamente en hidroponia a escala comercial (requieren demasiada biomasa).
Cacao tampoco es practico. Sin embargo, Crop Production System puede integrar
sensores de CE y pH para monitoreo de solucion nutritiva si un productor opera
un modulo hidroponico como diversificacion.

---

## 4. Agroforesteria

### Descripcion General

La agroforesteria es un sistema de uso del suelo que combina arboles con
cultivos agricolas y/o animales en una misma parcela, aprovechando las
interacciones ecologicas positivas entre componentes. Es el sistema mas cercano
a la estructura de los ecosistemas naturales tropicales.

### Tecnologia Utilizada

| Componente              | Descripcion                                     |
|-------------------------|-------------------------------------------------|
| Arboles de sombra       | Inga, Erythrina, Gliricidia, Cedro             |
| Arboles maderables      | Laurel, Teca, Caoba (en bordes o hileras)      |
| Cultivos asociados      | Cacao + platano + yuca, cafe + arboles         |
| Sensores IoT            | Radiacion PAR, temperatura bajo dosel           |
| Manejo de cobertura     | Leguminosas de cobertura, mulch organico        |
| Sistemas silvopastoriles| Arboles + pasto + ganado                        |

### Ventajas

- Mayor biodiversidad y resiliencia del ecosistema
- Captura de carbono en biomasa arborea
- Regulacion natural de temperatura y humedad
- Proteccion del suelo contra erosion
- Diversificacion de ingresos (fruta, madera, sombra)
- Reduccion de insumos externos (fertilizantes, pesticidas)
- Reciclaje de nutrientes a traves de hojarasca

### Desventajas

- Mayor complejidad de manejo (varios cultivos simultaneos)
- Competencia por luz, agua y nutrientes entre especies
- Mecanizacion limitada por presencia de arboles
- Ciclos largos de retorno economico (madera)
- Dificultad para aplicar fitosanitarios

### Relevancia para Crop Production System

Altamente relevante para cacao, que REQUIERE sombra (50-70 %) y se cultiva
naturalmente en sistemas agroforestales. Tambien aplica a banana en sistemas
de produccion organica. Crop Production System monitorea la radiacion PAR bajo
dosel para recomendar apertura o cierre de dosel. Los modelos de GDD para
Witches' Broom se correlacionan con la densidad de sombra, permitiendo alertas
especificas. Maize y rice NO se cultivan tipicamente en agroforesteria.

---

## 5. Agricultura Regenerativa

### Descripcion General

La agricultura regenerativa es un enfoque holistico que busca mejorar la salud
del suelo, restaurar ecosistemas y secuestrar carbono atmosferico mediante
practicas como cobertura permanente del suelo, minimo laboreo, rotacion de
cultivos e integracion animal. Prioriza procesos biologicos sobre insumos
quimicos.

### Tecnologia Utilizada

| Componente              | Descripcion                                     |
|-------------------------|-------------------------------------------------|
| Cobertura del suelo     | Cultivos de cobertura (avena, vicia, triticale) |
| Minimo laboreo          | Siembra directa sobre rastrojo                  |
| Rotacion de cultivos    | Maize + soja + abono verde                      |
| Abonos verdes           | Leguminosas (Crotalaria, Mucuna)                |
| Compost y biochar       | Enmiendas organicas, microorganismos beneficos  |
| Integracion animal      | Pastoreo rotativo en residuos de cosecha        |
| Sensores IoT            | Materia organica, actividad microbiana, CO2     |

### Ventajas

- Mejora progresiva de la fertilidad del suelo
- Secuestro de carbono (0.5 - 2 t C/ha/anio)
- Mayor retencion de agua en el suelo (infiltracion)
- Reduccion significativa de fertilizantes sinteticos
- Menor erosion y escorrentia
- Resiliencia a sequias e inundaciones
- Produccion de alimentos con menor huella de carbono

### Desventajas

- Periodo de transicion (3-5 anos) con posible baja de rendimiento
- Mayor requerimiento de mano de obra en manejo de cobertura
- Conocimiento especializado en ecologia del suelo
- Dependencia de disponibilidad de abonos organicos
- Competencia de cultivos de cobertura con el cultivo principal
- Dificultad para controlar malezas en sistema de minimo laboreo

### Relevancia para Crop Production System

Aplicable principalmente a maiz (rotacion con coberturas) y banana (mulch
organico). Crop Production System puede monitorear indicadores de salud del
suelo (humedad, temperatura, materia organica) y recomendar practicas
regenerativas como abonos verdes y compost. Para cacao, la produccion organica
bajo agroforesteria ya incorpora principios de agricultura regenerativa. Rice
es el cultivo mas desafiante para regeneracion, pero practicas como AWD (riego
alternado) reducen emisiones de metano sin cambiar radicalmente el sistema.

---

## Resumen Comparativo

| Aspecto                     | Precision | Tradicional | Hidroponia | Agroforesteria | Regenerativa |
|-----------------------------|-----------|-------------|------------|----------------|--------------|
| Inversion inicial           | Alta      | Baja        | Muy alta   | Media          | Baja-media   |
| Productividad               | Muy alta  | Baja-media  | Muy alta   | Media          | Media        |
| Uso de tecnologia           | Alto      | Bajo        | Muy alto   | Medio          | Medio        |
| Dependencia de insumos      | Media     | Baja        | Alta       | Baja           | Baja         |
| Resiliencia climatica       | Alta      | Baja        | Baja       | Muy alta       | Muy alta     |
| Impacto ambiental           | Medio     | Bajo        | Medio      | Muy bajo       | Muy bajo     |
| Captura de carbono          | Baja      | Baja        | Nula       | Alta           | Muy alta     |
| Escalabilidad               | Alta      | Baja        | Media      | Media          | Media        |
| Compatibilidad con CPS      | NATIVA    | Alta        | Baja       | Alta           | Media-alta   |

## Conclusiones para Crop Production System

1. **Agricultura de precision** es el sistema nativo del proyecto y el que
   maximiza el valor de la plataforma. Todos los modulos (sensores, ML,
   dashboard, app) estan disenados para este sistema.

2. **Agricultura tradicional** debe ser considerada en el diseno de UX/UI
   para asegurar accesibilidad. No se asume que el usuario tenga experiencia
   digital.

3. **Hidroponia** es marginal para los cultivos objetivo. El proyecto no debe
   invertir en funcionalidades especificas para este sistema, pero puede
   integrar sensores basicos si un productor lo requiere.

4. **Agroforesteria** es el sistema complementario mas importante,
   especialmente para cacao. Crop Production System debe soportar
   configuraciones de sombra y monitoreo PAR.

5. **Agricultura regenerativa** representa una tendencia creciente y el
   proyecto debe incorporar metricas de salud de suelo como valor agregado
   para productores orientados a sustentabilidad y mercados de carbono.

## Referencias

- Gebbers, R. & Adamchuk, V. I. (2010). Precision Agriculture and Food Security.
  Science, 327(5967), 828-831.
- Nair, P. K. R. (2011). Agroforestry Systems and Environmental Quality.
  Journal of Environmental Quality, 40(3), 784-790.
- Lal, R. (2020). Regenerative Agriculture for Food and Climate. Journal of
  Soil and Water Conservation, 75(6), 123-129.
- FAO (2022). The State of the World's Land and Water Resources for Food and
  Agriculture.
- Savci, S. (2012). Investigation of Effect of Chemical Fertilizers on
  Environment. APCBEE Procedia, 1, 287-292.
