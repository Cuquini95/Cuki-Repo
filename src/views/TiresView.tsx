import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, Gauge, Plus, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { RouteState, TireRecord, TireStatus } from '../types/fleet';
import {
  exportRowsToCsv,
  formatCurrency,
  formatDate,
  formatHours,
  tireStatusTextClass,
  todayIso,
} from '../utils/format';

interface TiresViewProps {
  initialQuery?: string;
  onNavigate: (next: RouteState) => void;
}

const STATUS_FILTERS: ('Todas' | TireStatus)[] = [
  'Todas',
  'Montada',
  'En almacén',
  'Reencauche',
  'Desecho',
];

export const TiresView: React.FC<TiresViewProps> = ({ onNavigate, initialQuery }) => {
  const { state, can, addTire, inspectTire, addIssue } = useFleet();
  const [statusFilter, setStatusFilter] = useState<'Todas' | TireStatus>('Todas');
  const [query, setQuery] = useState(initialQuery ?? '');

  // Create Tire modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [draft, setDraft] = useState({
    serial: '',
    brand: 'Bridgestone VMT',
    size: '12.00R24',
    vehicleId: state.vehicles[0]?.id || '',
    axlePosition: 'Eje 1 · Delantero Izq.',
    treadDepthMm: 22,
    minTreadMm: 6,
    pressurePsi: 115,
    targetPsi: 115,
    hoursUsed: 0,
    unitCost: 780,
    status: 'Montada' as TireStatus,
  });

  // Inspect Tire modal
  const [inspectTarget, setInspectTarget] = useState<TireRecord | null>(null);
  const [inspectMm, setInspectMm] = useState(12);
  const [inspectPsi, setInspectPsi] = useState(110);
  const [inspectStatus, setInspectStatus] = useState<TireStatus>('Montada');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.tires
      .filter((t) => (statusFilter === 'Todas' ? true : t.status === statusFilter))
      .filter((t) => {
        if (!q) return true;
        const veh = state.vehicles.find((v) => v.id === t.vehicleId);
        return (
          t.serial.toLowerCase().includes(q) ||
          t.brand.toLowerCase().includes(q) ||
          t.size.toLowerCase().includes(q) ||
          t.axlePosition.toLowerCase().includes(q) ||
          (veh?.code.toLowerCase().includes(q) ?? false)
        );
      });
  }, [state.tires, state.vehicles, statusFilter, query]);

  const metrics = useMemo(() => {
    const mounted = state.tires.filter((t) => t.status === 'Montada').length;
    const criticalWear = state.tires.filter(
      (t) => t.status === 'Montada' && t.treadDepthMm <= t.minTreadMm
    ).length;
    const inStock = state.tires.filter((t) => t.status === 'En almacén').length;
    const totalValue = state.tires
      .filter((t) => t.status !== 'Desecho')
      .reduce((acc, t) => acc + t.unitCost, 0);
    return { mounted, criticalWear, inStock, totalValue };
  }, [state.tires]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!draft.serial.trim() || !draft.brand.trim() || !draft.size.trim()) {
      setCreateError('Serial, marca y medida son obligatorios.');
      return;
    }
    const res = addTire({
      serial: draft.serial.trim().toUpperCase(),
      brand: draft.brand.trim(),
      size: draft.size.trim(),
      vehicleId: draft.status === 'Montada' ? draft.vehicleId || undefined : undefined,
      axlePosition: draft.status === 'Montada' ? draft.axlePosition.trim() : 'Bodega Llantas',
      treadDepthMm: Number(draft.treadDepthMm),
      minTreadMm: Number(draft.minTreadMm),
      pressurePsi: Number(draft.pressurePsi),
      targetPsi: Number(draft.targetPsi),
      hoursUsed: Number(draft.hoursUsed),
      unitCost: Number(draft.unitCost),
      status: draft.status,
      lastInspectedAt: todayIso(),
    });
    if (!res.ok) {
      setCreateError(res.error || 'No se pudo registrar la llanta.');
      return;
    }
    setCreateOpen(false);
    setDraft({ ...draft, serial: '' });
  };

  const handleInspectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectTarget) return;
    inspectTire(inspectTarget.id, Number(inspectMm), Number(inspectPsi), inspectStatus);
    setInspectTarget(null);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      'gtp_panama_llantas.csv',
      ['Serial', 'Marca', 'Medida', 'Unidad', 'Posición', 'Profundidad mm', 'Mín mm', 'Presión PSI', 'Horas', 'Costo USD', 'Estado', 'Última Insp.'],
      filtered.map((t) => {
        const veh = state.vehicles.find((v) => v.id === t.vehicleId);
        return [
          t.serial,
          t.brand,
          t.size,
          veh?.code || 'Bodega',
          t.axlePosition,
          t.treadDepthMm,
          t.minTreadMm,
          t.pressurePsi,
          t.hoursUsed,
          t.unitCost,
          t.status,
          t.lastInspectedAt,
        ];
      })
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Control de Llantas y Neumáticos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Seguimiento de profundidad de banda (mm), presión PSI, rotaciones y desgaste OTR/volquetes (TP-PER-015).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            disabled={!can('tires:manage')}
            onClick={() => {
              setCreateError('');
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Registrar Llanta
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Llantas Montadas</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
            {metrics.mounted}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">En operación activa</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Alerta de Desgaste</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-red-700">
            {metrics.criticalWear}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Banda &le; mínimo de retiro</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Disponibles en Bodega</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-blue-700">
            {metrics.inStock}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Listas para reemplazo</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Valor Activo en Llantas</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
            {formatCurrency(metrics.totalValue, state.settings.currency)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Excluye unidades en desecho</div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1">
          {STATUS_FILTERS.map((st) => {
            const count =
              st === 'Todas'
                ? state.tires.length
                : state.tires.filter((t) => t.status === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st} <span className="ml-1 font-mono text-[11px] tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar serial, marca, unidad..."
            className="h-9 w-60 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
              <th className="px-4 py-2.5 font-medium">Serial / Marca</th>
              <th className="px-4 py-2.5 font-medium">Unidad y Posición</th>
              <th className="px-4 py-2.5 text-right font-medium">Banda (mm)</th>
              <th className="px-4 py-2.5 text-right font-medium">Presión (PSI)</th>
              <th className="px-4 py-2.5 text-right font-medium">Horas / Costo</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((tire) => {
              const veh = state.vehicles.find((v) => v.id === tire.vehicleId);
              const isWorn = tire.treadDepthMm <= tire.minTreadMm && tire.status === 'Montada';
              const lowPressure =
                tire.status === 'Montada' && tire.pressurePsi < tire.targetPsi * 0.9;
              return (
                <tr key={tire.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">{tire.serial}</div>
                    <div className="text-[11px] text-slate-500">
                      {tire.brand} · {tire.size}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {veh ? (
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
                        {veh.code} · {veh.make} {veh.model}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-600">Almacén Central</span>
                    )}
                    <div className="text-[11px] text-slate-500">{tire.axlePosition}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className={isWorn ? 'font-semibold text-red-700' : 'font-medium text-slate-900'}>
                      {tire.treadDepthMm.toFixed(1)} mm
                    </div>
                    <div className="text-[11px] text-slate-400">Mín. {tire.minTreadMm} mm</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className={lowPressure ? 'font-semibold text-amber-700' : 'text-slate-800'}>
                      {tire.pressurePsi} PSI
                    </div>
                    <div className="text-[11px] text-slate-400">Obj. {tire.targetPsi} PSI</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                    <div className="text-slate-800">{formatHours(tire.hoursUsed)}</div>
                    <div className="text-[11px] text-slate-500">
                      {formatCurrency(tire.unitCost, state.settings.currency)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={tireStatusTextClass(tire.status)}>{tire.status}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      Insp. {formatDate(tire.lastInspectedAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!can('tires:manage')}
                        onClick={() => {
                          setInspectTarget(tire);
                          setInspectMm(tire.treadDepthMm);
                          setInspectPsi(tire.pressurePsi);
                          setInspectStatus(tire.status);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                      >
                        <Gauge className="h-3 w-3" />
                        Inspeccionar
                      </button>
                      {isWorn && veh && (
                        <button
                          type="button"
                          disabled={!can('issue:create')}
                          onClick={() => {
                            addIssue({
                              vehicleId: veh.id,
                              title: `Reemplazo de llanta ${tire.serial} (${tire.axlePosition})`,
                              description: `Profundidad crítica de ${tire.treadDepthMm} mm (mínimo ${tire.minTreadMm} mm) detectada en control de llantas.`,
                              category: 'Llantas',
                              priority: 'Alta',
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50/60 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100/70 disabled:opacity-40 whitespace-nowrap"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Reportar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Registrar Llanta */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Registrar Llanta / Neumático"
        subtitle="Alta en inventario con marcaje a fuego, posición en eje y profundidad inicial."
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-tire-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Llanta
            </button>
          </>
        }
      >
        <form id="create-tire-form" onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Serial / Código fuego *</label>
              <input
                type="text"
                required
                value={draft.serial}
                onChange={(e) => setDraft({ ...draft, serial: e.target.value })}
                placeholder="Ej. GTP-LL-109"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Marca y modelo *</label>
              <input
                type="text"
                required
                value={draft.brand}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Medida *</label>
              <input
                type="text"
                required
                value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                placeholder="Ej. 12.00R24 o 23.5R25"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Estado</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as TireStatus })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Montada">Montada</option>
                <option value="En almacén">En almacén</option>
                <option value="Reencauche">Reencauche</option>
              </select>
            </div>
            {draft.status === 'Montada' && (
              <>
                <div>
                  <label className="block font-medium text-slate-700">Unidad asignada</label>
                  <select
                    value={draft.vehicleId}
                    onChange={(e) => setDraft({ ...draft, vehicleId: e.target.value })}
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
                  <label className="block font-medium text-slate-700">Posición en eje</label>
                  <input
                    type="text"
                    value={draft.axlePosition}
                    onChange={(e) => setDraft({ ...draft, axlePosition: e.target.value })}
                    className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block font-medium text-slate-700">Profundidad actual (mm)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                value={draft.treadDepthMm}
                onChange={(e) => setDraft({ ...draft, treadDepthMm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Mínimo retiro (mm)</label>
              <input
                type="number"
                step="0.5"
                min={1}
                value={draft.minTreadMm}
                onChange={(e) => setDraft({ ...draft, minTreadMm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Presión actual (PSI)</label>
              <input
                type="number"
                min={0}
                value={draft.pressurePsi}
                onChange={(e) => setDraft({ ...draft, pressurePsi: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Costo unitario ({state.settings.currency})</label>
              <input
                type="number"
                min={0}
                value={draft.unitCost}
                onChange={(e) => setDraft({ ...draft, unitCost: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Inspeccionar Llanta */}
      <Modal
        open={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        title={`Inspección de Llanta · ${inspectTarget?.serial || ''}`}
        subtitle={`${inspectTarget?.brand || ''} ${inspectTarget?.size || ''} · ${inspectTarget?.axlePosition || ''}`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setInspectTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="inspect-tire-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Medición
            </button>
          </>
        }
      >
        <form id="inspect-tire-form" onSubmit={handleInspectSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Profundidad de banda medida (mm)</label>
            <input
              type="number"
              step="0.5"
              min={0}
              required
              value={inspectMm}
              onChange={(e) => setInspectMm(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Presión medida (PSI)</label>
            <input
              type="number"
              min={0}
              required
              value={inspectPsi}
              onChange={(e) => setInspectPsi(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Estado de llanta</label>
            <select
              value={inspectStatus}
              onChange={(e) => setInspectStatus(e.target.value as TireStatus)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="Montada">Montada</option>
              <option value="En almacén">En almacén</option>
              <option value="Reencauche">Reencauche</option>
              <option value="Desecho">Desecho</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
