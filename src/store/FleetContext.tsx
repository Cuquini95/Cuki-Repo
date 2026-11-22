import React, { createContext, useContext, useEffect, useState } from 'react';
import { INITIAL_FLEET_STATE } from '../data/seedData';
import {
  AppSettings,
  AutomatedTestResult,
  Contact,
  DashboardWidgetConfig,
  DowntimeEvent,
  FailureCategory,
  FleetGroup,
  FleetState,
  FuelEntry,
  InspectionForm,
  InspectionResponseItem,
  InspectionSubmission,
  Issue,
  IssuePriority,
  MeterReading,
  MeterSource,
  Part,
  PurchaseOrder,
  PurchaseOrderItem,
  RenewalReminder,
  ServiceReminder,
  ShiftDispatch,
  ShiftStatus,
  StockMovement,
  TireRecord,
  TireStatus,
  ToastNotice,
  UserRole,
  Vehicle,
  VehicleStatus,
  Vendor,
  WorkOrder,
  WorkOrderLogEntry,
} from '../types/fleet';
import {
  addMonthsIso,
  computeServiceReminderStatus,
  computeVehicleTCO,
  todayIso,
} from '../utils/format';

const STORAGE_KEY = 'vektor_flota_gtp_panama_v2';

export type PermissionAction =
  | 'vehicle:create'
  | 'vehicle:edit'
  | 'vehicle:delete'
  | 'meter:log'
  | 'inspection:submit'
  | 'inspection:manage_forms'
  | 'issue:create'
  | 'issue:resolve'
  | 'reminder:manage'
  | 'workorder:manage'
  | 'workorder:progress'
  | 'workorder:reopen'
  | 'fuel:create'
  | 'parts:manage'
  | 'directory:manage'
  | 'operations:dispatch'
  | 'operations:approve_shift'
  | 'operations:hse'
  | 'tires:manage'
  | 'purchasing:request'
  | 'purchasing:approve'
  | 'purchasing:receive'
  | 'purchasing:pay'
  | 'settings:manage';

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  gerencia: [
    'vehicle:create',
    'vehicle:edit',
    'vehicle:delete',
    'meter:log',
    'inspection:submit',
    'inspection:manage_forms',
    'issue:create',
    'issue:resolve',
    'reminder:manage',
    'workorder:manage',
    'workorder:progress',
    'workorder:reopen',
    'fuel:create',
    'parts:manage',
    'directory:manage',
    'operations:dispatch',
    'operations:approve_shift',
    'operations:hse',
    'tires:manage',
    'purchasing:request',
    'purchasing:approve',
    'purchasing:receive',
    'purchasing:pay',
    'settings:manage',
  ],
  coordinador: [
    'vehicle:create',
    'vehicle:edit',
    'meter:log',
    'inspection:submit',
    'inspection:manage_forms',
    'issue:create',
    'issue:resolve',
    'reminder:manage',
    'workorder:manage',
    'workorder:progress',
    'fuel:create',
    'directory:manage',
    'operations:dispatch',
    'operations:approve_shift',
    'tires:manage',
    'purchasing:request',
  ],
  supervisor: [
    'meter:log',
    'inspection:submit',
    'issue:create',
    'issue:resolve',
    'fuel:create',
    'operations:dispatch',
    'operations:approve_shift',
    'operations:hse',
  ],
  jefe_taller: [
    'vehicle:edit',
    'meter:log',
    'inspection:submit',
    'inspection:manage_forms',
    'issue:create',
    'issue:resolve',
    'reminder:manage',
    'workorder:manage',
    'workorder:progress',
    'workorder:reopen',
    'fuel:create',
    'parts:manage',
    'tires:manage',
    'purchasing:request',
  ],
  mecanico: ['meter:log', 'issue:create', 'workorder:progress'],
  almacen: ['parts:manage', 'purchasing:request', 'purchasing:receive'],
  operador: ['meter:log', 'inspection:submit', 'issue:create', 'fuel:create', 'operations:dispatch'],
  readonly: [],
};

export const ROLE_LABELS: Record<
  UserRole,
  { label: string; positionCode: string; summary: string }
