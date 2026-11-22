export interface AuditParameterRow {
  param: string;
  value: string;
  status: 'Observado' | 'Documentado' | 'Bloqueado' | 'Propuesto';
}

export interface FunctionalMapRow {
  dimension: string;
  finding: string;
  status: 'Observado' | 'Documentado' | 'Propuesto' | 'Bloqueado';
}

export interface CoverageMatrixRow {
  id: string;
  type: 'Navegación' | 'Pantalla' | 'Pestaña' | 'Estado' | 'Acción' | 'Recorrido';
  parent: string;
  entry: string;
  referenceState: 'Observado' | 'Documentado' | 'Inferido' | 'Propuesto' | 'Pendiente' | 'Bloqueado';
  ownProductState: 'Implementado y Verificado' | 'Implementado' | 'Parcial' | 'Propuesto' | 'Bloqueado';
  testId: string;
  testResult: 'Aprobada' | 'No ejecutada' | 'Bloqueada';
  evidence: string;
  pending: string;
}

export interface ScreenDictionaryRow {
  nodeId: string;
  screen: string;
  referenceControl: string;
  ownControl: string;
  fieldType: string;
  unitOrCurrency: string;
  validationAndEffect: string;
  evidenceRef: string;
}

export const AUDIT_PARAMETERS: AuditParameterRow[] = [
  {
    param: 'Referencia 1 (Fleetio)',
    value: 'Fleetio Web App — Fleetio (cuenta privada bloqueada por autenticación) + documentación oficial Help Center.',
    status: 'Bloqueado',
  },
  {
    param: 'Referencia 2 (Hermes Panamá)',
    value: 'Hermes Panamá · referencia de flujo operativo del prototipo.',
    status: 'Observado',
  },
  {
    param: 'Producto propio',
    value: 'Vektor Flota · Edición Grupo Trans Plus (TMF Panamá) — React 19 + TypeScript + Tailwind v4 + Recharts + localStorage + Importador CSV/Google Sheets.',
    status: 'Observado',
  },
  {
    param: 'Alcance integrado',
    value: '14 módulos operativos: Panel de Mando, Vehículos/Maquinaria (Horómetro+Odómetro+HSE), Despacho/Turnos y Tiempo Caído, Inspecciones DVIR, Incidencias, Recordatorios PM/HSE, Órdenes de Trabajo (con Progreso y statusLog), Control de Llantas, Combustible, Bodega/Repuestos, Compras/OC y CxP, Directorio, Reportes TCO y Configuración/RBAC.',
    status: 'Observado',
  },
  {
    param: 'Acceso a datos reales',
    value: 'Importación local CSV o pegado de filas de demostración en Configuración.',
    status: 'Observado',
  },
];

export const FUNCTIONAL_MAP: FunctionalMapRow[] = [
  {
    dimension: '¿Qué inicia el trabajo?',
    finding:
      'Partes de turno y acarreo (m³/viajes), inspecciones pre-uso DVIR con fallas, eventos de tiempo caído, vencimiento de PM por horómetro (250h/500h/1000h/2000h) o sticker HSE, alertas de llantas por profundidad (mm) y requisiciones por punto de reorden en bodega.',
    status: 'Observado',
  },
  {
    dimension: '¿Qué controla el resultado?',
    finding:
      'Matriz de 7 roles operativos de Grupo Trans Plus (TP-PER-001..028), regla de bloqueo al completar OT, validación de odómetro/horómetro progresivo, disponibilidad mecánica (horas caídas vs programadas), flujo de aprobación de compras (Requisición → Aprobada → Recibida → Facturada → Pagada) y habilitación HSE.',
    status: 'Observado',
  },
  {
    dimension: '¿Quién interviene y con qué alcance?',
    finding:
      'Gerencia (TP-PER-001/016/021: aprueba OC y pagos CxP), Coordinador (TP-PER-012: planea PM), Supervisor HSE/Turno (TP-PER-009/019: aprueba partes de turno y renueva stickers HSE), Jefe de Taller (TP-PER-011/015: gestiona OT, llantas y tiempo caído), Mecánico (TP-PER-014: reporta avance), Almacén (TP-PER-017: recibe OC y ajusta kardex) y Operador (TP-PER-027/028: pre-uso DVIR, combustible y parte de turno).',
    status: 'Observado',
  },
  {
    dimension: '¿Qué cambia y dónde termina?',
    finding:
      'Recibir una OC en Almacén suma stock automáticamente al Kardex de Repuestos y la mueve a CxP; completar una OT descuenta repuestos, cierra eventos de Tiempo Caído, resuelve incidencias, recalcula el próximo PM en horas/km y actualiza la Disponibilidad Mecánica y el TCO en USD.',
    status: 'Observado',
  },
  {
    dimension: '¿Qué pasa fuera del caso normal?',
    finding:
      'Falla crítica DVIR bloquea equipo a Fuera de servicio y abre evento de Tiempo Caído; stock insuficiente impide completar OT hasta recibir OC o ajustar bodega; lectura regresiva rechazada; datos reales importables vía CSV/TSV desde Google Sheets sin exponer credenciales.',
    status: 'Observado',
  },
];

