# Vault Cleaner · Destiny 2 · Base 0.1.7

Extensión para Firefox con un panel dentro de DIM y una demo sin conexión. La limpieza clasifica cada copia por su mayor rango de popularidad posible con los perks que ya tiene. Puedes preparar hasta 9 armas por ranura, 27 en total, o elegir armas sin filtro de rango mediante Traslado manual.

## Instalación o actualización

1. Extrae el ZIP completo en una carpeta nueva.
2. Abre Firefox y escribe `about:debugging#/runtime/this-firefox`.
3. Si aparece una versión anterior de Vault Cleaner, pulsa **Eliminar / Remove**.
4. Pulsa **Cargar complemento temporal / Load Temporary Add-on** y selecciona `vault-cleaner/manifest.json`.
5. Comprueba la versión **0.1.7** y recarga **DIM y light.gg** para retirar el código anterior.
6. En https://app.destinyitemmanager.com/ abre Inventario, expande Armas y pulsa **Limpiar vault**, abajo a la derecha.
7. Vuelve a sincronizar los máximos con light.gg.

Necesita Firefox 140 o posterior. Esta instalación de desarrollo es temporal: al cerrar completamente Firefox, tendrás que volver a cargar el complemento. No es un XPI firmado ni una publicación en la tienda.

## Clasificar por el mejor rango posible

Una copia que actualmente sea **C** y pueda alcanzar **S** se clasifica como **S**. No entra en las candidatas C/D/F. La tabla muestra **Máximo** y, cuando se ha podido leer, **Actual**. Las variantes + y − se mantienen y los contadores las agrupan por letra.

1. Pulsa **Sincronizar light.gg** para abrir Roll Appraiser.
2. Inicia sesión allí si hace falta. Abre **☰ → Settings → Popularity Rank Display → Best Available**.
3. Espera a que cambien las notas. En la franja de captura marca **Estoy viendo Best Available**. La extensión vuelve a leerlas como máximos.
4. Espera a que termine la captura y vuelve a DIM. Pulsa **Actualizar inventario**.

La confirmación corresponde a esa pestaña y se reinicia al recargar. Si cambias light.gg a Equipped, desmárcala. La extensión también admite un máximo explícito en la tarjeta o una etiqueta visible **↑ S Rank Possible**, aunque no esté marcada la confirmación.

Si falta el máximo, caduca o contradice al rango actual, la copia permanece protegida para Limpieza. Las notas actuales y los máximos caducan por separado a las 48 horas; capturar de nuevo solo el rango actual no renueva un máximo antiguo. Los rangos visibles de la 0.1.6 no se convierten automáticamente en máximos: vuelve a sincronizar.

**La captura solo lee.** La mejora de perks la haces tú desde light.gg mediante **Equip Popular Perks**. No vuelve la pestaña Mejorables ni ningún botón de mejora en la extensión.

Referencia de Best Available: https://www.light.gg/announcements/76/lightgg-patch-v21-notes-popularity-ranks-roll-appraiser-item-detail-page-updates-and-more/

## Tandas por ranura: hasta 27

**Máx. / ranura** vale 9 de inicio. Se aplica de forma independiente a las ranuras **Cinética, Energía y Potencia** de DIM. La munición especial no constituye una ranura adicional.

- Si cada ranura tiene solo su arma equipada y quedan 9 espacios libres, la tanda puede incluir **9 + 9 + 9 = 27** armas.
- Si ya tienes otras armas en el personaje, se usa el espacio libre real de cada ranura.
- Un límite de 3 permite hasta **3 + 3 + 3 = 9** armas.
- **Dejar 1 espacio adicional por ranura** viene desactivado. Al activarlo se reduce el espacio que se utilizará; una ranura con 9 libres aceptará 8.
- Si una ranura se llena o alcanza el límite, se siguen revisando las demás.

El panel muestra los espacios por ranura y el total posible. La revisión muestra cuántas armas de cada ranura se enviarán y cuántas seleccionadas quedaron fuera por capacidad, límite o estado. Las que no se trasladan permanecen seleccionadas si siguen siendo válidas para otra tanda.

No se desplazan otros objetos para hacer espacio. Cada movimiento comprueba de nuevo la copia exacta, la cuenta, el modo y la capacidad antes de usar STORE en DIM, sin equipar.

## Dos modos de traslado

### Limpieza por máximo

Es el modo inicial. Elige categorías de rango, revisa las candidatas y selecciona las copias que quieras trasladar. C/D/F vienen seleccionadas.

Se protegen las copias bloqueadas, equipadas, favoritas, conservar/archivar, en loadouts, fabricadas, exóticas, Deepsight, no transferibles, fuera del vault o sin máximo confirmado. Las vistas son **Candidatas**, **Protegidas**, **Sin máximo** y **Todas**.

