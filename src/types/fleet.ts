export type UserRole =
  | 'gerencia'
  | 'coordinador'
  | 'supervisor'
  | 'jefe_taller'
  | 'mecanico'
  | 'almacen'
  | 'operador'
  | 'readonly';

export type FleetGroup =
  | 'TMF Panamá · Movimiento de Tierras'
  | 'Acarreo y Volquetes'
  | 'Taller y Soporte Técnico'
  | 'Supervisión HSE y Campo';

export type VehicleStatus =
  | 'Activo'
  | 'En taller'
  | 'Fuera de servicio'
  | 'Inactivo'
  | 'Vendido';

export type VehicleType =
  | 'Excavadora'
  | 'Volquete 6x4'
  | 'Cargador Frontal'
  | 'Motoniveladora'
  | 'Tractocamión / Cabezal'
  | 'Cisterna de Diésel'
  | 'Pickup 4x4';

export type FuelType =
  | 'Diésel ULSD'
  | 'Gasolina 95'
  | 'Gasolina 91'
  | 'Eléctrico';

export type MeterSource =
  | 'Manual'
  | 'Inspección DVIR'
  | 'Combustible'
  | 'Orden de Trabajo'
  | 'Parte de Turno';

export type PmLevel = 'PM1 · 250h' | 'PM2 · 500h' | 'PM3 · 1000h' | 'PM4 · 2000h';

export type HseStickerStatus = 'Vigente' | 'Por vencer' | 'Vencido' | 'Pendiente';

export interface Vehicle {
  id: string;
  code: string;
  name: string;
  vin: string;
  licensePlate: string;
  year: number;
  make: string;
  model: string;
  type: VehicleType;
  status: VehicleStatus;
  group: FleetGroup;
  fuelType: FuelType;
  odometerKm: number;
  horometerHrs: number;
  meterMode: 'horometro' | 'odometro' | 'dual';
  nextPmLevel: PmLevel;
  nextPmHours: number;
  hseStickerCode: string;
  hseStickerExpiry: string;
  assignedOperatorId?: string;
  purchaseCost: number;
  purchaseDate: string;
  clientProject: string;
  notes?: string;
}

export interface MeterReading {
  id: string;
  vehicleId: string;
  date: string;
  valueKm: number;
  valueHrs?: number;
  source: MeterSource;
  referenceId?: string;
  recordedBy: string;
  voided?: boolean;
  note?: string;
}

export interface InspectionFormItem {
  id: string;
  label: string;
  category: string;
  required: boolean;
  criticalOnFail: boolean;
}

export interface InspectionForm {
  id: string;
  name: string;
  description: string;
  frequency: 'Diaria' | 'Semanal' | 'Mensual' | 'Pre-Viaje';
  active: boolean;
  items: InspectionFormItem[];
}

export type InspectionItemResult = 'Pasa' | 'Falla' | 'N/A';

export interface InspectionResponseItem {
  itemId: string;
  label: string;
  result: InspectionItemResult;
  note?: string;
  createdIssueId?: string;
}

export interface InspectionSubmission {
  id: string;
  code: string;
  formId: string;
  formName: string;
  vehicleId: string;
  operatorId: string;
  submittedAt: string;
  odometerKm: number;
  horometerHrs?: number;
  passedCount: number;
  failedCount: number;
  naCount: number;
  status: 'Aprobada' | 'Con fallas';
  items: InspectionResponseItem[];
  notes?: string;
}

export type IssuePriority = 'Crítica' | 'Alta' | 'Media' | 'Baja';
export type IssueStatus = 'Abierta' | 'En atención' | 'Resuelta' | 'Cerrada';
export type IssueSource = 'Inspección DVIR' | 'Manual' | 'Parte de Turno' | 'Telemática';

export type FailureCategory =
  | 'Hidráulico'
  | 'Motor y Tren Motriz'
  | 'Frenos y Neumático'
  | 'Eléctrico'
  | 'Tren de Rodaje'
  | 'Llantas'
  | 'PM Preventivo'
  | 'Cabina y HSE';

export interface Issue {
  id: string;
  code: string;
  vehicleId: string;
  title: string;
  description: string;
  category?: FailureCategory;
  priority: IssuePriority;
  status: IssueStatus;
  source: IssueSource;
  sourceRefId?: string;
  reportedBy: string;
  assignedToId?: string;
  reportedAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  workOrderId?: string;
}

