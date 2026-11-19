# Vault Cleaner · Destiny 2 · Base 0.1.5

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

## Actualizar a 0.1.5

1. En la alerta de Firefox, pulsa Stop si el navegador está bloqueado.
2. Abre `about:debugging#/runtime/this-firefox`, busca Vault Cleaner y pulsa Eliminar / Remove.
3. Recarga las pestañas de light.gg y DIM. Esto retira el código anterior de las páginas.
4. Extrae el ZIP actualizado en una carpeta nueva y carga su `vault-cleaner/manifest.json`.
5. Comprueba que Firefox muestre **0.1.5**. Recarga DIM y vuelve a abrir Sincronizar light.gg.

Las primeras versiones recorrían repetidamente grandes subárboles de la página; además Detener solo suspendía el desplazamiento. La versión actual busca primero IDs de las copias y evalúa cada tarjeta con límites de siete niveles y 1.500 nodos. Todas las búsquedas ceden el control cada pocos milisegundos; la revisión vuelve a ejecutarse solo al cambiar la página. Detener suspende tanto la captura como el recorrido. También se retiró la interceptación de fetch/XHR para evitar procesar las respuestas de light.gg. Después de cargarla, vuelve a sincronizar las notas.

## Máxima popularidad: Best Available

La limpieza ahora usa el mayor rango de popularidad posible **con los perks disponibles en esa copia**, no solo con los perks equipados. Es la opción **Best Available** de light.gg; no significa que todas las armas puedan llegar a S, ni añade perks nuevos, mejora stats o convierte el arma en otra copia. La sincronización solo lee; la acción Aplicar perks populares sí cambia los perks seleccionados cuando la solicitas.

1. En Roll Appraiser abre **☰ → Settings → Popularity Rank Display → Best Available**.
2. Espera a que light.gg actualice las notas de las tarjetas.
3. En la franja verde de Vault Cleaner marca **Ya activé Best Available en light.gg**. La extensión vuelve a leer la página en tareas pequeñas y guarda lo mostrado como máximo. Esta confirmación corresponde a esa pestaña; al recargarla tendrás que confirmarlo de nuevo. Si cambias la visualización de light.gg a Equipped, desmarca la confirmación antes de capturar.
4. Vuelve a DIM y pulsa Actualizar inventario. Las categorías y el contador ahora usan máximos confirmados.

Ejemplo: una copia equipada como D pero que puede alcanzar A se filtra como A, por lo que no entra en la limpieza de C/D/F. Una F cuyo máximo es C se filtra como C. Las notas antiguas, las advertencias Higher Rank Possible sin máximo y los rangos contradictorios quedan protegidos hasta volver a sincronizar.

El panel tiene una vista **Mejorables** y una columna **Máximo**. Muestra también el rango actual cuando la tarjeta lo proporciona de forma explícita. Si solo se captura la visualización Best Available, no se inventa un rango actual. Una advertencia Higher Rank Possible se puede capturar desde texto, título o aria-label dentro de la tarjeta. Los selectores de notas actuales/máximas explícitas se comprobaron con estructuras de prueba; aunque tus capturas muestran notas capturadas, no hemos inspeccionado el HTML de tu sesión real. Por eso la opción documentada de visualización y tu confirmación son la vía de sincronización principal. La lectura no cambia perks. La acción de mejora requiere pulsar su botón y revisar la copia antes de enviar la solicitud.

Se comprobó que una D→A no se puede incluir en una tanda de C/D/F, que una F→C se evalúa por C, que los máximos desconocidos/contradictorios se protegen y que cambiar el modo de captura vuelve a evaluar las tarjetas. En una prueba de 1.300 tarjetas y unos 65.000 elementos se mantuvo una sola lectura en reposo, sin tareas de JavaScript de 50 ms o más detectadas. Falta comprobar la lectura del máximo en tu Firefox real.

Referencia oficial de la opción: https://www.light.gg/announcements/76/lightgg-patch-v21-notes-popularity-ranks-roll-appraiser-item-detail-page-updates-and-more/

## Mejorables: solo subidas de rango (0.1.5)

La vista Mejorables incluye todas las categorías, también armas en personajes y copias bloqueadas. Sus botones cambian perks; no usan la selección ni los botones de traslado o desmantelado. Las protecciones de limpieza siguen aplicándose a los traslados.

En esta vista entran únicamente las copias con una subida de rango de popularidad confirmada: el aviso **↑ B- Rank Possible**, **Higher Rank Possible**, o una comparación reciente en la que el máximo es superior al rango actual. La etiqueta de la captura se lee como máximo alcanzable de esa copia; por ejemplo, C → B-. Las variantes +/− también se comparan en orden.

Se retiraron **Por comprobar** y **Comprobar y aplicar**. Tener perks alternativos, conocer solamente el máximo o ver un botón Equip Popular Perks no demuestra por sí solo una subida de rango, por lo que esas condiciones no agregan armas a Mejorables. Las flechas genéricas de perks, las insignias ocultas y los textos negativos tampoco cuentan.

