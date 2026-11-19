# Vault Cleaner · Destiny 2 · Base 0.1.6

Extensión para Firefox con un panel dentro de DIM y una demo sin conexión. Clasifica las armas por el rango de popularidad mostrado en light.gg y permite llevar las candidatas del vault a un personaje por tandas.

## Instalación o actualización

1. Extrae el ZIP completo en una carpeta nueva.
2. Abre Firefox y escribe `about:debugging#/runtime/this-firefox`.
3. Si aparece una versión anterior de Vault Cleaner, pulsa **Eliminar / Remove**.
4. Pulsa **Cargar complemento temporal / Load Temporary Add-on** y selecciona `vault-cleaner/manifest.json`.
5. Comprueba que la versión sea **0.1.6** y recarga las pestañas de **DIM y light.gg** para retirar el código anterior.
6. En https://app.destinyitemmanager.com/ abre Inventario, expande Armas y pulsa **Limpiar vault**, abajo a la derecha.
7. Vuelve a sincronizar los rangos. Las capturas anteriores guardadas como máximo potencial necesitan una nueva captura.

Necesita Firefox 140 o posterior. Es una instalación de desarrollo temporal: al cerrar completamente Firefox, tendrás que volver a cargar el complemento. No es un XPI firmado ni una publicación en la tienda.

## Clasificación por rango

El panel muestra una sola nota por copia: **S, A, B, C, D o F**, conservando las variantes + y −. Los contadores agrupan cada variante dentro de su letra.

Esta versión retira la pestaña y las acciones de Mejorables, el enlace para cambiar perks desde la extensión, la columna de máximo potencial y el aviso/casilla «Para leer el máximo». La sincronización lee el rango que muestra light.gg; no cambia su configuración ni aplica perks.

1. Pulsa **Sincronizar light.gg** para abrir Roll Appraiser.
2. Inicia sesión allí si hace falta y espera a que carguen las armas.
3. La franja inferior muestra el avance. Puedes **Detener captura** o **Reanudar captura**.
4. Al terminar, vuelve a DIM y pulsa **Actualizar inventario**.

Si cambias los perks desde light.gg, actualiza Roll Appraiser y vuelve a capturar los rangos antes de preparar una tanda. La extensión no confirma por su cuenta que todas las armas estén optimizadas.

## Aplicar perks populares directamente en light.gg

En Roll Appraiser, busca las copias con el aviso de flecha **↑ … Rank Possible**. Abre la copia y usa **Equip Popular Perks**. light.gg explica que este botón selecciona los perks disponibles que dan el mayor rango de popularidad. Hay que estar en órbita, en un espacio social o fuera del juego.

La documentación consultada describe el botón por copia. No se pudo confirmar un botón para aplicarlo a todo el inventario ni un filtro exclusivo de esas flechas. Para localizar el texto visible puedes usar **Ctrl+F → Rank Possible** en Firefox; solo busca las tarjetas que la página ya haya cargado, no todo el inventario oculto o paginado.

Referencias oficiales:

- https://www.light.gg/announcements/76/lightgg-patch-v21-notes-popularity-ranks-roll-appraiser-item-detail-page-updates-and-more/
- https://www.light.gg/db/es-mx/items/927567426/todo-pasa/
- https://www.light.gg/god-roll/roll-appraiser/

## Revisar y trasladar una tanda

1. Elige las categorías de rango que quieras revisar. C/D/F vienen seleccionadas.
2. Usa **Candidatas**, **Protegidas**, **Sin nota** o **Todas** y busca por arma o perk.
3. Selecciona las candidatas individualmente o con **Seleccionar visibles**.
4. Elige un personaje de destino y el tamaño de la tanda. Para una primera prueba, usa una sola arma.
5. Pulsa **Preparar tanda**, revisa nombres, perks y terminaciones de IDs, y confirma **Enviar tanda**.
6. Comprueba el traslado dentro del juego, desmantela allí las armas que hayas decidido y actualiza DIM antes de continuar.