export const COVERAGE_MATRIX: CoverageMatrixRow[] = [
  {
    id: 'NAV-01',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Centro de Mando · TMF Panamá (Dashboard + Disponibilidad Mecánica)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-06',
    testResult: 'Aprobada',
    evidence: 'hermes-panama.vercel.app/panama/inicio + DashboardView.tsx (widgets configurables y disponibilidad mecánica)',
    pending: 'Conectar feed en vivo de Google Sheets / Supabase si el usuario proporciona CSV o endpoint público',
  },
  {
    id: 'NAV-02',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Vehículos y Maquinaria Pesada (Horómetro + Odómetro + Sticker HSE)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-01',
    testResult: 'Aprobada',
    evidence: 'equipment-store de Hermes Panamá + VehiclesView.tsx + VehicleDetailView.tsx',
    pending: 'Cargar listado completo FLOTA desde Google Sheets en Configuración → Importar Datos',
  },
  {
    id: 'NAV-03',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Despacho, Turnos, Tiempo Caído y Habilitación HSE (/panama/turnos, /panama/tiempo-caido, /sticker-inspection)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-07',
    testResult: 'Aprobada',
    evidence: 'panama-dispatch de Hermes Panamá + OperationsView.tsx (partes de turno, m³, downtime y renovación de sticker)',
    pending: 'Sincronizar boletas fotográficas si se conecta almacenamiento en nube',
  },
  {
    id: 'NAV-04',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Inspecciones DVIR (Pre-Uso Diario y Habilitación HSE)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-01',
    testResult: 'Aprobada',
    evidence: 'InspectionsView.tsx con creación automática de incidencias y actualización de horómetro/odómetro',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'NAV-05',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Incidencias / Averías y Conversión directa a OT',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-02',
    testResult: 'Aprobada',
    evidence: 'IssuesView.tsx con categoría de avería y botón Crear OT',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'NAV-06',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Recordatorios PM (250h/500h/1000h/2000h) y Renovaciones HSE/ATTT',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-02',
    testResult: 'Aprobada',
    evidence: 'RemindersView.tsx calculando vencimiento por horómetro, odómetro y fecha',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'NAV-07',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Órdenes de Trabajo con Progreso (0-100%) y Bitácora statusLog',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-02',
    testResult: 'Aprobada',
    evidence: 'workorder-store de Hermes Panamá + WorkOrdersView.tsx con cierre atómico de stock/downtime/incidencias',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'NAV-08',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Control de Llantas / Neumáticos (/neumaticos · TP-PER-015)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-08',
    testResult: 'Aprobada',
    evidence: 'TiresView.tsx (profundidad mm, presión PSI, alertas de desgaste, inspección y rotación)',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'NAV-09',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Compras, Órdenes de Compra, Recepciones y Cuentas por Pagar (/pedidos, /panama/recepciones, /panama/cuentas-por-pagar)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-08',
    testResult: 'Aprobada',
    evidence: 'purchasing-home de Hermes Panamá + PurchasingView.tsx (recepción suma stock en Kardex automáticamente)',
    pending: 'Conectar conciliación bancaria real si se integra backend',
  },
  {
    id: 'NAV-10',
    type: 'Navegación',
    parent: 'ROOT',
    entry: 'Combustible (Diésel ULSD gal/L · USD), Bodega/Repuestos, Directorio y Reportes TCO',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-03',
    testResult: 'Aprobada',
    evidence: 'FuelView.tsx, PartsView.tsx, DirectoryView.tsx y ReportsView.tsx en USD y galones/litros',
    pending: 'Ninguno en producto propio',
  },
  {
    id: 'ACT-RBAC',
    type: 'Acción',
    parent: 'NAV-11',
    entry: 'Roles operativos Grupo Trans Plus (Gerencia, Coordinador, Supervisor, Jefe de Taller, Mecánico, Almacén, Operador, Solo Lectura)',
    referenceState: 'Observado',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-04',
    testResult: 'Aprobada',
    evidence: 'purchasing-home TP-PER-001..028 + FleetContext.tsx + SettingsView.tsx',
    pending: 'Validar asignación nominal de usuarios si se conecta Supabase Auth',
  },
  {
    id: 'ACT-IMP',
    type: 'Acción',
    parent: 'NAV-11',
    entry: 'Importador CSV / Pegado Google Sheets (FLOTA) para carga de datos reales',
    referenceState: 'Propuesto',
    ownProductState: 'Implementado y Verificado',
    testId: 'T-05',
    testResult: 'Aprobada',
    evidence: 'SettingsView.tsx (importación directa de filas FLOTA de Google Sheets)',
    pending: 'Probar con archivo real exportado por el usuario',
  },
  {
    id: 'ST-AUTH-FL',
    type: 'Estado',
    parent: 'ROOT',
    entry: 'Sesión autenticada de Fleetio y API privada /hermes-api de Hermes Panamá',
    referenceState: 'Bloqueado',
    ownProductState: 'Propuesto',
    testId: 'N/A',
    testResult: 'Bloqueada',
    evidence: 'Ambos endpoints requieren sesión privada autenticada',
    pending: 'Usar el Importador CSV/Google Sheets en Configuración o compartir exportación sin credenciales',
  },
];