### Traslado manual

Elige este modo para pasar al personaje cualquier arma transferible del vault que tú selecciones, incluso una S o una copia sin nota. También permite seleccionar copias bloqueadas, favoritas, en loadouts, fabricadas o exóticas: esas condiciones protegen la limpieza automática, no impiden este traslado elegido por ti.

1. En **Modo** elige **Traslado manual**. Se abre Todas y se vacía la selección anterior.
2. Busca el arma y marca la copia concreta. Puedes elegir una sola o varias.
3. Elige el personaje y pulsa **Preparar tanda**.
4. Revisa nombre, perks, terminación del ID, protecciones y cantidad por ranura. Confirma **Enviar tanda**.
5. Decide dentro del juego cuáles quieres borrar. Las copias bloqueadas siguen bloqueadas y sus etiquetas se conservan.

Este modo ignora el rango y los filtros de limpieza, pero mantiene las comprobaciones de espacio, copia exacta y traslado disponible. No admite armaduras, copias fuera del vault, en el postmaster, equipadas o no transferibles. No desbloquea, equipa ni desmantela armas. Cambiar entre modos borra la selección para que cada tanda corresponda al modo que estás revisando.

## Después de una tanda

Los traslados son secuenciales y se confirman en el inventario actualizado de DIM. **Detener** evita comenzar otra arma; una petición ya enviada puede terminar. Desmantela dentro de Destiny 2 solo las copias que hayas decidido, actualiza DIM y prepara otra tanda.

La extensión debe haber cargado las etiquetas y loadouts de DIM y del juego antes de permitir movimientos. Si faltan esos datos o cambia la cuenta, no fuerza el traslado.

## Captura y límites

- Las notas se asocian al ID completo de cada copia, no solo al nombre o al tipo de arma.
- La captura puede ser parcial con filtros, pestañas, paginación o listas virtualizadas. Abre las vistas restantes para capturar esas copias.
- La lectura se divide en tareas pequeñas, con límites por tarjeta. **Detener captura** y **Reanudar captura** controlan el recorrido.
- No se intercepta fetch/XHR ni se leen cookies, contraseñas o tokens.
- Una nota ausente nunca se transforma en F.
- Aegis no es necesario: las notas se capturan directamente de light.gg.
- La popularidad no determina por sí sola qué debes conservar. Revisa cada tanda.
- La integración con DIM usa controles internos y puede necesitar ajustes si cambian. Las pruebas usan un inventario simulado; falta validar estos cambios en tu sesión real de Firefox.

Si la captura queda en cero, espera a **Captura lista**. Si no aparecen notas, pulsa **Diagnóstico** y comparte `Vault-Cleaner-diagnostico.json`. Contiene contadores y muestras limitadas de marcadores y atributos, sin HTML completo, scripts, valores de formularios ni datos de sesión. Se descarga localmente y no se envía automáticamente.

Si el panel no conecta, comprueba que el complemento esté cargado, recarga DIM, espera al inventario y pulsa **Actualizar inventario**.

## Demo y pruebas

Abre `preview/demo.html` o `Vault-Cleaner-demo.html`. Las notas son inventadas y los traslados son simulados. La demo incluye una C→S y un personaje con 9 espacios libres por ranura. Recarga para restaurar los datos.

Desde `vault-cleaner`, ejecuta `node --test tests/core.test.cjs` para las 34 pruebas de lógica. Las pruebas `rank.test.cjs`, `batches.test.cjs`, `browser.test.cjs`, `capture-layouts.test.cjs` y `performance.test.cjs` requieren Playwright y Chromium; las dependencias no se empaquetan.

Las comprobaciones cubren C→S protegida, máximos pendientes y contradictorios, fechas independientes, 27 armas repartidas 9/9/9, límites menores por ranura, ranuras llenas y reserva adicional, selección manual sin notas y protegida para limpieza, cambios de modo, captura de Best Available, ausencia de acciones de perks y STORE de DIM sin EQUIP. La prueba de rendimiento usa 1.300 tarjetas y unos 65.000 elementos, además de Detener/Reanudar y tarjetas reutilizadas. No se validó un traslado real de Bungie.

Referencias de implementación:

- https://github.com/DestinyItemManager/DIM (código consultado: d7c02e5cf9ba19e750bc626f497a7a069be23b08)
- https://github.com/Maxeption/dim-aegis-overlay (estructura consultada: 50a7b276aaca6980dcd88d66d72520292b920f4c)
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts

El código se escribió para este proyecto. No se empaquetan los repositorios consultados ni las dependencias de pruebas.
