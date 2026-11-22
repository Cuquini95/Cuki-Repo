# Prompt maestro V2 para auditar y reconstruir aplicaciones completas

## Instrucción para ejecutar

@Craft Anything

Estudia la aplicación hasta poder explicar, reproducir y probar el resultado que recibe cada usuario. Descubre el alcance de forma autónoma a partir del producto indicado. El método de investigación es reutilizable. El mapa funcional, los roles, los datos y las pruebas se derivan de nuevo para cada producto. Las referencias aportadas identifican el objetivo inicial y pueden incluir ejemplos. **Un ejemplo, una captura, un menú y un inventario anterior son puntos de entrada, nunca el límite del alcance.** Si se pide toda la aplicación, comienza por todas las áreas visibles con el acceso disponible y sigue sus dependencias. Continúa con el trabajo autorizado mientras una rama esté bloqueada. Pide al usuario únicamente el acceso, el entorno o la decisión específica que impide avanzar.

Cuando se pida construir o corregir, usa la auditoría para llevar cada recorrido al producto y probarlo allí. Para una interfaz propietaria ajena, conserva los comportamientos pertinentes con identidad visual propia. Comprueba fidelidad visual solo cuando exista autorización para reproducir ese diseño. Aplica este método a web, móvil, escritorio, CLI, API y juegos usando los puntos de entrada equivalentes.

### Parámetros del encargo

Resuélvelos primero con los archivos, el contexto y las herramientas de la sesión. Declara en el expediente qué datos siguen sin determinar.

| Parámetro | Qué identificar |
|---|---|
| Referencia | Producto, versión o fecha, URL o archivo, plan, configuración, idioma y cuenta o entorno |
| Producto propio | URL, repositorio, versión y datos que deban conservarse |
| Resultado | Auditoría y especificación, reconstrucción, corrección o despliegue |
| Alcance | Toda la aplicación visible o una selección explícita, con interfaces compartidas y dependencias |
| Acceso | Roles, perfiles, permisos efectivos, dispositivos, integraciones y entornos accesibles |
| Pruebas | Datos sintéticos o registros descartables autorizados, alcance de escrituras y efectos permitidos |
| Entrega | Expediente, matrices y evidencia. Código, app y despliegue cuando correspondan |

Si el resultado es ambiguo, avanza con el levantamiento y la especificación. Si el usuario pide una app completa, la especificación es un paso de trabajo y la entrega incluye la implementación y las pruebas. Si no se especifica alcance al estudiar una aplicación, toma todo lo visible para los accesos disponibles. Las funciones por rol, plan, configuración o dispositivo que se descubran durante el levantamiento se incorporan al inventario o quedan expresamente bloqueadas.

### 1. Prepara la ejecución y conserva el estado

1. Comprueba que responde el motor real de Craft Anything. Registra versión, comandos disponibles, proyecto y modo. Abre o reanuda un proyecto `.cany` con el objetivo, alcance, plan y criterio de cierre. Si el motor carece de una capacidad, documenta el error y utiliza una herramienta autorizada para la parte que sí puedas ejecutar. Atribuye cada evidencia a la herramienta que la produjo.
2. Trabaja por observación externa como regla inicial. Usa inspección interna para archivos propios o cuando esté autorizada. En una cuenta operativa, usa lectura y navegación que no alteren registros. Para escritura, envíos, aprobaciones, pagos, conexiones, eliminación y efectos persistentes, ejecuta únicamente en el entorno y con la autorización que correspondan.
3. Registra datos de contexto por sesión: dispositivo, ventana, idioma, rol efectivo si se comprobó, versión, plan, permisos y tipos de datos disponibles. Los valores por defecto y las variantes pueden depender de ese contexto.
4. Mantén un registro de trabajo recuperable. Al detener una rama anota el último paso comprobado, el control exacto que falta abrir, el dato o rol necesario, el bloqueo real y las ramas que siguen accesibles. Guarda los entregables y el estado recuperable; cuando retomes, usa el registro en vez de reiniciar el recorrido.

