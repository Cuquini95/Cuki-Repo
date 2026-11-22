import React, { useMemo, useState } from 'react';
import { ArrowLeft, Gauge, Trash2 } from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { FleetGroup, RouteState, VehicleStatus } from '../types/fleet';
import {
  computeHseStickerStatus,
  computeMechanicalAvailability,
  computeServiceReminderStatus,
  computeVehicleTCO,
  computeWorkOrderTotals,
  formatCurrency,
  formatDate,
  formatDistance,
  formatEfficiency,
  formatHours,
  formatVolume,
  hseStickerTextClass,
  issuePriorityTextClass,
  issueStatusTextClass,
  reminderStatusTextClass,
  vehicleStatusTextClass,
  workOrderStatusTextClass,
} from '../utils/format';

interface VehicleDetailViewProps {
  vehicleId: string;
  activeTab: NonNullable<RouteState['selectedVehicleTab']>;
  onChangeTab: (tab: NonNullable<RouteState['selectedVehicleTab']>) => void;
  onNavigate: (next: RouteState) => void;
}

const TABS: { id: NonNullable<RouteState['selectedVehicleTab']>; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'servicio', label: 'Historial de Servicio' },
  { id: 'incidencias', label: 'Incidencias' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'recordatorios', label: 'Recordatorios' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'odometro', label: 'Odómetro' },
];

