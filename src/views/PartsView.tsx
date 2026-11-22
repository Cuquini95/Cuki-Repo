import React, { useMemo, useState } from 'react';
import { ArrowDownUp, Plus, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { Part } from '../types/fleet';
import { formatCurrency, formatDate } from '../utils/format';

export const PartsView: React.FC = () => {
  const { state, can, addPart, adjustPartStock } = useFleet();
  const [subTab, setSubTab] = useState<'catalog' | 'movements'>('catalog');
  const [query, setQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<Part | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(5);
  const [adjustReason, setAdjustReason] = useState('Recepción de compra');
  const [adjustRef, setAdjustRef] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const [draft, setDraft] = useState({
    sku: '',
    name: '',
    category: 'Filtros',
    manufacturer: '',
    location: 'Almacén Central · Estante B2',
    quantityOnHand: 5,
    reorderPoint: 3,
    unitCost: 450,
    vendorId: state.vendors.find((v) => v.type === 'Proveedor de Repuestos')?.id || '',
  });

  const filteredParts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.parts
      .filter((p) => (onlyLowStock ? p.quantityOnHand <= p.reorderPoint : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q)
        );
      });
  }, [state.parts, query, onlyLowStock]);

  const totalValuation = useMemo(
    () => state.parts.reduce((acc, p) => acc + p.quantityOnHand * p.unitCost, 0),
    [state.parts]
  );

  const lowStockCount = useMemo(
    () => state.parts.filter((p) => p.quantityOnHand <= p.reorderPoint).length,
    [state.parts]
  );

  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!draft.sku.trim() || !draft.name.trim()) {
      setCreateError('SKU y nombre son obligatorios.');
      return;
    }
    const res = addPart({
      ...draft,
      sku: draft.sku.trim().toUpperCase(),
      quantityOnHand: Number(draft.quantityOnHand),
      reorderPoint: Number(draft.reorderPoint),
      unitCost: Number(draft.unitCost),
      vendorId: draft.vendorId || undefined,
    });
    if (!res.ok) {
      setCreateError(res.error || 'Error al agregar repuesto.');
      return;
    }
    setCreateOpen(false);
    setDraft({ ...draft, sku: '', name: '', manufacturer: '' });
  };

  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setAdjustError('');
    const res = adjustPartStock(adjustTarget.id, Number(adjustDelta), adjustReason, adjustRef);
    if (!res.ok) {
      setAdjustError(res.error || 'No se pudo ajustar el inventario.');
      return;
    }
    setAdjustTarget(null);
    setAdjustRef('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Repuestos e Inventario</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Control de existencias, punto de reorden, valuación y kardex vinculado automáticamente a Órdenes de Trabajo.
          </p>
        </div>
        <button
          type="button"
          disabled={!can('parts:manage')}
          onClick={() => {
            setCreateError('');
            setCreateOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Nuevo Repuesto
        </button>
      </div>

      {/* Valuation Strip */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Valuación Total de Inventario</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(totalValuation, state.settings.currency)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">SKUs Activos</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">
            {state.parts.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Alertas de Punto de Reorden</div>
          <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-red-700">
            {lowStockCount} repuesto(s)
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1 w-fit">
          <button
            type="button"
            onClick={() => setSubTab('catalog')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              subTab === 'catalog' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Catálogo de Repuestos
          </button>
          <button
            type="button"
            onClick={() => setSubTab('movements')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              subTab === 'movements' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kardex de Movimientos{' '}
            <span className="ml-1 font-mono text-[11px] text-slate-400">
              {state.stockMovements.length}
            </span>
          </button>
        </div>

        {subTab === 'catalog' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              Solo stock bajo
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar SKU, nombre o fabricante..."
                className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {subTab === 'catalog' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">SKU y Descripción</th>
                <th className="px-4 py-2.5 font-medium">Categoría / Ubicación</th>
                <th className="px-4 py-2.5 text-right font-medium">Existencia</th>
                <th className="px-4 py-2.5 text-right font-medium">Reorden</th>
                <th className="px-4 py-2.5 text-right font-medium">Costo Unit.</th>
                <th className="px-4 py-2.5 text-right font-medium">Valuación</th>
                <th className="px-4 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParts.map((part) => {
                const low = part.quantityOnHand <= part.reorderPoint;
                return (
                  <tr key={part.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{part.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {part.sku} · {part.manufacturer}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{part.category}</div>
                      <div className="text-[11px] text-slate-500">{part.location}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className={low ? 'font-semibold text-red-700' : 'font-medium text-slate-900'}>
                        {part.quantityOnHand} uds
                      </div>
                      {low && (
                        <div className="text-[11px] font-medium text-red-700">
                          {part.quantityOnHand === 0 ? 'Agotado' : 'Stock bajo'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                      {part.reorderPoint}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(part.unitCost, state.settings.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-900">
                      {formatCurrency(part.quantityOnHand * part.unitCost, state.settings.currency)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!can('parts:manage')}
                        onClick={() => {
                          setAdjustTarget(part);
                          setAdjustDelta(5);
                          setAdjustReason('Recepción de compra');
                          setAdjustError('');
                        }}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <ArrowDownUp className="h-3 w-3" />
                        Ajustar Stock
                      </button>
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
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Repuesto</th>
                <th className="px-4 py-2.5 font-medium">Motivo y Referencia</th>
                <th className="px-4 py-2.5 text-right font-medium">Movimiento</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo Resultante</th>
                <th className="px-4 py-2.5 font-medium">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.stockMovements.map((mv) => {
                const part = state.parts.find((p) => p.id === mv.partId);
                return (
                  <tr key={mv.id}>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(mv.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{part?.name || mv.partId}</div>
                      <div className="font-mono text-[11px] text-slate-500">{part?.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {mv.reason}
                      {mv.referenceCode ? (
                        <span className="ml-1.5 font-mono text-slate-500">· {mv.referenceCode}</span>
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                        mv.delta < 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {mv.delta > 0 ? `+${mv.delta}` : mv.delta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {mv.resultingQty} uds
                    </td>
                    <td className="px-4 py-3 text-slate-600">{mv.performedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Part Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Agregar Repuesto al Catálogo"
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
              form="create-part-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Repuesto
            </button>
          </>
        }
      >
        <form id="create-part-form" onSubmit={handleCreatePart} className="space-y-4 text-xs">
          {createError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">SKU / Número de parte *</label>
              <input
                type="text"
                required
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                placeholder="Ej. FLT-OIL-220"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Nombre *</label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej. Filtro de aceite sintético"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Categoría</label>
              <input
                type="text"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fabricante</label>
              <input
                type="text"
                value={draft.manufacturer}
                onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Existencia inicial</label>
              <input
                type="number"
                min={0}
                value={draft.quantityOnHand}
                onChange={(e) => setDraft({ ...draft, quantityOnHand: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Punto de reorden</label>
              <input
                type="number"
                min={0}
                value={draft.reorderPoint}
                onChange={(e) => setDraft({ ...draft, reorderPoint: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">
                Costo unitario ({state.settings.currency})
              </label>
              <input
                type="number"
                min={0}
                value={draft.unitCost}
                onChange={(e) => setDraft({ ...draft, unitCost: Number(e.target.value) })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Ubicación / Almacén</label>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={adjustTarget ? `Ajustar Stock · ${adjustTarget.sku}` : ''}
        subtitle={
          adjustTarget
            ? `${adjustTarget.name} · Existencia actual: ${adjustTarget.quantityOnHand} uds`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAdjustTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="adjust-stock-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Aplicar Movimiento
            </button>
          </>
        }
      >
        <form id="adjust-stock-form" onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          {adjustError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {adjustError}
            </div>
          )}
          <div>
            <label className="block font-medium text-slate-700">
              Variación de cantidad (positivo para entrada, negativo para salida)
            </label>
            <input
              type="number"
              required
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Motivo</label>
            <input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Referencia (OC / Factura)</label>
            <input
              type="text"
              value={adjustRef}
              onChange={(e) => setAdjustRef(e.target.value)}
              placeholder="Ej. OC-905"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