export const SCREEN_DICTIONARY: ScreenDictionaryRow[] = [
  {
    nodeId: 'SCR-01',
    screen: 'Centro de Mando · TMF Panamá',
    referenceControl: 'Hermes /panama/inicio + Fleetio Dashboard Widgets',
    ownControl: 'KPI Disponibilidad Mecánica + Filtro de Frente + Personalizar Widgets',
    fieldType: 'Selectores, KPIs clicables y gráficos Recharts',
    unitOrCurrency: 'USD · hrs · km · %',
    validationAndEffect: 'Recalcula disponibilidad mecánica, incidencias, PM vencidos y costos en USD por frente.',
    evidenceRef: 'src/views/DashboardView.tsx',
  },
  {
    nodeId: 'SCR-02',
    screen: 'Despacho, Turnos y Tiempo Caído',
    referenceControl: 'Hermes /panama/turnos + /panama/tiempo-caido + /sticker-inspection',
    ownControl: 'Partes de Turno (Aprobar/Revisar) + Eventos de Tiempo Caído + Renovar Sticker HSE',
    fieldType: 'Horómetro inicio/fin, viajes, m³, horas caídas, vigencia HSE',
    unitOrCurrency: 'hrs · m³ · días',
    validationAndEffect: 'Registrar turno actualiza el horómetro del equipo; renovar sticker actualiza la vigencia HSE de la unidad.',
    evidenceRef: 'src/views/OperationsView.tsx',
  },
  {
    nodeId: 'SCR-03',
    screen: 'Órdenes de Trabajo',
    referenceControl: 'Hermes /workorders/:otId (progreso, statusLog) + Fleetio Line Items/Lock',
    ownControl: 'Editor OT (Progreso 0-100%, Mano de Obra, Repuestos, Bitácora statusLog, Completar OT)',
    fieldType: 'Slider de progreso, líneas dinámicas, ITBMS 7%',
    unitOrCurrency: 'USD · hrs · uds',
    validationAndEffect: 'Cada cambio queda en statusLog; al Completar descuenta bodega, cierra Tiempo Caído activo, resuelve incidencias y recalcula PM.',
    evidenceRef: 'src/views/WorkOrdersView.tsx',
  },
  {
    nodeId: 'SCR-04',
    screen: 'Control de Llantas',
    referenceControl: 'Hermes /neumaticos (TP-PER-015)',
    ownControl: 'Registro de Llantas + Inspeccionar mm/PSI + Cambiar Estado/Posición',
    fieldType: 'Serie, medida OTR/camión, profundidad mm, presión PSI',
    unitOrCurrency: 'mm · PSI · USD',
    validationAndEffect: 'Alerta desgaste crítico cuando profundidad ≤ mínimo y permite generar incidencia de llanta con un clic.',
    evidenceRef: 'src/views/TiresView.tsx',
  },
  {
    nodeId: 'SCR-05',
    screen: 'Compras, OC y Cuentas por Pagar',
    referenceControl: 'Hermes /pedidos + /panama/recepciones + /panama/cuentas-por-pagar',
    ownControl: 'Flujo 4 etapas: Requisición → Aprobar OC → Recibir en Almacén → Facturar y Pagar',
    fieldType: 'Ítems de repuesto, ITBMS 7%, No. factura, referencia ACH',
    unitOrCurrency: 'USD · uds',
    validationAndEffect: 'Al confirmar Recepción en Almacén, suma automáticamente las cantidades al catálogo de Repuestos y escribe el movimiento en Kardex.',
    evidenceRef: 'src/views/PurchasingView.tsx',
  },
];