export const VehicleDetailView: React.FC<VehicleDetailViewProps> = ({
  vehicleId,
  activeTab,
  onChangeTab,
  onNavigate,
}) => {
  const {
    state,
    can,
    updateVehicle,
    deleteVehicle,
    logMeterReading,
    toggleVoidMeterReading,
  } = useFleet();

  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [meterValue, setMeterValue] = useState<number>(vehicle?.odometerKm ?? 0);
  const [meterHrsValue, setMeterHrsValue] = useState<number>(vehicle?.horometerHrs ?? 0);
  const [meterNote, setMeterNote] = useState('');
  const [allowCorrection, setAllowCorrection] = useState(false);
  const [meterError, setMeterError] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<VehicleStatus>(vehicle?.status ?? 'Activo');
  const [editGroup, setEditGroup] = useState<FleetGroup>(
    vehicle?.group ?? 'TMF Panamá · Movimiento de Tierras'
  );
  const [editOperatorId, setEditOperatorId] = useState(vehicle?.assignedOperatorId ?? '');
  const [editNotes, setEditNotes] = useState(vehicle?.notes ?? '');

  const tco = useMemo(
    () => (vehicle ? computeVehicleTCO(vehicle.id, state) : null),
    [vehicle, state]
  );

  if (!vehicle || !tco) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">Vehículo no encontrado</p>
        <button
          type="button"
          onClick={() => onNavigate({ section: 'vehicles' })}
          className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
        >
          Volver al listado de vehículos
        </button>
      </div>
    );
  }

  const operator = state.contacts.find((c) => c.id === vehicle.assignedOperatorId);
  const vehicleWorkOrders = state.workOrders.filter((w) => w.vehicleId === vehicle.id);
  const vehicleIssues = state.issues.filter((i) => i.vehicleId === vehicle.id);
  const vehicleInspections = state.inspections.filter((i) => i.vehicleId === vehicle.id);
  const vehicleReminders = state.serviceReminders.filter((r) => r.vehicleId === vehicle.id);
  const vehicleFuels = state.fuelEntries.filter((f) => f.vehicleId === vehicle.id);
  const vehicleMeters = state.meterReadings.filter((m) => m.vehicleId === vehicle.id);
  const vehicleTires = state.tires.filter((t) => t.vehicleId === vehicle.id && t.status === 'Montada');
  const hse = computeHseStickerStatus(vehicle.hseStickerExpiry);
  const availability = computeMechanicalAvailability(vehicle.id, state, 240);

  const handleMeterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMeterError('');
    const res = logMeterReading({
      vehicleId: vehicle.id,
      valueKm: Number(meterValue),
      valueHrs: Number(meterHrsValue) > 0 ? Number(meterHrsValue) : undefined,
      note: meterNote.trim() || undefined,
      allowCorrection,
    });
    if (!res.ok) {
      setMeterError(res.error || 'Error al registrar lectura.');
      return;
    }
    setMeterModalOpen(false);
    setMeterNote('');
    setAllowCorrection(false);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateVehicle(vehicle.id, {
      status: editStatus,
      group: editGroup,
      assignedOperatorId: editOperatorId || undefined,
      notes: editNotes,
    });
    setEditModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => onNavigate({ section: 'vehicles' })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a Vehículos
          </button>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {vehicle.code} · {vehicle.name}
            </h1>
            <span className={`text-xs ${vehicleStatusTextClass(vehicle.status)}`}>
              {vehicle.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {vehicle.year} {vehicle.make} {vehicle.model} · Placa{' '}
            <span className="font-mono text-slate-800">{vehicle.licensePlate}</span> · VIN{' '}
            <span className="font-mono text-slate-800">{vehicle.vin}</span> · {vehicle.group}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!can('meter:log')}
            onClick={() => {
              setMeterValue(vehicle.odometerKm);
              setMeterHrsValue(vehicle.horometerHrs);
              setMeterError('');
              setMeterModalOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Gauge className="h-3.5 w-3.5" />
            Registrar Medidor
          </button>
          <button
            type="button"
            disabled={!can('vehicle:edit')}
            onClick={() => {
              setEditStatus(vehicle.status);
              setEditGroup(vehicle.group);
              setEditOperatorId(vehicle.assignedOperatorId || '');
              setEditNotes(vehicle.notes || '');
              setEditModalOpen(true);
            }}
            className="inline-flex h-9 items-center rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
          >
            Editar Ficha
          </button>
        </div>
      </div>

      {/* Summary Metric Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Horómetro / Odómetro</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {vehicle.horometerHrs > 0
              ? formatHours(vehicle.horometerHrs)
              : formatDistance(vehicle.odometerKm, state.settings.distanceUnit)}
          </div>
          {vehicle.horometerHrs > 0 && vehicle.odometerKm > 0 && (
            <div className="text-[11px] font-mono text-slate-500">
              {formatDistance(vehicle.odometerKm, state.settings.distanceUnit)}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Disponibilidad / HSE</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
              {availability.availabilityPct.toFixed(1)}%
            </span>
            <span className={`text-xs ${hseStickerTextClass(hse.status)}`}>HSE {hse.status}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {vehicle.hseStickerCode} · Vence {formatDate(vehicle.hseStickerExpiry)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Costo Operativo (TCO)</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(tco.totalOperatingCost, state.settings.currency)}
          </div>
          <div className="text-[11px] text-slate-500">
            Próx. {vehicle.nextPmLevel} @ {vehicle.nextPmHours}h
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Rendimiento / Llantas</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatEfficiency(tco.avgKmPerLiter, state.settings)}
          </div>
          <div className="text-[11px] text-slate-500">
            {vehicleTires.length} llanta(s) registradas
          </div>
        </div>
      </div>

      {/* 7-Tab Vehicle Profile Bar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-5 overflow-x-auto" aria-label="Pestañas del vehículo">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`border-b-2 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Especificaciones y Asignación</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3.5 text-xs sm:grid-cols-2">
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Operador Asignado</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{operator ? operator.name : 'Sin asignar'}</dd>
              </div>
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Grupo de Flota</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{vehicle.group}</dd>
              </div>
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Tipo de Activo</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{vehicle.type}</dd>
              </div>
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Tipo de Combustible</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{vehicle.fuelType}</dd>
              </div>
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Fecha de Adquisición</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{formatDate(vehicle.purchaseDate)}</dd>
              </div>
              <div className="border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Valor de Adquisición</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                  {formatCurrency(vehicle.purchaseCost, state.settings.currency)}
                </dd>
              </div>
            </dl>
            {vehicle.notes && (
              <div className="mt-4 text-xs text-slate-600">
                <span className="font-medium text-slate-800">Notas: </span>
                {vehicle.notes}
              </div>
            )}
          </section>

          <section className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Desglose de Costos</h2>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Mantenimiento y OT</span>
                  <span className="font-mono font-medium tabular-nums text-slate-900">
                    {formatCurrency(tco.maintenanceCost, state.settings.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Combustible</span>
                  <span className="font-mono font-medium tabular-nums text-slate-900">
                    {formatCurrency(tco.fuelCost, state.settings.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-slate-900">Total Operativo</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {formatCurrency(tco.totalOperatingCost, state.settings.currency)}
                  </span>
                </div>
              </div>
            </div>

            {can('vehicle:delete') && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    deleteVehicle(vehicle.id);
                    onNavigate({ section: 'vehicles' });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar unidad del inventario
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'servicio' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Órdenes de Trabajo del Vehículo</h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: 'work-orders' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Ir a Órdenes de Trabajo
            </button>
          </div>
          {vehicleWorkOrders.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              Este equipo no tiene órdenes de trabajo.
            </div>
          ) : (
            <TableViewport label="Historial de órdenes">
              <table className="vektor-data-table" style={{ minWidth: 680 }} aria-label="Historial de órdenes">
                <colgroup>
                  <col style={{ width: 105 }} />
                  <col />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 115 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">Orden</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Resumen</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Estado</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Fecha</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Costo total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleWorkOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono font-semibold text-blue-700">
                        <button
                          type="button"
                          onClick={() => onNavigate({ section: 'work-orders', selectedWorkOrderId: wo.id })}
                          className="hover:underline"
                        >
                          {wo.code}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-800">{wo.summary}</td>
                      <td className={`px-5 py-3 ${workOrderStatusTextClass(wo.status)}`}>{wo.status}</td>
                      <td className="px-5 py-3 font-mono text-slate-600">{formatDate(wo.completedAt || wo.scheduledDate)}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatCurrency(computeWorkOrderTotals(wo).total, state.settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          )}
        </section>
      )}

      {activeTab === 'incidencias' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Incidencias Reportadas</h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: 'issues' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Gestionar incidencias
            </button>
          </div>
          {vehicleIssues.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              No se registran incidencias para esta unidad.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vehicleIssues.map((iss) => (
                <li key={iss.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {iss.code} · {iss.title}
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      {iss.description} · Origen: {iss.source}
                      {iss.sourceRefId ? ` (${iss.sourceRefId})` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={issuePriorityTextClass(iss.priority)}>{iss.priority}</div>
                    <div className={`vektor-status ${issueStatusTextClass(iss.status)}`}>{iss.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'inspecciones' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Historial de Inspecciones DVIR</h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: 'inspections' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Ejecutar inspección
            </button>
          </div>
          {vehicleInspections.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              Este equipo no tiene inspecciones registradas.
            </div>
          ) : (
            <TableViewport label="Historial de inspecciones">
              <table className="vektor-data-table" style={{ minWidth: 665 }} aria-label="Historial de inspecciones">
                <colgroup>
                  <col style={{ width: 100 }} />
                  <col />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 105 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">Folio</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Formulario</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Fecha</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Resultado</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Odómetro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleInspections.map((insp) => (
                    <tr key={insp.id}>
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900">{insp.code}</td>
                      <td className="px-5 py-3 text-slate-700">{insp.formName}</td>
                      <td className="px-5 py-3 font-mono text-slate-600">{formatDate(insp.submittedAt)}</td>
                      <td className="px-5 py-3">
                        <span className={insp.failedCount > 0 ? 'font-semibold text-red-700' : 'font-medium text-emerald-700'}>
                          {insp.status}
                        </span>{' '}
                        <span className="text-slate-500">
                          ({insp.passedCount} pasan · {insp.failedCount} fallan)
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatDistance(insp.odometerKm, state.settings.distanceUnit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          )}
        </section>
      )}

      {activeTab === 'recordatorios' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Programas Preventivos</h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: 'reminders' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Ver todos los recordatorios
            </button>
          </div>
          {vehicleReminders.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              Sin recordatorios preventivos asignados.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {vehicleReminders.map((rem) => {
                const computed = computeServiceReminderStatus(rem, vehicle);
                return (
                  <li key={rem.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{rem.serviceTask}</div>
                      <div className="mt-0.5 text-slate-500">
                        Cada {formatDistance(rem.intervalKm, state.settings.distanceUnit)} o {rem.intervalMonths} meses
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`vektor-status ${reminderStatusTextClass(computed.status)}`}>{computed.status}</div>
                      <div className="font-mono tabular-nums text-slate-600">
                        Próx: {formatDistance(rem.nextDueKm, state.settings.distanceUnit)} · {formatDate(rem.nextDueDate)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'combustible' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Historial de Combustible</h2>
            <button
              type="button"
              onClick={() => onNavigate({ section: 'fuel' })}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Registrar carga
            </button>
          </div>
          {vehicleFuels.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              Este equipo no tiene cargas registradas.
            </div>
          ) : (
            <TableViewport label="Historial de combustible">
              <table className="vektor-data-table" style={{ minWidth: 530 }} aria-label="Historial de combustible">
                <colgroup>
                  <col style={{ width: 110 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 105 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">Fecha</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Odómetro</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Volumen</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Rendimiento</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleFuels.map((fl) => (
                    <tr key={fl.id}>
                      <td className="px-5 py-3 font-mono text-slate-700">{formatDate(fl.date)}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatDistance(fl.odometerKm, state.settings.distanceUnit)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatVolume(fl.liters, state.settings.volumeUnit)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-800">
                        {formatEfficiency(fl.kmPerLiter, state.settings)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium tabular-nums text-slate-900">
                        {formatCurrency(fl.totalCost, state.settings.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          )}
        </section>
      )}

      {activeTab === 'odometro' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Cronología de Lecturas de Odómetro</h2>
            <button
              type="button"
              disabled={!can('meter:log')}
              onClick={() => {
                setMeterValue(vehicle.odometerKm);
                setMeterHrsValue(vehicle.horometerHrs);
                setMeterError('');
                setMeterModalOpen(true);
              }}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 disabled:text-slate-400"
            >
              + Nueva lectura
            </button>
          </div>
          <TableViewport label="Lecturas de medidor">
            <table className="vektor-data-table" style={{ minWidth: 665 }} aria-label="Lecturas de medidor">
              <colgroup>
                <col style={{ width: 105 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
                <col />
                <col style={{ width: 135 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th scope="col" className="px-5 py-2.5 font-medium">Fecha</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Horómetro</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Odómetro</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Origen</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Registrado por</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleMeters.map((mr) => (
                  <tr key={mr.id} className={mr.voided ? 'bg-slate-50/60 text-slate-400 line-through' : ''}>
                    <td className="px-5 py-3 font-mono">{formatDate(mr.date)}</td>
                    <td className="px-5 py-3 text-right font-mono font-medium tabular-nums text-slate-900">
                      {typeof mr.valueHrs === 'number' && mr.valueHrs > 0 ? formatHours(mr.valueHrs) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                      {mr.valueKm > 0 ? formatDistance(mr.valueKm, state.settings.distanceUnit) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {mr.source}
                      {mr.referenceId ? ` · ${mr.referenceId}` : ''}
                    </td>
                    <td className="px-5 py-3">{mr.recordedBy}</td>
                    <td className="px-5 py-3 text-right">
                      {can('vehicle:edit') ? (
                        <button
                          type="button"
                          onClick={() => toggleVoidMeterReading(mr.id)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          {mr.voided ? 'Restaurar' : 'Anular'}
                        </button>
                      ) : (
                        <span>{mr.voided ? 'Anulada' : 'Vigente'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
        </section>
      )}

      {/* Meter Modal */}
      <Modal
        open={meterModalOpen}
        onClose={() => setMeterModalOpen(false)}
        title={`Registrar Lectura de Odómetro · ${vehicle.code}`}
        subtitle={`Lectura vigente: ${formatDistance(vehicle.odometerKm, state.settings.distanceUnit)}`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMeterModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="meter-reading-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Lectura
            </button>
          </>
        }
      >
        <form id="meter-reading-form" onSubmit={handleMeterSubmit} className="space-y-4 text-xs">
          {meterError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {meterError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Horómetro (h)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={meterHrsValue}
                onChange={(e) => setMeterHrsValue(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Odómetro (km)</label>
              <input
                type="number"
                min={0}
                value={meterValue}
                onChange={(e) => setMeterValue(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Nota (opcional)</label>
            <input
              type="text"
              value={meterNote}
              onChange={(e) => setMeterNote(e.target.value)}
              placeholder="Ej. Revisión de fin de turno"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-slate-700">
            <input
              type="checkbox"
              checked={allowCorrection}
              onChange={(e) => setAllowCorrection(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
            />
            Permitir corrección manual (lectura menor a la actual)
          </label>
        </form>
      </Modal>

      {/* Edit Vehicle Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Editar Ficha · ${vehicle.code}`}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="edit-vehicle-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Cambios
            </button>
          </>
        }
      >
        <form id="edit-vehicle-form" onSubmit={handleEditSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Estado operativo</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as VehicleStatus)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {(['Activo', 'En taller', 'Fuera de servicio', 'Inactivo', 'Vendido'] as VehicleStatus[]).map(
                  (st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Grupo</label>
              <select
                value={editGroup}
                onChange={(e) => setEditGroup(e.target.value as FleetGroup)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {(
                  [
                    'TMF Panamá · Movimiento de Tierras',
                    'Acarreo y Volquetes',
                    'Taller y Soporte Técnico',
                    'Supervisión HSE y Campo',
                  ] as FleetGroup[]
                ).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Operador asignado</label>
            <select
              value={editOperatorId}
              onChange={(e) => setEditOperatorId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="">Sin asignar</option>
              {state.contacts
                .filter((c) => c.role === 'Operador' || c.role === 'Supervisor')
                .map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Notas</label>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