### 2. Descubre el alcance por varias entradas

Primero redacta un mapa funcional específico del producto. A partir de la interfaz, los materiales autorizados y la ayuda vigente, identifica qué trabajo hace cada actor, qué entra al sistema, qué reglas transforman esos datos, quién revisa el resultado y quién o qué lo recibe. Usa los nombres y unidades de ese producto. Si hay una auditoría previa, conserva su método. Reutiliza sus hallazgos únicamente cuando pertenezcan al mismo producto y sigan vigentes en el entorno actual.

Construye el mapa con estas preguntas. Si una dimensión parece ausente, registra cómo comprobaste su aplicabilidad.

| Pregunta | Qué buscar |
|---|---|
| ¿Qué inicia el trabajo? | Acciones humanas, importaciones, integraciones, eventos, fechas, recurrencias y procesos por lote |
| ¿Qué controla el resultado? | Reglas configurables, cálculos, parámetros, vigencias, calendarios, jerarquías y datos de referencia |
| ¿Quién interviene y con qué alcance? | Actores humanos y del sistema, permisos por acción y ámbito, traspasos, delegaciones y aprobaciones cuando existan |
| ¿Qué cambia y dónde termina? | Estados, registros, artefactos, comunicaciones, reportes, integraciones y receptores posteriores |
| ¿Qué pasa fuera del caso normal? | Datos históricos, correcciones, reversión, reapertura, reintento, resultados parciales y fallos que el producto permita comprobar |

Después levanta tres inventarios independientes. Cruza sus resultados y agrega las diferencias a la cola de exploración antes de considerar cerrado un módulo.

| Inventario | Qué rastrear |
|---|---|
| Navegación de la interfaz | Menú global, submenús, pestañas, paneles laterales, inicio, mapa y tarjetas, búsqueda, enlaces rápidos, notificaciones, ayuda, configuración por cuenta y perfil, rutas directas visibles y enlaces de regreso |
| Objetos y ciclos de vida | Para cada entidad identificada, localiza lista, alta, detalle, edición, ficha relacionada, historial, ajustes, archivo y recuperación, exportación, acciones por fila y por lote, adjuntos y registros que la referencian. Identifica estados y transiciones con permisos distintos |
| Variantes de acceso y evidencia complementaria | Revisa roles disponibles, plan, dispositivos, preferencias e integraciones. Contrasta con documentación oficial vigente, ayuda contextual y material adjunto. En producto propio, cuando esté autorizado, cruza además rutas del código, vistas habilitadas y permisos. Agrega las diferencias como pendientes con su origen |

En cada área, revisa las perspectivas de los actores que el producto realmente admite: quién configura, inicia, ejecuta, supervisa, autoriza o consume la salida. Incluye actores automáticos si existen. Registra las perspectivas aplicables aunque un mismo rol cubra varias. Una función encontrada en documentación se registra como documentada hasta abrirla. Una función de otro plan, versión o plataforma se mantiene identificada con su aplicabilidad por confirmar.

### 3. Recorre todas las ramas de cada punto de entrada

Trabaja con una cola de nodos. Un nodo es cualquier destino o estado con información, controles, validaciones, permisos o salidas propios. Incluye páginas, pestañas, pasos de asistente, paneles, menús, modales, variantes condicionales y resultados. Una URL compartida puede contener varios nodos. Dos accesos equivalentes pueden converger en un nodo cuando se haya comprobado que ofrecen los mismos datos, acciones y condiciones.