Cada fila muestra la subida de rango y el botón **Mejorar al máximo**. Solicita a light.gg aplicar la combinación más popular disponible en esa copia. Las calificaciones y los avisos caducan por separado. Si se recaptura una tarjeta cuyo aviso desapareció, se elimina el aviso guardado; los datos anteriores a la 0.1.5 que no distinguen una mejora de perks de una mejora de rango requieren volver a sincronizar. La extensión verifica la subida guardada antes de enviar la solicitud y vuelve a comprobar, cuando están disponibles, los rangos/avisos del modelo de la copia antes de pulsar el control nativo. No aplica una nueva mejora si esos datos muestran que la copia ya alcanzó su máximo.

1. Actualiza la extensión, recarga **DIM y light.gg** y vuelve a sincronizar. Mantén Roll Appraiser abierto.
2. En DIM abre **Mejorables**. Pulsa **Mejorar al máximo** en una sola copia.
3. Revisa nombre, terminación del ID y perks actuales. Confirma la mejora.
4. La extensión busca la copia exacta en una pestaña capturada de light.gg, activa esa pestaña, inspecciona la copia si hace falta y pulsa su control nativo **Equip Popular Perks**. Nunca selecciona un botón solo por el nombre del arma.
5. Comprueba la respuesta de light.gg. Después actualiza el inventario desde DIM y vuelve a sincronizar las notas. La versión informa **Solicitud enviada**, no un éxito de Bungie que no puede verificar. Las notas de la copia se invalidan tras enviar la acción para no emplear datos anteriores como si demostraran que se aplicó.

Para aplicar perks, light.gg indica que hay que estar en órbita, en un espacio social o fuera del juego: https://www.light.gg/db/items/3193598749/the-immortal-adept/

Si la copia ya está optimizada, light.gg puede no mostrar Equip Popular Perks. Si la tarjeta/inspector/control no se puede identificar de forma segura, se muestra un mensaje y no se aplican perks. Pulsa **Diagnóstico** en light.gg con el inspector abierto y adjunta el JSON para ajustar esa estructura. El reporte agrega etiquetas de controles visibles y si tienen enlace Angular, sin ejecutar ni exportar sus expresiones o datos de sesión.

**Compatibilidad:** la lectura real de notas fue visible en tus capturas; esta acción nueva de mejora se validó con tarjetas e inspectores simulados. Aún no se probó en tu sesión real. Las estructuras y los campos Angular admitidos no son una API pública de light.gg, por lo que puede hacer falta adaptar el detector a tu inspector. La extensión no inicia una sesión por su cuenta, no lee cookies/tokens ni hace peticiones directas a Bungie: usa la sesión y el botón nativos de light.gg.

## Si las notas quedan en cero

Esta versión admite marcadores de nota como imagen, etiqueta `.quality`, texto en `.tags` y atributos explícitos de roll. Acepta IDs completos incluso dentro de nombres como `weapon_691753…`. Prioriza los títulos de popularidad sobre las etiquetas secundarias y no asigna S a una tarjeta por decir God Roll.

La franja inferior muestra notas, IDs y marcadores encontrados. Espera a que indique Captura lista. Si las notas permanecen en cero, pulsa **Diagnóstico** y adjunta el archivo `Vault-Cleaner-diagnostico.json` en el chat. El reporte contiene contadores, nombres de etiquetas/clases/atributos, muestras de marcadores y terminaciones de algunos IDs. No exporta el HTML completo, cookies, contraseñas, tokens, valores de formularios ni el contenido de scripts. El reporte se descarga localmente; no se envía automáticamente.

El HTML de tu sesión real aún no estuvo disponible para validar sus selectores. Las pruebas cubren distintas estructuras simuladas, no garantizan que la página real use una de ellas.

## Primera prueba con tu inventario

1. Pulsa **Sincronizar light.gg** en el panel. Se abrirá Roll Appraiser.
2. Inicia sesión en light.gg si hace falta. Activa Best Available y confírmalo en la franja verde como se explica arriba. Cuando haya armas visibles, la extensión recorrerá la página y guardará las notas que pueda asociar a una copia concreta. Puedes detener toda la captura y reanudarla con el botón de la franja inferior.
3. Vuelve a DIM y pulsa **Actualizar inventario**. Mira el contador: X armas con nota / Y armas totales.
4. Las categorías C, D y F vienen marcadas. Selecciona las armas que quieras revisar.
5. Elige tu personaje. Para probar por primera vez, pon **Máx. / tanda = 1**.
6. Pulsa **Preparar tanda**, comprueba el nombre, los perks y la terminación del ID, y pulsa **Enviar tanda**.
7. Comprueba dentro del juego que llegó la copia indicada. Si funciona, aumenta el tamaño de la siguiente tanda.
8. Desmantela las armas dentro de Destiny 2. Actualiza DIM y el panel antes de preparar otra tanda.

La extensión mueve objetos mediante los controles de DIM. No pide contraseñas, claves de API ni tokens. Los candidatos permanecen desbloqueados como estaban; la extensión no desbloquea objetos, no los equipa y no los desmantela.