export type ReminderComputedStatus = 'Vencido' | 'Próximo' | 'Al día' | 'Pospuesto';

export interface ServiceReminder {
  id: string;
  vehicleId: string;
  serviceTask: string;
  pmLevel?: PmLevel;
  intervalKm: number;
  intervalHrs?: number;
  intervalMonths: number;
  soonThresholdKm: number;
  soonThresholdHrs?: number;
  soonThresholdDays: number;
  lastCompletedDate: string;
  lastCompletedKm: number;
  lastCompletedHrs?: number;
  nextDueDate: string;
  nextDueKm: number;
  nextDueHrs?: number;
  snoozedUntil?: string;
  linkedWorkOrderId?: string;
}

export interface RenewalReminder {
  id: string;
  entityType: 'Vehículo' | 'Contacto';
  entityId: string;
  renewalType:
    | 'Sticker HSE de Obra'
    | 'Seguro Vehicular / Responsabilidad Civil'
    | 'Revisado Vehicular ATTT'
    | 'Licencia de Conducir / Certificado Operador';
  dueDate: string;
  soonThresholdDays: number;
  lastRenewedDate?: string;
  costEstimate: number;
  notes?: string;
}

export type WorkOrderStatusKey =
  | 'Abierta'
  | 'En progreso'
  | 'Esperando repuestos'
  | 'Completada'
  | 'Cancelada';

export interface WorkOrderStatusConfig {
  key: WorkOrderStatusKey;
  description: string;
  marksCompleted: boolean;
  isDefault: boolean;
}

export interface LaborLineItem {
  id: string;
  taskName: string;
  technicianId: string;
  hours: number;
  hourlyRate: number;
}

export interface PartLineItem {
  id: string;
  partId: string;
  quantity: number;
  unitCost: number;
}

export interface WorkOrderLogEntry {
  id: string;
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  role: string;
}

export interface WorkOrder {
  id: string;
  code: string;
  vehicleId: string;
  status: WorkOrderStatusKey;
  priority: IssuePriority;
  failureCategory: FailureCategory;
  progress: number;
  vendorId?: string;
  summary: string;
  description: string;
  createdAt: string;
  scheduledDate: string;
  completedAt?: string;
  odometerKm: number;
  horometerHrs?: number;
  linkedIssueIds: string[];
  linkedReminderIds: string[];
  laborItems: LaborLineItem[];
  partItems: PartLineItem[];
  discountAmount: number;
  taxPercent: number;
  inventoryDeducted?: boolean;
  statusLog: WorkOrderLogEntry[];
}

export interface FuelEntry {
  id: string;
  vehicleId: string;
  operatorId?: string;
  vendorId?: string;
  date: string;
  odometerKm: number;
  horometerHrs?: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  partialFill: boolean;
  kmPerLiter?: number;
  costPerKm?: number;
  galPerHour?: number;
  notes?: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  category: string;
  manufacturer: string;
  location: string;
  quantityOnHand: number;
  reorderPoint: number;
  unitCost: number;
  vendorId?: string;
}

export interface StockMovement {
  id: string;
  partId: string;
  date: string;
  delta: number;
  resultingQty: number;
  reason: string;
  referenceCode?: string;
  performedBy: string;
}

export type VendorType =
  | 'Taller Mecánico'
  | 'Proveedor de Repuestos'
  | 'Distribuidor Diésel / Combustible'
  | 'Proveedor de Llantas'
  | 'Aseguradora / HSE';

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  rating: number;
}

export type ContactRole = 'Operador' | 'Mecánico' | 'Supervisor' | 'Jefe de Taller' | 'Almacén' | 'Gerencia';

export interface Contact {
  id: string;
  name: string;
  positionCode: string;
  role: ContactRole;
  email: string;
  phone: string;
  group: FleetGroup;
  licenseNumber?: string;
  licenseExpiry?: string;
  hourlyRate?: number;
  active: boolean;
}

// Hermes Panama: Shift Dispatch, Haulage & Downtime
export type ShiftStatus = 'En curso' | 'Por revisar' | 'Aceptado' | 'Observado';

export interface ShiftDispatch {
  id: string;
  code: string;
  date: string;
  shift: 'Turno Día (06:00–18:00)' | 'Turno Noche (18:00–06:00)';
  vehicleId: string;
  operatorId: string;
  frontName: string;
  material: string;
  tripsCount: number;
  volumeM3: number;
  startHorometer: number;
  endHorometer: number;
  status: ShiftStatus;
  supervisorNote?: string;
}