1. Asigna IDs estables a entidad, nodo, enlace, control, recorrido y evidencia. Registra quién descubrió cada nodo, su padre, vía de acceso, estado inicial, contexto, y todos los hijos observados o documentados.
2. En **cada lista**, abre por lo menos un detalle representativo cuando exista. Busca acciones por fila, ajustes de columnas y vista, búsqueda, filtros, agrupación, paginación, selección simple y múltiple, exportación/importación y accesos desde indicadores. Cuando filas de distintos estados cambien las acciones, toma un caso por variante funcional accesible.
3. En **cada detalle**, abre todas las pestañas accesibles, secciones plegables, menús contextuales, contenidos relacionados, historial y adjuntos. Sigue los vínculos hacia otros módulos hasta su destino. Registra el camino de vuelta. Inspecciona el menú que solo aparece por rol, selección, estado o dato cuando esa variante esté disponible.
4. En **cada edición o alta**, recorre los pasos y alterna todas las opciones que cambien controles, validaciones o salidas. Revisa botones alternativos para guardar, continuar, crear otro, descartar, duplicar y deshacer cuando existan. Abre menús y diálogos antes de decidir si se puede ejecutar su efecto. Captura vacíos, errores, estados restringidos y estados con datos que puedas reproducir legítimamente.
5. Para **cada efecto**, sigue el dato a su destino. Un resultado puede aparecer en otro módulo, historial, reporte, existencia, documento, notificación o contador. Registra el enlace o identificador correlativo, unidad, valor previo y nuevo cuando se puedan comparar. Comprueba reapertura o recarga para acreditar persistencia.
6. Repite por variantes relevantes de **rol, estado, tipo de entidad, plan, configuración, idioma y dispositivo**. Agrupa variantes solo cuando la equivalencia esté sustentada. Prueba todas las combinaciones que cambien permisos, cálculos, datos visibles, efectos externos o movimientos de inventario. Para cambios puramente de presentación, usa casos representativos y explica por qué cubren la rama.
7. Aplica la misma lógica a otros medios. En CLI descubre subcomandos, opciones, entradas, códigos de salida, archivos y efectos. En API recorre operaciones autorizadas desde documentación, validaciones, roles, paginación, respuestas y persistencia. En móvil o escritorio incluye navegación del sistema, permisos, teclado, archivos y offline cuando afecten el flujo. En juegos usa controles, modos, reglas, transiciones, progreso y guardado con recursos autorizados.
8. Antes de salir de un módulo, reconcilia los hijos descubiertos con las acciones y pantallas que realmente abriste. Haz una segunda pasada entrando por otra vía, por ejemplo desde la entidad relacionada, un menú contextual, un estado distinto, documentación, reportes o configuración. Agrega los hijos nuevos y continúa hasta que la reconciliación no deje entradas explicables sin registrar.

**Exploración transversal.** Parte de una salida real y rastrea hacia atrás los datos, reglas, pasos y actores que la producen. Repite desde un cambio de entrada hacia todos los destinos que podrían verse afectados y confirma cuáles cambian. Incluye operaciones sin pantalla propia si pueden observarse por su inicio, estado, resultado o historial.

### 4. Construye el contrato verificable de cada nodo

Por cada nodo guarda un registro con acceso, padres e hijos, rol, datos de ejemplo sintéticos, estado de referencia, estado en el producto propio, evidencia y próxima comprobación. Conserva los nombres visibles exactos donde sean necesarios para encontrar controles. Para una reconstrucción con diseño propio, registra además la equivalencia entre el control de referencia y su destino en el producto nuevo.

| Elemento | Datos mínimos |
|---|---|
| Vista | Título, propósito, jerarquía, secciones, modos, columnas, orden, filtros, selección, acciones, estado inicial, navegación de entrada y salida, variantes de dispositivo |
| Campo | Etiqueta, tipo, unidad, moneda, fuente de opciones, valor inicial, visibilidad, obligatoriedad, rango, formato, dependencias, ayuda, edición, validaciones y mensajes comprobados, destino tras guardar |
| Acción | Control, requisitos, permiso, entradas, confirmación, carga, resultado, undo si existe, cancelación, fallo, reintento, salida y acciones siguientes |
| Flujo | Actor, estado inicial, pasos verificables, entrada, validación, transformación, salida, estado final, persistencia y efectos relacionados |
| Evidencia | ID, fuente, fecha, dispositivo, rol, versión/plan, datos sintéticos, ruta o localizador, pasos y resultado. Usa IDs de Craft Anything solo si se generaron realmente |