## Qué incluye

- Lectura del inventario completo de armas desde el estado de DIM; no depende de tener todas las tarjetas visibles.
- Calificaciones de light.gg por ID de instancia, recogidas al visitar Roll Appraiser. Captura las tarjetas visibles en tareas pequeñas y con un límite por tarjeta; no intercepta las solicitudes de la página.
- Categorías S/A/B/C/D/F, con variantes como C+ agrupadas dentro de su letra.
- Búsqueda por arma y perk, selección individual o de las candidatas visibles.
- Vistas Candidatas, Protegidas, Mejorables, Sin nota y Todas.
- Protecciones para bloqueadas, equipadas, favoritas, conservar/archivar, loadouts de DIM y del juego, fabricadas, exóticas y Deepsight.
- Preparación y revisión de una tanda, capacidad calculada por ranura y reserva opcional de un espacio.
- Traslado secuencial al personaje elegido, sin equipar. Cada movimiento se verifica en el estado actualizado de DIM antes de continuar.
- Botón Detener y filtro por IDs exactos mediante Ver en DIM.
- Notas guardadas localmente en esta extensión. Vencen a las 48 horas para evitar usar calificaciones viejas.

## Límites de esta primera base

- **La integración está implementada y probada con un DIM simulado. No se ha validado todavía en tu cuenta real.** Usa la primera tanda de una sola arma para comprobar la compatibilidad de tu DIM.
- Las notas de esta demo son inventadas para mostrar el flujo; no describen tus armas ni el meta actual. Nunca se usan en la extensión real.
- Esta extensión no puede leer el almacenamiento privado de Aegis Overlay. Las notas se capturan de nuevo desde light.gg. Aegis no es necesario; puedes desinstalarlo.
- La captura puede ser parcial. No presupone que 118 notas correspondan a todo el vault. Si light.gg usa filtros, pestañas, paginación o una lista que no se desplaza con la página, habrá que abrir esas vistas para capturar las armas restantes. La captura continúa cuando abres otras páginas de Roll Appraiser y está reanudada; esta versión no automatiza filtros ni paginación.
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

## Prueba de rendimiento de la corrección 0.1.1

En una página de prueba en Chromium con 1.300 tarjetas identificables y 200 contenedores sin ID (65.709 elementos DOM), se capturaron las 1.300 notas. Se ejecutó una sola búsqueda de tarjetas en reposo, sin tareas largas de 50 ms o más detectadas; el mayor intervalo del temporizador de respuesta fue 42,7 ms. Se comprobó que Detener evita nuevas búsquedas tras modificar la página, que Reanudar recoge tarjetas nuevas y que un cambio de ID en una tarjeta reutilizada se vuelve a evaluar. Esta medición corresponde al entorno de prueba; falta comprobar el resultado en tu Firefox con light.gg real.

## Verificación de la captura 0.1.2

Se probaron tarjetas con 240 elementos de perks antes de la nota, notas en texto, imágenes sin la clase quality, atributos explícitos y distintos prefijos de ID. Se rechazaron N/A, el texto God Roll sin una nota, las notas contradictorias y los contenedores con dos copias diferentes. Se comprobó la descarga del diagnóstico y la actualización de atributos de instancia descubiertos automáticamente. Las pruebas originales de interfaz y traslado simulado también pasaron.

La nueva detección se comprobó además con 1.300 tarjetas identificables y contenedores sin ID en una página de unos 65.000 elementos. La lectura permaneció dividida en tareas pequeñas, sin interceptación de solicitudes y sin escanear continuamente una página sin cambios. Se verificó que Detener y Reanudar funcionan.

## Pruebas y código

El ZIP incluye el código fuente y las pruebas. Para las pruebas de lógica: `node --test tests/core.test.cjs`. Las pruebas `rank-badge.test.cjs`, `native-improvement.test.cjs`, `popularity.test.cjs`, `browser.test.cjs`, `capture-layouts.test.cjs` y `performance.test.cjs` necesitan Playwright y un Chromium compatible; no se incluyen esas dependencias en el ZIP.

Se comprobaron 32 casos de IDs, notas, protecciones, antigüedad y capacidad, y cinco flujos en Chromium: interfaz de demo, exclusión de armas sin nota, traslado por la acción STORE de DIM simulado sin usar EQUIP, bloqueo al faltar datos de protección, y captura DOM con rechazo de IDs ambiguos. No se validó una instalación real en Firefox ni un traslado real de Bungie.

Referencias de implementación:

- https://github.com/DestinyItemManager/DIM (código consultado: d7c02e5cf9ba19e750bc626f497a7a069be23b08)
- https://github.com/Maxeption/dim-aegis-overlay (estructura de integración light.gg consultada: 50a7b276aaca6980dcd88d66d72520292b920f4c)
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts
- https://github.com/DestinyItemManager/DIM/wiki/FAQ

El código de esta base se escribió para este proyecto. No se empaquetan los repositorios consultados ni dependencias de pruebas dentro de la extensión.
