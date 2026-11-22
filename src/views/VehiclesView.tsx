import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, FileSpreadsheet, Plus, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import {
  FleetGroup,
  FuelType,
  PmLevel,
  RouteState,
  VehicleStatus,
  VehicleType,
} from '../types/fleet';
import {
  addMonthsIso,
  computeHseStickerStatus,
  exportRowsToCsv,
  formatDistance,
  formatHours,
  hseStickerTextClass,
  todayIso,
  vehicleStatusTextClass,
} from '../utils/format';

interface VehiclesViewProps {
  onNavigate: (next: RouteState) => void;
  openCreateSignal?: number;
}

const STATUS_TABS: ('Todos' | VehicleStatus)[] = [
  'Todos',
  'Activo',
  'En taller',
  'Fuera de servicio',
  'Inactivo',
  'Vendido',
];

const GROUPS: FleetGroup[] = [
  'TMF Panamá · Movimiento de Tierras',
  'Acarreo y Volquetes',
  'Taller y Soporte Técnico',
  'Supervisión HSE y Campo',
];

const VEHICLE_TYPES: VehicleType[] = [
  'Excavadora',
  'Volquete 6x4',
  'Cargador Frontal',
  'Motoniveladora',
  'Tractocamión / Cabezal',
  'Cisterna de Diésel',
  'Pickup 4x4',
];

const FUEL_TYPES: FuelType[] = ['Diésel ULSD', 'Gasolina 95', 'Gasolina 91', 'Eléctrico'];

