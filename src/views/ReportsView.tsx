import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { useFleet } from '../store/FleetContext';
import { RouteState } from '../types/fleet';
import {
  computeVehicleTCO,
  exportRowsToCsv,
  formatCurrency,
  formatDistance,
  formatEfficiency,
} from '../utils/format';

interface ReportsViewProps {
  onNavigate: (next: RouteState) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNavigate }) => {
  const { state } = useFleet();

  const tcoRows = useMemo(() => {
    return state.vehicles
      .map((veh) => {
        const tco = computeVehicleTCO(veh.id, state);
        return {
          veh,
          ...tco,
        };
      })
      .sort((a, b) => b.totalOperatingCost - a.totalOperatingCost);
  }, [state]);

  const fleetTotals = useMemo(() => {
    const maintenance = tcoRows.reduce((s, r) => s + r.maintenanceCost, 0);
    const fuel = tcoRows.reduce((s, r) => s + r.fuelCost, 0);
    const inventory = state.parts.reduce((s, p) => s + p.quantityOnHand * p.unitCost, 0);
    const totalInspectedItems = state.inspections.reduce(
      (s, i) => s + i.passedCount + i.failedCount,
      0
    );
    const totalFailedItems = state.inspections.reduce((s, i) => s + i.failedCount, 0);
    const failRate =
      totalInspectedItems > 0 ? (totalFailedItems / totalInspectedItems) * 100 : 0;
    return { maintenance, fuel, total: maintenance + fuel, inventory, failRate };
  }, [tcoRows, state.parts, state.inspections]);

  const chartData = tcoRows.map((r) => ({
    code: r.veh.code,
    Combustible: Math.round(r.fuelCost),
    Mantenimiento: Math.round(r.maintenanceCost),
  }));

  const handleExportTco = () => {
    exportRowsToCsv(
      'vektor_reporte_tco.csv',
      ['Código', 'Vehículo', 'Grupo', 'Odómetro (km)', 'Mantenimiento', 'Combustible', 'Total Operativo', 'Costo/km', 'Rendimiento (km/L)'],
      tcoRows.map((r) => [
        r.veh.code,
        r.veh.name,
        r.veh.group,
        r.veh.odometerKm,
        r.maintenanceCost.toFixed(2),
        r.fuelCost.toFixed(2),
        r.totalOperatingCost.toFixed(2),
        r.costPerKm.toFixed(2),
        r.avgKmPerLiter.toFixed(2),
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Reportes y Analítica TCO</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Costo Total de Propiedad por vehículo, eficiencia de combustible, tasa de fallas DVIR y valuación de inventario.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportTco}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar Reporte TCO (CSV)
        </button>
      </div>

      {/* Top Financial KPIs */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Gasto Operativo Total</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(fleetTotals.total, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Mantenimiento + Combustible</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Mantenimiento (OT)</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(fleetTotals.maintenance, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {fleetTotals.total > 0
              ? `${Math.round((fleetTotals.maintenance / fleetTotals.total) * 100)}% del gasto`
              : '0%'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Valuación de Inventario</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(fleetTotals.inventory, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{state.parts.length} SKUs en almacén</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Tasa de Fallas DVIR</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {fleetTotals.failRate.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Sobre {state.inspections.length} inspecciones registradas
          </div>
        </div>
      </div>

      {/* Stacked Cost Chart */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Composición de Costo Operativo por Unidad ({state.settings.currency})
        </h2>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
              />
              <Tooltip
                formatter={(val) =>
                  formatCurrency(Number(val ?? 0), state.settings.currency)
                }
                contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Bar dataKey="Combustible" stackId="a" fill="#1d4ed8" />
              <Bar dataKey="Mantenimiento" stackId="a" fill="#64748b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* TCO Table */}
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Desglose TCO por Vehículo</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
              <th className="px-4 py-2.5 font-medium">Vehículo</th>
              <th className="px-4 py-2.5 font-medium">Grupo</th>
              <th className="px-4 py-2.5 text-right font-medium">Odómetro</th>
              <th className="px-4 py-2.5 text-right font-medium">Mantenimiento</th>
              <th className="px-4 py-2.5 text-right font-medium">Combustible</th>
              <th className="px-4 py-2.5 text-right font-medium">Total Operativo</th>
              <th className="px-4 py-2.5 text-right font-medium">Costo / km</th>
              <th className="px-4 py-2.5 text-right font-medium">Rendimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tcoRows.map((row) => (
              <tr key={row.veh.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        section: 'vehicle-detail',
                        selectedVehicleId: row.veh.id,
                        selectedVehicleTab: 'resumen',
                      })
                    }
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {row.veh.code} · {row.veh.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.veh.group}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                  {formatDistance(row.veh.odometerKm, state.settings.distanceUnit)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                  {formatCurrency(row.maintenanceCost, state.settings.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                  {formatCurrency(row.fuelCost, state.settings.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                  {formatCurrency(row.totalOperatingCost, state.settings.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                  {formatCurrency(row.costPerKm, state.settings.currency)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                  {formatEfficiency(row.avgKmPerLiter, state.settings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
