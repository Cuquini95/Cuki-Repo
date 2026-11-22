import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Copy, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ROLE_LABELS, useFleet } from '../store/FleetContext';
import { FleetGroup, RouteState, UserRole } from '../types/fleet';
import {
  computeMechanicalAvailability,
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
  onNavigate: (next: RouteState) => void;
}

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

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    state,
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
      ),
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
      .sort((a, b) => (a.status === 'Vencido' ? -1 : b.status === 'Vencido' ? 1 : 0));
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

  const totalFuelCost = useMemo(
    () =>
      state.fuelEntries
        .filter((f) => vehicleIdSet.has(f.vehicleId))
        .reduce((acc, f) => acc + f.totalCost, 0),
    [state.fuelEntries, vehicleIdSet]
  );

  const totalMaintenanceCost = useMemo(
    () =>
      filteredWorkOrders
        .filter((w) => w.status !== 'Cancelada')
        .reduce((acc, w) => acc + computeWorkOrderTotals(w).total, 0),
    [filteredWorkOrders]
  );

  const avgEfficiency = useMemo(() => {
    const valid = state.fuelEntries.filter(
      (f) => vehicleIdSet.has(f.vehicleId) && typeof f.kmPerLiter === 'number' && f.kmPerLiter > 0
    );
    if (valid.length === 0) return 0;
    return valid.reduce((acc, f) => acc + (f.kmPerLiter || 0), 0) / valid.length;
  }, [state.fuelEntries, vehicleIdSet]);

  const costTrendData = useMemo(() => {
    const months = [
      { key: '2026-08', label: 'Ago', mantenimiento: 6200, combustible: 9850 },
      { key: '2026-09', label: 'Sep', mantenimiento: 5400, combustible: 10420 },
      { key: '2026-10', label: 'Oct', mantenimiento: 0, combustible: 0 },
      { key: '2026-11', label: 'Nov', mantenimiento: 0, combustible: 0 },
    ];
    const scale = selectedGroup === 'Todos' ? 1 : Math.max(0.25, filteredVehicles.length / Math.max(1, state.vehicles.length));
    months[0].mantenimiento = Math.round(months[0].mantenimiento * scale);
    months[0].combustible = Math.round(months[0].combustible * scale);
    months[1].mantenimiento = Math.round(months[1].mantenimiento * scale);
    months[1].combustible = Math.round(months[1].combustible * scale);

    filteredWorkOrders
      .filter((w) => w.status !== 'Cancelada')
      .forEach((wo) => {
        const bucket = months.find((m) => wo.createdAt.startsWith(m.key));
        if (bucket) bucket.mantenimiento += Math.round(computeWorkOrderTotals(wo).total);
      });

    state.fuelEntries
      .filter((f) => vehicleIdSet.has(f.vehicleId))
      .forEach((f) => {
        const bucket = months.find((m) => f.date.startsWith(m.key));
        if (bucket) bucket.combustible += Math.round(f.totalCost);
      });

    return months;
  }, [filteredWorkOrders, state.fuelEntries, vehicleIdSet, selectedGroup, filteredVehicles.length, state.vehicles.length]);

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

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {activeProfile.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Supervisión consolidada de disponibilidad, mantenimiento preventivo, incidencias y costos operativos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar vista de panel"
            value={activeProfile.id}
            onChange={(e) => selectDashboardProfile(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
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
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
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
      </div>

      {/* Role-Aware Quick Access Bar */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-600">
          <span className="font-mono font-semibold text-slate-900">
            {ROLE_LABELS[state.settings.activeRole].positionCode}
          </span>{' '}
          · <span className="font-medium text-slate-900">{ROLE_LABELS[state.settings.activeRole].label}</span>{' '}
          <span className="hidden md:inline text-slate-500">
            — {ROLE_LABELS[state.settings.activeRole].summary}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {ROLE_QUICK_ACTIONS[state.settings.activeRole].map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={() => onNavigate({ section: act.section })}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      {isVisible('kpi_strip') && (
        <section
          aria-label="Indicadores principales"
          className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
        >
          <button
            type="button"
            onClick={() => onNavigate({ section: 'operations' })}
            className="flex flex-col justify-between p-5 text-left transition-colors hover:bg-slate-50/70"
          >
            <span className="text-xs font-medium text-slate-500">Disponibilidad Mecánica</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {computeMechanicalAvailability(null, state, 240).availabilityPct.toFixed(1)}%
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                {statusBreakdown.Activo}/{filteredVehicles.length} activos
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {statusBreakdown['En taller']} en taller · {statusBreakdown['Fuera de servicio']} fuera de servicio
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ section: 'issues' })}
            className="flex flex-col justify-between p-5 text-left transition-colors hover:bg-slate-50/70"
          >
            <span className="text-xs font-medium text-slate-500">Incidencias Abiertas</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {filteredIssues.length}
              </span>
              <span className="text-xs font-medium text-red-700">
                {filteredIssues.filter((i) => i.priority === 'Crítica').length} críticas
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {filteredIssues.filter((i) => i.status === 'En atención').length} vinculadas a orden de trabajo
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ section: 'reminders' })}
            className="flex flex-col justify-between p-5 text-left transition-colors hover:bg-slate-50/70"
          >
            <span className="text-xs font-medium text-slate-500">Recordatorios Pendientes</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {reminderItems.filter((r) => r.status === 'Vencido').length}
              </span>
              <span className="text-xs font-medium text-red-700">Vencidos</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {reminderItems.filter((r) => r.status === 'Próximo').length} próximos por km o fecha
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ section: 'reports' })}
            className="flex flex-col justify-between p-5 text-left transition-colors hover:bg-slate-50/70"
          >
            <span className="text-xs font-medium text-slate-500">Gasto Operativo Acumulado</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {formatCurrency(totalFuelCost + totalMaintenanceCost, state.settings.currency)}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 tabular-nums">
              Rendimiento medio: {avgEfficiency > 0 ? `${avgEfficiency.toFixed(2)} km/L` : '—'}
            </div>
          </button>
        </section>
      )}

      {/* Primary Row: Cost Chart + Fleet Status */}
      {(isVisible('cost_chart') || isVisible('fleet_status')) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {isVisible('cost_chart') && (
            <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Tendencia de Costos Operativos
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Mantenimiento (OT) frente a combustible en {state.settings.currency}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ section: 'reports' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  Ver reporte TCO <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
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
                    <Bar dataKey="combustible" name="Combustible" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="mantenimiento" name="Mantenimiento" fill="#64748b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {isVisible('fleet_status') && (
            <section className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
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
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
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
                          onClick={() => onNavigate({ section: 'issues' })}
                          className="block truncate text-left text-sm font-medium text-slate-900 hover:text-blue-700"
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
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
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
                        className="block truncate text-left text-sm font-medium text-slate-900 hover:text-blue-700"
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isVisible('active_work_orders') && (
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Órdenes de Trabajo Activas</h2>
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
                {activeWorkOrders.map((wo) => {
                  const veh = state.vehicles.find((v) => v.id === wo.vehicleId);
                  const totals = computeWorkOrderTotals(wo);
                  return (
                    <li key={wo.id} className="px-5 py-3 hover:bg-slate-50/70">
                      <button
                        type="button"
                        onClick={() => onNavigate({ section: 'work-orders', selectedWorkOrderId: wo.id })}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {wo.code}
                          </span>
                          <span className={`text-xs ${workOrderStatusTextClass(wo.status)}`}>
                            {wo.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-slate-700">
                          {wo.summary}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{veh?.code || wo.vehicleId}</span>
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
        )}

        {isVisible('low_stock_parts') && (
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
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
                      <div className="truncate text-xs font-medium text-slate-900">{part.name}</div>
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
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
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
                        className="truncate text-xs font-medium text-slate-900 hover:text-blue-700"
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
