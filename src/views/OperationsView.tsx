import React, { useMemo, useState } from 'react';
import { Check, Clock, Download, Plus, ShieldCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { FailureCategory, RouteState } from '../types/fleet';
import {
  computeHseStickerStatus,
  computeMechanicalAvailability,
  exportRowsToCsv,
  formatDate,
  formatHours,
  hseStickerTextClass,
  shiftStatusTextClass,
  todayIso,
} from '../utils/format';

interface OperationsViewProps {
  onNavigate: (next: RouteState) => void;
}

const FAILURE_CATEGORIES: FailureCategory[] = [
  'Hidráulico',
  'Motor y Tren Motriz',
  'Frenos y Neumático',
  'Eléctrico',
  'Tren de Rodaje',
  'Llantas',
  'PM Preventivo',
  'Cabina y HSE',
];

export const OperationsView: React.FC<OperationsViewProps> = ({ onNavigate }) => {
  const {
    state,
    can,
    addShiftDispatch,
    updateShiftStatus,
    addDowntimeEvent,
    closeDowntimeEvent,
    renewHseSticker,
  } = useFleet();

  const [subTab, setSubTab] = useState<'turnos' | 'downtime' | 'hse'>('turnos');

  // Shift Dispatch modal state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const defaultVehicle = state.vehicles[0];
  const operators = state.contacts.filter((c) => c.role === 'Operador' || c.role === 'Supervisor');
  const [shiftDraft, setShiftDraft] = useState({
    date: todayIso(),
    shift: 'Turno Día (06:00–18:00)' as 'Turno Día (06:00–18:00)' | 'Turno Noche (18:00–06:00)',
    vehicleId: defaultVehicle?.id || '',
    operatorId: operators[0]?.id || '',
    frontName: 'Frente TMF · Botadero Sur',
    material: 'Roca fracturada / Material selecto',
    tripsCount: 14,
    volumeM3: 224,
    startHorometer: defaultVehicle?.horometerHrs ?? 0,
    endHorometer: (defaultVehicle?.horometerHrs ?? 0) + 10,
    supervisorNote: '',
  });

  // Downtime modal state
  const [downtimeModalOpen, setDowntimeModalOpen] = useState(false);
  const [downtimeError, setDowntimeError] = useState('');
  const [downtimeDraft, setDowntimeDraft] = useState({
    vehicleId: defaultVehicle?.id || '',
    category: 'Hidráulico' as FailureCategory,
    reason: '',
    startedAt: todayIso(),
    hoursDown: 4,
    impactNote: '',
  });

  // Close downtime modal
  const [closingDowntimeId, setClosingDowntimeId] = useState<string | null>(null);
  const [finalDownHours, setFinalDownHours] = useState(4);

  // HSE Sticker renewal modal
  const [hseVehicleId, setHseVehicleId] = useState<string | null>(null);
  const [hseCode, setHseCode] = useState('');
  const [hseExpiry, setHseExpiry] = useState('');

  // Observe shift modal
  const [observingShiftId, setObservingShiftId] = useState<string | null>(null);
  const [observeNote, setObserveNote] = useState('');

  const fleetAvailability = useMemo(
    () => computeMechanicalAvailability(null, state, 240),
    [state]
  );

  const shiftStats = useMemo(() => {
    const totalM3 = state.shiftDispatches.reduce((acc, s) => acc + s.volumeM3, 0);
    const totalTrips = state.shiftDispatches.reduce((acc, s) => acc + s.tripsCount, 0);
    const pendingReview = state.shiftDispatches.filter((s) => s.status === 'Por revisar').length;
    return { totalM3, totalTrips, pendingReview };
  }, [state.shiftDispatches]);

  const activeDowntimeCount = useMemo(
    () => state.downtimeEvents.filter((d) => d.status === 'Activo').length,
    [state.downtimeEvents]
  );

  const hseAlertsCount = useMemo(
    () =>
      state.vehicles.filter((v) => {
        const st = computeHseStickerStatus(v.hseStickerExpiry).status;
        return st === 'Vencido' || st === 'Por vencer' || st === 'Pendiente';
      }).length,
    [state.vehicles]
  );

  const handleOpenShiftModal = () => {
    const v = state.vehicles[0];
    setShiftDraft({
      date: todayIso(),
      shift: 'Turno Día (06:00–18:00)',
      vehicleId: v?.id || '',
      operatorId: operators[0]?.id || '',
      frontName: 'Frente TMF · Botadero Sur',
      material: 'Material selecto / Tosca',
      tripsCount: 12,
      volumeM3: 192,
      startHorometer: v?.horometerHrs ?? 0,
      endHorometer: Number(((v?.horometerHrs ?? 0) + 9.5).toFixed(1)),
      supervisorNote: '',
    });
    setShiftError('');
    setShiftModalOpen(true);
  };

  const handleShiftVehicleChange = (vehicleId: string) => {
    const v = state.vehicles.find((item) => item.id === vehicleId);
    const baseHrs = v?.horometerHrs ?? 0;
    setShiftDraft((prev) => ({
      ...prev,
      vehicleId,
      operatorId: v?.assignedOperatorId || prev.operatorId,
      startHorometer: baseHrs,
      endHorometer: Number((baseHrs + 9).toFixed(1)),
    }));
  };

  const handleShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    if (!shiftDraft.vehicleId || !shiftDraft.operatorId) {
      setShiftError('Selecciona equipo y operador.');
      return;
    }
    if (shiftDraft.endHorometer < shiftDraft.startHorometer) {
      setShiftError('El horómetro final no puede ser menor al horómetro inicial.');
      return;
    }
    const res = addShiftDispatch({
      ...shiftDraft,
      status: 'Por revisar',
      supervisorNote: shiftDraft.supervisorNote.trim() || undefined,
    });
    if (!res.ok) {
      setShiftError(res.error || 'No se pudo registrar el parte de turno.');
      return;
    }
    setShiftModalOpen(false);
  };

  const handleDowntimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDowntimeError('');
    if (!downtimeDraft.vehicleId || !downtimeDraft.reason.trim()) {
      setDowntimeError('Equipo y motivo de parada son obligatorios.');
      return;
    }
    const res = addDowntimeEvent({
      vehicleId: downtimeDraft.vehicleId,
      category: downtimeDraft.category,
      reason: downtimeDraft.reason.trim(),
      startedAt: downtimeDraft.startedAt,
      hoursDown: Number(downtimeDraft.hoursDown),
      impactNote: downtimeDraft.impactNote.trim() || undefined,
    });
    if (!res.ok) {
      setDowntimeError(res.error || 'No se pudo registrar el tiempo caído.');
      return;
    }
    setDowntimeModalOpen(false);
    setDowntimeDraft({
      ...downtimeDraft,
      reason: '',
      impactNote: '',
      hoursDown: 4,
    });
  };

  const handleExportShifts = () => {
    exportRowsToCsv(
      'gtp_panama_partes_turno.csv',
      ['Folio', 'Fecha', 'Turno', 'Equipo', 'Operador', 'Frente', 'Material', 'Viajes', 'Volumen m3', 'Horómetro Ini', 'Horómetro Fin', 'Estado'],
      state.shiftDispatches.map((s) => {
        const veh = state.vehicles.find((v) => v.id === s.vehicleId);
        const op = state.contacts.find((c) => c.id === s.operatorId);
        return [
          s.code,
          s.date,
          s.shift,
          veh?.code || s.vehicleId,
          op?.name || s.operatorId,
          s.frontName,
          s.material,
          s.tripsCount,
          s.volumeM3,
          s.startHorometer,
          s.endHorometer,
          s.status,
        ];
      })
    );
  };

  const hseTargetVehicle = state.vehicles.find((v) => v.id === hseVehicleId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Turnos, Tiempo Caído y Habilitación HSE
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Control diario de producción y acarreo en {state.settings.projectCode}, paradas mecánicas y vigencia de stickers HSE.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subTab === 'turnos' && (
            <>
              <button
                type="button"
                onClick={handleExportShifts}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
              <button
                type="button"
                disabled={!can('operations:dispatch')}
                onClick={handleOpenShiftModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Registrar Parte de Turno
              </button>
            </>
          )}
          {subTab === 'downtime' && (
            <button
              type="button"
              disabled={!can('issue:create')}
              onClick={() => {
                setDowntimeError('');
                setDowntimeModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Reportar Tiempo Caído
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Disponibilidad Mecánica</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
            {fleetAvailability.availabilityPct.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            {fleetAvailability.totalDownHours} h caídas acumuladas
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Producción Acarreo</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
            {shiftStats.totalM3.toLocaleString('es-PA')} m³
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums">
            {shiftStats.totalTrips} viajes · {shiftStats.pendingReview} parte(s) por revisar
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Paradas Activas</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-red-700">
            {activeDowntimeCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Equipos detenidos en frente o taller
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Alertas Sticker HSE</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-700">
            {hseAlertsCount}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Vencidos o próximos a vencer (&le;15 días)
          </div>
        </div>
      </section>

      {/* Sub-tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Secciones de operación">
          {(
            [
              ['turnos', `Producción y Partes de Turno (${state.shiftDispatches.length})`],
              ['downtime', `Tiempo Caído y Disponibilidad (${state.downtimeEvents.length})`],
              ['hse', `Habilitación HSE · Stickers (${state.vehicles.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`border-b-2 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === id
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Partes de Turno */}
      {subTab === 'turnos' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Folio / Fecha</th>
                <th className="px-4 py-2.5 font-medium">Equipo y Operador</th>
                <th className="px-4 py-2.5 font-medium">Frente / Material</th>
                <th className="px-4 py-2.5 text-right font-medium">Viajes / m³</th>
                <th className="px-4 py-2.5 text-right font-medium">Horómetro</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Validación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.shiftDispatches.map((sd) => {
                const veh = state.vehicles.find((v) => v.id === sd.vehicleId);
                const op = state.contacts.find((c) => c.id === sd.operatorId);
                const hrsWorked = Math.max(0, Number((sd.endHorometer - sd.startHorometer).toFixed(1)));
                return (
                  <tr key={sd.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">{sd.code}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatDate(sd.date)} · {sd.shift.startsWith('Turno Día') ? 'Día' : 'Noche'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          veh &&
                          onNavigate({
                            section: 'vehicle-detail',
                            selectedVehicleId: veh.id,
                            selectedVehicleTab: 'resumen',
                          })
                        }
                        className="font-semibold text-slate-900 hover:text-blue-700"
                      >
                        {veh ? `${veh.code} · ${veh.make} ${veh.model}` : sd.vehicleId}
                      </button>
                      <div className="text-[11px] text-slate-500">{op?.name || 'Sin operador'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{sd.frontName}</div>
                      <div className="text-[11px] text-slate-500">{sd.material}</div>
                      {sd.supervisorNote && (
                        <div className="mt-0.5 text-[11px] text-amber-700">Obs: {sd.supervisorNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{sd.volumeM3} m³</div>
                      <div className="text-[11px] text-slate-500">{sd.tripsCount} viajes</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="text-slate-800">
                        {sd.startHorometer} → {sd.endHorometer} h
                      </div>
                      <div className="text-[11px] text-slate-500">+{hrsWorked} h trabajadas</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={shiftStatusTextClass(sd.status)}>{sd.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {sd.status === 'Por revisar' || sd.status === 'En curso' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!can('operations:approve_shift')}
                            onClick={() => updateShiftStatus(sd.id, 'Aceptado')}
                            className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                          >
                            <Check className="h-3 w-3" />
                            Aceptar
                          </button>
                          <button
                            type="button"
                            disabled={!can('operations:approve_shift')}
                            onClick={() => {
                              setObservingShiftId(sd.id);
                              setObserveNote(sd.supervisorNote || '');
                            }}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                          >
                            Observar
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Revisado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Tiempo Caído */}
      {subTab === 'downtime' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Folio</th>
                <th className="px-4 py-2.5 font-medium">Equipo</th>
                <th className="px-4 py-2.5 font-medium">Categoría y Motivo</th>
                <th className="px-4 py-2.5 font-medium">Inicio / Cierre</th>
                <th className="px-4 py-2.5 text-right font-medium">Horas Caídas</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.downtimeEvents.map((dt) => {
                const veh = state.vehicles.find((v) => v.id === dt.vehicleId);
                const linkedWo = state.workOrders.find((w) => w.id === dt.workOrderId);
                return (
                  <tr key={dt.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {dt.code}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          veh &&
                          onNavigate({
                            section: 'vehicle-detail',
                            selectedVehicleId: veh.id,
                            selectedVehicleTab: 'resumen',
                          })
                        }
                        className="font-semibold text-slate-900 hover:text-blue-700"
                      >
                        {veh ? `${veh.code} · ${veh.name}` : dt.vehicleId}
                      </button>
                      {linkedWo && (
                        <div className="mt-0.5 text-[11px] text-blue-700">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({ section: 'work-orders', selectedWorkOrderId: linkedWo.id })
                            }
                            className="hover:underline"
                          >
                            Vinculada a {linkedWo.code}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{dt.category}</div>
                      <div className="text-[11px] text-slate-600">{dt.reason}</div>
                      {dt.impactNote && (
                        <div className="mt-0.5 text-[11px] text-slate-400">{dt.impactNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>Inicio: {formatDate(dt.startedAt)}</div>
                      <div>{dt.endedAt ? `Fin: ${formatDate(dt.endedAt)}` : 'En parada'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatHours(dt.hoursDown)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          dt.status === 'Activo'
                            ? 'font-semibold text-red-700'
                            : 'font-medium text-emerald-700'
                        }
                      >
                        {dt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {dt.status === 'Activo' ? (
                        <button
                          type="button"
                          disabled={!can('workorder:manage') && !can('operations:approve_shift')}
                          onClick={() => {
                            setClosingDowntimeId(dt.id);
                            setFinalDownHours(dt.hoursDown);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                        >
                          <Clock className="h-3 w-3" />
                          Cerrar parada
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Cerrado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Habilitación HSE (Stickers) */}
      {subTab === 'hse' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Equipo</th>
                <th className="px-4 py-2.5 font-medium">Frente / Grupo</th>
                <th className="px-4 py-2.5 font-medium">Código Sticker HSE</th>
                <th className="px-4 py-2.5 font-medium">Vencimiento</th>
                <th className="px-4 py-2.5 font-medium">Vigencia</th>
                <th className="px-4 py-2.5 text-right font-medium">Habilitación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.vehicles.map((veh) => {
                const hse = computeHseStickerStatus(veh.hseStickerExpiry);
                return (
                  <tr key={veh.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            section: 'vehicle-detail',
                            selectedVehicleId: veh.id,
                            selectedVehicleTab: 'resumen',
                          })
                        }
                        className="font-semibold text-slate-900 hover:text-blue-700"
                      >
                        {veh.code} · {veh.name}
                      </button>
                      <div className="text-[11px] text-slate-500">
                        {veh.licensePlate} · Estado: {veh.status}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{veh.group}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      {veh.hseStickerCode || 'SIN-STICKER'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDate(veh.hseStickerExpiry)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={hseStickerTextClass(hse.status)}>{hse.status}</span>
                      {hse.status !== 'Pendiente' && (
                        <span className="ml-1.5 font-mono text-[11px] tabular-nums text-slate-500">
                          ({hse.remainingDays < 0 ? `${Math.abs(hse.remainingDays)}d vencido` : `${hse.remainingDays}d`})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!can('operations:hse')}
                        onClick={() => {
                          setHseVehicleId(veh.id);
                          setHseCode(`HSE-TMF-${new Date().getFullYear()}-${veh.code.slice(-2)}R`);
                          const nextQuarter = new Date();
                          nextQuarter.setMonth(nextQuarter.getMonth() + 3);
                          setHseExpiry(nextQuarter.toISOString().slice(0, 10));
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                        Renovar Sticker
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Registrar Parte de Turno */}
      <Modal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title="Registrar Parte de Turno / Acarreo"
        subtitle="Actualiza producción diaria (viajes y m³) y lectura de horómetro del equipo."
        footer={
          <>
            <button
              type="button"
              onClick={() => setShiftModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="shift-dispatch-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Enviar Parte a Revisión
            </button>
          </>
        }
      >
        <form id="shift-dispatch-form" onSubmit={handleShiftSubmit} className="space-y-4 text-xs">
          {shiftError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {shiftError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Fecha *</label>
              <input
                type="date"
                required
                value={shiftDraft.date}
                onChange={(e) => setShiftDraft({ ...shiftDraft, date: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Turno *</label>
              <select
                value={shiftDraft.shift}
                onChange={(e) =>
                  setShiftDraft({
                    ...shiftDraft,
                    shift: e.target.value as 'Turno Día (06:00–18:00)' | 'Turno Noche (18:00–06:00)',
                  })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Turno Día (06:00–18:00)">Turno Día (06:00–18:00)</option>
                <option value="Turno Noche (18:00–06:00)">Turno Noche (18:00–06:00)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Equipo *</label>
              <select
                value={shiftDraft.vehicleId}
                onChange={(e) => handleShiftVehicleChange(e.target.value)}
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
              <label className="block font-medium text-slate-700">Operador *</label>
              <select
                value={shiftDraft.operatorId}
                onChange={(e) => setShiftDraft({ ...shiftDraft, operatorId: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.positionCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Frente de trabajo *</label>
              <input
                type="text"
                required
                value={shiftDraft.frontName}
                onChange={(e) => setShiftDraft({ ...shiftDraft, frontName: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Material *</label>
              <input
                type="text"
                required
                value={shiftDraft.material}
                onChange={(e) => setShiftDraft({ ...shiftDraft, material: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Viajes realizados</label>
              <input
                type="number"
                min={0}
                value={shiftDraft.tripsCount}
                onChange={(e) => setShiftDraft({ ...shiftDraft, tripsCount: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Volumen acarreado (m³)</label>
              <input
                type="number"
                min={0}
                value={shiftDraft.volumeM3}
                onChange={(e) => setShiftDraft({ ...shiftDraft, volumeM3: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Horómetro inicial (h)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={shiftDraft.startHorometer}
                onChange={(e) =>
                  setShiftDraft({ ...shiftDraft, startHorometer: Number(e.target.value) })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Horómetro final (h)</label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={shiftDraft.endHorometer}
                onChange={(e) =>
                  setShiftDraft({ ...shiftDraft, endHorometer: Number(e.target.value) })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Observaciones del turno</label>
            <textarea
              rows={2}
              value={shiftDraft.supervisorNote}
              onChange={(e) => setShiftDraft({ ...shiftDraft, supervisorNote: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Observar Parte */}
      <Modal
        open={Boolean(observingShiftId)}
        onClose={() => setObservingShiftId(null)}
        title="Observar Parte de Turno"
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setObservingShiftId(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (observingShiftId) {
                  updateShiftStatus(observingShiftId, 'Observado', observeNote);
                }
                setObservingShiftId(null);
              }}
              className="rounded-md bg-amber-700 px-4 py-2 text-xs font-medium text-white hover:bg-amber-800"
            >
              Guardar Observación
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="block font-medium text-slate-700">Motivo de observación</label>
          <textarea
            rows={3}
            value={observeNote}
            onChange={(e) => setObserveNote(e.target.value)}
            placeholder="Ej. Verificar diferencia entre viajes reportados y guía de acarreo."
            className="w-full rounded-md border border-slate-300 p-2.5"
          />
        </div>
      </Modal>

      {/* Modal: Reportar Tiempo Caído */}
      <Modal
        open={downtimeModalOpen}
        onClose={() => setDowntimeModalOpen(false)}
        title="Reportar Tiempo Caído (Parada de Equipo)"
        subtitle="Marca el equipo como Fuera de servicio y descuenta disponibilidad mecánica."
        maxWidthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDowntimeModalOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="downtime-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Registrar Parada
            </button>
          </>
        }
      >
        <form id="downtime-form" onSubmit={handleDowntimeSubmit} className="space-y-4 text-xs">
          {downtimeError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {downtimeError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Equipo *</label>
              <select
                value={downtimeDraft.vehicleId}
                onChange={(e) => setDowntimeDraft({ ...downtimeDraft, vehicleId: e.target.value })}
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
              <label className="block font-medium text-slate-700">Sistema / Categoría *</label>
              <select
                value={downtimeDraft.category}
                onChange={(e) =>
                  setDowntimeDraft({ ...downtimeDraft, category: e.target.value as FailureCategory })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {FAILURE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fecha inicio *</label>
              <input
                type="date"
                required
                value={downtimeDraft.startedAt}
                onChange={(e) => setDowntimeDraft({ ...downtimeDraft, startedAt: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Horas estimadas caídas *</label>
              <input
                type="number"
                min={0.5}
                step="0.5"
                required
                value={downtimeDraft.hoursDown}
                onChange={(e) =>
                  setDowntimeDraft({ ...downtimeDraft, hoursDown: Number(e.target.value) })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Motivo de parada *</label>
            <input
              type="text"
              required
              value={downtimeDraft.reason}
              onChange={(e) => setDowntimeDraft({ ...downtimeDraft, reason: e.target.value })}
              placeholder="Ej. Ruptura de manguera hidráulica principal en frente norte"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Impacto operativo</label>
            <input
              type="text"
              value={downtimeDraft.impactNote}
              onChange={(e) => setDowntimeDraft({ ...downtimeDraft, impactNote: e.target.value })}
              placeholder="Ej. Detiene carga de 2 volquetes en frente TMF"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Cerrar Parada */}
      <Modal
        open={Boolean(closingDowntimeId)}
        onClose={() => setClosingDowntimeId(null)}
        title="Cerrar Tiempo Caído"
        subtitle="Confirma las horas totales fuera de servicio para liberar el equipo."
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setClosingDowntimeId(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (closingDowntimeId) {
                  closeDowntimeEvent(closingDowntimeId, finalDownHours);
                }
                setClosingDowntimeId(null);
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Confirmar Cierre
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="block font-medium text-slate-700">Horas totales de parada</label>
          <input
            type="number"
            min={0.5}
            step="0.5"
            value={finalDownHours}
            onChange={(e) => setFinalDownHours(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
          />
        </div>
      </Modal>

      {/* Modal: Renovar Sticker HSE */}
      <Modal
        open={Boolean(hseVehicleId)}
        onClose={() => setHseVehicleId(null)}
        title={`Renovar Sticker HSE · ${hseTargetVehicle?.code || ''}`}
        subtitle="Habilitación trimestral de seguridad para ingreso a frente TMF Panamá."
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setHseVehicleId(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (hseVehicleId && hseCode.trim() && hseExpiry) {
                  renewHseSticker(hseVehicleId, hseCode.trim().toUpperCase(), hseExpiry);
                }
                setHseVehicleId(null);
              }}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Emitir Sticker Vigente
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Nuevo código de sticker *</label>
            <input
              type="text"
              value={hseCode}
              onChange={(e) => setHseCode(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Nueva fecha de vencimiento *</label>
            <input
              type="date"
              value={hseExpiry}
              onChange={(e) => setHseExpiry(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