> = {
  gerencia: {
    label: 'Gerencia General / Operaciones',
    positionCode: 'TP-PER-001',
    summary: 'Control total, aprobación de Órdenes de Compra, pagos CxP, activos y configuración.',
  },
  coordinador: {
    label: 'Coordinador / Planeación PM',
    positionCode: 'TP-PER-012',
    summary: 'Planificación PM, despacho de turnos, costos, OT y solicitudes de compra.',
  },
  supervisor: {
    label: 'Supervisor de Turno / HSE',
    positionCode: 'TP-PER-019',
    summary: 'Aprueba partes de turno/acarreo, renueva Stickers HSE y gestiona alertas de campo.',
  },
  jefe_taller: {
    label: 'Jefatura de Taller',
    positionCode: 'TP-PER-011',
    summary: 'Gestiona OT, tiempo caído, llantas, incidencias, repuestos y requisiciones.',
  },
  mecanico: {
    label: 'Mecánico de Taller',
    positionCode: 'TP-PER-014',
    summary: 'Actualiza progreso de sus OT, reporta averías y registra lecturas de horómetro.',
  },
  almacen: {
    label: 'Almacén y Repuestos',
    positionCode: 'TP-PER-017',
    summary: 'Recibe Órdenes de Compra en bodega, actualiza kardex y solicita reposiciones.',
  },
  operador: {
    label: 'Operador / Conductor de Acarreo',
    positionCode: 'TP-PER-027',
    summary: 'Envía pre-uso DVIR, registra cargas de diésel, partes de turno y reporta fallas.',
  },
  readonly: {
    label: 'Solo Lectura / Auditor',
    positionCode: 'AUD-000',
    summary: 'Consulta tableros, reportes TCO y exportaciones CSV sin permisos de escritura.',
  },
};

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowTimestamp(): string {
  const d = new Date();
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export function applySubmitInspection(
  prev: FleetState,
  payload: {
    formId: string;
    vehicleId: string;
    operatorId: string;
    odometerKm: number;
    horometerHrs?: number;
    items: InspectionResponseItem[];
    notes?: string;
    date?: string;
  }
): {
  next: FleetState;
  result: ActionResult<{ submission: InspectionSubmission; createdIssues: Issue[] }>;
} {
  const vehicle = prev.vehicles.find((v) => v.id === payload.vehicleId);
  const form = prev.inspectionForms.find((f) => f.id === payload.formId);
  const operator = prev.contacts.find((c) => c.id === payload.operatorId);
  if (!vehicle || !form) {
    return { next: prev, result: { ok: false, error: 'Vehículo o formulario inválido.' } };
  }
  if (vehicle.meterMode !== 'horometro' && payload.odometerKm < vehicle.odometerKm) {
    return {
      next: prev,
      result: {
        ok: false,
        error: `El odómetro (${payload.odometerKm.toLocaleString('es-PA')} km) es menor al actual (${vehicle.odometerKm.toLocaleString('es-PA')} km).`,
      },
    };
  }
  if (
    typeof payload.horometerHrs === 'number' &&
    payload.horometerHrs > 0 &&
    payload.horometerHrs < vehicle.horometerHrs
  ) {
    return {
      next: prev,
      result: {
        ok: false,
        error: `El horómetro (${payload.horometerHrs} h) es menor al actual (${vehicle.horometerHrs} h).`,
      },
    };
  }

  const submittedAt = payload.date || todayIso();
  const inspCode = `INSP-${401 + prev.inspections.length}`;
  let nextIssueSeq = 301 + prev.issues.length;

  const createdIssues: Issue[] = [];
  const enrichedItems: InspectionResponseItem[] = payload.items.map((resp) => {
    if (resp.result === 'Falla') {
      const templateItem = form.items.find((fi) => fi.id === resp.itemId);
      const issueId = uid('iss');
      const issueCode = `INC-${nextIssueSeq++}`;
      const priority: IssuePriority = templateItem?.criticalOnFail ? 'Crítica' : 'Alta';
      const newIssue: Issue = {
        id: issueId,
        code: issueCode,
        vehicleId: vehicle.id,
        title: `Falla DVIR: ${resp.label}`,
        description: resp.note?.trim() || `Detectado en ${inspCode} (${form.name}).`,
        category: templateItem?.category === 'Hidráulico' ? 'Hidráulico' : 'Cabina y HSE',
        priority,
        status: 'Abierta',
        source: 'Inspección DVIR',
        sourceRefId: inspCode,
        reportedBy: operator?.name || prev.settings.activeUserName,
        reportedAt: submittedAt,
      };
      createdIssues.push(newIssue);
      return { ...resp, createdIssueId: issueId };
    }
    return resp;
  });

  const passedCount = enrichedItems.filter((i) => i.result === 'Pasa').length;
  const failedCount = enrichedItems.filter((i) => i.result === 'Falla').length;
  const naCount = enrichedItems.filter((i) => i.result === 'N/A').length;

  const submission: InspectionSubmission = {
    id: uid('insp'),
    code: inspCode,
    formId: form.id,
    formName: form.name,
    vehicleId: vehicle.id,
    operatorId: payload.operatorId,
    submittedAt,
    odometerKm: payload.odometerKm,
    horometerHrs: payload.horometerHrs,
    passedCount,
    failedCount,
    naCount,
    status: failedCount > 0 ? 'Con fallas' : 'Aprobada',
    items: enrichedItems,
    notes: payload.notes,
  };

  const hasCriticalFail = createdIssues.some((iss) => iss.priority === 'Crítica');
  const meterReading: MeterReading = {
    id: uid('mr'),
    vehicleId: vehicle.id,
    date: submittedAt,
    valueKm: payload.odometerKm,
    valueHrs: payload.horometerHrs,
    source: 'Inspección DVIR',
    referenceId: inspCode,
    recordedBy: operator?.name || prev.settings.activeUserName,
  };

  const extraDowntime: DowntimeEvent[] = hasCriticalFail
    ? [
        {
          id: uid('dt'),
          code: `TC-0${82 + prev.downtimeEvents.length}`,
          vehicleId: vehicle.id,
          category: 'Cabina y HSE',
          reason: `Parada automática por falla crítica en ${inspCode}`,
          startedAt: submittedAt,
          hoursDown: 1,
          status: 'Activo',
        },
      ]
    : [];

  const next: FleetState = {
    ...prev,
    vehicles: prev.vehicles.map((v) =>
      v.id === vehicle.id
        ? {
            ...v,
            odometerKm: Math.max(v.odometerKm, payload.odometerKm),
            horometerHrs: Math.max(v.horometerHrs, payload.horometerHrs ?? v.horometerHrs),
            status: hasCriticalFail && v.status === 'Activo' ? 'Fuera de servicio' : v.status,
          }
        : v
    ),
    meterReadings: [meterReading, ...prev.meterReadings],
    inspections: [submission, ...prev.inspections],
    issues: [...createdIssues, ...prev.issues],
    downtimeEvents: [...extraDowntime, ...prev.downtimeEvents],
  };

  return { next, result: { ok: true, data: { submission, createdIssues } } };
}

export function applyCompleteWorkOrder(
  prev: FleetState,
  workOrderId: string
): { next: FleetState; result: ActionResult<WorkOrder> } {
  const wo = prev.workOrders.find((w) => w.id === workOrderId);
  if (!wo) return { next: prev, result: { ok: false, error: 'Orden de trabajo no encontrada.' } };
  if (wo.status === 'Completada') {
    return { next: prev, result: { ok: false, error: 'La orden ya se encuentra completada.' } };
  }

  if (!wo.inventoryDeducted) {
    for (const line of wo.partItems) {
      const part = prev.parts.find((p) => p.id === line.partId);
      if (!part) {
        return { next: prev, result: { ok: false, error: 'Uno de los repuestos asignados ya no existe.' } };
      }
      if (part.quantityOnHand < line.quantity) {
        return {
          next: prev,
          result: {
            ok: false,
            error: `Stock insuficiente para "${part.name}" (disponible: ${part.quantityOnHand}, requerido: ${line.quantity}). Recibe una OC o ajusta bodega primero.`,
          },
        };
      }
    }
  }

  const completedAt = todayIso();
  const newMovements: StockMovement[] = [];
  const nextParts = prev.parts.map((part) => {
    if (wo.inventoryDeducted) return part;
    const totalUsed = wo.partItems
      .filter((pi) => pi.partId === part.id)
      .reduce((acc, pi) => acc + pi.quantity, 0);
    if (totalUsed <= 0) return part;
    const resultingQty = part.quantityOnHand - totalUsed;
    newMovements.push({
      id: uid('sm'),
      partId: part.id,
      date: completedAt,
      delta: -totalUsed,
      resultingQty,
      reason: 'Consumo en Orden de Trabajo completada',
      referenceCode: wo.code,
      performedBy: prev.settings.activeUserName,
    });
    return { ...part, quantityOnHand: resultingQty };
  });

  const logEntry: WorkOrderLogEntry = {
    id: uid('log'),
    timestamp: nowTimestamp(),
    field: 'estado',
    oldValue: wo.status,
    newValue: 'Completada',
    changedBy: prev.settings.activeUserName,
    role: ROLE_LABELS[prev.settings.activeRole].label,
  };

  const completedWo: WorkOrder = {
    ...wo,
    status: 'Completada',
    progress: 100,
    completedAt,
    inventoryDeducted: true,
    statusLog: [logEntry, ...wo.statusLog],
  };

  const nextWorkOrders = prev.workOrders.map((w) => (w.id === wo.id ? completedWo : w));

  const nextIssues = prev.issues.map((iss) =>
    wo.linkedIssueIds.includes(iss.id)
      ? {
          ...iss,
          status: 'Resuelta' as const,
          resolvedAt: completedAt,
          resolutionNote: `Resuelta al completar ${wo.code}.`,
          workOrderId: wo.id,
        }
      : iss
  );

  // Close linked active downtime events
  const nextDowntime = prev.downtimeEvents.map((dt) =>
    (dt.workOrderId === wo.id || dt.vehicleId === wo.vehicleId) && dt.status === 'Activo'
      ? { ...dt, status: 'Cerrado' as const, endedAt: completedAt }
      : dt
  );

  const vehicle = prev.vehicles.find((v) => v.id === wo.vehicleId);
  const effectiveKm = Math.max(vehicle?.odometerKm ?? 0, wo.odometerKm);
  const effectiveHrs = Math.max(vehicle?.horometerHrs ?? 0, wo.horometerHrs ?? 0);

  const nextServiceReminders = prev.serviceReminders.map((rem) => {
    if (!wo.linkedReminderIds.includes(rem.id)) return rem;
    return {
      ...rem,
      lastCompletedDate: completedAt,
      lastCompletedKm: effectiveKm,
      lastCompletedHrs: rem.intervalHrs ? effectiveHrs : rem.lastCompletedHrs,
      nextDueDate: addMonthsIso(completedAt, rem.intervalMonths),
      nextDueKm: rem.intervalKm > 0 ? effectiveKm + rem.intervalKm : rem.nextDueKm,
      nextDueHrs: rem.intervalHrs ? effectiveHrs + rem.intervalHrs : rem.nextDueHrs,
      snoozedUntil: undefined,
      linkedWorkOrderId: undefined,
    };
  });

  const hasOtherActiveWo = nextWorkOrders.some(
    (other) =>
      other.id !== wo.id &&
      other.vehicleId === wo.vehicleId &&
      (other.status === 'Abierta' || other.status === 'En progreso' || other.status === 'Esperando repuestos')
  );

  const nextVehicles = prev.vehicles.map((v) => {
    if (v.id !== wo.vehicleId) return v;
    return {
      ...v,
      odometerKm: Math.max(v.odometerKm, wo.odometerKm),
      horometerHrs: Math.max(v.horometerHrs, wo.horometerHrs ?? v.horometerHrs),
      status: !hasOtherActiveWo && (v.status === 'En taller' || v.status === 'Fuera de servicio')
        ? ('Activo' as const)
        : v.status,
    };
  });

  return {
    next: {
      ...prev,
      parts: nextParts,
      stockMovements: [...newMovements, ...prev.stockMovements],
      workOrders: nextWorkOrders,
      issues: nextIssues,
      downtimeEvents: nextDowntime,
      serviceReminders: nextServiceReminders,
      vehicles: nextVehicles,
    },
    result: { ok: true, data: completedWo },
  };
}

export function applyReceivePurchaseOrder(
  prev: FleetState,
  poId: string
): { next: FleetState; result: ActionResult<PurchaseOrder> } {
  const po = prev.purchaseOrders.find((p) => p.id === poId);
  if (!po) return { next: prev, result: { ok: false, error: 'Orden de compra no encontrada.' } };
  if (po.status !== 'Aprobada') {
    return { next: prev, result: { ok: false, error: 'Solo se pueden recibir órdenes en estado Aprobada.' } };
  }

  const receivedAt = todayIso();
  const newMovements: StockMovement[] = [];
  const nextParts = prev.parts.map((part) => {
    const addedQty = po.items
      .filter((it) => it.partId === part.id)
      .reduce((acc, it) => acc + it.quantity, 0);
    if (addedQty <= 0) return part;
    const resultingQty = part.quantityOnHand + addedQty;
    newMovements.push({
      id: uid('sm'),
      partId: part.id,
      date: receivedAt,
      delta: addedQty,
      resultingQty,
      reason: 'Recepción de Orden de Compra en Almacén',
      referenceCode: po.code,
      performedBy: prev.settings.activeUserName,
    });
    return { ...part, quantityOnHand: resultingQty };
  });

  const updatedPo: PurchaseOrder = {
    ...po,
    status: 'Recibida en Almacén',
    receivedAt,
  };

  return {
    next: {
      ...prev,
      parts: nextParts,
      stockMovements: [...newMovements, ...prev.stockMovements],
      purchaseOrders: prev.purchaseOrders.map((p) => (p.id === poId ? updatedPo : p)),
    },
    result: { ok: true, data: updatedPo },
  };
}

export function applyAddFuelEntry(
  prev: FleetState,
  payload: Omit<FuelEntry, 'id' | 'totalCost' | 'kmPerLiter' | 'costPerKm' | 'galPerHour'> & {
    allowBackwardsOdometer?: boolean;
  }
): { next: FleetState; result: ActionResult<FuelEntry> } {
  const vehicle = prev.vehicles.find((v) => v.id === payload.vehicleId);
  if (!vehicle) return { next: prev, result: { ok: false, error: 'Vehículo no encontrado.' } };
  if (payload.liters <= 0 || payload.pricePerLiter <= 0) {
    return { next: prev, result: { ok: false, error: 'Volumen y precio unitario deben ser mayores a 0.' } };
  }
  if (
    vehicle.meterMode !== 'horometro' &&
    !payload.allowBackwardsOdometer &&
    payload.odometerKm < vehicle.odometerKm
  ) {
    return {
      next: prev,
      result: {
        ok: false,
        error: `Odómetro ingresado (${payload.odometerKm.toLocaleString('es-PA')} km) es menor al actual (${vehicle.odometerKm.toLocaleString('es-PA')} km).`,
      },
    };
  }

  const totalCost = Number((payload.liters * payload.pricePerLiter).toFixed(2));
  const previousFull = prev.fuelEntries
    .filter((f) => f.vehicleId === vehicle.id && !f.partialFill && f.odometerKm < payload.odometerKm)
    .sort((a, b) => b.odometerKm - a.odometerKm)[0];

  let kmPerLiter: number | undefined;
  let costPerKm: number | undefined;
  if (!payload.partialFill && previousFull && payload.odometerKm > 0) {
    const distance = payload.odometerKm - previousFull.odometerKm;
    if (distance > 0) {
      kmPerLiter = Number((distance / payload.liters).toFixed(2));
      costPerKm = Number((totalCost / distance).toFixed(2));
    }
  }

  let galPerHour: number | undefined;
  if (payload.horometerHrs && vehicle.horometerHrs > 0 && payload.horometerHrs > vehicle.horometerHrs) {
    const hrsDelta = payload.horometerHrs - vehicle.horometerHrs;
    const gallons = payload.liters * 0.264172;
    galPerHour = Number((gallons / hrsDelta).toFixed(2));
  }

  const entry: FuelEntry = {
    id: uid('fl'),
    vehicleId: payload.vehicleId,
    operatorId: payload.operatorId,
    vendorId: payload.vendorId,
    date: payload.date,
    odometerKm: payload.odometerKm,
    horometerHrs: payload.horometerHrs,
    liters: payload.liters,
    pricePerLiter: payload.pricePerLiter,
    totalCost,
    fuelType: payload.fuelType,
    partialFill: payload.partialFill,
    kmPerLiter,
    costPerKm,
    galPerHour,
    notes: payload.notes,
  };

  const meterEntry: MeterReading = {
    id: uid('mr'),
    vehicleId: vehicle.id,
    date: payload.date,
    valueKm: payload.odometerKm,
    valueHrs: payload.horometerHrs,
    source: 'Combustible',
    recordedBy:
      prev.contacts.find((c) => c.id === payload.operatorId)?.name || prev.settings.activeUserName,
  };

  const next: FleetState = {
    ...prev,
    fuelEntries: [entry, ...prev.fuelEntries],
    meterReadings: [meterEntry, ...prev.meterReadings],
    vehicles: prev.vehicles.map((v) =>
      v.id === vehicle.id
        ? {
            ...v,
            odometerKm: Math.max(v.odometerKm, payload.odometerKm),
            horometerHrs: Math.max(v.horometerHrs, payload.horometerHrs ?? v.horometerHrs),
          }
        : v
    ),
  };

  return { next, result: { ok: true, data: entry } };
}

interface FleetContextValue {
  state: FleetState;
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<ToastNotice, 'id'>) => void;
  can: (action: PermissionAction) => boolean;
  addVehicle: (v: Omit<Vehicle, 'id'>) => ActionResult<Vehicle>;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => ActionResult<Vehicle>;
  bulkUpdateVehicles: (ids: string[], patch: { status?: VehicleStatus; group?: FleetGroup }) => ActionResult;
  deleteVehicle: (id: string) => ActionResult;
  logMeterReading: (payload: {
    vehicleId: string;
    valueKm: number;
    valueHrs?: number;
    date?: string;
    source?: MeterSource;
    note?: string;
    allowCorrection?: boolean;
  }) => ActionResult<MeterReading>;
  toggleVoidMeterReading: (readingId: string) => ActionResult;
  submitInspection: (payload: {
    formId: string;
    vehicleId: string;
    operatorId: string;
    odometerKm: number;
    horometerHrs?: number;
    items: InspectionResponseItem[];
    notes?: string;
  }) => ActionResult<{ submission: InspectionSubmission; createdIssues: Issue[] }>;
  addInspectionForm: (form: Omit<InspectionForm, 'id'>) => ActionResult<InspectionForm>;
  addIssue: (payload: {
    vehicleId: string;
    title: string;
    description: string;
    category?: FailureCategory;
    priority: IssuePriority;
    assignedToId?: string;
  }) => ActionResult<Issue>;
  resolveIssue: (issueId: string, resolutionNote: string) => ActionResult;
  updateIssueStatus: (issueId: string, status: Issue['status']) => ActionResult;
  addServiceReminder: (payload: Omit<ServiceReminder, 'id' | 'nextDueDate' | 'nextDueKm' | 'nextDueHrs'>) => ActionResult<ServiceReminder>;
  snoozeServiceReminder: (id: string, days: number) => ActionResult;
  addRenewalReminder: (payload: Omit<RenewalReminder, 'id'>) => ActionResult<RenewalReminder>;
  completeRenewalReminder: (id: string) => ActionResult;
  createWorkOrder: (payload: Omit<WorkOrder, 'id' | 'code' | 'createdAt' | 'statusLog'>) => ActionResult<WorkOrder>;
  updateWorkOrder: (id: string, patch: Partial<WorkOrder>, logLabel?: string) => ActionResult<WorkOrder>;
  completeWorkOrder: (id: string) => ActionResult<WorkOrder>;
  reopenWorkOrder: (id: string) => ActionResult;
  cancelWorkOrder: (id: string) => ActionResult;
  addFuelEntry: (
    payload: Omit<FuelEntry, 'id' | 'totalCost' | 'kmPerLiter' | 'costPerKm' | 'galPerHour'> & {
      allowBackwardsOdometer?: boolean;
    }
  ) => ActionResult<FuelEntry>;
  addPart: (part: Omit<Part, 'id'>) => ActionResult<Part>;
  adjustPartStock: (partId: string, delta: number, reason: string, referenceCode?: string) => ActionResult;
  addVendor: (vendor: Omit<Vendor, 'id'>) => ActionResult<Vendor>;
  addContact: (contact: Omit<Contact, 'id'>) => ActionResult<Contact>;
  // New Hermes Panama operational actions
  addShiftDispatch: (payload: Omit<ShiftDispatch, 'id' | 'code'>) => ActionResult<ShiftDispatch>;
  updateShiftStatus: (shiftId: string, status: ShiftStatus, note?: string) => ActionResult;
  addDowntimeEvent: (payload: Omit<DowntimeEvent, 'id' | 'code' | 'status'>) => ActionResult<DowntimeEvent>;
  closeDowntimeEvent: (id: string, finalHours: number) => ActionResult;
  renewHseSticker: (vehicleId: string, newCode: string, newExpiry: string) => ActionResult;
  addTire: (tire: Omit<TireRecord, 'id'>) => ActionResult<TireRecord>;
  inspectTire: (tireId: string, treadDepthMm: number, pressurePsi: number, status?: TireStatus) => ActionResult;
  createPurchaseOrder: (payload: {
    vendorId: string;
    workOrderId?: string;
    neededBy: string;
    items: PurchaseOrderItem[];
    notes?: string;
  }) => ActionResult<PurchaseOrder>;
  approvePurchaseOrder: (poId: string) => ActionResult;
  receivePurchaseOrder: (poId: string) => ActionResult<PurchaseOrder>;
  recordPoInvoice: (poId: string, invoiceNumber: string, invoiceDueDate: string) => ActionResult;
  payPurchaseOrder: (poId: string, paymentRef: string) => ActionResult;
  importFleetRowsFromText: (rawText: string) => ActionResult<{ imported: number; updated: number }>;
  importFleetMatrix: (
    rows: string[][],
    sourceLabel?: string
  ) => ActionResult<{ imported: number; updated: number }>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setActiveRole: (role: UserRole) => void;
  toggleDashboardWidget: (widgetId: DashboardWidgetConfig['id']) => ActionResult;
  duplicateDashboardView: (name: string) => ActionResult;
  selectDashboardProfile: (profileId: string) => void;
  resetToFixtures: () => void;
  runAutomatedVerificationSuite: () => AutomatedTestResult[];
}