Usa los estados **Observado**, **Documentado**, **Inferido**, **Propuesto**, **Pendiente** y **Bloqueado** para hallazgos según corresponda. Para una prueba, registra **Aprobada**, **Fallida**, **No ejecutada** o **Bloqueada**. Para cada caso indica qué se verificó: rótulo visible, contenido abierto, acción ejecutada, salida observada, persistencia o efecto en otro módulo. Una vista visible respalda solo lo capturado de esa vista. Un botón visible respalda su presencia. Un selector con nombre no respalda el origen de sus opciones.

### 5. Prueba ciclos completos con roles, estados y fallos

- Por cada flujo que cambie datos, prepara una fixture reconocible y el resultado esperado. Ejecuta en la interfaz normal de uso, verifica el historial o destino y vuelve a abrir el registro. Comprueba efectos relacionados antes y después. Prueba la misma operación con un perfil insuficiente cuando haya autorización y exista esa regla de acceso.
- Prueba entradas mínimas y máximas que importen, valores inválidos, campos obligatorios, duplicados, cancelación, error, reintento, carga parcial y acciones repetidas. En flujos con varios actores, cruza un traspaso real entre perfiles de prueba. En flujos con cambios relevantes, prueba concurrencia cuando el entorno lo permita.
- Adapta las pruebas a la salida del producto. Para cálculos, reconstruye el valor esperado con las entradas, reglas y vigencias observadas. Para movimientos o transiciones, comprueba cambios, conservación de cantidades o unicidad, según aplique. Para documentos, verifica contenido, versión y vínculo al origen. Para comunicaciones o integraciones, comprueba destino, momento, resultado y duplicados dentro del entorno autorizado.
- Captura el antes y el después de las bifurcaciones relevantes. Conserva evidencia reproducible con datos mínimos. Omite credenciales, información sensible y datos de otras personas que no sean necesarios para el encargo.
- Para lo bloqueado, indica el test exacto, el entorno o rol faltante y la evidencia que permitiría cerrarlo. Una prueba parcial o con datos simulados debe indicar qué parte se ejecutó y dónde. No traslades su resultado a producción o al producto de referencia.

### 6. Si se pidió construir, implementa cada comportamiento contratado

1. Cruza cada nodo y recorrido de referencia con el existente en el producto propio. Clasifica si ya funciona, si le falta una parte, si falta por completo, si tiene una diferencia aprobada o si queda pendiente. Incluye rutas, acciones de fila y lote, formularios, estados, datos, permisos, efectos y transiciones. Las adaptaciones se documentan con motivo e impacto.
2. Construye por flujos utilizables con entrada y salida comprobable desde la navegación normal. Un menú sin sus destinos, una ficha genérica, un botón inactivo, un campo que se pierde al recargar o una acción sin efecto reciben estado parcial. Una pantalla implementada puede seguir pendiente de prueba.
3. Conserva compatibilidad con los registros existentes y comprueba lectura, edición y persistencia. Deja explícitas unidades, monedas, estados y roles. Prueba integraciones con el ambiente autorizado y registra el estado real de conexión.
4. Valida con navegador o cliente real los dispositivos requeridos. Verifica navegación, paneles, filtros, textos y foco donde importen, además de entradas, resultados, errores y cambios de estado. Una prueba automatizada de lógica complementa el recorrido en la interfaz. Si existe despliegue autorizado, repite una comprobación de los flujos esenciales en la URL publicada.
5. Si algún comportamiento de referencia es inaccesible, avanza con las demás ramas. Registra cualquier implementación provisional como propuesta e identifica su supuesto. Para efectos materiales o decisiones irreversibles pide solo la decisión que falte. No declares paridad de una rama a partir de una aproximación.