const PM_LEVELS: PmLevel[] = ['PM1 · 250h', 'PM2 · 500h', 'PM3 · 1000h', 'PM4 · 2000h'];

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  onNavigate,
  openCreateSignal,
}) => {
  const { state, can, addVehicle, bulkUpdateVehicles } = useFleet();
  const [statusFilter, setStatusFilter] = useState<'Todos' | VehicleStatus>('Todos');
  const [groupFilter, setGroupFilter] = useState<'Todos' | FleetGroup>('Todos');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'horometerHrs' | 'odometerKm'>('code');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<VehicleStatus>('Activo');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');

  React.useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) {
      setCreateOpen(true);
    }
  }, [openCreateSignal]);

  const [draft, setDraft] = useState({
    code: '',
    name: '',
    vin: '',
    licensePlate: '',
    year: 2024,
    make: '',
    model: '',
    type: 'Volquete 6x4' as VehicleType,
    status: 'Activo' as VehicleStatus,
    group: 'Acarreo y Volquetes' as FleetGroup,
    fuelType: 'Diésel ULSD' as FuelType,
    odometerKm: 0,
    horometerHrs: 0,
    meterMode: 'dual' as 'horometro' | 'odometro' | 'dual',
    nextPmLevel: 'PM1 · 250h' as PmLevel,
    nextPmHours: 250,
    hseStickerCode: `HSE-TMF-${new Date().getFullYear()}-NEW`,
    hseStickerExpiry: addMonthsIso(todayIso(), 3),
    assignedOperatorId: '',
    purchaseCost: 145000,
    purchaseDate: todayIso(),
    clientProject: state.settings.projectCode,
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.vehicles
      .filter((v) => (statusFilter === 'Todos' ? true : v.status === statusFilter))
      .filter((v) => (groupFilter === 'Todos' ? true : v.group === groupFilter))
      .filter((v) => {
        if (!q) return true;
        return (
          v.code.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.licensePlate.toLowerCase().includes(q) ||
          v.vin.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.hseStickerCode.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortBy === 'code') return a.code.localeCompare(b.code) * dir;
        if (sortBy === 'horometerHrs') return (a.horometerHrs - b.horometerHrs) * dir;
        return (a.odometerKm - b.odometerKm) * dir;
      });
  }, [state.vehicles, statusFilter, groupFilter, query, sortBy, sortAsc]);

  const toggleSort = (col: 'code' | 'horometerHrs' | 'odometerKm') => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((v) => v.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCsv = () => {
    const source =
      selectedIds.length > 0
        ? state.vehicles.filter((v) => selectedIds.includes(v.id))
        : filtered;
    exportRowsToCsv(
      'gtp_panama_flota.csv',
      [
        'Código',
        'Nombre',
        'Placa',
        'Serie / VIN',
        'Año',
        'Marca',
        'Modelo',
        'Tipo',
        'Estado',
        'Grupo',
        'Horómetro (h)',
        'Odómetro (km)',
        'Próx PM',
        'Sticker HSE',
        'Vence HSE',
      ],
      source.map((v) => [
        v.code,
        v.name,
        v.licensePlate,
        v.vin,
        v.year,
        v.make,
        v.model,
        v.type,
        v.status,
        v.group,
        v.horometerHrs,
        v.odometerKm,
        `${v.nextPmLevel} @ ${v.nextPmHours}h`,
        v.hseStickerCode,
        v.hseStickerExpiry,
      ])
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!draft.code.trim() || !draft.name.trim() || !draft.licensePlate.trim()) {
      setFormError('Código, nombre y placa/registro son obligatorios.');
      return;
    }
    if (draft.odometerKm < 0 || draft.horometerHrs < 0) {
      setFormError('Horómetro y odómetro iniciales no pueden ser negativos.');
      return;
    }
    const res = addVehicle({
      ...draft,
      code: draft.code.trim().toUpperCase(),
      licensePlate: draft.licensePlate.trim().toUpperCase(),
      vin: draft.vin.trim().toUpperCase() || 'PENDIENTE-SERIE',
      assignedOperatorId: draft.assignedOperatorId || undefined,
    });
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar el equipo.');
      return;
    }
    setCreateOpen(false);
    setDraft({
      ...draft,
      code: '',
      name: '',
      vin: '',
      licensePlate: '',
      make: '',
      model: '',
      odometerKm: 0,
      horometerHrs: 0,
      notes: '',
    });
  };

  const operators = state.contacts.filter((c) => c.role === 'Operador' || c.role === 'Supervisor');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Flota y Equipos</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Inventario de maquinaria pesada, volquetes y soporte en {state.settings.projectCode} con horómetro, PM y Sticker HSE.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ section: 'settings' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            Google Sheets / Importar
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!can('vehicle:create')}
            title={!can('vehicle:create') ? 'Requiere rol Gerencia o Coordinador' : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nuevo Equipo
          </button>
        </div>
      </div>

      {/* Status Segmented Tabs + Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'Todos'
                ? state.vehicles.length
                : state.vehicles.filter((v) => v.status === tab).length;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab} <span className="ml-1 font-mono text-[11px] tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar código, placa, serie, HSE..."
              className="h-9 w-60 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <select
            aria-label="Filtrar equipos por grupo"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as 'Todos' | FleetGroup)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="Todos">Todos los frentes / grupos</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs">
          <span className="font-medium text-slate-900">
            {selectedIds.length} equipo(s) seleccionado(s)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Nuevo estado en lote"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as VehicleStatus)}
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800"
            >
              {STATUS_TABS.filter((s) => s !== 'Todos').map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!can('vehicle:edit')}
              onClick={() => {
                const res = bulkUpdateVehicles(selectedIds, { status: bulkStatus });
                if (res.ok) setSelectedIds([]);
              }}
              className="h-8 rounded bg-blue-700 px-3 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300"
            >
              Aplicar estado
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Grid */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">No se encontraron equipos</p>
            <p className="mt-1 text-xs text-slate-500">
              Ajusta los filtros de estado/grupo o importa tu hoja FLOTA en Configuración.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('code')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Equipo <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Frente / Tipo</th>
                <th className="px-4 py-2.5 font-medium">Sticker HSE</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('horometerHrs')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Horómetro / PM <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort('odometerKm')}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Odómetro <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right font-medium">Incidencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((veh) => {
                const operator = state.contacts.find((c) => c.id === veh.assignedOperatorId);
                const openIssues = state.issues.filter(
                  (i) => i.vehicleId === veh.id && (i.status === 'Abierta' || i.status === 'En atención')
                ).length;
                const hse = computeHseStickerStatus(veh.hseStickerExpiry);
                return (
                  <tr key={veh.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${veh.code}`}
                        checked={selectedIds.includes(veh.id)}
                        onChange={() => toggleSelectOne(veh.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                      />
                    </td>
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
                        className="text-left"
                      >
                        <div className="font-semibold text-slate-900 hover:text-blue-700">
                          {veh.code} · {veh.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {veh.year} {veh.make} {veh.model} ·{' '}
                          <span className="font-mono text-slate-700">{veh.licensePlate}</span>
                          {operator ? ` · ${operator.name}` : ''}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={vehicleStatusTextClass(veh.status)}>{veh.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{veh.group}</div>
                      <div className="text-[11px] text-slate-500">{veh.type}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={hseStickerTextClass(hse.status)}>{hse.status}</div>
                      <div className="font-mono text-[11px] text-slate-500">{veh.hseStickerCode}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {veh.horometerHrs > 0 ? formatHours(veh.horometerHrs) : '—'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {veh.nextPmLevel} @ {veh.nextPmHours}h
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-900 whitespace-nowrap">
                      {veh.odometerKm > 0
                        ? formatDistance(veh.odometerKm, state.settings.distanceUnit)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      {openIssues > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              section: 'vehicle-detail',
                              selectedVehicleId: veh.id,
                              selectedVehicleTab: 'incidencias',
                            })
                          }
                          className="font-semibold text-red-700 hover:underline"
                        >
                          {openIssues} abierta{openIssues > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Vehicle Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Registrar Nuevo Equipo / Vehículo"
        subtitle="Alta en inventario con lectura inicial de horómetro/odómetro, PM y Sticker HSE."
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
              form="create-vehicle-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Equipo
            </button>
          </>
        }
      >
        <form id="create-vehicle-form" onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Código interno *</label>
              <input
                type="text"
                required
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="Ej. GTP-VOL-21"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Nombre del equipo *</label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Volquete Mack Granite 6x4"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Placa / Registro ATTT *</label>
              <input
                type="text"
                required
                value={draft.licensePlate}
                onChange={(e) => setDraft({ ...draft, licensePlate: e.target.value })}
                placeholder="Ej. PA-TC-9821"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Serie / VIN</label>
              <input
                type="text"
                value={draft.vin}
                onChange={(e) => setDraft({ ...draft, vin: e.target.value })}
                placeholder="Serie de fábrica o VIN"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Marca</label>
              <input
                type="text"
                value={draft.make}
                onChange={(e) => setDraft({ ...draft, make: e.target.value })}
                placeholder="Ej. Caterpillar / Mack / Komatsu"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Modelo</label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="Ej. 336D2 / Granite 64FR"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Horómetro inicial (h)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.horometerHrs}
                onChange={(e) => setDraft({ ...draft, horometerHrs: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Odómetro inicial (km)</label>
              <input
                type="number"
                min={0}
                value={draft.odometerKm}
                onChange={(e) => setDraft({ ...draft, odometerKm: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Tipo de activo</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as VehicleType })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Grupo / Frente</label>
              <select
                value={draft.group}
                onChange={(e) => setDraft({ ...draft, group: e.target.value as FleetGroup })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Próximo nivel PM</label>
              <select
                value={draft.nextPmLevel}
                onChange={(e) => setDraft({ ...draft, nextPmLevel: e.target.value as PmLevel })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {PM_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Próximo PM (horas)</label>
              <input
                type="number"
                min={0}
                value={draft.nextPmHours}
                onChange={(e) => setDraft({ ...draft, nextPmHours: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Código Sticker HSE</label>
              <input
                type="text"
                value={draft.hseStickerCode}
                onChange={(e) => setDraft({ ...draft, hseStickerCode: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Vencimiento Sticker HSE</label>
              <input
                type="date"
                value={draft.hseStickerExpiry}
                onChange={(e) => setDraft({ ...draft, hseStickerExpiry: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Combustible</label>
              <select
                value={draft.fuelType}
                onChange={(e) => setDraft({ ...draft, fuelType: e.target.value as FuelType })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Operador asignado</label>
              <select
                value={draft.assignedOperatorId}
                onChange={(e) => setDraft({ ...draft, assignedOperatorId: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Sin asignar</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.positionCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Notas operativas</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
