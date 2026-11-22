import React, { useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { FuelType, RouteState } from '../types/fleet';
import {
  exportRowsToCsv,
  formatCurrency,
  formatDate,
  formatDistance,
  formatEfficiency,
  formatHours,
  formatVolume,
  todayIso,
} from '../utils/format';

interface FuelViewProps {
  onNavigate: (next: RouteState) => void;
}

export const FuelView: React.FC<FuelViewProps> = ({ onNavigate }) => {
  const { state, can, addFuelEntry } = useFleet();
  const [vehicleFilter, setVehicleFilter] = useState('Todos');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const defaultVeh = state.vehicles[0];
  const fuelVendors = state.vendors.filter(
    (v) => v.type === 'Distribuidor Diésel / Combustible'
  );
  const operators = state.contacts.filter(
    (c) => c.role === 'Operador' || c.role === 'Supervisor'
  );

  const [draft, setDraft] = useState({
    vehicleId: defaultVeh?.id || '',
    operatorId: defaultVeh?.assignedOperatorId || operators[0]?.id || '',
    vendorId: fuelVendors[0]?.id || '',
    date: todayIso(),
    odometerKm: defaultVeh?.odometerKm ? defaultVeh.odometerKm + 320 : 0,
    horometerHrs: defaultVeh?.horometerHrs ? defaultVeh.horometerHrs + 24 : 0,
    liters: 180,
    pricePerLiter: 0.98,
    fuelType: (defaultVeh?.fuelType || 'Diésel ULSD') as FuelType,
    partialFill: false,
    allowBackwardsOdometer: false,
    notes: '',
  });

  const filtered = useMemo(
    () =>
      state.fuelEntries.filter((f) =>
        vehicleFilter === 'Todos' ? true : f.vehicleId === vehicleFilter
      ),
    [state.fuelEntries, vehicleFilter]
  );

  const summary = useMemo(() => {
    const totalCost = filtered.reduce((acc, f) => acc + f.totalCost, 0);
    const totalLiters = filtered.reduce((acc, f) => acc + f.liters, 0);
    const effs = filtered
      .map((f) => f.kmPerLiter)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgEff = effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : 0;
    return { totalCost, totalLiters, avgEff };
  }, [filtered]);

  const handleSelectVehicle = (vid: string) => {
    const v = state.vehicles.find((x) => x.id === vid);
    setDraft((prev) => ({
      ...prev,
      vehicleId: vid,
      odometerKm: v?.odometerKm ? v.odometerKm + 320 : 0,
      horometerHrs: v?.horometerHrs ? v.horometerHrs + 24 : 0,
      fuelType: v?.fuelType || prev.fuelType,
      operatorId: v?.assignedOperatorId || prev.operatorId,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const res = addFuelEntry({
      vehicleId: draft.vehicleId,
      operatorId: draft.operatorId || undefined,
      vendorId: draft.vendorId || undefined,
      date: draft.date,
      odometerKm: Number(draft.odometerKm),
      horometerHrs: Number(draft.horometerHrs) > 0 ? Number(draft.horometerHrs) : undefined,
      liters: Number(draft.liters),
      pricePerLiter: Number(draft.pricePerLiter),
      fuelType: draft.fuelType,
      partialFill: draft.partialFill,
      allowBackwardsOdometer: draft.allowBackwardsOdometer,
      notes: draft.notes.trim() || undefined,
    });
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar la carga.');
      return;
    }
    setCreateOpen(false);
    setDraft((prev) => ({ ...prev, notes: '', allowBackwardsOdometer: false }));
  };

  const handleExport = () => {
    exportRowsToCsv(
      'vektor_combustible_panama.csv',
      [
        'Fecha',
        'Equipo / Unidad',
        'Horómetro (h)',
        'Odómetro (km)',
        'Volumen (L)',
        'Precio/L',
        'Total',
        'Rendimiento (km/L)',
        'Consumo (gal/h)',
        'Costo/km',
        'Tipo',
      ],
      filtered.map((f) => {
        const veh = state.vehicles.find((v) => v.id === f.vehicleId);
        return [
          f.date,
          veh ? `${veh.code} ${veh.name}` : f.vehicleId,
          f.horometerHrs ?? '',
          f.odometerKm,
          f.liters,
          f.pricePerLiter,
          f.totalCost,
          f.kmPerLiter ?? '',
          f.galPerHour ?? '',
          f.costPerKm ?? '',
          f.fuelType,
        ];
      })
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Combustible</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Registro de cargas, control de rendimiento (km/L), costo por kilómetro y actualización automática de odómetro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            disabled={!can('fuel:create')}
            onClick={() => {
              setFormError('');
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Registrar Combustible
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Gasto Total Filtrado</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(summary.totalCost, state.settings.currency)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Volumen Consumido</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatVolume(summary.totalLiters, state.settings.volumeUnit)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Rendimiento Promedio</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatEfficiency(summary.avgEff, state.settings)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3">
        <select
          aria-label="Filtrar cargas por vehículo"
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700"
        >
          <option value="Todos">Todos los vehículos ({state.fuelEntries.length} cargas)</option>
          {state.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.code} · {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Equipo / Unidad</th>
              <th className="px-4 py-2.5 font-medium">Distribuidor y Tipo</th>
              <th className="px-4 py-2.5 text-right font-medium">Medidor (h / km)</th>
              <th className="px-4 py-2.5 text-right font-medium">Volumen</th>
              <th className="px-4 py-2.5 text-right font-medium">Rendimiento</th>
              <th className="px-4 py-2.5 text-right font-medium">Costo/km</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((f) => {
              const veh = state.vehicles.find((v) => v.id === f.vehicleId);
              const vendor = state.vendors.find((v) => v.id === f.vendorId);
              return (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                    {formatDate(f.date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          section: 'vehicle-detail',
                          selectedVehicleId: f.vehicleId,
                          selectedVehicleTab: 'combustible',
                        })
                      }
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {veh ? `${veh.code} · ${veh.make}` : f.vehicleId}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{vendor?.name || 'Despacho en frente'}</div>
                    <div className="text-[11px] text-slate-500">
                      {f.fuelType}
                      {f.partialFill ? ' · Carga parcial' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    <div>
                      {f.horometerHrs && f.horometerHrs > 0
                        ? formatHours(f.horometerHrs)
                        : formatDistance(f.odometerKm, state.settings.distanceUnit)}
                    </div>
                    {f.horometerHrs && f.horometerHrs > 0 && f.odometerKm > 0 && (
                      <div className="text-[11px] text-slate-400">
                        {formatDistance(f.odometerKm, state.settings.distanceUnit)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {formatVolume(f.liters, state.settings.volumeUnit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {f.galPerHour
                      ? `${f.galPerHour.toFixed(1)} gal/h`
                      : formatEfficiency(f.kmPerLiter, state.settings)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {f.costPerKm ? formatCurrency(f.costPerKm, state.settings.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-900 whitespace-nowrap">
                    {formatCurrency(f.totalCost, state.settings.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Fuel Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Registrar Carga de Combustible"
        subtitle="Actualiza el odómetro de la unidad y recalcula rendimiento km/L automáticamente."
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
              form="add-fuel-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Carga
            </button>
          </>
        }
      >
        <form id="add-fuel-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Equipo / Unidad *</label>
              <select
                value={draft.vehicleId}
                onChange={(e) => handleSelectVehicle(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} · {v.name} ({v.horometerHrs.toLocaleString('es-PA')} h · {v.odometerKm.toLocaleString('es-PA')} km)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fecha *</label>
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Horómetro (h)</label>
              <input
                type="number"
                min={0}
                value={draft.horometerHrs}
                onChange={(e) => setDraft({ ...draft, horometerHrs: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Odómetro en bomba (km) *</label>
              <input
                type="number"
                min={0}
                required
                value={draft.odometerKm}
                onChange={(e) => setDraft({ ...draft, odometerKm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Distribuidor / Tanquero</label>
              <select
                value={draft.vendorId}
                onChange={(e) => setDraft({ ...draft, vendorId: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {fuelVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Tipo de combustible</label>
              <select
                value={draft.fuelType}
                onChange={(e) => setDraft({ ...draft, fuelType: e.target.value as FuelType })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Diésel ULSD">Diésel ULSD</option>
                <option value="Gasolina 95">Gasolina 95</option>
                <option value="Gasolina 91">Gasolina 91</option>
                <option value="Eléctrico">Eléctrico</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Litros despachados *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={draft.liters}
                onChange={(e) => setDraft({ ...draft, liters: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">
                Precio por litro ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={draft.pricePerLiter}
                onChange={(e) => setDraft({ ...draft, pricePerLiter: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-slate-600">Importe total calculado</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              {formatCurrency(draft.liters * draft.pricePerLiter, state.settings.currency)}
            </span>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={draft.partialFill}
                onChange={(e) => setDraft({ ...draft, partialFill: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              Carga parcial (no llenar tanque completo; omite cálculo km/L puntual)
            </label>
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={draft.allowBackwardsOdometer}
                onChange={(e) =>
                  setDraft({ ...draft, allowBackwardsOdometer: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              Permitir registro histórico con odómetro menor al actual
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};
