import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, BarChart3, CalendarClock, Copy, Package, Plus, SlidersHorizontal, Truck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ROLE_LABELS, useFleet } from '../store/FleetContext';
import { FleetGroup, RouteState, UserRole } from '../types/fleet';
import {
  computeRenewalStatus,
  computeServiceReminderStatus,
  computeWorkOrderTotals,
  formatCurrency,
  formatDate,
  formatDistance,
  formatHours,
  issuePriorityTextClass,
  reminderStatusTextClass,
  vehicleStatusTextClass,
  workOrderStatusTextClass,
} from '../utils/format';

interface DashboardViewProps {
  onCreateWorkOrder: () => void;
  onNavigate: (next: RouteState) => void;
}

const PRIORITY_ORDER = ['Crítica', 'Alta', 'Media', 'Baja'];

const GROUPS: ('Todos' | FleetGroup)[] = [
  'Todos',
  'TMF Panamá · Movimiento de Tierras',
  'Acarreo y Volquetes',
  'Taller y Soporte Técnico',
  'Supervisión HSE y Campo',
];

const ROLE_QUICK_ACTIONS: Record<UserRole, { label: string; section: RouteState['section'] }[]> = {
  gerencia: [
    { label: 'Aprobar Órdenes de Compra', section: 'purchasing' },
    { label: 'Reportes TCO y Costos', section: 'reports' },
    { label: 'Turnos y Disponibilidad', section: 'operations' },
  ],
  coordinador: [
    { label: 'Programas PM y HSE', section: 'reminders' },
    { label: 'Despacho y Partes de Turno', section: 'operations' },
    { label: 'Órdenes de Trabajo', section: 'work-orders' },
  ],
  supervisor: [
    { label: 'Revisar Partes de Turno', section: 'operations' },
    { label: 'Stickers HSE', section: 'operations' },
    { label: 'Inspecciones DVIR', section: 'inspections' },
  ],
  jefe_taller: [
    { label: 'Órdenes de Trabajo', section: 'work-orders' },
    { label: 'Tiempo Caído Activo', section: 'operations' },
    { label: 'Control de Llantas', section: 'tires' },
  ],
  mecanico: [
    { label: 'Actualizar Avance de OT', section: 'work-orders' },
    { label: 'Reportar Incidencia', section: 'issues' },
    { label: 'Flota y Horómetros', section: 'vehicles' },
  ],
  almacen: [
    { label: 'Recibir OC en Almacén', section: 'purchasing' },
    { label: 'Stock Bajo y Kardex', section: 'parts' },
    { label: 'Órdenes de Trabajo', section: 'work-orders' },
  ],
  operador: [
    { label: 'Pre-Uso DVIR Diario', section: 'inspections' },
    { label: 'Registrar Parte de Turno', section: 'operations' },
    { label: 'Cargar Diésel', section: 'fuel' },
  ],
  readonly: [
    { label: 'Reportes TCO', section: 'reports' },
    { label: 'Auditoría V2', section: 'audit' },
    { label: 'Flota y Equipos', section: 'vehicles' },
  ],
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onCreateWorkOrder }) => {
  const {
    state,
    can,
    toggleDashboardWidget,
    duplicateDashboardView,
    selectDashboardProfile,
  } = useFleet();
  const [selectedGroup, setSelectedGroup] = useState<'Todos' | FleetGroup>('Todos');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [copyName, setCopyName] = useState('');

  const activeProfile =
    state.settings.dashboardProfiles.find(
      (p) => p.id === state.settings.activeDashboardProfileId
    ) || state.settings.dashboardProfiles[0];

  const isVisible = (id: string) =>
    activeProfile.widgets.find((w) => w.id === id)?.visible ?? true;

  const filteredVehicles = useMemo(
    () =>
      selectedGroup === 'Todos'
        ? state.vehicles
        : state.vehicles.filter((v) => v.group === selectedGroup),
    [state.vehicles, selectedGroup]
  );

  const vehicleIdSet = useMemo(
    () => new Set(filteredVehicles.map((v) => v.id)),
    [filteredVehicles]
  );

  const filteredIssues = useMemo(
    () =>
      state.issues.filter(
        (i) => vehicleIdSet.has(i.vehicleId) && (i.status === 'Abierta' || i.status === 'En atención')
      ),
    [state.issues, vehicleIdSet]
  );

  const filteredWorkOrders = useMemo(
    () => state.workOrders.filter((w) => vehicleIdSet.has(w.vehicleId)),
    [state.workOrders, vehicleIdSet]
  );

  const activeWorkOrders = useMemo(
    () =>
      filteredWorkOrders.filter(
        (w) => w.status === 'Abierta' || w.status === 'En progreso' || w.status === 'Esperando repuestos'
      ).sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
        a.scheduledDate.localeCompare(b.scheduledDate)),
    [filteredWorkOrders]
  );

  const reminderItems = useMemo(() => {
    const service = state.serviceReminders
      .filter((r) => vehicleIdSet.has(r.vehicleId))
      .map((r) => {
        const veh = state.vehicles.find((v) => v.id === r.vehicleId);
        const computed = computeServiceReminderStatus(r, veh);
        return {
          id: r.id,
          kind: 'Mantenimiento' as const,
          title: r.serviceTask,
          targetLabel: veh ? `${veh.code} · ${veh.name}` : r.vehicleId,
          vehicleId: r.vehicleId,
          status: computed.status,
          dueLabel:
            typeof r.nextDueHrs === 'number'
              ? `${formatHours(r.nextDueHrs)} · ${formatDate(r.nextDueDate)}`
              : `${formatDate(r.nextDueDate)} · ${formatDistance(r.nextDueKm, state.settings.distanceUnit)}`,
        };
      });

    const renewals = state.renewalReminders
      .filter((r) => r.entityType === 'Contacto' || vehicleIdSet.has(r.entityId))
      .map((r) => {
        const computed = computeRenewalStatus(r);
        const target =
          r.entityType === 'Vehículo'
            ? state.vehicles.find((v) => v.id === r.entityId)?.code || r.entityId
            : state.contacts.find((c) => c.id === r.entityId)?.name || r.entityId;
        return {
          id: r.id,
          kind: 'Renovación' as const,
          title: r.renewalType,
          targetLabel: `${r.entityType}: ${target}`,
          vehicleId: r.entityType === 'Vehículo' ? r.entityId : undefined,
          status: computed.status,
          dueLabel: formatDate(r.dueDate),
        };
      });

    return [...service, ...renewals]
      .filter((item) => item.status === 'Vencido' || item.status === 'Próximo')
      .sort((a, b) => Number(b.status === 'Vencido') - Number(a.status === 'Vencido'));
  }, [state.serviceReminders, state.renewalReminders, state.vehicles, state.contacts, vehicleIdSet, state.settings.distanceUnit]);

  const statusBreakdown = useMemo(() => {
    const counts = {
      Activo: 0,
      'En taller': 0,
      'Fuera de servicio': 0,
      Inactivo: 0,
      Vendido: 0,
    };
    filteredVehicles.forEach((v) => {
      counts[v.status] += 1;
    });
    return counts;
  }, [filteredVehicles]);

  const totalMaintenanceCost = filteredWorkOrders
    .filter((order) => order.status !== 'Cancelada')
    .reduce((total, order) => total + computeWorkOrderTotals(order).total, 0);

  const costTrendData = useMemo(() => {
    const months = new Map<string, { mantenimiento: number; combustible: number }>();
    function monthFor(date: string) {
      const key = date.slice(0, 7);
      let month = months.get(key);
      if (!month) {
        month = { mantenimiento: 0, combustible: 0 };
        months.set(key, month);
      }
      return month;
    }

    for (const order of filteredWorkOrders) {
      if (order.status !== 'Cancelada') {
        monthFor(order.createdAt).mantenimiento += computeWorkOrderTotals(order).total;
      }
    }
    for (const entry of state.fuelEntries) {
      if (vehicleIdSet.has(entry.vehicleId)) monthFor(entry.date).combustible += entry.totalCost;
    }

    const monthLabel = new Intl.DateTimeFormat('es-PA', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([key, totals]) => ({
      label: monthLabel.format(new Date(`${key}-01T00:00:00Z`)),
      ...totals,
    }));
  }, [filteredWorkOrders, state.fuelEntries, vehicleIdSet]);

  const lowStockParts = useMemo(
    () => state.parts.filter((p) => p.quantityOnHand <= p.reorderPoint),
    [state.parts]
  );

  const recentMeters = useMemo(
    () =>
      state.meterReadings
        .filter((m) => vehicleIdSet.has(m.vehicleId) && !m.voided)
        .slice(0, 6),
    [state.meterReadings, vehicleIdSet]
  );

  const stoppedCount = new Set(state.downtimeEvents
    .filter((event) => event.status === 'Activo' && vehicleIdSet.has(event.vehicleId))
    .map((event) => event.vehicleId)).size;
  const criticalWorkOrders = activeWorkOrders.filter((order) => order.priority === 'Crítica');
  const overduePm = reminderItems.filter((item) => item.kind === 'Mantenimiento' && item.status === 'Vencido');
  const upcomingPm = reminderItems.filter((item) => item.kind === 'Mantenimiento' && item.status === 'Próximo');
  const indicators = [
    { label: 'Equipos detenidos', value: stoppedCount, detail: `${filteredVehicles.length} equipos en la vista`, icon: Truck, iconClass: 'bg-red-50 text-red-700', section: 'operations' },
    { label: 'OT críticas', value: criticalWorkOrders.length, detail: `${activeWorkOrders.length} órdenes activas`, icon: AlertTriangle, iconClass: 'bg-orange-50 text-orange-700', section: 'work-orders' },
    { label: 'PM vencidos', value: overduePm.length, detail: `${upcomingPm.length} próximos`, icon: CalendarClock, iconClass: 'bg-amber-100 text-amber-800', section: 'reminders' },
    { label: 'Stock bajo', value: lowStockParts.length, detail: 'Inventario general', icon: Package, iconClass: 'bg-blue-50 text-blue-700', section: 'parts' },
  ] as const;

  return (
    <div className="vektor-dashboard space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-blue-800">{state.settings.projectCode} · {state.settings.currency}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {activeProfile.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate({ section: 'reports' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <BarChart3 className="h-4 w-4" /> Reportes
          </button>
          {can('workorder:manage') && (
            <button type="button" onClick={onCreateWorkOrder} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" /> Nueva orden
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar vista de panel"
            value={activeProfile.id}
            onChange={(e) => selectDashboardProfile(e.target.value)}
            className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            {state.settings.dashboardProfiles.map((prof) => (
              <option key={prof.id} value={prof.id}>
                {prof.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por grupo de flota"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value as 'Todos' | FleetGroup)}
            className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g === 'Todos' ? 'Todos los grupos' : g}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Personalizar widgets
          </button>
      </div>

      {isVisible('kpi_strip') && (
        <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-2.5 bg-transparent !shadow-none xl:grid-cols-4">
          {indicators.map(({ label, value, detail, icon: Icon, iconClass, section }) => (
            <button key={label} type="button" onClick={() => onNavigate({ section })}
              className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-300 sm:flex-row sm:gap-3 sm:p-4">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconClass}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-600">{label}</span>
                <strong className="my-0.5 block text-3xl leading-tight tabular-nums text-slate-900">{value}</strong>
                <span className="block text-xs leading-snug text-slate-600">{detail}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      {isVisible('active_work_orders') && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Prioridades operativas</h2>
              <button
                type="button"
                onClick={() => onNavigate({ section: 'work-orders' })}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Ver todas
              </button>
            </div>
            {activeWorkOrders.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Sin órdenes activas en taller.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeWorkOrders.slice(0, 5).map((wo) => {
                  const veh = state.vehicles.find((v) => v.id === wo.vehicleId);
                  const totals = computeWorkOrderTotals(wo);
                  return (
                    <li key={wo.id} className="px-5 py-3 hover:bg-slate-50/70">
                      <button
                        type="button"
                        onClick={() => onNavigate({ section: 'work-orders', selectedWorkOrderId: wo.id })}
                        className="block w-full min-w-0 text-left"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {wo.code} · {veh?.code || wo.vehicleId}
                          </span>
                          <span className={`text-xs ${workOrderStatusTextClass(wo.status)}`}>
                            {wo.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-slate-700">
                          {wo.summary}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span className={issuePriorityTextClass(wo.priority)}>{wo.priority}</span>
                          <span className="font-mono tabular-nums text-slate-800">
                            {formatCurrency(totals.total, state.settings.currency)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-bold">Panorama de mantenimiento</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
              {([
                ['Abiertas', 'Abierta', 'bg-blue-50 text-blue-800'],
                ['En curso', 'En progreso', 'bg-sky-50 text-sky-800'],
                ['En espera', 'Esperando repuestos', 'bg-amber-50 text-amber-800'],
                ['Completadas', 'Completada', 'bg-emerald-50 text-emerald-800'],
              ] as const).map(([label, status, tone]) => (
                <div key={status} className={`rounded-lg px-2.5 py-3 ${tone}`}>
                  <strong className="block text-xl tabular-nums">{filteredWorkOrders.filter((order) => order.status === status).length}</strong>
                  <span className="text-xs font-medium">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="mr-1 text-xs font-semibold text-slate-600">{ROLE_LABELS[state.settings.activeRole].label}</span>
        {ROLE_QUICK_ACTIONS[state.settings.activeRole].map((action) => (
          <button key={action.label} type="button" onClick={() => onNavigate({ section: action.section })}
            className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-800 hover:bg-slate-50">
            {action.label}
          </button>
        ))}
      </div>

      {/* Primary Row: Cost Chart + Fleet Status */}
      {(isVisible('cost_chart') || isVisible('fleet_status')) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {isVisible('cost_chart') && (
            <section className="rounded-xl border border-slate-200 bg-white min-w-0 p-4 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Costos registrados
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    OT por mes de creación y combustible en {state.settings.currency}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ section: 'reports' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Ver reporte <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600" aria-label="Series de costos">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#086e79]" aria-hidden="true" /> Combustible</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#536a84]" aria-hidden="true" /> Mantenimiento</span>
              </div>
              {costTrendData.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-600">Sin costos registrados para este grupo.</p>
              ) : (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costTrendData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      width={42}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => new Intl.NumberFormat('es-PA', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}
                    />
                    <Tooltip
                      formatter={(value) =>
                        formatCurrency(Number(value ?? 0), state.settings.currency)
                      }
                      contentStyle={{
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="combustible" name="Combustible" fill="#086e79" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="combustible" position="insideTop" fill="#fff" fontSize={11} formatter={(value) => Number(value) > 0 ? Math.round(Number(value)).toLocaleString('es-PA') : ''} />
                    </Bar>
                    <Bar dataKey="mantenimiento" name="Mantenimiento" fill="#536a84" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="mantenimiento" position="insideTop" fill="#fff" fontSize={11} formatter={(value) => Number(value) > 0 ? Math.round(Number(value)).toLocaleString('es-PA') : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </section>
          )}

          {isVisible('fleet_status') && (
            <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Estado de Vehículos</h2>
                  <button
                    type="button"
                    onClick={() => onNavigate({ section: 'vehicles' })}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    Ver todos
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Distribución operativa actual ({filteredVehicles.length} unidades)
                </p>

                <div className="mt-5 space-y-3.5">
                  {(
                    [
                      ['Activo', statusBreakdown.Activo, 'bg-emerald-600'],
                      ['En taller', statusBreakdown['En taller'], 'bg-amber-500'],
                      ['Fuera de servicio', statusBreakdown['Fuera de servicio'], 'bg-red-600'],
                      ['Inactivo', statusBreakdown.Inactivo, 'bg-slate-400'],
                      ['Vendido', statusBreakdown.Vendido, 'bg-slate-300'],
                    ] as const
                  ).map(([statusLabel, count, barClass]) => {
                    const pct =
                      filteredVehicles.length > 0
                        ? Math.round((count / filteredVehicles.length) * 100)
                        : 0;
                    return (
                      <div key={statusLabel}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={vehicleStatusTextClass(statusLabel)}>{statusLabel}</span>
                          <span className="font-mono tabular-nums text-slate-700">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                Mantenimiento acumulado:{' '}
                <span className="font-mono font-medium tabular-nums text-slate-800">
                  {formatCurrency(totalMaintenanceCost, state.settings.currency)}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Operational Action Queues */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isVisible('priority_issues') && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Incidencias Prioritarias</h2>
              <button
                type="button"
                onClick={() => onNavigate({ section: 'issues' })}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Gestionar incidencias
              </button>
            </div>
            {filteredIssues.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                No hay incidencias abiertas para el grupo seleccionado.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredIssues.slice(0, 5).map((iss) => {
                  const veh = state.vehicles.find((v) => v.id === iss.vehicleId);
                  return (
                    <li
                      key={iss.id}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onNavigate({ section: 'issues', initialFilter: iss.code })}
                          className="block max-w-full truncate text-left text-sm font-medium text-slate-900 hover:text-blue-700"
                        >
                          {iss.code} · {iss.title}
                        </button>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {veh ? `${veh.code} ${veh.name}` : iss.vehicleId} · {iss.source} · {formatDate(iss.reportedAt)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className={issuePriorityTextClass(iss.priority)}>{iss.priority}</div>
                        <div className="text-slate-500">{iss.status}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {isVisible('overdue_reminders') && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Recordatorios Vencidos y Próximos
              </h2>
              <button
                type="button"
                onClick={() => onNavigate({ section: 'reminders' })}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Abrir recordatorios
              </button>
            </div>
            {reminderItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Todos los programas preventivos y renovaciones están al día.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reminderItems.slice(0, 5).map((rem) => (
                  <li
                    key={rem.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onNavigate({ section: 'reminders' })}
                        className="block max-w-full truncate text-left text-sm font-medium text-slate-900 hover:text-blue-700"
                      >
                        {rem.title}
                      </button>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {rem.targetLabel} · {rem.kind}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <div className={reminderStatusTextClass(rem.status)}>{rem.status}</div>
                      <div className="font-mono tabular-nums text-slate-500">{rem.dueLabel}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Secondary Row: Work Orders, Low Stock, Latest Meters */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {isVisible('low_stock_parts') && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Alertas de Repuestos</h2>
              <button
                type="button"
                onClick={() => onNavigate({ section: 'parts' })}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Inventario
              </button>
            </div>
            {lowStockParts.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Todos los repuestos superan su punto de reorden.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {lowStockParts.map((part) => (
                  <li key={part.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="max-w-full truncate text-xs font-medium text-slate-900">{part.name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {part.sku} · Mín. {part.reorderPoint}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs font-semibold tabular-nums text-red-700">
                        {part.quantityOnHand} uds
                      </div>
                      <div className="text-[11px] text-slate-500">Stock bajo</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isVisible('recent_meters') && (
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Últimas Lecturas (Horómetro / Odómetro)</h2>
              <button
                type="button"
                onClick={() => onNavigate({ section: 'vehicles' })}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Flota
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentMeters.map((m) => {
                const veh = state.vehicles.find((v) => v.id === m.vehicleId);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            section: 'vehicle-detail',
                            selectedVehicleId: m.vehicleId,
                            selectedVehicleTab: 'odometro',
                          })
                        }
                        className="max-w-full truncate text-xs font-medium text-slate-900 hover:text-blue-700"
                      >
                        {veh ? `${veh.code} · ${veh.make} ${veh.model}` : m.vehicleId}
                      </button>
                      <div className="text-[11px] text-slate-500">
                        {m.source} · {formatDate(m.date)}
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs font-medium tabular-nums text-slate-900 whitespace-nowrap">
                      {typeof m.valueHrs === 'number' && m.valueHrs > 0 && (
                        <div>{formatHours(m.valueHrs)}</div>
                      )}
                      {m.valueKm > 0 && (
                        <div className="text-[11px] text-slate-500">
                          {formatDistance(m.valueKm, state.settings.distanceUnit)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Customize Dashboard Modal (Reconstructs Fleetio Make a Copy + Add/Toggle Widgets) */}
      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Personalizar Panel Operativo"
        subtitle={
          activeProfile.isStandard
            ? 'La vista estándar está protegida (comportamiento Fleetio). Duplica la vista para activar o desactivar widgets.'
            : `Editando widgets de "${activeProfile.name}"`
        }
        footer={
          <button
            type="button"
            onClick={() => setCustomizeOpen(false)}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Listo
          </button>
        }
      >
        <div className="space-y-5">
          {activeProfile.isStandard && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-800">
                Crear copia editable del panel estándar
              </p>
              <div className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="Ej. Panel Taller Norte"
                  className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    duplicateDashboardView(copyName);
                    setCopyName('');
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar vista
                </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-700">Widgets visibles</h3>
            <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
              {activeProfile.widgets.map((widget) => (
                <li key={widget.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-800">{widget.label}</span>
                  <button
                    type="button"
                    disabled={activeProfile.isStandard}
                    onClick={() => toggleDashboardWidget(widget.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      activeProfile.isStandard
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : widget.visible
                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {widget.visible ? 'Visible' : 'Oculto'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};