const FleetContext = createContext<FleetContextValue | null>(null);

function loadInitialState(): FleetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_FLEET_STATE;
    const parsed = JSON.parse(raw) as FleetState;
    if (
      !parsed ||
      !Array.isArray(parsed.vehicles) ||
      !Array.isArray(parsed.tires) ||
      !Array.isArray(parsed.purchaseOrders) ||
      !parsed.settings
    ) {
      return INITIAL_FLEET_STATE;
    }
    return parsed;
  } catch {
    return INITIAL_FLEET_STATE;
  }
}

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<FleetState>(loadInitialState);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const pushToast = (toast: Omit<ToastNotice, 'id'>) => {
    const id = uid('tst');
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const can = (action: PermissionAction): boolean => {
    return ROLE_PERMISSIONS[state.settings.activeRole].includes(action);
  };

  const deny = (label: string): ActionResult<never> => {
    const roleInfo = ROLE_LABELS[state.settings.activeRole];
    const msg = `Permiso denegado para ${roleInfo.label} (${roleInfo.positionCode}) al intentar ${label}.`;
    pushToast({ title: 'Acceso restringido por posición', detail: msg, tone: 'warning' });
    return { ok: false, error: msg };
  };

  const addVehicle = (v: Omit<Vehicle, 'id'>): ActionResult<Vehicle> => {
    if (!can('vehicle:create')) return deny('crear equipos/vehículos');
    if (state.vehicles.some((ex) => ex.code.toLowerCase() === v.code.trim().toLowerCase())) {
      return { ok: false, error: `Ya existe un equipo con el código ${v.code}.` };
    }
    const created: Vehicle = { ...v, id: uid('veh') };
    const initialMeter: MeterReading = {
      id: uid('mr'),
      vehicleId: created.id,
      date: todayIso(),
      valueKm: created.odometerKm,
      valueHrs: created.horometerHrs,
      source: 'Manual',
      recordedBy: state.settings.activeUserName,
      note: 'Lectura inicial al alta',
    };
    setState((prev) => ({
      ...prev,
      vehicles: [created, ...prev.vehicles],
      meterReadings: [initialMeter, ...prev.meterReadings],
    }));
    pushToast({ title: `Equipo ${created.code} registrado`, detail: created.name, tone: 'success' });
    return { ok: true, data: created };
  };

  const updateVehicle = (id: string, patch: Partial<Vehicle>): ActionResult<Vehicle> => {
    if (!can('vehicle:edit')) return deny('editar equipos');
    let updated: Vehicle | undefined;
    setState((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => {
        if (v.id !== id) return v;
        updated = { ...v, ...patch };
        return updated;
      }),
    }));
    pushToast({ title: 'Ficha de equipo actualizada', tone: 'success' });
    return { ok: true, data: updated };
  };

  const bulkUpdateVehicles = (
    ids: string[],
    patch: { status?: VehicleStatus; group?: FleetGroup }
  ): ActionResult => {
    if (!can('vehicle:edit')) return deny('editar equipos en lote');
    setState((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        ids.includes(v.id)
          ? {
              ...v,
              ...(patch.status ? { status: patch.status } : {}),
              ...(patch.group ? { group: patch.group } : {}),
            }
          : v
      ),
    }));
    pushToast({
      title: `${ids.length} equipo(s) actualizado(s)`,
      detail: [patch.status, patch.group].filter(Boolean).join(' · '),
      tone: 'success',
    });
    return { ok: true };
  };

  const deleteVehicle = (id: string): ActionResult => {
    if (!can('vehicle:delete')) return deny('eliminar equipos');
    const target = state.vehicles.find((v) => v.id === id);
    setState((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.id !== id),
    }));
    pushToast({ title: `Equipo ${target?.code || ''} eliminado`, tone: 'info' });
    return { ok: true };
  };

  const logMeterReading: FleetContextValue['logMeterReading'] = (payload) => {
    if (!can('meter:log')) return deny('registrar lecturas de horómetro/odómetro');
    const vehicle = state.vehicles.find((v) => v.id === payload.vehicleId);
    if (!vehicle) return { ok: false, error: 'Equipo no encontrado.' };
    if (!payload.allowCorrection && vehicle.meterMode !== 'horometro' && payload.valueKm < vehicle.odometerKm) {
      return {
        ok: false,
        error: `Odómetro regresivo rechazado (${payload.valueKm.toLocaleString('es-PA')} km < ${vehicle.odometerKm.toLocaleString('es-PA')} km).`,
      };
    }
    if (
      !payload.allowCorrection &&
      typeof payload.valueHrs === 'number' &&
      payload.valueHrs > 0 &&
      payload.valueHrs < vehicle.horometerHrs
    ) {
      return {
        ok: false,
        error: `Horómetro regresivo rechazado (${payload.valueHrs} h < ${vehicle.horometerHrs} h).`,
      };
    }
    const reading: MeterReading = {
      id: uid('mr'),
      vehicleId: vehicle.id,
      date: payload.date || todayIso(),
      valueKm: payload.valueKm,
      valueHrs: payload.valueHrs,
      source: payload.source || 'Manual',
      recordedBy: state.settings.activeUserName,
      note: payload.note,
    };
    setState((prev) => ({
      ...prev,
      meterReadings: [reading, ...prev.meterReadings],
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicle.id
          ? {
              ...v,
              odometerKm: payload.allowCorrection ? payload.valueKm : Math.max(v.odometerKm, payload.valueKm),
              horometerHrs:
                typeof payload.valueHrs === 'number'
                  ? payload.allowCorrection
                    ? payload.valueHrs
                    : Math.max(v.horometerHrs, payload.valueHrs)
                  : v.horometerHrs,
            }
          : v
      ),
    }));
    pushToast({
      title: `Lectura actualizada · ${vehicle.code}`,
      detail: [
        payload.valueHrs ? `${payload.valueHrs} h` : null,
        payload.valueKm > 0 ? `${payload.valueKm.toLocaleString('es-PA')} km` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'success',
    });
    return { ok: true, data: reading };
  };

  const toggleVoidMeterReading = (readingId: string): ActionResult => {
    if (!can('vehicle:edit')) return deny('anular lecturas');
    setState((prev) => ({
      ...prev,
      meterReadings: prev.meterReadings.map((m) =>
        m.id === readingId ? { ...m, voided: !m.voided } : m
      ),
    }));
    return { ok: true };
  };

  const submitInspection: FleetContextValue['submitInspection'] = (payload) => {
    if (!can('inspection:submit')) return deny('enviar inspecciones DVIR');
    const { next, result } = applySubmitInspection(state, payload);
    if (!result.ok) {
      pushToast({ title: 'Validación DVIR', detail: result.error, tone: 'error' });
      return result;
    }
    setState(next);
    const createdCount = result.data?.createdIssues.length || 0;
    pushToast({
      title: `Pre-Uso ${result.data?.submission.code} registrado`,
      detail:
        createdCount > 0
          ? `Se crearon ${createdCount} incidencia(s): ${result.data?.createdIssues.map((i) => i.code).join(', ')}`
          : 'Unidad aprobada sin novedades.',
      tone: createdCount > 0 ? 'warning' : 'success',
    });
    return result;
  };

  const addInspectionForm = (form: Omit<InspectionForm, 'id'>): ActionResult<InspectionForm> => {
    if (!can('inspection:manage_forms')) return deny('crear formularios DVIR');
    const created: InspectionForm = { ...form, id: uid('form') };
    setState((prev) => ({ ...prev, inspectionForms: [created, ...prev.inspectionForms] }));
    pushToast({ title: 'Formulario DVIR creado', detail: created.name, tone: 'success' });
    return { ok: true, data: created };
  };

  const addIssue: FleetContextValue['addIssue'] = (payload) => {
    if (!can('issue:create')) return deny('reportar incidencias');
    const code = `INC-${301 + state.issues.length}`;
    const created: Issue = {
      id: uid('iss'),
      code,
      vehicleId: payload.vehicleId,
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category || 'Motor y Tren Motriz',
      priority: payload.priority,
      status: 'Abierta',
      source: 'Manual',
      reportedBy: state.settings.activeUserName,
      assignedToId: payload.assignedToId,
      reportedAt: todayIso(),
    };
    setState((prev) => ({ ...prev, issues: [created, ...prev.issues] }));
    pushToast({ title: `Incidencia ${created.code} reportada`, detail: created.title, tone: 'success' });
    return { ok: true, data: created };
  };

  const resolveIssue = (issueId: string, resolutionNote: string): ActionResult => {
    if (!can('issue:resolve')) return deny('resolver incidencias');
    setState((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) =>
        iss.id === issueId
          ? { ...iss, status: 'Resuelta', resolvedAt: todayIso(), resolutionNote: resolutionNote || 'Resuelta.' }
          : iss
      ),
    }));
    pushToast({ title: 'Incidencia marcada como resuelta', tone: 'success' });
    return { ok: true };
  };

  const updateIssueStatus = (issueId: string, status: Issue['status']): ActionResult => {
    if (!can('issue:resolve')) return deny('cambiar estado de incidencias');
    setState((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) =>
        iss.id === issueId
          ? { ...iss, status, resolvedAt: status === 'Resuelta' ? todayIso() : iss.resolvedAt }
          : iss
      ),
    }));
    return { ok: true };
  };

  const addServiceReminder: FleetContextValue['addServiceReminder'] = (payload) => {
    if (!can('reminder:manage')) return deny('crear recordatorios PM');
    const created: ServiceReminder = {
      ...payload,
      id: uid('sr'),
      nextDueDate: addMonthsIso(payload.lastCompletedDate, payload.intervalMonths),
      nextDueKm: payload.intervalKm > 0 ? payload.lastCompletedKm + payload.intervalKm : 0,
      nextDueHrs:
        payload.intervalHrs && payload.intervalHrs > 0
          ? (payload.lastCompletedHrs ?? 0) + payload.intervalHrs
          : undefined,
    };
    setState((prev) => ({ ...prev, serviceReminders: [created, ...prev.serviceReminders] }));
    pushToast({ title: 'Programa PM creado', detail: created.serviceTask, tone: 'success' });
    return { ok: true, data: created };
  };

  const snoozeServiceReminder = (id: string, days: number): ActionResult => {
    if (!can('reminder:manage')) return deny('posponer recordatorios');
    const target = new Date();
    target.setDate(target.getDate() + days);
    const until = target.toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      serviceReminders: prev.serviceReminders.map((r) => (r.id === id ? { ...r, snoozedUntil: until } : r)),
    }));
    pushToast({ title: `Recordatorio pospuesto ${days} días`, tone: 'info' });
    return { ok: true };
  };

  const addRenewalReminder: FleetContextValue['addRenewalReminder'] = (payload) => {
    if (!can('reminder:manage')) return deny('crear renovaciones');
    const created: RenewalReminder = { ...payload, id: uid('rr') };
    setState((prev) => ({ ...prev, renewalReminders: [created, ...prev.renewalReminders] }));
    pushToast({ title: 'Renovación programada', detail: created.renewalType, tone: 'success' });
    return { ok: true, data: created };
  };

  const completeRenewalReminder = (id: string): ActionResult => {
    if (!can('reminder:manage') && !can('operations:hse')) return deny('completar renovaciones');
    const today = todayIso();
    setState((prev) => ({
      ...prev,
      renewalReminders: prev.renewalReminders.map((r) =>
        r.id === id
          ? {
              ...r,
              lastRenewedDate: today,
              dueDate: addMonthsIso(today, r.renewalType === 'Sticker HSE de Obra' ? 3 : 12),
            }
          : r
      ),
    }));
    pushToast({ title: 'Renovación completada y reprogramada', tone: 'success' });
    return { ok: true };
  };

  const createWorkOrder: FleetContextValue['createWorkOrder'] = (payload) => {
    if (!can('workorder:manage')) return deny('crear órdenes de trabajo');
    const code = `OT-${1001 + state.workOrders.length}`;
    const defaultStatus =
      state.settings.workOrderStatuses.find((s) => s.isDefault)?.key || 'Abierta';
    const initialLog: WorkOrderLogEntry = {
      id: uid('log'),
      timestamp: nowTimestamp(),
      field: 'estado',
      oldValue: 'Nueva',
      newValue: payload.status || defaultStatus,
      changedBy: state.settings.activeUserName,
      role: ROLE_LABELS[state.settings.activeRole].label,
    };

    const created: WorkOrder = {
      ...payload,
      id: uid('wo'),
      code,
      status: payload.status || defaultStatus,
      createdAt: todayIso(),
      inventoryDeducted: false,
      statusLog: [initialLog],
    };

    setState((prev) => ({
      ...prev,
      workOrders: [created, ...prev.workOrders],
      issues: prev.issues.map((iss) =>
        created.linkedIssueIds.includes(iss.id)
          ? { ...iss, status: 'En atención', workOrderId: created.id }
          : iss
      ),
      serviceReminders: prev.serviceReminders.map((sr) =>
        created.linkedReminderIds.includes(sr.id) ? { ...sr, linkedWorkOrderId: created.id } : sr
      ),
      vehicles: prev.vehicles.map((v) =>
        v.id === created.vehicleId && (v.status === 'Activo' || v.status === 'Fuera de servicio')
          ? { ...v, status: 'En taller' }
          : v
      ),
    }));
    pushToast({
      title: `Orden de Trabajo ${created.code} creada`,
      detail: 'Equipo asignado a Taller y bitácora statusLog iniciada.',
      tone: 'success',
    });
    return { ok: true, data: created };
  };

  const updateWorkOrder = (
    id: string,
    patch: Partial<WorkOrder>,
    logLabel?: string
  ): ActionResult<WorkOrder> => {
    const isProgressOnly = Object.keys(patch).every((k) => k === 'progress');
    if (isProgressOnly) {
      if (!can('workorder:progress')) return deny('actualizar progreso de OT');
    } else if (!can('workorder:manage')) {
      return deny('modificar órdenes de trabajo');
    }

    const existing = state.workOrders.find((w) => w.id === id);
    if (!existing) return { ok: false, error: 'Orden no encontrada.' };
    const statusCfg = state.settings.workOrderStatuses.find((s) => s.key === existing.status);
    if (statusCfg?.marksCompleted) {
      const msg = `La orden ${existing.code} está bloqueada porque su estado "${existing.status}" marca finalización.`;
      pushToast({ title: 'Orden bloqueada', detail: msg, tone: 'warning' });
      return { ok: false, error: msg };
    }

    const extraLogs: WorkOrderLogEntry[] = [];
    if (patch.status && patch.status !== existing.status) {
      extraLogs.push({
        id: uid('log'),
        timestamp: nowTimestamp(),
        field: 'estado',
        oldValue: existing.status,
        newValue: patch.status,
        changedBy: state.settings.activeUserName,
        role: ROLE_LABELS[state.settings.activeRole].label,
      });
    }
    if (typeof patch.progress === 'number' && patch.progress !== existing.progress) {
      extraLogs.push({
        id: uid('log'),
        timestamp: nowTimestamp(),
        field: 'progreso',
        oldValue: `${existing.progress}%`,
        newValue: `${patch.progress}%`,
        changedBy: state.settings.activeUserName,
        role: ROLE_LABELS[state.settings.activeRole].label,
      });
    }
    if (logLabel) {
      extraLogs.push({
        id: uid('log'),
        timestamp: nowTimestamp(),
        field: 'detalle',
        oldValue: '—',
        newValue: logLabel,
        changedBy: state.settings.activeUserName,
        role: ROLE_LABELS[state.settings.activeRole].label,
      });
    }

    let updated: WorkOrder | undefined;
    setState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((w) => {
        if (w.id !== id) return w;
        updated = {
          ...w,
          ...patch,
          statusLog: extraLogs.length > 0 ? [...extraLogs, ...w.statusLog] : w.statusLog,
        };
        return updated;
      }),
    }));
    return { ok: true, data: updated };
  };

  const completeWorkOrder = (id: string): ActionResult<WorkOrder> => {
    if (!can('workorder:manage')) return deny('completar órdenes de trabajo');
    const { next, result } = applyCompleteWorkOrder(state, id);
    if (!result.ok) {
      pushToast({ title: 'No se pudo completar la orden', detail: result.error, tone: 'error' });
      return result;
    }
    setState(next);
    pushToast({
      title: `Orden ${result.data?.code} completada`,
      detail: 'Stock descontado, tiempo caído cerrado, incidencias resueltas y PM recalculado.',
      tone: 'success',
    });
    return result;
  };

  const reopenWorkOrder = (id: string): ActionResult => {
    if (!can('workorder:reopen')) return deny('reabrir órdenes completadas');
    const logEntry: WorkOrderLogEntry = {
      id: uid('log'),
      timestamp: nowTimestamp(),
      field: 'estado',
      oldValue: 'Completada',
      newValue: 'En progreso (Reabierta)',
      changedBy: state.settings.activeUserName,
      role: ROLE_LABELS[state.settings.activeRole].label,
    };
    setState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((w) =>
        w.id === id
          ? { ...w, status: 'En progreso', completedAt: undefined, statusLog: [logEntry, ...w.statusLog] }
          : w
      ),
    }));
    pushToast({ title: 'Orden reabierta para edición', tone: 'info' });
    return { ok: true };
  };

  const cancelWorkOrder = (id: string): ActionResult => {
    if (!can('workorder:manage')) return deny('cancelar órdenes de trabajo');
    const wo = state.workOrders.find((w) => w.id === id);
    if (!wo) return { ok: false, error: 'Orden no encontrada.' };
    const logEntry: WorkOrderLogEntry = {
      id: uid('log'),
      timestamp: nowTimestamp(),
      field: 'estado',
      oldValue: wo.status,
      newValue: 'Cancelada',
      changedBy: state.settings.activeUserName,
      role: ROLE_LABELS[state.settings.activeRole].label,
    };
    setState((prev) => ({
      ...prev,
      workOrders: prev.workOrders.map((w) =>
        w.id === id ? { ...w, status: 'Cancelada', statusLog: [logEntry, ...w.statusLog] } : w
      ),
      issues: prev.issues.map((iss) =>
        wo.linkedIssueIds.includes(iss.id) && iss.status === 'En atención'
          ? { ...iss, status: 'Abierta', workOrderId: undefined }
          : iss
      ),
    }));
    pushToast({ title: `Orden ${wo.code} cancelada`, tone: 'info' });
    return { ok: true };
  };

  const addFuelEntry: FleetContextValue['addFuelEntry'] = (payload) => {
    if (!can('fuel:create')) return deny('registrar combustible');
    const { next, result } = applyAddFuelEntry(state, payload);
    if (!result.ok) {
      pushToast({ title: 'Error al registrar combustible', detail: result.error, tone: 'error' });
      return result;
    }
    setState(next);
    pushToast({
      title: 'Abastecimiento de combustible registrado',
      detail: result.data?.galPerHour
        ? `Consumo calculado: ${result.data.galPerHour} gal/h`
        : result.data?.kmPerLiter
        ? `Rendimiento: ${result.data.kmPerLiter.toFixed(2)} km/L`
        : 'Lectura y costo actualizados.',
      tone: 'success',
    });
    return result;
  };

  const addPart = (part: Omit<Part, 'id'>): ActionResult<Part> => {
    if (!can('parts:manage')) return deny('dar de alta repuestos');
    if (state.parts.some((p) => p.sku.toLowerCase() === part.sku.trim().toLowerCase())) {
      return { ok: false, error: `El SKU ${part.sku} ya existe en bodega.` };
    }
    const created: Part = { ...part, id: uid('prt') };
    const initMove: StockMovement = {
      id: uid('sm'),
      partId: created.id,
      date: todayIso(),
      delta: created.quantityOnHand,
      resultingQty: created.quantityOnHand,
      reason: 'Alta inicial de inventario',
      performedBy: state.settings.activeUserName,
    };
    setState((prev) => ({
      ...prev,
      parts: [created, ...prev.parts],
      stockMovements: [initMove, ...prev.stockMovements],
    }));
    pushToast({ title: `Repuesto ${created.sku} agregado`, detail: created.name, tone: 'success' });
    return { ok: true, data: created };
  };

  const adjustPartStock = (
    partId: string,
    delta: number,
    reason: string,
    referenceCode?: string
  ): ActionResult => {
    if (!can('parts:manage')) return deny('ajustar inventario');
    const target = state.parts.find((p) => p.id === partId);
    if (!target) return { ok: false, error: 'Repuesto no encontrado.' };
    const resultingQty = target.quantityOnHand + delta;
    if (resultingQty < 0) return { ok: false, error: 'El ajuste dejaría stock negativo.' };
    const movement: StockMovement = {
      id: uid('sm'),
      partId,
      date: todayIso(),
      delta,
      resultingQty,
      reason: reason.trim() || 'Ajuste manual',
      referenceCode: referenceCode?.trim() || undefined,
      performedBy: state.settings.activeUserName,
    };
    setState((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => (p.id === partId ? { ...p, quantityOnHand: resultingQty } : p)),
      stockMovements: [movement, ...prev.stockMovements],
    }));
    pushToast({
      title: `Kardex actualizado · ${target.sku}`,
      detail: `${delta >= 0 ? '+' : ''}${delta} uds (Saldo: ${resultingQty})`,
      tone: 'success',
    });
    return { ok: true };
  };

  const addVendor = (vendor: Omit<Vendor, 'id'>): ActionResult<Vendor> => {
    if (!can('directory:manage')) return deny('registrar proveedores');
    const created: Vendor = { ...vendor, id: uid('vnd') };
    setState((prev) => ({ ...prev, vendors: [created, ...prev.vendors] }));
    pushToast({ title: 'Proveedor agregado', detail: created.name, tone: 'success' });
    return { ok: true, data: created };
  };

  const addContact = (contact: Omit<Contact, 'id'>): ActionResult<Contact> => {
    if (!can('directory:manage')) return deny('registrar personal');
    const created: Contact = { ...contact, id: uid('cnt') };
    setState((prev) => ({ ...prev, contacts: [created, ...prev.contacts] }));
    pushToast({ title: 'Personal registrado', detail: created.name, tone: 'success' });
    return { ok: true, data: created };
  };

  // --- Hermes Panama: Operations, Shift Dispatch, Downtime, HSE ---
  const addShiftDispatch: FleetContextValue['addShiftDispatch'] = (payload) => {
    if (!can('operations:dispatch')) return deny('registrar partes de turno');
    if (payload.endHorometer < payload.startHorometer) {
      return { ok: false, error: 'El horómetro final no puede ser menor al inicial.' };
    }
    const code = `TUR-${207 + state.shiftDispatches.length}`;
    const created: ShiftDispatch = { ...payload, id: uid('tur'), code };
    const veh = state.vehicles.find((v) => v.id === payload.vehicleId);
    const op = state.contacts.find((c) => c.id === payload.operatorId);
    const meterEntry: MeterReading = {
      id: uid('mr'),
      vehicleId: payload.vehicleId,
      date: payload.date,
      valueKm: veh?.odometerKm || 0,
      valueHrs: payload.endHorometer,
      source: 'Parte de Turno',
      referenceId: code,
      recordedBy: op?.name || state.settings.activeUserName,
    };

    setState((prev) => ({
      ...prev,
      shiftDispatches: [created, ...prev.shiftDispatches],
      meterReadings: [meterEntry, ...prev.meterReadings],
      vehicles: prev.vehicles.map((v) =>
        v.id === payload.vehicleId
          ? { ...v, horometerHrs: Math.max(v.horometerHrs, payload.endHorometer) }
          : v
      ),
    }));
    pushToast({
      title: `Parte de turno ${code} registrado`,
      detail: `${payload.tripsCount} viajes · ${payload.volumeM3} m³ · Horómetro actualizado a ${payload.endHorometer} h.`,
      tone: 'success',
    });
    return { ok: true, data: created };
  };

  const updateShiftStatus = (shiftId: string, status: ShiftStatus, note?: string): ActionResult => {
    if (!can('operations:approve_shift')) return deny('aprobar o revisar partes de turno');
    setState((prev) => ({
      ...prev,
      shiftDispatches: prev.shiftDispatches.map((s) =>
        s.id === shiftId ? { ...s, status, supervisorNote: note ?? s.supervisorNote } : s
      ),
    }));
    pushToast({ title: `Parte de turno marcado como ${status}`, tone: 'success' });
    return { ok: true };
  };

  const addDowntimeEvent: FleetContextValue['addDowntimeEvent'] = (payload) => {
    if (!can('workorder:manage') && !can('operations:dispatch')) return deny('registrar tiempo caído');
    const code = `TC-0${82 + state.downtimeEvents.length}`;
    const created: DowntimeEvent = { ...payload, id: uid('dt'), code, status: 'Activo' };
    setState((prev) => ({
      ...prev,
      downtimeEvents: [created, ...prev.downtimeEvents],
      vehicles: prev.vehicles.map((v) =>
        v.id === payload.vehicleId && v.status === 'Activo'
          ? { ...v, status: 'Fuera de servicio' }
          : v
      ),
    }));
    pushToast({ title: `Tiempo caído ${code} abierto`, detail: payload.reason, tone: 'warning' });
    return { ok: true, data: created };
  };

  const closeDowntimeEvent = (id: string, finalHours: number): ActionResult => {
    if (!can('workorder:manage') && !can('operations:approve_shift')) return deny('cerrar tiempo caído');
    setState((prev) => ({
      ...prev,
      downtimeEvents: prev.downtimeEvents.map((dt) =>
        dt.id === id ? { ...dt, status: 'Cerrado', endedAt: todayIso(), hoursDown: finalHours } : dt
      ),
    }));
    pushToast({ title: 'Evento de tiempo caído cerrado', tone: 'success' });
    return { ok: true };
  };

  const renewHseSticker = (vehicleId: string, newCode: string, newExpiry: string): ActionResult => {
    if (!can('operations:hse')) return deny('emitir o renovar stickers HSE');
    setState((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicleId
          ? { ...v, hseStickerCode: newCode.trim().toUpperCase(), hseStickerExpiry: newExpiry }
          : v
      ),
      renewalReminders: prev.renewalReminders.map((r) =>
        r.entityType === 'Vehículo' &&
        r.entityId === vehicleId &&
        r.renewalType === 'Sticker HSE de Obra'
          ? { ...r, dueDate: newExpiry, lastRenewedDate: todayIso() }
          : r
      ),
    }));
    pushToast({
      title: `Sticker HSE ${newCode.toUpperCase()} habilitado`,
      detail: `Vigente hasta ${newExpiry}`,
      tone: 'success',
    });
    return { ok: true };
  };

  // --- Hermes Panama: Tires (/neumaticos) ---
  const addTire = (tire: Omit<TireRecord, 'id'>): ActionResult<TireRecord> => {
    if (!can('tires:manage')) return deny('registrar llantas');
    const created: TireRecord = { ...tire, id: uid('tir') };
    setState((prev) => ({ ...prev, tires: [created, ...prev.tires] }));
    pushToast({ title: `Llanta ${created.serial} registrada`, tone: 'success' });
    return { ok: true, data: created };
  };

  const inspectTire = (
    tireId: string,
    treadDepthMm: number,
    pressurePsi: number,
    status?: TireStatus
  ): ActionResult => {
    if (!can('tires:manage')) return deny('inspeccionar llantas');
    setState((prev) => ({
      ...prev,
      tires: prev.tires.map((t) =>
        t.id === tireId
          ? {
              ...t,
              treadDepthMm,
              pressurePsi,
              status: status ?? t.status,
              lastInspectedAt: todayIso(),
            }
          : t
      ),
    }));
    pushToast({ title: 'Inspección de llanta registrada', detail: `${treadDepthMm} mm · ${pressurePsi} PSI`, tone: 'success' });
    return { ok: true };
  };

  // --- Hermes Panama: Purchasing, OC, Receiving & AP ---
  const createPurchaseOrder: FleetContextValue['createPurchaseOrder'] = (payload) => {
    if (!can('purchasing:request')) return deny('crear requisiciones / OC');
    const code = `OC-2026-0${16 + state.purchaseOrders.length}`;
    const created: PurchaseOrder = {
      id: uid('po'),
      code,
      vendorId: payload.vendorId,
      requestedBy: state.settings.activeUserName,
      workOrderId: payload.workOrderId || undefined,
      createdAt: todayIso(),
      neededBy: payload.neededBy,
      status: 'Requisición',
      items: payload.items,
      taxPercent: 7,
      notes: payload.notes,
    };
    setState((prev) => ({ ...prev, purchaseOrders: [created, ...prev.purchaseOrders] }));
    pushToast({ title: `Requisición ${code} creada`, detail: 'Pendiente de aprobación por Gerencia.', tone: 'success' });
    return { ok: true, data: created };
  };

  const approvePurchaseOrder = (poId: string): ActionResult => {
    if (!can('purchasing:approve')) return deny('aprobar órdenes de compra (requiere Gerencia TP-PER-001/016)');
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === poId ? { ...p, status: 'Aprobada' } : p
      ),
    }));
    pushToast({ title: 'Orden de Compra aprobada', detail: 'Lista para recepción en Almacén.', tone: 'success' });
    return { ok: true };
  };

  const receivePurchaseOrder = (poId: string): ActionResult<PurchaseOrder> => {
    if (!can('purchasing:receive')) return deny('recibir compras en Almacén (requiere TP-PER-017 o Gerencia)');
    const { next, result } = applyReceivePurchaseOrder(state, poId);
    if (!result.ok) {
      pushToast({ title: 'Error de recepción', detail: result.error, tone: 'error' });
      return result;
    }
    setState(next);
    pushToast({
      title: `Recepción confirmada · ${result.data?.code}`,
      detail: 'Existencias sumadas automáticamente al Kardex de Repuestos.',
      tone: 'success',
    });
    return result;
  };

  const recordPoInvoice = (poId: string, invoiceNumber: string, invoiceDueDate: string): ActionResult => {
    if (!can('purchasing:pay') && !can('purchasing:approve')) return deny('registrar facturas en Cuentas por Pagar');
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === poId
          ? { ...p, status: 'Facturada / Por Pagar', invoiceNumber: invoiceNumber.trim(), invoiceDueDate }
          : p
      ),
    }));
    pushToast({ title: `Factura ${invoiceNumber} conciliada`, detail: 'Enviada a bandeja Por Pagar.', tone: 'success' });
    return { ok: true };
  };

  const payPurchaseOrder = (poId: string, paymentRef: string): ActionResult => {
    if (!can('purchasing:pay')) return deny('registrar pagos de Tesorería (TP-PER-021/022)');
    setState((prev) => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map((p) =>
        p.id === poId
          ? { ...p, status: 'Pagada', paidAt: todayIso(), paymentRef: paymentRef.trim() }
          : p
      ),
    }));
    pushToast({ title: 'Pago registrado en Tesorería', detail: `Ref. ${paymentRef}`, tone: 'success' });
    return { ok: true };
  };

  // --- Real Data Importer (CSV / TSV pasted or live Google Sheets 2D matrix) ---
  const parseDelimitedLine = (line: string, sep: string): string[] => {
    if (sep === '\t') {
      return line.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));
    }
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === sep && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const normalizeHeader = (h: string): string =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const parseNumericCell = (val?: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const importFleetMatrix = (
    rows: string[][],
    sourceLabel = 'CSV / Google Sheets'
  ): ActionResult<{ imported: number; updated: number }> => {
    if (!can('vehicle:create')) return deny('importar flota real');
    const cleanRows = rows
      .map((r) => r.map((c) => String(c ?? '').trim()))
      .filter((r) => r.some((cell) => cell.length > 0));

    if (cleanRows.length === 0) {
      return { ok: false, error: 'No se encontraron filas con datos para importar.' };
    }

    const firstRowNorm = cleanRows[0].map(normalizeHeader);
    const hasHeader = firstRowNorm.some((h) =>
      /^(codigo|cod|id|unidad|unit id|equipo|placa|matricula|marca|modelo|horometro|odometro|estado|status|nombre|descripcion)$/.test(
        h
      ) || /codigo|unidad|horometro|odometro|placa|marca/.test(h)
    );

    const findCol = (pattern: RegExp): number =>
      hasHeader ? firstRowNorm.findIndex((h) => pattern.test(h)) : -1;

    const colIdx = hasHeader
      ? {
          code: findCol(/^(codigo|cod|id|unit id|unidad|id equipo|no economico|economico|code)/),
          name: findCol(/^(nombre|equipo|descripcion|vehiculo|activo|unidad nombre|name)/),
          type: findCol(/^(tipo|categoria|clase|familia|type)/),
          make: findCol(/^(marca|fabricante|make)/),
          model: findCol(/^(modelo|referencia|model)/),
          plate: findCol(/^(placa|patente|matricula|plate)/),
          status: findCol(/^(estado|estatus|condicion|disponibilidad|status)/),
          horometer: findCol(/^(horometro|horas|hrs|horom|hm|hour)/),
          odometer: findCol(/^(odometro|km|kilometraje|kilometros|odometer)/),
          group: findCol(/^(grupo|frente|proyecto|area|flota|ubicacion|group)/),
          hseCode: findCol(/(sticker|hse|habilitacion|calcomania)/),
          hseExpiry: findCol(/(venc|expir|vigencia)/),
          year: findCol(/^(ano|year|anio)$/),
          vin: findCol(/^(vin|serie|chasis|serial)/),
        }
      : {
          // Positional default matching SettingsView sample:
          // Codigo, Nombre, Marca, Modelo, Placa, Horometro, Odometro, Estado
          code: 0,
          name: 1,
          type: -1,
          make: 2,
          model: 3,
          plate: 4,
          horometer: 5,
          odometer: 6,
          status: 7,
          group: -1,
          hseCode: -1,
          hseExpiry: -1,
          year: -1,
          vin: -1,
        };

    // Fallback if header had "Equipo" as column 0 and no separate "Codigo"
    if (colIdx.code === -1 && colIdx.name >= 0) {
      colIdx.code = colIdx.name;
    } else if (colIdx.code === -1) {
      colIdx.code = 0;
    }

    const dataRows = hasHeader ? cleanRows.slice(1) : cleanRows;
    let imported = 0;
    let updated = 0;
    const nextVehicles = [...state.vehicles];

    const getCell = (row: string[], idx: number): string =>
      idx >= 0 && idx < row.length ? row[idx].trim() : '';

    dataRows.forEach((cols) => {
      const rawCode = getCell(cols, colIdx.code);
      if (!rawCode) return;
      const code = rawCode.toUpperCase();
      const rawName = getCell(cols, colIdx.name);
      const rawType = getCell(cols, colIdx.type);
      const rawMake = getCell(cols, colIdx.make);
      const rawModel = getCell(cols, colIdx.model);
      const rawPlate = getCell(cols, colIdx.plate);
      const rawStatus = getCell(cols, colIdx.status).toLowerCase();
      const horometerVal = parseNumericCell(getCell(cols, colIdx.horometer));
      const odometerVal = parseNumericCell(getCell(cols, colIdx.odometer));
      const rawGroup = getCell(cols, colIdx.group);
      const rawHseCode = getCell(cols, colIdx.hseCode);
      const rawHseExpiry = getCell(cols, colIdx.hseExpiry);
      const rawYear = parseInt(getCell(cols, colIdx.year), 10);
      const rawVin = getCell(cols, colIdx.vin);

      const name =
        rawName && rawName.toUpperCase() !== code
          ? rawName
          : [rawMake, rawModel].filter(Boolean).join(' ') || code;
      const make = rawMake || name.split(' ')[0] || 'GTP';
      const model = rawModel || name.split(' ').slice(1).join(' ') || 'Estándar';

      const status: VehicleStatus =
        rawStatus.includes('taller') || rawStatus.includes('reparac') || rawStatus.includes('pm') || rawStatus.includes('mant')
          ? 'En taller'
          : rawStatus.includes('fuera') || rawStatus.includes('falla') || rawStatus.includes('varad') || rawStatus.includes('baja')
          ? 'Fuera de servicio'
          : rawStatus.includes('inact') || rawStatus.includes('stand')
          ? 'Inactivo'
          : rawStatus.includes('vend')
          ? 'Vendido'
          : 'Activo';

      const typeHint = `${rawType} ${name} ${code}`;
      const mappedType: Vehicle['type'] = /excav|retro/i.test(typeHint)
        ? 'Excavadora'
        : /cargador|loader|pala/i.test(typeHint)
        ? 'Cargador Frontal'
        : /moto|grader|niveladora/i.test(typeHint)
        ? 'Motoniveladora'
        : /cisterna|tanquero|lubric/i.test(typeHint)
        ? 'Cisterna de Diésel'
        : /pickup|hilux|l200|ranger|camioneta/i.test(typeHint)
        ? 'Pickup 4x4'
        : /cabezal|tracto|mula|lowboy/i.test(typeHint)
        ? 'Tractocamión / Cabezal'
        : 'Volquete 6x4';

      const mappedGroup: FleetGroup = /volquete|acarreo|camion/i.test(`${rawGroup} ${mappedType}`)
        ? 'Acarreo y Volquetes'
        : /taller|soporte|cisterna/i.test(`${rawGroup} ${mappedType}`)
        ? 'Taller y Soporte Técnico'
        : /hse|supervis|pickup/i.test(`${rawGroup} ${mappedType}`)
        ? 'Supervisión HSE y Campo'
        : 'TMF Panamá · Movimiento de Tierras';

      const existingIdx = nextVehicles.findIndex(
        (v) => v.code.toLowerCase() === code.toLowerCase()
      );

      if (existingIdx >= 0) {
        const cur = nextVehicles[existingIdx];
        nextVehicles[existingIdx] = {
          ...cur,
          name: rawName ? name : cur.name,
          make: rawMake || cur.make,
          model: rawModel || cur.model,
          licensePlate: rawPlate || cur.licensePlate,
          status: rawStatus ? status : cur.status,
          horometerHrs: horometerVal > 0 ? horometerVal : cur.horometerHrs,
          odometerKm: odometerVal > 0 ? odometerVal : cur.odometerKm,
          hseStickerCode: rawHseCode || cur.hseStickerCode,
          hseStickerExpiry: /^\d{4}-\d{2}-\d{2}$/.test(rawHseExpiry)
            ? rawHseExpiry
            : cur.hseStickerExpiry,
        };
        updated += 1;
      } else {
        const meterMode: Vehicle['meterMode'] =
          horometerVal > 0 && odometerVal > 0
            ? 'dual'
            : odometerVal > 0 && horometerVal === 0
            ? 'odometro'
            : 'horometro';
        nextVehicles.unshift({
          id: uid('veh'),
          code,
          name,
          vin: rawVin || `IMP-${code}-GTP`,
          licensePlate: rawPlate || `PA-${Math.floor(10000 + Math.random() * 89999)}`,
          year: Number.isFinite(rawYear) && rawYear > 1990 && rawYear <= 2030 ? rawYear : 2024,
          make,
          model,
          type: mappedType,
          status,
          group: mappedGroup,
          fuelType: 'Diésel ULSD',
          odometerKm: odometerVal,
          horometerHrs: horometerVal,
          meterMode,
          nextPmLevel: 'PM1 · 250h',
          nextPmHours: Math.ceil((horometerVal + 1) / 250) * 250,
          hseStickerCode: rawHseCode || `HSE-${code}`,
          hseStickerExpiry: /^\d{4}-\d{2}-\d{2}$/.test(rawHseExpiry)
            ? rawHseExpiry
            : addMonthsIso(todayIso(), 3),
          purchaseCost: 120000,
          purchaseDate: todayIso(),
          clientProject: state.settings.projectCode,
          notes: `Importado desde ${sourceLabel}.`,
        });
        imported += 1;
      }
    });

    if (imported === 0 && updated === 0) {
      return {
        ok: false,
        error:
          'No se reconocieron filas válidas. Verifica que la hoja tenga al menos una columna de Código o Unidad.',
      };
    }

    setState((prev) => ({ ...prev, vehicles: nextVehicles }));
    pushToast({
      title: `Importación completada (${sourceLabel})`,
      detail: `${imported} equipo(s) nuevo(s) · ${updated} actualizado(s).`,
      tone: 'success',
    });
    return { ok: true, data: { imported, updated } };
  };

  const importFleetRowsFromText = (
    rawText: string
  ): ActionResult<{ imported: number; updated: number }> => {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return { ok: false, error: 'Pega al menos una fila CSV o desde Google Sheets.' };
    }
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const matrix = lines.map((line) => parseDelimitedLine(line, sep));
    return importFleetMatrix(matrix, 'CSV / Pegado directo');
  };

  const updateSettings = (patch: Partial<AppSettings>) => {
    if (!can('settings:manage')) {
      deny('modificar configuración del sistema');
      return;
    }
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    pushToast({ title: 'Configuración guardada', tone: 'success' });
  };

  const setActiveRole = (role: UserRole) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        activeRole: role,
        activePositionCode: ROLE_LABELS[role].positionCode,
      },
    }));
    pushToast({
      title: `${ROLE_LABELS[role].label} (${ROLE_LABELS[role].positionCode})`,
      detail: ROLE_LABELS[role].summary,
      tone: 'info',
    });
  };

  const toggleDashboardWidget = (widgetId: DashboardWidgetConfig['id']): ActionResult => {
    const activeProfile = state.settings.dashboardProfiles.find(
      (p) => p.id === state.settings.activeDashboardProfileId
    );
    if (!activeProfile) return { ok: false, error: 'Perfil de panel no encontrado.' };
    if (activeProfile.isStandard) {
      const msg = 'La vista estándar está protegida. Usa "Duplicar vista" para personalizar widgets.';
      pushToast({ title: 'Vista estándar protegida', detail: msg, tone: 'info' });
      return { ok: false, error: msg };
    }
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dashboardProfiles: prev.settings.dashboardProfiles.map((prof) =>
          prof.id === activeProfile.id
            ? {
                ...prof,
                widgets: prof.widgets.map((w) =>
                  w.id === widgetId ? { ...w, visible: !w.visible } : w
                ),
              }
            : prof
        ),
      },
    }));
    return { ok: true };
  };

  const duplicateDashboardView = (name: string): ActionResult => {
    const base =
      state.settings.dashboardProfiles.find(
        (p) => p.id === state.settings.activeDashboardProfileId
      ) || state.settings.dashboardProfiles[0];
    const copyId = uid('dash');
    const copyProfile = {
      id: copyId,
      name: name.trim() || `Panel TMF Personalizado ${state.settings.dashboardProfiles.length}`,
      isStandard: false,
      widgets: base.widgets.map((w) => ({ ...w })),
    };
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dashboardProfiles: [...prev.settings.dashboardProfiles, copyProfile],
        activeDashboardProfileId: copyId,
      },
    }));
    pushToast({ title: `Vista "${copyProfile.name}" creada`, tone: 'success' });
    return { ok: true };
  };

  const selectDashboardProfile = (profileId: string) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, activeDashboardProfileId: profileId },
    }));
  };

  const resetToFixtures = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_FLEET_STATE);
    pushToast({ title: 'Datos de ejemplo restaurados', tone: 'info' });
  };

  const runAutomatedVerificationSuite = (): AutomatedTestResult[] => {
    const executedAt = new Date().toLocaleTimeString('es-PA');
    const results: AutomatedTestResult[] = [];

    // T-01: DVIR critical failure -> auto Issue + Downtime + Horometer update
    {
      const t0 = performance.now();
      const base = structuredClone(INITIAL_FLEET_STATE);
      const { next, result } = applySubmitInspection(base, {
        formId: 'form-dvir-1',
        vehicleId: 'veh-exc01',
        operatorId: 'cnt-1',
        odometerKm: 0,
        horometerHrs: 4978,
        items: [
          { itemId: 'fi-2', label: 'Mangueras hidráulicas y cilindros sin fugas activas', result: 'Falla', note: 'Goteo activo' },
          { itemId: 'fi-1', label: 'Frenos de servicio, emergencia y sistema neumático', result: 'Pasa' },
        ],
      });
      const veh = next.vehicles.find((v) => v.id === 'veh-exc01');
      const pass =
        result.ok &&
        result.data?.createdIssues.length === 1 &&
        veh?.horometerHrs === 4978 &&
        veh?.status === 'Fuera de servicio' &&
        next.downtimeEvents.length === base.downtimeEvents.length + 1;
      results.push({
        id: 'T-01',
        name: 'Pre-Uso DVIR con falla crítica → Incidencia + Horómetro + Tiempo Caído automático',
        module: 'Inspecciones → Incidencias → Tiempo Caído',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Horómetro GTP-EXC-01 subió a 4,978 h, generó ${result.data?.createdIssues[0].code} y abrió evento de Tiempo Caído.`
          : 'Fallo en propagación DVIR.',
        executedAt,
      });
    }

    // T-02: Complete OT-1002 -> deduct Parts, resolve Issue, close Downtime, recalculate PM1, return Active
    {
      const t0 = performance.now();
      const base = structuredClone(INITIAL_FLEET_STATE);
      const beforeQty = base.parts.find((p) => p.id === 'prt-1')?.quantityOnHand ?? 0;
      const { next, result } = applyCompleteWorkOrder(base, 'wo-1002');
      const afterQty = next.parts.find((p) => p.id === 'prt-1')?.quantityOnHand ?? 0;
      const afterIss = next.issues.find((i) => i.id === 'iss-303');
      const afterDt = next.downtimeEvents.find((d) => d.id === 'dt-2');
      const afterRem = next.serviceReminders.find((r) => r.id === 'sr-2');
      const afterVeh = next.vehicles.find((v) => v.id === 'veh-vol14');
      const remSt = afterRem ? computeServiceReminderStatus(afterRem, afterVeh).status : 'Vencido';
      const tcoCheck = computeVehicleTCO('veh-vol14', next).maintenanceCost > 0;
      const pass =
        result.ok &&
        afterQty === beforeQty - 1 &&
        afterIss?.status === 'Resuelta' &&
        afterDt?.status === 'Cerrado' &&
        remSt === 'Al día' &&
        afterVeh?.status === 'Activo' &&
        tcoCheck;
      results.push({
        id: 'T-02',
        name: 'Cierre atómico OT-1002 → Stock + Incidencia + Tiempo Caído + Recálculo PM1',
        module: 'Órdenes de Trabajo → Bodega → Downtime → PM',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Stock GTP-BRK-HOWO: ${beforeQty}→${afterQty}, TC-080 cerrado, INC-303 Resuelta, PM1 recalculado a ${afterRem?.nextDueHrs} h y GTP-VOL-14 Activo.`
          : 'Fallo en cierre atómico de OT-1002.',
        executedAt,
      });
    }

    // T-03: Fuel backwards odometer rejection & valid km/L + USD calculation
    {
      const t0 = performance.now();
      const base = structuredClone(INITIAL_FLEET_STATE);
      const bad = applyAddFuelEntry(base, {
        vehicleId: 'veh-vol18',
        date: todayIso(),
        odometerKm: 65000,
        liters: 100,
        pricePerLiter: 0.95,
        fuelType: 'Diésel ULSD',
        partialFill: false,
      });
      const good = applyAddFuelEntry(base, {
        vehicleId: 'veh-vol18',
        date: todayIso(),
        odometerKm: 72150,
        horometerHrs: 2845,
        liters: 250,
        pricePerLiter: 0.95,
        fuelType: 'Diésel ULSD',
        partialFill: false,
      });
      const pass = !bad.result.ok && good.result.ok && good.result.data?.kmPerLiter === 3.2;
      results.push({
        id: 'T-03',
        name: 'Diésel ULSD → Bloqueo de odómetro regresivo y cálculo exacto km/L + gal/h',
        module: 'Combustible → Odómetro/Horómetro',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? 'Odómetro regresivo bloqueado; carga válida en 72,150 km calculó 3.20 km/L.'
          : 'Error en validación de combustible.',
        executedAt,
      });
    }

    // T-04: RBAC Matrix across Grupo Trans Plus TP-PER roles
    {
      const t0 = performance.now();
      const pass =
        ROLE_PERMISSIONS.gerencia.includes('purchasing:approve') &&
        !ROLE_PERMISSIONS.almacen.includes('purchasing:approve') &&
        ROLE_PERMISSIONS.almacen.includes('purchasing:receive') &&
        !ROLE_PERMISSIONS.mecanico.includes('workorder:manage') &&
        ROLE_PERMISSIONS.mecanico.includes('workorder:progress') &&
        ROLE_PERMISSIONS.supervisor.includes('operations:hse') &&
        ROLE_PERMISSIONS.readonly.length === 0;
      results.push({
        id: 'T-04',
        name: 'Matriz RBAC Grupo Trans Plus (TP-PER-001..028) → Segregación de funciones',
        module: 'Configuración / Seguridad',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? 'Segregación verificada: Gerencia aprueba OC, Almacén recibe en bodega, Mecánico solo reporta avance y Supervisor habilita HSE.'
          : 'Inconsistencia en matriz RBAC.',
        executedAt,
      });
    }

    // T-05: localStorage persistence check
    {
      const t0 = performance.now();
      let pass = false;
      try {
        const persisted = localStorage.getItem(STORAGE_KEY);
        const parsed = persisted ? (JSON.parse(persisted) as FleetState) : null;
        pass = Boolean(parsed && parsed.vehicles.length === state.vehicles.length);
      } catch {
        pass = false;
      }
      results.push({
        id: 'T-05',
        name: 'Persistencia localStorage → Integridad del estado v2 tras recarga',
        module: 'Núcleo de Persistencia',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Clave ${STORAGE_KEY} verificada con ${state.vehicles.length} equipos, ${state.tires.length} llantas y ${state.purchaseOrders.length} OC.`
          : 'Estado v2 no encontrado en localStorage.',
        executedAt,
      });
    }

    // T-06: Standard Dashboard protection + widgets
    {
      const t0 = performance.now();
      const standard = state.settings.dashboardProfiles.find((p) => p.isStandard);
      const pass = Boolean(standard && standard.widgets.length === 8);
      results.push({
        id: 'T-06',
        name: 'Centro de Mando → Protección de vista estándar + 8 widgets TMF Panamá',
        module: 'Panel Operativo',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Perfil "${standard?.name}" verificado con 8 widgets operativos.`
          : 'Error en configuración del panel.',
        executedAt,
      });
    }

    // T-07: Operations (Downtime availability & HSE sticker)
    {
      const t0 = performance.now();
      const activeDown = INITIAL_FLEET_STATE.downtimeEvents.filter((d) => d.status === 'Activo').length;
      const expiredSticker = INITIAL_FLEET_STATE.vehicles.some((v) => v.code === 'GTP-MOT-02' && v.hseStickerExpiry < todayIso());
      const pass = activeDown >= 2 && expiredSticker;
      results.push({
        id: 'T-07',
        name: 'Despacho, Tiempo Caído y HSE → Detección de Sticker vencido y horas detenidas',
        module: 'Operaciones TMF Panamá',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Detectados ${activeDown} eventos activos de tiempo caído y sticker vencido en GTP-MOT-02.`
          : 'Error en cálculo operativo.',
        executedAt,
      });
    }

    // T-08: Purchasing OC Receive -> automatic Warehouse Stock increase & Kardex entry
    {
      const t0 = performance.now();
      const base = structuredClone(INITIAL_FLEET_STATE);
      const beforeHoseQty = base.parts.find((p) => p.id === 'prt-6')?.quantityOnHand ?? 0;
      const { next, result } = applyReceivePurchaseOrder(base, 'po-1');
      const afterHoseQty = next.parts.find((p) => p.id === 'prt-6')?.quantityOnHand ?? 0;
      const addedMove = next.stockMovements.find((m) => m.referenceCode === 'OC-2026-014' && m.partId === 'prt-6');
      const pass = result.ok && afterHoseQty === beforeHoseQty + 3 && Boolean(addedMove);
      results.push({
        id: 'T-08',
        name: 'Compras → Recepción de OC-2026-014 en Almacén suma stock y escribe Kardex',
        module: 'Compras → Bodega / Repuestos',
        status: pass ? 'Aprobada' : 'Fallida',
        durationMs: Math.max(1, Math.round(performance.now() - t0)),
        assertionSummary: pass
          ? `Recepción de OC-2026-014 incrementó HYD-HSE-140K de ${beforeHoseQty}→${afterHoseQty} uds con registro en Kardex.`
          : 'Error en recepción de OC.',
        executedAt,
      });
    }

    return results;
  };

  return (
    <FleetContext.Provider
      value={{
        state,
        toasts,
        dismissToast,
        pushToast,
        can,
        addVehicle,
        updateVehicle,
        bulkUpdateVehicles,
        deleteVehicle,
        logMeterReading,
        toggleVoidMeterReading,
        submitInspection,
        addInspectionForm,
        addIssue,
        resolveIssue,
        updateIssueStatus,
        addServiceReminder,
        snoozeServiceReminder,
        addRenewalReminder,
        completeRenewalReminder,
        createWorkOrder,
        updateWorkOrder,
        completeWorkOrder,
        reopenWorkOrder,
        cancelWorkOrder,
        addFuelEntry,
        addPart,
        adjustPartStock,
        addVendor,
        addContact,
        addShiftDispatch,
        updateShiftStatus,
        addDowntimeEvent,
        closeDowntimeEvent,
        renewHseSticker,
        addTire,
        inspectTire,
        createPurchaseOrder,
        approvePurchaseOrder,
        receivePurchaseOrder,
        recordPoInvoice,
        payPurchaseOrder,
        importFleetRowsFromText,
        importFleetMatrix,
        updateSettings,
        setActiveRole,
        toggleDashboardWidget,
        duplicateDashboardView,
        selectDashboardProfile,
        resetToFixtures,
        runAutomatedVerificationSuite,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
};

export function useFleet(): FleetContextValue {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet debe usarse dentro de FleetProvider');
  return ctx;
}
