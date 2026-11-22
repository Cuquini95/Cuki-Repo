import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { FailureCategory, IssuePriority, RouteState, WorkOrderStatusKey } from '../types/fleet';
import {
  computeWorkOrderTotals,
  formatCurrency,
  formatDate,
  formatDistance,
  formatHours,
  issuePriorityTextClass,
  todayIso,
  workOrderStatusTextClass,
} from '../utils/format';

interface WorkOrdersViewProps {
  openCreateSignal: number;
  onConsumeCreateSignal: () => void;
  selectedWorkOrderId?: string;
  onSelectWorkOrder: (id?: string) => void;
  onNavigate: (next: RouteState) => void;
}

const STATUS_TABS: ('Todas' | WorkOrderStatusKey)[] = [
  'Todas',
  'Abierta',
  'En progreso',
  'Esperando repuestos',
  'Completada',
  'Cancelada',
];

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  selectedWorkOrderId,
  openCreateSignal,
  onConsumeCreateSignal,
  onSelectWorkOrder,
  onNavigate,
}) => {
  const {
    state,
    can,
    createWorkOrder,
    updateWorkOrder,
    completeWorkOrder,
    reopenWorkOrder,
    cancelWorkOrder,
  } = useFleet();

  const [statusFilter, setStatusFilter] = useState<'Todas' | WorkOrderStatusKey>('Todas');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (openCreateSignal) {
      if (can('workorder:manage')) setCreateOpen(true);
      onConsumeCreateSignal();
    }
  }, [can, openCreateSignal, onConsumeCreateSignal]);

  // Create WO Draft
  const [newVehicleId, setNewVehicleId] = useState(state.vehicles[0]?.id || '');
  const [newSummary, setNewSummary] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<IssuePriority>('Media');
  const [newCategory, setNewCategory] = useState<FailureCategory>('Hidráulico');
  const [newVendorId, setNewVendorId] = useState(state.vendors[0]?.id || '');
  const [newScheduledDate, setNewScheduledDate] = useState(todayIso());

  // Line Item adders inside Detail
  const technicians = state.contacts.filter(
    (c) => c.role === 'Mecánico' || c.role === 'Jefe de Taller'
  );
  const [laborTask, setLaborTask] = useState('');
  const [laborTechId, setLaborTechId] = useState(technicians[0]?.id || '');
  const [laborHours, setLaborHours] = useState(1.5);
  const [selectedPartId, setSelectedPartId] = useState(state.parts[0]?.id || '');
  const [partQty, setPartQty] = useState(1);

  const selectedWo = state.workOrders.find((w) => w.id === selectedWorkOrderId);

  useEffect(() => {
    if (selectedWorkOrderId && !selectedWo) {
      onSelectWorkOrder(undefined);
    }
  }, [selectedWorkOrderId, selectedWo, onSelectWorkOrder]);

  const filtered = useMemo(
    () =>
      state.workOrders.filter((w) =>
        statusFilter === 'Todas' ? true : w.status === statusFilter
      ),
    [state.workOrders, statusFilter]
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) return;
    const veh = state.vehicles.find((v) => v.id === newVehicleId);
    const res = createWorkOrder({
      vehicleId: newVehicleId,
      status: 'Abierta',
      priority: newPriority,
      failureCategory: newCategory,
      progress: 0,
      vendorId: newVendorId || undefined,
      summary: newSummary.trim(),
      description: newDesc.trim() || 'Orden generada desde módulo de mantenimiento.',
      scheduledDate: newScheduledDate,
      odometerKm: veh?.odometerKm || 0,
      horometerHrs: veh?.horometerHrs || undefined,
      linkedIssueIds: [],
      linkedReminderIds: [],
      laborItems: [],
      partItems: [],
      discountAmount: 0,
      taxPercent: 7,
    });
    if (res.ok && res.data) {
      setCreateOpen(false);
      setNewSummary('');
      setNewDesc('');
      onSelectWorkOrder(res.data.id);
    }
  };

  // Detail / Editor View of a Work Order
  if (selectedWo) {
    const veh = state.vehicles.find((v) => v.id === selectedWo.vehicleId);
    const totals = computeWorkOrderTotals(selectedWo);
    const statusConfig = state.settings.workOrderStatuses.find((s) => s.key === selectedWo.status);
    const isLocked = Boolean(statusConfig?.marksCompleted) || selectedWo.status === 'Cancelada';
    const editable = !isLocked && can('workorder:manage');

    const vehicleOpenIssues = state.issues.filter(
      (i) =>
        i.vehicleId === selectedWo.vehicleId &&
        (i.status === 'Abierta' || i.status === 'En atención' || selectedWo.linkedIssueIds.includes(i.id))
    );
    const vehicleReminders = state.serviceReminders.filter(
      (r) => r.vehicleId === selectedWo.vehicleId
    );

    const handleAddLabor = (e: React.FormEvent) => {
      e.preventDefault();
      if (!laborTask.trim()) return;
      const tech = state.contacts.find((c) => c.id === laborTechId);
      updateWorkOrder(selectedWo.id, {
        laborItems: [
          ...selectedWo.laborItems,
          {
            id: `lab-${Date.now()}`,
            taskName: laborTask.trim(),
            technicianId: laborTechId,
            hours: Number(laborHours),
            hourlyRate: tech?.hourlyRate || 520,
          },
        ],
      });
      setLaborTask('');
    };

    const handleAddPart = (e: React.FormEvent) => {
      e.preventDefault();
      const part = state.parts.find((p) => p.id === selectedPartId);
      if (!part || partQty <= 0) return;
      updateWorkOrder(selectedWo.id, {
        partItems: [
          ...selectedWo.partItems,
          {
            id: `pi-${Date.now()}`,
            partId: part.id,
            quantity: Number(partQty),
            unitCost: part.unitCost,
          },
        ],
      });
      setPartQty(1);
    };

    const toggleLinkedIssue = (issueId: string) => {
      if (!editable) return;
      const exists = selectedWo.linkedIssueIds.includes(issueId);
      updateWorkOrder(selectedWo.id, {
        linkedIssueIds: exists
          ? selectedWo.linkedIssueIds.filter((id) => id !== issueId)
          : [...selectedWo.linkedIssueIds, issueId],
      });
    };

    const toggleLinkedReminder = (remId: string) => {
      if (!editable) return;
      const exists = selectedWo.linkedReminderIds.includes(remId);
      updateWorkOrder(selectedWo.id, {
        linkedReminderIds: exists
          ? selectedWo.linkedReminderIds.filter((id) => id !== remId)
          : [...selectedWo.linkedReminderIds, remId],
      });
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => onSelectWorkOrder(undefined)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a Órdenes de Trabajo
            </button>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {selectedWo.code} · {selectedWo.summary}
              </h1>
              <span className={`text-xs ${workOrderStatusTextClass(selectedWo.status)}`}>
                {selectedWo.status}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <button
                type="button"
                onClick={() =>
                  onNavigate({
                    section: 'vehicle-detail',
                    selectedVehicleId: selectedWo.vehicleId,
                    selectedVehicleTab: 'servicio',
                  })
                }
                className="font-medium text-blue-700 hover:underline"
              >
                {veh ? `${veh.code} · ${veh.name}` : selectedWo.vehicleId}
              </button>{' '}
              · {selectedWo.failureCategory}
              {selectedWo.horometerHrs ? ` · ${formatHours(selectedWo.horometerHrs)}` : ''}
              {selectedWo.odometerKm > 0
                ? ` · ${formatDistance(selectedWo.odometerKm, state.settings.distanceUnit)}`
                : ''}{' '}
              · Programada {formatDate(selectedWo.scheduledDate)}
              {selectedWo.completedAt ? ` · Completada ${formatDate(selectedWo.completedAt)}` : ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLocked && can('workorder:manage') && (
              <>
                <select
                  aria-label="Cambiar estado de orden"
                  value={selectedWo.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as WorkOrderStatusKey;
                    if (nextStatus === 'Completada') {
                      completeWorkOrder(selectedWo.id);
                    } else if (nextStatus === 'Cancelada') {
                      cancelWorkOrder(selectedWo.id);
                    } else {
                      updateWorkOrder(selectedWo.id, { status: nextStatus });
                    }
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                >
                  {state.settings.workOrderStatuses.map((s) => (
                    <option key={s.key} value={s.key}>
                      Estado: {s.key}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => completeWorkOrder(selectedWo.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Completar OT
                </button>
              </>
            )}

            {selectedWo.status === 'Completada' && can('workorder:reopen') && (
              <button
                type="button"
                onClick={() => reopenWorkOrder(selectedWo.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir OT
              </button>
            )}
          </div>
        </div>

        {isLocked && (
          <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-100/80 px-4 py-2.5 text-xs text-slate-700">
            <Lock className="h-4 w-4 shrink-0 text-slate-500" />
            <span>
              Esta orden está en estado <strong>{selectedWo.status}</strong> y bloqueada contra edición
              {selectedWo.inventoryDeducted ? ' (repuestos ya descontados del inventario).' : '.'}
            </span>
          </div>
        )}

        {/* Progress Control Bar (Hermes Panama: Mecánico & Jefatura de Taller) */}
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-900">Avance físico de OT</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-blue-700">
                {selectedWo.progress}%
              </span>
            </div>
            {!isLocked && can('workorder:progress') && (
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 25, 50, 75, 90, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => updateWorkOrder(selectedWo.id, { progress: pct })}
                    className={`rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                      selectedWo.progress === pct
                        ? 'bg-blue-700 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-700 transition-all"
              style={{ width: `${selectedWo.progress}%` }}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 cols: Line items + Linked items */}
          <div className="space-y-6 lg:col-span-2">
            {/* Labor Items */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">Mano de Obra</h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th className="px-5 py-2 font-medium">Tarea</th>
                    <th className="px-5 py-2 font-medium">Técnico</th>
                    <th className="px-5 py-2 text-right font-medium">Horas</th>
                    <th className="px-5 py-2 text-right font-medium">Tarifa/h</th>
                    <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                    {editable && <th className="w-10 px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedWo.laborItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        Sin líneas de mano de obra registradas.
                      </td>
                    </tr>
                  ) : (
                    selectedWo.laborItems.map((lab) => {
                      const tech = state.contacts.find((c) => c.id === lab.technicianId);
                      return (
                        <tr key={lab.id}>
                          <td className="px-5 py-2.5 font-medium text-slate-900">{lab.taskName}</td>
                          <td className="px-5 py-2.5 text-slate-600">{tech?.name || '—'}</td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums">{lab.hours}</td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency(lab.hourlyRate, state.settings.currency)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-slate-900">
                            {formatCurrency(lab.hours * lab.hourlyRate, state.settings.currency)}
                          </td>
                          {editable && (
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                aria-label="Quitar línea de mano de obra"
                                onClick={() =>
                                  updateWorkOrder(selectedWo.id, {
                                    laborItems: selectedWo.laborItems.filter((l) => l.id !== lab.id),
                                  })
                                }
                                className="text-slate-400 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {editable && (
                <form
                  onSubmit={handleAddLabor}
                  className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs"
                >
                  <input
                    type="text"
                    required
                    value={laborTask}
                    onChange={(e) => setLaborTask(e.target.value)}
                    placeholder="Descripción de tarea..."
                    className="h-8 flex-1 min-w-[180px] rounded border border-slate-300 bg-white px-2.5"
                  />
                  <select
                    value={laborTechId}
                    onChange={(e) => setLaborTechId(e.target.value)}
                    className="h-8 rounded border border-slate-300 bg-white px-2"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (${t.hourlyRate || 520}/h)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={laborHours}
                    onChange={(e) => setLaborHours(Number(e.target.value))}
                    className="h-8 w-20 rounded border border-slate-300 bg-white px-2 font-mono"
                  />
                  <button
                    type="submit"
                    className="h-8 rounded bg-slate-900 px-3 font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    + Agregar
                  </button>
                </form>
              )}
            </section>

            {/* Parts Line Items */}
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">Repuestos de Inventario</h2>
                <span className="text-xs text-slate-500">
                  Se descuentan automáticamente al completar la orden
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th className="px-5 py-2 font-medium">Repuesto (SKU)</th>
                    <th className="px-5 py-2 text-right font-medium">Stock Actual</th>
                    <th className="px-5 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-5 py-2 text-right font-medium">Costo Unit.</th>
                    <th className="px-5 py-2 text-right font-medium">Subtotal</th>
                    {editable && <th className="w-10 px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedWo.partItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        Sin repuestos asignados.
                      </td>
                    </tr>
                  ) : (
                    selectedWo.partItems.map((pi) => {
                      const part = state.parts.find((p) => p.id === pi.partId);
                      const insufficient = !selectedWo.inventoryDeducted && part && part.quantityOnHand < pi.quantity;
                      return (
                        <tr key={pi.id}>
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-slate-900">{part?.name || pi.partId}</div>
                            <div className="font-mono text-[11px] text-slate-500">{part?.sku}</div>
                          </td>
                          <td
                            className={`px-5 py-2.5 text-right font-mono tabular-nums ${
                              insufficient ? 'font-semibold text-red-700' : 'text-slate-600'
                            }`}
                          >
                            {part ? `${part.quantityOnHand} uds` : '—'}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-900">
                            {pi.quantity}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono tabular-nums text-slate-600">
                            {formatCurrency(pi.unitCost, state.settings.currency)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono font-medium tabular-nums text-slate-900">
                            {formatCurrency(pi.quantity * pi.unitCost, state.settings.currency)}
                          </td>
                          {editable && (
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                aria-label="Quitar repuesto"
                                onClick={() =>
                                  updateWorkOrder(selectedWo.id, {
                                    partItems: selectedWo.partItems.filter((p) => p.id !== pi.id),
                                  })
                                }
                                className="text-slate-400 hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {editable && (
                <form
                  onSubmit={handleAddPart}
                  className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs"
                >
                  <select
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                    className="h-8 flex-1 min-w-[220px] rounded border border-slate-300 bg-white px-2"
                  >
                    {state.parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name} (Stock: {p.quantityOnHand})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={partQty}
                    onChange={(e) => setPartQty(Number(e.target.value))}
                    className="h-8 w-20 rounded border border-slate-300 bg-white px-2 font-mono"
                  />
                  <button
                    type="submit"
                    className="h-8 rounded bg-slate-900 px-3 font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    + Agregar Repuesto
                  </button>
                </form>
              )}
            </section>

            {/* Linked Issues & Service Reminders */}
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Incidencias y Recordatorios a Resolver al Completar
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 text-xs">
                <div>
                  <div className="font-medium text-slate-700">Incidencias de la unidad</div>
                  {vehicleOpenIssues.length === 0 ? (
                    <p className="mt-2 text-slate-400">Sin incidencias pendientes para esta unidad.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {vehicleOpenIssues.map((iss) => (
                        <li key={iss.id}>
                          <label className="flex items-start gap-2 text-slate-700">
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={selectedWo.linkedIssueIds.includes(iss.id)}
                              onChange={() => toggleLinkedIssue(iss.id)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                            />
                            <span>
                              <span className="font-mono font-medium">{iss.code}</span> · {iss.title}{' '}
                              <span className="text-slate-400">({iss.status})</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="font-medium text-slate-700">Recordatorios preventivos</div>
                  {vehicleReminders.length === 0 ? (
                    <p className="mt-2 text-slate-400">Sin recordatorios asignados a esta unidad.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {vehicleReminders.map((rem) => (
                        <li key={rem.id}>
                          <label className="flex items-start gap-2 text-slate-700">
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={selectedWo.linkedReminderIds.includes(rem.id)}
                              onChange={() => toggleLinkedReminder(rem.id)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                            />
                            <span>
                              {rem.serviceTask}{' '}
                              <span className="font-mono text-slate-400">
                                (Próx. {rem.nextDueKm.toLocaleString('es-MX')} km)
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Col: Cost Summary */}
          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Resumen Financiero</h2>
              <div className="mt-4 space-y-2.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Mano de Obra</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(totals.laborSubtotal, state.settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Repuestos</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(totals.partsSubtotal, state.settings.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Descuento ({state.settings.currency})</span>
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      value={selectedWo.discountAmount}
                      onChange={(e) =>
                        updateWorkOrder(selectedWo.id, { discountAmount: Number(e.target.value) })
                      }
                      className="h-7 w-24 rounded border border-slate-300 px-2 text-right font-mono"
                    />
                  ) : (
                    <span className="font-mono tabular-nums">
                      -{formatCurrency(selectedWo.discountAmount, state.settings.currency)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ITBMS ({selectedWo.taxPercent}%)</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(totals.taxAmount, state.settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
                  <span>Costo Total</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(totals.total, state.settings.currency)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">Detalles de Taller</h2>
              <dl className="mt-3 space-y-2.5">
                <div>
                  <dt className="text-slate-500">Taller / Proveedor</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {state.vendors.find((v) => v.id === selectedWo.vendorId)?.name || 'Interno'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Categoría de Avería</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{selectedWo.failureCategory}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Prioridad</dt>
                  <dd className={`mt-0.5 ${issuePriorityTextClass(selectedWo.priority)}`}>
                    {selectedWo.priority}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Descripción</dt>
                  <dd className="mt-0.5 text-slate-700">{selectedWo.description}</dd>
                </div>
              </dl>
            </section>

            {/* Bitácora statusLog */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 text-xs">
              <h2 className="text-sm font-semibold text-slate-900">
                Bitácora de Cambios ({selectedWo.statusLog.length})
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {selectedWo.statusLog.map((entry) => (
                  <li key={entry.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {entry.field}: {entry.oldValue} → {entry.newValue}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {entry.changedBy} ({entry.role}) ·{' '}
                      <span className="font-mono">{entry.timestamp}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Órdenes de Trabajo</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Ciclo de mantenimiento correctivo y preventivo con control de mano de obra, consumo de inventario y cierre atómico.
          </p>
        </div>
        <button
          type="button"
          disabled={!can('workorder:manage')}
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nueva Orden de Trabajo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1 w-fit">
        {STATUS_TABS.map((tab) => {
          const count =
            tab === 'Todas'
              ? state.workOrders.length
              : state.workOrders.filter((w) => w.status === tab).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab} <span className="ml-1 font-mono text-[11px] text-slate-400">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
              <th className="px-4 py-2.5 font-medium">Folio</th>
              <th className="px-4 py-2.5 font-medium">Vehículo</th>
              <th className="px-4 py-2.5 font-medium">Resumen</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Prioridad</th>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 text-right font-medium">Costo Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((wo) => {
              const veh = state.vehicles.find((v) => v.id === wo.vehicleId);
              const total = computeWorkOrderTotals(wo).total;
              return (
                <tr key={wo.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectWorkOrder(wo.id)}
                      className="hover:underline"
                    >
                      {wo.code}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                    {veh ? `${veh.code} · ${veh.make}` : wo.vehicleId}
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectWorkOrder(wo.id)}
                      className="block truncate text-left font-medium text-slate-900 hover:text-blue-700"
                    >
                      {wo.summary}
                    </button>
                    <div className="text-[11px] text-slate-500">
                      {wo.failureCategory} · {wo.laborItems.length} labor · {wo.partItems.length} repuestos
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={workOrderStatusTextClass(wo.status)}>{wo.status}</div>
                    <div className="font-mono text-[11px] text-slate-500">{wo.progress}% avance</div>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${issuePriorityTextClass(wo.priority)}`}>
                    {wo.priority}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                    {formatDate(wo.completedAt || wo.scheduledDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-900 whitespace-nowrap">
                    {formatCurrency(total, state.settings.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Work Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Crear Nueva Orden de Trabajo"
        subtitle="La unidad cambiará automáticamente a estado En taller."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-wo-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Crear y Abrir Editor
            </button>
          </>
        }
      >
        <form id="create-wo-form" onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Vehículo *</label>
              <select
                value={newVehicleId}
                onChange={(e) => setNewVehicleId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} · {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Taller / Proveedor</label>
              <select
                value={newVendorId}
                onChange={(e) => setNewVendorId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Prioridad</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as IssuePriority)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Crítica">Crítica</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Categoría de avería</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as FailureCategory)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {(
                  [
                    'Hidráulico',
                    'Motor y Tren Motriz',
                    'Frenos y Neumático',
                    'Eléctrico',
                    'Tren de Rodaje',
                    'Llantas',
                    'PM Preventivo',
                    'Cabina y HSE',
                  ] as FailureCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fecha programada</label>
              <input
                type="date"
                value={newScheduledDate}
                onChange={(e) => setNewScheduledDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Resumen del trabajo *</label>
            <input
              type="text"
              required
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Ej. Reparación de válvula neumática y prueba de presión"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Descripción</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
