import {
  AppSettings,
  FleetState,
  HseStickerStatus,
  IssuePriority,
  IssueStatus,
  PurchaseOrder,
  PurchaseOrderStatus,
  ReminderComputedStatus,
  RenewalReminder,
  ServiceReminder,
  ShiftStatus,
  TireStatus,
  Vehicle,
  VehicleStatus,
  WorkOrder,
  WorkOrderStatusKey,
} from '../types/fleet';

export function formatCurrency(amount: number, currency: 'USD' | 'MXN' = 'USD'): string {
  const locale = currency === 'USD' ? 'es-PA' : 'es-MX';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDistance(km: number, unit: 'km' | 'mi' = 'km'): string {
  const val = unit === 'mi' ? km * 0.621371 : km;
  return `${Math.round(val).toLocaleString('es-PA')} ${unit}`;
}

export function formatHours(hrs: number): string {
  return `${hrs.toLocaleString('es-PA', { maximumFractionDigits: 1 })} h`;
}

export function formatVolume(liters: number, unit: 'gal' | 'L' = 'gal'): string {
  const val = unit === 'gal' ? liters * 0.264172 : liters;
  return `${val.toLocaleString('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unit}`;
}

export function formatEfficiency(
  kmPerLiter?: number,
  settings?: Pick<AppSettings, 'distanceUnit' | 'volumeUnit'>
): string {
  if (kmPerLiter === undefined || !Number.isFinite(kmPerLiter) || kmPerLiter <= 0) {
    return '—';
  }
  if (settings?.volumeUnit === 'gal') {
    const kmPerGal = kmPerLiter * 3.78541;
    if (settings.distanceUnit === 'mi') {
      return `${(kmPerLiter * 2.35215).toFixed(1)} mpg`;
    }
    return `${kmPerGal.toFixed(1)} km/gal`;
  }
  return `${kmPerLiter.toFixed(2)} km/L`;
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) return '—';
  const normalized = isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('es-PA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsIso(baseIso: string, months: number): string {
  const base = new Date(baseIso.length === 10 ? `${baseIso}T12:00:00` : baseIso);
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

export function diffDaysFromToday(targetIso: string): number {
  const now = new Date(`${todayIso()}T12:00:00`).getTime();
  const target = new Date(`${targetIso.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

export function computeHseStickerStatus(expiryIso?: string): {
  status: HseStickerStatus;
  remainingDays: number;
} {
  if (!expiryIso) return { status: 'Pendiente', remainingDays: -999 };
  const remainingDays = diffDaysFromToday(expiryIso);
  if (remainingDays < 0) return { status: 'Vencido', remainingDays };
  if (remainingDays <= 15) return { status: 'Por vencer', remainingDays };
  return { status: 'Vigente', remainingDays };
}

export function computeServiceReminderStatus(
  reminder: ServiceReminder,
  vehicle?: Vehicle
): {
  status: ReminderComputedStatus;
  remainingKm: number;
  remainingHrs?: number;
  remainingDays: number;
} {
  const currentKm = vehicle?.odometerKm ?? reminder.lastCompletedKm;
  const remainingKm = reminder.nextDueKm - currentKm;
  const remainingDays = diffDaysFromToday(reminder.nextDueDate);

  let remainingHrs: number | undefined;
  if (typeof reminder.nextDueHrs === 'number' && vehicle && vehicle.horometerHrs > 0) {
    remainingHrs = Number((reminder.nextDueHrs - vehicle.horometerHrs).toFixed(1));
  }

  if (reminder.snoozedUntil && diffDaysFromToday(reminder.snoozedUntil) > 0) {
    return { status: 'Pospuesto', remainingKm, remainingHrs, remainingDays };
  }

  const overdueByHrs = typeof remainingHrs === 'number' && remainingHrs <= 0;
  const overdueByKm = reminder.intervalKm > 0 && remainingKm <= 0;
  if (overdueByHrs || overdueByKm || remainingDays < 0) {
    return { status: 'Vencido', remainingKm, remainingHrs, remainingDays };
  }

  const soonByHrs =
    typeof remainingHrs === 'number' &&
    remainingHrs <= (reminder.soonThresholdHrs ?? 40);
  const soonByKm = reminder.intervalKm > 0 && remainingKm <= reminder.soonThresholdKm;
  if (soonByHrs || soonByKm || remainingDays <= reminder.soonThresholdDays) {
    return { status: 'Próximo', remainingKm, remainingHrs, remainingDays };
  }
  return { status: 'Al día', remainingKm, remainingHrs, remainingDays };
}

export function computeRenewalStatus(renewal: RenewalReminder): {
  status: ReminderComputedStatus;
  remainingDays: number;
} {
  const remainingDays = diffDaysFromToday(renewal.dueDate);
  if (remainingDays < 0) return { status: 'Vencido', remainingDays };
  if (remainingDays <= renewal.soonThresholdDays) return { status: 'Próximo', remainingDays };
  return { status: 'Al día', remainingDays };
}

export function computeWorkOrderTotals(wo: WorkOrder): {
  laborSubtotal: number;
  partsSubtotal: number;
  taxAmount: number;
  total: number;
} {
  const laborSubtotal = wo.laborItems.reduce((acc, item) => acc + item.hours * item.hourlyRate, 0);
  const partsSubtotal = wo.partItems.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
  const taxable = Math.max(0, laborSubtotal + partsSubtotal - (wo.discountAmount || 0));
  const taxAmount = taxable * ((wo.taxPercent || 0) / 100);
  const total = taxable + taxAmount;
  return { laborSubtotal, partsSubtotal, taxAmount, total };
}

export function computePurchaseOrderTotal(po: PurchaseOrder): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = po.items.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
  const taxAmount = subtotal * ((po.taxPercent || 0) / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export function computeMechanicalAvailability(
  vehicleId: string | null,
  state: FleetState,
  periodHours = 240
): { availabilityPct: number; totalDownHours: number } {
  const events = vehicleId
    ? state.downtimeEvents.filter((d) => d.vehicleId === vehicleId)
    : state.downtimeEvents;
  const totalDownHours = events.reduce((acc, e) => acc + e.hoursDown, 0);
  const fleetSize = vehicleId ? 1 : Math.max(1, state.vehicles.filter((v) => v.status !== 'Vendido').length);
  const totalScheduled = fleetSize * periodHours;
  const availabilityPct = Math.max(
    0,
    Math.min(100, ((totalScheduled - totalDownHours) / totalScheduled) * 100)
  );
  return { availabilityPct, totalDownHours };
}

export function computeVehicleTCO(vehicleId: string, state: FleetState): {
  maintenanceCost: number;
  fuelCost: number;
  totalOperatingCost: number;
  costPerKm: number;
  avgKmPerLiter: number;
  trackedKm: number;
} {
  const maintenanceCost = state.workOrders
    .filter((wo) => wo.vehicleId === vehicleId && wo.status !== 'Cancelada')
    .reduce((sum, wo) => sum + computeWorkOrderTotals(wo).total, 0);

  const vehicleFuels = state.fuelEntries.filter((f) => f.vehicleId === vehicleId);
  const fuelCost = vehicleFuels.reduce((sum, f) => sum + f.totalCost, 0);
  const totalOperatingCost = maintenanceCost + fuelCost;

  const validEfficiencies = vehicleFuels
    .map((f) => f.kmPerLiter)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const avgKmPerLiter =
    validEfficiencies.length > 0
      ? validEfficiencies.reduce((a, b) => a + b, 0) / validEfficiencies.length
      : 0;

  const readings = state.meterReadings
    .filter((m) => m.vehicleId === vehicleId && !m.voided)
    .map((m) => m.valueKm)
    .sort((a, b) => a - b);

  const trackedKm =
    readings.length >= 2 ? Math.max(1, readings[readings.length - 1] - readings[0]) : 500;
  const costPerKm = totalOperatingCost > 0 ? totalOperatingCost / trackedKm : 0;

  return {
    maintenanceCost,
    fuelCost,
    totalOperatingCost,
    costPerKm,
    avgKmPerLiter,
    trackedKm,
  };
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined)[][]
): void {
  const escapeCell = (val: string | number | undefined) => {
    const str = val === undefined || val === null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Strict Zero-Pill Semantic Typography Classes
export function vehicleStatusTextClass(status: VehicleStatus): string {
  switch (status) {
    case 'Activo':
      return 'text-emerald-700 font-medium';
    case 'En taller':
      return 'text-amber-700 font-medium';
    case 'Fuera de servicio':
      return 'text-red-700 font-semibold';
    case 'Inactivo':
    case 'Vendido':
    default:
      return 'text-slate-500 font-medium';
  }
}

export function issuePriorityTextClass(priority: IssuePriority): string {
  switch (priority) {
    case 'Crítica':
      return 'text-red-700 font-semibold';
    case 'Alta':
      return 'text-amber-700 font-semibold';
    case 'Media':
      return 'text-slate-800 font-medium';
    case 'Baja':
    default:
      return 'text-slate-500 font-medium';
  }
}

export function issueStatusTextClass(status: IssueStatus): string {
  switch (status) {
    case 'Abierta':
      return 'text-red-700 font-medium';
    case 'En atención':
      return 'text-amber-700 font-medium';
    case 'Resuelta':
      return 'text-emerald-700 font-medium';
    case 'Cerrada':
    default:
      return 'text-slate-500 font-medium';
  }
}

export function reminderStatusTextClass(status: ReminderComputedStatus): string {
  switch (status) {
    case 'Vencido':
      return 'text-red-700 font-semibold';
    case 'Próximo':
      return 'text-amber-700 font-medium';
    case 'Al día':
      return 'text-emerald-700 font-medium';
    case 'Pospuesto':
    default:
      return 'text-slate-500 font-medium';
  }
}

export function workOrderStatusTextClass(status: WorkOrderStatusKey): string {
  switch (status) {
    case 'Abierta':
      return 'text-blue-700 font-medium';
    case 'En progreso':
      return 'text-amber-700 font-medium';
    case 'Esperando repuestos':
      return 'text-red-700 font-medium';
    case 'Completada':
      return 'text-emerald-700 font-medium';
    case 'Cancelada':
    default:
      return 'text-slate-500 font-medium';
  }
}

export function hseStickerTextClass(status: HseStickerStatus): string {
  switch (status) {
    case 'Vigente':
      return 'text-emerald-700 font-medium';
    case 'Por vencer':
      return 'text-amber-700 font-medium';
    case 'Vencido':
      return 'text-red-700 font-semibold';
    default:
      return 'text-slate-500 font-medium';
  }
}

export function shiftStatusTextClass(status: ShiftStatus): string {
  switch (status) {
    case 'Aceptado':
      return 'text-emerald-700 font-medium';
    case 'Por revisar':
      return 'text-amber-700 font-semibold';
    case 'En curso':
      return 'text-blue-700 font-medium';
    default:
      return 'text-red-700 font-medium';
  }
}

export function tireStatusTextClass(status: TireStatus): string {
  switch (status) {
    case 'Montada':
      return 'text-emerald-700 font-medium';
    case 'En almacén':
      return 'text-blue-700 font-medium';
    case 'Reencauche':
      return 'text-amber-700 font-medium';
    default:
      return 'text-slate-500 font-medium';
  }
}

export function purchaseOrderStatusTextClass(status: PurchaseOrderStatus): string {
  switch (status) {
    case 'Pagada':
      return 'text-emerald-700 font-medium';
    case 'Recibida en Almacén':
    case 'Aprobada':
      return 'text-blue-700 font-medium';
    case 'Facturada / Por Pagar':
    case 'Cotizada':
    case 'Requisición':
      return 'text-amber-700 font-medium';
    default:
      return 'text-red-700 font-medium';
  }
}