export interface DowntimeEvent {
  id: string;
  code: string;
  vehicleId: string;
  workOrderId?: string;
  category: FailureCategory;
  reason: string;
  startedAt: string;
  endedAt?: string;
  hoursDown: number;
  status: 'Activo' | 'Cerrado';
  impactNote?: string;
}

// Hermes Panama: Tire Control (/neumaticos)
export type TireStatus = 'Montada' | 'En almacén' | 'Reencauche' | 'Desecho';

export interface TireRecord {
  id: string;
  serial: string;
  brand: string;
  size: string;
  vehicleId?: string;
  axlePosition: string;
  treadDepthMm: number;
  minTreadMm: number;
  pressurePsi: number;
  targetPsi: number;
  hoursUsed: number;
  unitCost: number;
  status: TireStatus;
  lastInspectedAt: string;
}

// Hermes Panama: Purchasing, PO, Warehouse Receiving & Accounts Payable
export type PurchaseOrderStatus =
  | 'Requisición'
  | 'Cotizada'
  | 'Aprobada'
  | 'Recibida en Almacén'
  | 'Facturada / Por Pagar'
  | 'Pagada'
  | 'Rechazada';

export interface PurchaseOrderItem {
  id: string;
  partId?: string;
  description: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  vendorId: string;
  requestedBy: string;
  workOrderId?: string;
  createdAt: string;
  neededBy: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  taxPercent: number;
  invoiceNumber?: string;
  invoiceDueDate?: string;
  paidAt?: string;
  paymentRef?: string;
  receivedAt?: string;
  notes?: string;
}

export interface DashboardWidgetConfig {
  id:
    | 'kpi_strip'
    | 'cost_chart'
    | 'fleet_status'
    | 'priority_issues'
    | 'overdue_reminders'
    | 'active_work_orders'
    | 'low_stock_parts'
    | 'recent_meters';
  label: string;
  visible: boolean;
}

export interface DashboardViewProfile {
  id: string;
  name: string;
  isStandard: boolean;
  widgets: DashboardWidgetConfig[];
}

export interface AppSettings {
  organizationName: string;
  projectCode: string;
  currency: 'USD' | 'MXN';
  distanceUnit: 'km' | 'mi';
  volumeUnit: 'gal' | 'L';
  activeRole: UserRole;
  activePositionCode: string;
  activeUserName: string;
  workOrderStatuses: WorkOrderStatusConfig[];
  dashboardProfiles: DashboardViewProfile[];
  activeDashboardProfileId: string;
}

export type NavigationSection =
  | 'dashboard'
  | 'vehicles'
  | 'vehicle-detail'
  | 'operations'
  | 'inspections'
  | 'issues'
  | 'reminders'
  | 'work-orders'
  | 'tires'
  | 'fuel'
  | 'parts'
  | 'purchasing'
  | 'directory'
  | 'reports'
  | 'settings'
  | 'audit';

export interface RouteState {
  section: NavigationSection;
  selectedVehicleId?: string;
  selectedVehicleTab?:
    | 'resumen'
    | 'servicio'
    | 'incidencias'
    | 'inspecciones'
    | 'recordatorios'
    | 'combustible'
    | 'odometro';
  selectedWorkOrderId?: string;
  initialFilter?: string;
}

export interface FleetState {
  vehicles: Vehicle[];
  meterReadings: MeterReading[];
  inspectionForms: InspectionForm[];
  inspections: InspectionSubmission[];
  issues: Issue[];
  serviceReminders: ServiceReminder[];
  renewalReminders: RenewalReminder[];
  workOrders: WorkOrder[];
  fuelEntries: FuelEntry[];
  parts: Part[];
  stockMovements: StockMovement[];
  vendors: Vendor[];
  contacts: Contact[];
  shiftDispatches: ShiftDispatch[];
  downtimeEvents: DowntimeEvent[];
  tires: TireRecord[];
  purchaseOrders: PurchaseOrder[];
  settings: AppSettings;
}

export interface ToastNotice {
  id: string;
  title: string;
  detail?: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

export interface AutomatedTestResult {
  id: string;
  name: string;
  module: string;
  status: 'Aprobada' | 'Fallida';
  durationMs: number;
  assertionSummary: string;
  executedAt: string;
}