Se usa la acción de traslado de DIM, sin equipar. Cada movimiento se verifica en el inventario actualizado antes de continuar. El cálculo de capacidad respeta cada ranura y permite reservar un espacio libre. **Detener** impide comenzar otra arma; una petición que DIM ya envió puede terminar.

## Protecciones y límites

- Se excluyen de las candidatas las copias bloqueadas, equipadas, favoritas, conservar/archivar, en loadouts, fabricadas, exóticas, Deepsight, no transferibles y fuera del vault.
- Si no se conocen el bloqueo, el equipo, las etiquetas o los loadouts necesarios, no se fuerza el traslado.
- Una nota ausente, inválida o de más de 48 horas queda como **Sin nota**, nunca F.
- Las notas se asocian al ID completo de cada copia, no solo al nombre o al tipo de arma.
- La captura puede ser parcial cuando hay filtros, pestañas, paginación o listas virtualizadas. Abre las vistas restantes para capturar esas copias.
- La lectura se divide en tareas pequeñas, con límites por tarjeta. No intercepta fetch/XHR ni lee cookies, contraseñas o tokens.
- La extensión no desbloquea, mejora, equipa ni desmantela armas. El desmantelado se hace dentro del juego.
- Aegis no es necesario: las notas se capturan directamente de light.gg.
- No se mueven otros objetos para liberar espacio. Si el personaje está lleno, libera espacio y actualiza.
- La popularidad no es una recomendación personalizada de qué conservar. Revisa las armas antes de trasladarlas.
- Las armaduras quedan fuera de esta clasificación.
- La integración con DIM usa sus controles internos y puede necesitar ajustes si cambian. Las pruebas usan un inventario simulado; no sustituyen una prueba en tu sesión real.

## Si la captura queda en cero

Espera a que la franja indique **Captura lista**. Si no aparecen notas, pulsa **Diagnóstico** y comparte el archivo `Vault-Cleaner-diagnostico.json`.

El diagnóstico contiene contadores, clases/atributos, muestras de marcadores y terminaciones de IDs. No exporta el HTML completo, scripts, valores de formularios ni datos de sesión. Se descarga localmente y no se envía automáticamente.

Si el panel no conecta, comprueba que el complemento esté cargado, recarga DIM, espera a que termine de cargar el inventario y pulsa **Actualizar inventario**.

## Demo y pruebas

Abre `preview/demo.html` o el archivo independiente `Vault-Cleaner-demo.html`. Incluye notas inventadas y traslados simulados; no conecta con tu cuenta. Recarga para restaurar la demo.

El ZIP incluye el código fuente y las pruebas. Desde `vault-cleaner`, ejecuta `node --test tests/core.test.cjs` para las 25 pruebas de lógica. Las pruebas `rank.test.cjs`, `browser.test.cjs`, `capture-layouts.test.cjs` y `performance.test.cjs` requieren Playwright y Chromium; esas dependencias no se empaquetan.

Las comprobaciones cubren clasificación por rango sin confirmar máximos, notas vencidas, protección de armas, capacidad por ranura, reemplazo de datos antiguos, captura por copia, ausencia de acciones de perks, interfaz simplificada y traslado mediante STORE de DIM sin EQUIP. La prueba de rendimiento usa 1.300 tarjetas y unos 65.000 elementos, además de Detener/Reanudar y tarjetas reutilizadas. No se validó una instalación real de Firefox ni un traslado real de Bungie.

Referencias de implementación:

- https://github.com/DestinyItemManager/DIM (código consultado: d7c02e5cf9ba19e750bc626f497a7a069be23b08)
- https://github.com/Maxeption/dim-aegis-overlay (estructura consultada: 50a7b276aaca6980dcd88d66d72520292b920f4c)
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts

El código se escribió para este proyecto. No se empaquetan los repositorios consultados ni las dependencias de pruebas.
