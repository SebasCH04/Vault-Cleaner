# Vault Cleaner · Destiny 2 · Base 0.1

Extensión inicial para Firefox. Incluye un panel dentro de DIM y una demo interactiva sin conexión.

## Instalación en Firefox

1. Extrae el ZIP completo a una carpeta de tu computadora.
2. Abre Firefox y escribe `about:debugging#/runtime/this-firefox` en la barra de direcciones.
3. Pulsa **Cargar complemento temporal…** / **Load Temporary Add-on…**.
4. Selecciona el archivo **manifest.json** de la carpeta `vault-cleaner`.
5. Abre https://app.destinyitemmanager.com/ e inicia sesión de la forma habitual.
6. Recarga DIM si ya estaba abierto. En Inventario, expande la sección Armas.
7. Pulsa el botón verde **Limpiar vault**, abajo a la derecha.

Necesita Firefox 140 o posterior. Esta instalación de desarrollo es temporal: al cerrar completamente Firefox, tendrás que volver a cargar el complemento. No es un XPI firmado ni una versión publicada en la tienda. No requiere cambiar configuraciones de seguridad del navegador.

## Primera prueba con tu inventario

1. Pulsa **Sincronizar light.gg** en el panel. Se abrirá Roll Appraiser.
2. Inicia sesión en light.gg si hace falta. Cuando haya armas visibles, la extensión recorrerá la página y guardará las notas que pueda asociar a una copia concreta. Puedes detener el recorrido.
3. Vuelve a DIM y pulsa **Actualizar inventario**. Mira el contador: X armas con nota / Y armas totales.
4. Las categorías C, D y F vienen marcadas. Selecciona las armas que quieras revisar.
5. Elige tu personaje. Para probar por primera vez, pon **Máx. / tanda = 1**.
6. Pulsa **Preparar tanda**, comprueba el nombre, los perks y la terminación del ID, y pulsa **Enviar tanda**.
7. Comprueba dentro del juego que llegó la copia indicada. Si funciona, aumenta el tamaño de la siguiente tanda.
8. Desmantela las armas dentro de Destiny 2. Actualiza DIM y el panel antes de preparar otra tanda.

La extensión mueve objetos mediante los controles de DIM. No pide contraseñas, claves de API ni tokens. Los candidatos permanecen desbloqueados como estaban; la extensión no desbloquea objetos, no los equipa y no los desmantela.

## Qué incluye

- Lectura del inventario completo de armas desde el estado de DIM; no depende de tener todas las tarjetas visibles.
- Calificaciones de light.gg por ID de instancia, recogidas al visitar Roll Appraiser. Incluye captura de respuestas JSON y de tarjetas visibles.
- Categorías S/A/B/C/D/F, con variantes como C+ agrupadas dentro de su letra.
- Búsqueda por arma y perk, selección individual o de las candidatas visibles.
- Vistas Candidatas, Protegidas, Sin nota y Todas.
- Protecciones para bloqueadas, equipadas, favoritas, conservar/archivar, loadouts de DIM y del juego, fabricadas, exóticas y Deepsight.
- Preparación y revisión de una tanda, capacidad calculada por ranura y reserva opcional de un espacio.
- Traslado secuencial al personaje elegido, sin equipar. Cada movimiento se verifica en el estado actualizado de DIM antes de continuar.
- Botón Detener y filtro por IDs exactos mediante Ver en DIM.
- Notas guardadas localmente en esta extensión. Vencen a las 48 horas para evitar usar calificaciones viejas.

## Límites de esta primera base

- **La integración está implementada y probada con un DIM simulado. No se ha validado todavía en tu cuenta real.** Usa la primera tanda de una sola arma para comprobar la compatibilidad de tu DIM.
- Las notas de esta demo son inventadas para mostrar el flujo; no describen tus armas ni el meta actual. Nunca se usan en la extensión real.
- Esta extensión no puede leer el almacenamiento privado de Aegis Overlay. Las notas se capturan de nuevo desde light.gg. Puedes mantener Aegis instalado.
- La captura puede ser parcial. No presupone que 118 notas correspondan a todo el vault. Si light.gg usa filtros, pestañas, paginación o una lista que no se desplaza con la página, habrá que abrir esas vistas para capturar las armas restantes. La captura continúa cuando abres otras páginas de Roll Appraiser; esta versión no automatiza filtros ni paginación.
- Sin nota significa sin evaluar, nunca F. Se necesita volver a sincronizar para refrescar las notas vencidas.
- Las armaduras no se evalúan con estas notas de armas. Su limpieza queda para una versión posterior.
- Las notas son popularidad de light.gg; no son una recomendación personalizada de qué armas debes conservar. Por eso revisas y seleccionas cada tanda.
- Los botones de movimiento y el estado React/Redux de DIM son interfaces internas. Si DIM cambia su estructura, la extensión muestra un error y se detiene. No intenta una acción alternativa desconocida.
- DIM debe haber cargado tus etiquetas y los loadouts del juego para permitir el traslado. No se fuerza el traslado cuando faltan esas protecciones.
- No se desplazan otros objetos para hacer espacio. Si el personaje está lleno, libera espacio y actualiza.
- Detener impide empezar otra arma; una petición que DIM ya envió puede terminar. Si hay un error o una espera vencida, verifica el inventario antes de repetir.
- No hay detección instantánea de desmantelado: después de borrar una tanda, actualiza DIM y el panel.
- Bungie no ofrece desmantelado mediante su API. El borrado se hace en el juego.

## Demo sin instalar

Abre `preview/demo.html` en cualquier navegador. Prueba categorías, seleccionar visibles, buscar, elegir personaje, preparar tanda y simular traslado. No conecta con tu cuenta. Recarga para restaurar los datos de demostración.

También se entrega `Vault-Cleaner-demo.html`, que reúne la demo en un único archivo.

## Si el panel no conecta

1. Confirma que el complemento aparece cargado en `about:debugging`.
2. Recarga DIM, entra a Inventario y expande Armas.
3. Espera a que DIM termine de cargar y pulsa Actualizar en el panel.
4. Si el error continúa, comparte el texto del error y una captura del panel. No hace falta copiar tokens ni usar la consola.

## Pruebas y código

El ZIP incluye el código fuente y las pruebas. Para las pruebas de lógica: `node --test tests/core.test.cjs`.

Se comprobaron 22 casos de IDs, notas, protecciones, antigüedad y capacidad, y cinco flujos en Chromium: interfaz de demo, exclusión de armas sin nota, traslado por la acción STORE de DIM simulado sin usar EQUIP, bloqueo al faltar datos de protección, y captura DOM con rechazo de IDs ambiguos. No se validó una instalación real en Firefox ni un traslado real de Bungie.

Referencias de implementación:

- https://github.com/DestinyItemManager/DIM (código consultado: d7c02e5cf9ba19e750bc626f497a7a069be23b08)
- https://github.com/Maxeption/dim-aegis-overlay (estructura de integración light.gg consultada: 50a7b276aaca6980dcd88d66d72520292b920f4c)
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts
- https://github.com/DestinyItemManager/DIM/wiki/FAQ

El código de esta base se escribió para este proyecto. No se empaquetan los repositorios consultados ni dependencias de pruebas dentro de la extensión.