### 7. Reconciliación y criterio de cierre

Antes de entregar, ejecuta esta comprobación y conserva su resultado:

1. **Grafo.** Cada nodo identificado tiene origen o raíz explícita. Cada enlace descubierto tiene destino asociado o motivo de bloqueo. Cada detalle, pestaña, menú contextual, asistente y estado condicional aparece como nodo o como entrada agrupada con equivalencia comprobada. Cada acción significativa tiene prueba o pendiente identificable.
2. **Triangulación.** Compara navegación, objetos/ciclos de vida y fuentes complementarias. Lista los casos que solo aparecieron en cada inventario y resuelve su clasificación. Si la segunda pasada descubre pantallas nuevas, explóralas, incorpora sus hijos y vuelve a reconciliar.
3. **Flujos críticos.** Revisa integridad de origen, pasos, resultado, destino y persistencia. Revisa permisos y efectos entre módulos cuando apliquen. Contrasta el conjunto de casos con el mapa funcional del producto, incluyendo sus trabajos programados y procesos sin punto de entrada en el menú cuando existan. Si una prueba queda bloqueada, se identifica qué afirmación no puede hacerse sobre el resultado.
4. **Cobertura.** Publica denominadores por separado para entradas de navegación, pantallas, pestañas, estados, acciones, recorridos y pruebas. Muestra para cada uno lo descubierto, abierto, probado, aprobado, bloqueado y pendiente según aplique. En implementación, añade lo implementado y lo verificado en el producto. Los elementos documentados pendientes entran en el inventario. Si falta conocer el universo de un rol, plan, módulo o dispositivo, indica alcance sin inventariar y evita un porcentaje global.
5. **Cierre.** Un área está inventariada cuando sus ramas conocidas están abiertas o su bloqueo concreto está registrado. Está verificada cuando sus pruebas exigibles se ejecutaron y las salidas quedaron comprobadas. Una app está completa dentro del alcance acordado cuando las funciones requeridas son utilizables desde sus rutas normales, los flujos y variantes relevantes pasan pruebas y se entregó el resultado solicitado. Si hay ramas sin inventariar o recorridos críticos bloqueados, informa el trabajo completado y el cierre que sigue pendiente.

Haz una revisión final desde la perspectiva de un usuario que ve el producto por primera vez. Rastrea qué puede hacer desde el menú, desde una ficha existente y desde el resultado de un flujo. Usa los hallazgos para corregir la matriz, los casos o el producto antes de entregar.

### 8. Entrega

- **Inventario navegable** de entidades, nodos, rutas, padres, hijos, roles, variantes y estados del levantamiento.
- **Diccionario de pantalla y controles** con campos, valores iniciales, dependencias, validaciones, condiciones de habilitación y localizador de evidencia.
- **Matriz de recorridos y pruebas** con pasos replicables, fixture, expected/resultado, prueba ejecutada, destino, persistencia, permisos y efectos.
- **Matriz de cobertura separada por nivel** con las columnas mínimas `ID | tipo | padre | entrada | estado de referencia | estado en producto propio | prueba | resultado | evidencia | pendiente`.
- **Bitácora y continuación** con versión, accesos, fuentes, diferencias, pendientes, desbloqueo exacto y rutas inspeccionadas. Incluye el proyecto recuperable cuando corresponda.
- **Si se pidió app**, entrega versión, código o URL correspondiente y resultados de verificación por flujo. Indica qué se guardó y qué se publicó una vez confirmado.

En la respuesta final identifica primero el resultado usable. Resume qué se verificó en vivo, qué se acreditó documentalmente y qué falta comprobar. Limita el estado de completitud al alcance que los expedientes permiten demostrar.

**Fin del prompt**
