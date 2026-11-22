import React, { useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { RenewalReminder, RouteState, ServiceReminder } from '../types/fleet';
import {
  computeRenewalStatus,
  computeServiceReminderStatus,
  formatCurrency,
  formatDate,
  formatDistance,
  formatHours,
  reminderStatusTextClass,
  todayIso,
} from '../utils/format';

interface RemindersViewProps {
  onNavigate: (next: RouteState) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({ onNavigate }) => {
  const {
    state,
    can,
    addServiceReminder,
    snoozeServiceReminder,
    addRenewalReminder,
    completeRenewalReminder,
    createWorkOrder,
  } = useFleet();

  const [subTab, setSubTab] = useState<'service' | 'renewals'>('service');
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [createRenewalOpen, setCreateRenewalOpen] = useState(false);

  const [srvDraft, setSrvDraft] = useState({
    vehicleId: state.vehicles[0]?.id || '',
    serviceTask: '',
    intervalKm: 10000,
    intervalHrs: 250,
    intervalMonths: 3,
    soonThresholdKm: 1000,
    soonThresholdHrs: 40,
    soonThresholdDays: 14,
    lastCompletedDate: todayIso(),
    lastCompletedKm: state.vehicles[0]?.odometerKm || 0,
    lastCompletedHrs: state.vehicles[0]?.horometerHrs || 0,
  });

  const [renDraft, setRenDraft] = useState({
    entityType: 'Vehículo' as RenewalReminder['entityType'],
    entityId: state.vehicles[0]?.id || '',
    renewalType: 'Sticker HSE de Obra' as RenewalReminder['renewalType'],
    dueDate: todayIso(),
    soonThresholdDays: 15,
    costEstimate: 120,
    notes: '',
  });

  const handleScheduleWorkOrder = (rem: ServiceReminder) => {
    const veh = state.vehicles.find((v) => v.id === rem.vehicleId);
    const defaultTech = state.contacts.find(
      (c) => c.role === 'Mecánico' || c.role === 'Jefe de Taller'
    );
    const res = createWorkOrder({
      vehicleId: rem.vehicleId,
      status: 'Abierta',
      priority: 'Media',
      failureCategory: 'PM Preventivo',
      progress: 0,
      vendorId: state.vendors.find((v) => v.type === 'Taller Mecánico')?.id,
      summary: `Preventivo: ${rem.serviceTask}`,
      description: `Generada desde programa PM (${
        rem.nextDueHrs
          ? `${rem.nextDueHrs} h`
          : `${rem.nextDueKm.toLocaleString('es-PA')} km`
      } / ${rem.nextDueDate}).`,
      scheduledDate: todayIso(),
      odometerKm: veh?.odometerKm || 0,
      horometerHrs: veh?.horometerHrs || undefined,
      linkedIssueIds: [],
      linkedReminderIds: [rem.id],
      laborItems: defaultTech
        ? [
            {
              id: `lab-rem-${Date.now()}`,
              taskName: rem.serviceTask,
              technicianId: defaultTech.id,
              hours: 2.5,
              hourlyRate: defaultTech.hourlyRate || 32,
            },
          ]
        : [],
      partItems: [],
      discountAmount: 0,
      taxPercent: 7,
    });
    if (res.ok && res.data) {
      onNavigate({ section: 'work-orders', selectedWorkOrderId: res.data.id });
    }
  };

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvDraft.serviceTask.trim()) return;
    const res = addServiceReminder({
      ...srvDraft,
      intervalKm: Number(srvDraft.intervalKm),
      intervalMonths: Number(srvDraft.intervalMonths),
      soonThresholdKm: Number(srvDraft.soonThresholdKm),
      soonThresholdDays: Number(srvDraft.soonThresholdDays),
      lastCompletedKm: Number(srvDraft.lastCompletedKm),
    });
    if (res.ok) {
      setCreateServiceOpen(false);
      setSrvDraft({ ...srvDraft, serviceTask: '' });
    }
  };

  const handleCreateRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addRenewalReminder({
      ...renDraft,
      soonThresholdDays: Number(renDraft.soonThresholdDays),
      costEstimate: Number(renDraft.costEstimate),
    });
    if (res.ok) {
      setCreateRenewalOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Recordatorios</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Mantenimiento preventivo automático por odómetro/calendario y renovaciones normativas.
          </p>
        </div>
        <button
          type="button"
          disabled={!can('reminder:manage')}
          onClick={() =>
            subTab === 'service' ? setCreateServiceOpen(true) : setCreateRenewalOpen(true)
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          {subTab === 'service' ? 'Nuevo Preventivo' : 'Nueva Renovación'}
        </button>
      </div>

      {/* Subtabs */}
      <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('service')}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'service' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Mantenimiento Preventivo{' '}
          <span className="ml-1 font-mono text-[11px] text-slate-400">{state.serviceReminders.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('renewals')}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'renewals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Renovaciones y Licencias{' '}
          <span className="ml-1 font-mono text-[11px] text-slate-400">{state.renewalReminders.length}</span>
        </button>
      </div>

      {subTab === 'service' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Vehículo</th>
                <th className="px-4 py-2.5 font-medium">Tarea Preventiva</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Próximo Vencimiento</th>
                <th className="px-4 py-2.5 text-right font-medium">Margen</th>
                <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.serviceReminders.map((rem) => {
                const veh = state.vehicles.find((v) => v.id === rem.vehicleId);
                const computed = computeServiceReminderStatus(rem, veh);
                const linkedWo = state.workOrders.find((w) => w.id === rem.linkedWorkOrderId);
                return (
                  <tr key={rem.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            section: 'vehicle-detail',
                            selectedVehicleId: rem.vehicleId,
                            selectedVehicleTab: 'recordatorios',
                          })
                        }
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {veh ? `${veh.code} · ${veh.make}` : rem.vehicleId}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{rem.serviceTask}</div>
                      <div className="text-[11px] text-slate-500">
                        {rem.intervalHrs ? `Cada ${rem.intervalHrs} h` : `Cada ${formatDistance(rem.intervalKm, state.settings.distanceUnit)}`}{' '}
                        o {rem.intervalMonths} meses
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={reminderStatusTextClass(computed.status)}>{computed.status}</div>
                      {linkedWo && (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({ section: 'work-orders', selectedWorkOrderId: linkedWo.id })
                          }
                          className="font-mono text-[11px] text-blue-700 hover:underline"
                        >
                          Vinculado a {linkedWo.code}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                      <div>
                        {typeof rem.nextDueHrs === 'number'
                          ? formatHours(rem.nextDueHrs)
                          : formatDistance(rem.nextDueKm, state.settings.distanceUnit)}
                      </div>
                      <div className="text-[11px] text-slate-500">{formatDate(rem.nextDueDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {typeof computed.remainingHrs === 'number' ? (
                        <div className={computed.remainingHrs <= 0 ? 'font-semibold text-red-700' : 'text-slate-700'}>
                          {computed.remainingHrs >= 0
                            ? `Faltan ${formatHours(computed.remainingHrs)}`
                            : `Excedido ${formatHours(Math.abs(computed.remainingHrs))}`}
                        </div>
                      ) : (
                        <div className={computed.remainingKm <= 0 ? 'font-semibold text-red-700' : 'text-slate-700'}>
                          {computed.remainingKm >= 0
                            ? `Faltan ${formatDistance(computed.remainingKm, state.settings.distanceUnit)}`
                            : `Excedido ${formatDistance(Math.abs(computed.remainingKm), state.settings.distanceUnit)}`}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500">
                        {computed.remainingDays >= 0
                          ? `${computed.remainingDays} días`
                          : `Vencido hace ${Math.abs(computed.remainingDays)} días`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {!linkedWo && (
                          <button
                            type="button"
                            disabled={!can('workorder:manage')}
                            onClick={() => handleScheduleWorkOrder(rem)}
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                          >
                            <Wrench className="h-3 w-3" />
                            Crear OT
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={!can('reminder:manage')}
                          onClick={() => snoozeServiceReminder(rem.id, 14)}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          Posponer 14d
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Tipo de Renovación</th>
                <th className="px-4 py-2.5 font-medium">Entidad</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Vencimiento</th>
                <th className="px-4 py-2.5 text-right font-medium">Costo Estimado</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.renewalReminders.map((ren) => {
                const computed = computeRenewalStatus(ren);
                const entityName =
                  ren.entityType === 'Vehículo'
                    ? (() => {
                        const v = state.vehicles.find((item) => item.id === ren.entityId);
                        return v ? `${v.code} · ${v.name}` : ren.entityId;
                      })()
                    : state.contacts.find((c) => c.id === ren.entityId)?.name || ren.entityId;
                return (
                  <tr key={ren.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{ren.renewalType}</div>
                      {ren.notes && <div className="text-[11px] text-slate-500">{ren.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {ren.entityType} · {entityName}
                    </td>
                    <td className={`px-4 py-3 ${reminderStatusTextClass(computed.status)}`}>
                      {computed.status}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {formatDate(ren.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrency(ren.costEstimate, state.settings.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!can('reminder:manage') && !can('operations:hse')}
                        onClick={() => completeRenewalReminder(ren.id)}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Marcar renovada
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Service Reminder Modal */}
      <Modal
        open={createServiceOpen}
        onClose={() => setCreateServiceOpen(false)}
        title="Nuevo Recordatorio de Mantenimiento Preventivo"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateServiceOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-service-rem-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Recordatorio
            </button>
          </>
        }
      >
        <form id="create-service-rem-form" onSubmit={handleCreateService} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Vehículo *</label>
            <select
              value={srvDraft.vehicleId}
              onChange={(e) => {
                const v = state.vehicles.find((x) => x.id === e.target.value);
                setSrvDraft({
                  ...srvDraft,
                  vehicleId: e.target.value,
                  lastCompletedKm: v?.odometerKm || 0,
                });
              }}
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
            <label className="block font-medium text-slate-700">Tarea de servicio *</label>
            <input
              type="text"
              required
              value={srvDraft.serviceTask}
              onChange={(e) => setSrvDraft({ ...srvDraft, serviceTask: e.target.value })}
              placeholder="Ej. Cambio de aceite y filtro de transmisión"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700">Intervalo (km)</label>
              <input
                type="number"
                min={1000}
                value={srvDraft.intervalKm}
                onChange={(e) => setSrvDraft({ ...srvDraft, intervalKm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Intervalo (meses)</label>
              <input
                type="number"
                min={1}
                value={srvDraft.intervalMonths}
                onChange={(e) => setSrvDraft({ ...srvDraft, intervalMonths: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Último servicio (km)</label>
              <input
                type="number"
                min={0}
                value={srvDraft.lastCompletedKm}
                onChange={(e) => setSrvDraft({ ...srvDraft, lastCompletedKm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Última fecha</label>
              <input
                type="date"
                value={srvDraft.lastCompletedDate}
                onChange={(e) => setSrvDraft({ ...srvDraft, lastCompletedDate: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* New Renewal Modal */}
      <Modal
        open={createRenewalOpen}
        onClose={() => setCreateRenewalOpen(false)}
        title="Programar Nueva Renovación"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateRenewalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-renewal-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Renovación
            </button>
          </>
        }
      >
        <form id="create-renewal-form" onSubmit={handleCreateRenewal} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700">Tipo de entidad</label>
              <select
                value={renDraft.entityType}
                onChange={(e) => {
                  const et = e.target.value as RenewalReminder['entityType'];
                  setRenDraft({
                    ...renDraft,
                    entityType: et,
                    entityId:
                      et === 'Vehículo'
                        ? state.vehicles[0]?.id || ''
                        : state.contacts[0]?.id || '',
                  });
                }}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Vehículo">Vehículo</option>
                <option value="Contacto">Contacto</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Registro</label>
              <select
                value={renDraft.entityId}
                onChange={(e) => setRenDraft({ ...renDraft, entityId: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {renDraft.entityType === 'Vehículo'
                  ? state.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} · {v.name}
                      </option>
                    ))
                  : state.contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role})
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Trámite</label>
              <select
                value={renDraft.renewalType}
                onChange={(e) =>
                  setRenDraft({
                    ...renDraft,
                    renewalType: e.target.value as RenewalReminder['renewalType'],
                  })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Sticker HSE de Obra">Sticker HSE de Obra</option>
                <option value="Seguro Vehicular / Responsabilidad Civil">
                  Seguro Vehicular / Responsabilidad Civil
                </option>
                <option value="Revisado Vehicular ATTT">Revisado Vehicular ATTT</option>
                <option value="Licencia de Conducir / Certificado Operador">
                  Licencia de Conducir / Certificado Operador
                </option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fecha límite *</label>
              <input
                type="date"
                required
                value={renDraft.dueDate}
                onChange={(e) => setRenDraft({ ...renDraft, dueDate: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Costo estimado ({state.settings.currency})</label>
            <input
              type="number"
              min={0}
              value={renDraft.costEstimate}
              onChange={(e) => setRenDraft({ ...renDraft, costEstimate: Number(e.target.value) })}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
