import React, { useMemo, useState } from 'react';
import { Check, CreditCard, Download, FileText, PackageCheck, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, RouteState } from '../types/fleet';
import {
  computePurchaseOrderTotal,
  exportRowsToCsv,
  formatCurrency,
  formatDate,
  purchaseOrderStatusTextClass,
  todayIso,
} from '../utils/format';

interface PurchasingViewProps {
  initialQuery?: string;
  onNavigate: (next: RouteState) => void;
}

const PIPELINE_TABS: ('Todas' | PurchaseOrderStatus)[] = [
  'Todas',
  'Requisición',
  'Aprobada',
  'Recibida en Almacén',
  'Facturada / Por Pagar',
  'Pagada',
];

export const PurchasingView: React.FC<PurchasingViewProps> = ({ onNavigate, initialQuery }) => {
  const {
    state,
    can,
    createPurchaseOrder,
    approvePurchaseOrder,
    receivePurchaseOrder,
    recordPoInvoice,
    payPurchaseOrder,
  } = useFleet();

  const [statusFilter, setStatusFilter] = useState<'Todas' | PurchaseOrderStatus>('Todas');

  const [query, setQuery] = useState(initialQuery ?? '');

  // Create PO modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [vendorId, setVendorId] = useState(state.vendors[0]?.id || '');
  const [workOrderId, setWorkOrderId] = useState('');
  const [neededBy, setNeededBy] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<
    { partId: string; description: string; quantity: number; unitCost: number }[]
  >(() => {
    const firstPart = state.parts[0];
    return [
      {
        partId: firstPart?.id || '',
        description: firstPart?.name || '',
        quantity: 2,
        unitCost: firstPart?.unitCost || 50,
      },
    ];
  });

  // Invoice modal
  const [invoiceTarget, setInvoiceTarget] = useState<PurchaseOrder | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');

  // Payment modal
  const [payTarget, setPayTarget] = useState<PurchaseOrder | null>(null);
  const [paymentRef, setPaymentRef] = useState('');

  const filtered = useMemo(
    () =>
      state.purchaseOrders.filter((po) => {
        const term = query.trim().toLowerCase();
        return (statusFilter === 'Todas' || po.status === statusFilter) &&
          (po.code.toLowerCase().includes(term) || (po.invoiceNumber ?? '').toLowerCase().includes(term));
      }),
    [state.purchaseOrders, statusFilter, query]
  );

  const metrics = useMemo(() => {
    let committed = 0;
    let pendingApproval = 0;
    let pendingReceiving = 0;
    let accountsPayable = 0;
    state.purchaseOrders.forEach((po) => {
      const { total } = computePurchaseOrderTotal(po);
      if (po.status !== 'Rechazada') committed += total;
      if (po.status === 'Requisición' || po.status === 'Cotizada') pendingApproval += 1;
      if (po.status === 'Aprobada') pendingReceiving += 1;
      if (po.status === 'Facturada / Por Pagar') accountsPayable += total;
    });
    return { committed, pendingApproval, pendingReceiving, accountsPayable };
  }, [state.purchaseOrders]);

  const handleLinePartSelect = (idx: number, partId: string) => {
    const part = state.parts.find((p) => p.id === partId);
    setLines((prev) =>
      prev.map((ln, i) =>
        i === idx
          ? {
              ...ln,
              partId,
              description: part ? `${part.sku} · ${part.name}` : ln.description,
              unitCost: part ? part.unitCost : ln.unitCost,
            }
          : ln
      )
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const validItems: PurchaseOrderItem[] = lines
      .filter((l) => l.description.trim() && l.quantity > 0 && l.unitCost >= 0)
      .map((l, idx) => ({
        id: `poi-${Date.now()}-${idx}`,
        partId: l.partId || undefined,
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      }));

    if (!vendorId || validItems.length === 0) {
      setCreateError('Selecciona un proveedor y al menos un ítem válido.');
      return;
    }

    const res = createPurchaseOrder({
      vendorId,
      workOrderId: workOrderId || undefined,
      neededBy,
      items: validItems,
      notes: notes.trim() || undefined,
    });
    if (!res.ok) {
      setCreateError(res.error || 'No se pudo crear la requisición / OC.');
      return;
    }
    setCreateOpen(false);
    setNotes('');
    setWorkOrderId('');
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      'gtp_panama_compras_cxp.csv',
      ['Folio OC', 'Proveedor', 'Solicitado por', 'OT', 'Fecha', 'Estado', 'Factura', 'Vencimiento CxP', 'Total USD'],
      filtered.map((po) => {
        const vendor = state.vendors.find((v) => v.id === po.vendorId);
        const wo = state.workOrders.find((w) => w.id === po.workOrderId);
        return [
          po.code,
          vendor?.name || po.vendorId,
          po.requestedBy,
          wo?.code || '',
          po.createdAt,
          po.status,
          po.invoiceNumber || '',
          po.invoiceDueDate || '',
          computePurchaseOrderTotal(po).total.toFixed(2),
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
            Compras, Órdenes de Compra y Cuentas por Pagar
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Flujo completo de requisición → aprobación Gerencia → recepción en Almacén (+kardex) → facturación y pago ACH (ITBMS 7%).
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
            disabled={!can('purchasing:request')}
            onClick={() => {
              setCreateError('');
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nueva Requisición / OC
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs text-slate-500">Total Comprometido</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
            {formatCurrency(metrics.committed, state.settings.currency)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Incluye ITBMS 7%</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Pendiente de Aprobación</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-700">
            {metrics.pendingApproval}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Requiere firma Gerencia</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Por Recibir en Almacén</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-blue-700">
            {metrics.pendingReceiving}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Aprobadas en tránsito</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">Cuentas por Pagar (CxP)</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-red-700">
            {formatCurrency(metrics.accountsPayable, state.settings.currency)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Facturas pendientes de pago</div>
        </div>
      </section>

      {/* Segmented Pipeline Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-100/80 p-1">
        {PIPELINE_TABS.map((tab) => {
          const count =
            tab === 'Todas'
              ? state.purchaseOrders.length
              : state.purchaseOrders.filter((p) => p.status === tab).length;
          const active = statusFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab} <span className="ml-1 font-mono text-[11px] tabular-nums text-slate-400">{count}</span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        aria-label="Buscar orden de compra"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar OC o factura…"
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm sm:max-w-72"
      />

      {/* Purchase Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-500">
            No hay órdenes de compra en el estado seleccionado.
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Folio / Fecha</th>
                <th className="px-4 py-2.5 font-medium">Proveedor y Detalle</th>
                <th className="px-4 py-2.5 font-medium">OT / Factura</th>
                <th className="px-4 py-2.5 text-right font-medium">Total (ITBMS)</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Siguiente Paso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((po) => {
                const vendor = state.vendors.find((v) => v.id === po.vendorId);
                const wo = state.workOrders.find((w) => w.id === po.workOrderId);
                const totals = computePurchaseOrderTotal(po);
                return (
                  <tr key={po.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-slate-900">{po.code}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {formatDate(po.createdAt)} · Req: {formatDate(po.neededBy)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {vendor?.name || po.vendorId}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-600">
                        {po.items.map((it) => `${it.quantity}× ${it.description}`).join(' · ')}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        Solicitó: {po.requestedBy}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {wo ? (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({ section: 'work-orders', selectedWorkOrderId: wo.id })
                          }
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {wo.code}
                        </button>
                      ) : (
                        <span className="text-slate-400">Stock bodega</span>
                      )}
                      {po.invoiceNumber && (
                        <div className="text-slate-800">
                          Fac: {po.invoiceNumber}
                          {po.invoiceDueDate ? ` · Vence ${formatDate(po.invoiceDueDate)}` : ''}
                        </div>
                      )}
                      {po.paymentRef && (
                        <div className="text-emerald-700">Pago: {po.paymentRef}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(totals.total, state.settings.currency)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Sub {formatCurrency(totals.subtotal, state.settings.currency)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={purchaseOrderStatusTextClass(po.status)}>{po.status}</div>
                      {po.receivedAt && (
                        <div className="font-mono text-[11px] text-slate-400">
                          Rec. {formatDate(po.receivedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(po.status === 'Requisición' || po.status === 'Cotizada') && (
                        <button
                          type="button"
                          disabled={!can('purchasing:approve')}
                          onClick={() => approvePurchaseOrder(po.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
                        >
                          <Check className="h-3 w-3" />
                          Aprobar OC
                        </button>
                      )}
                      {po.status === 'Aprobada' && (
                        <button
                          type="button"
                          disabled={!can('purchasing:receive')}
                          onClick={() => receivePurchaseOrder(po.id)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          Recibir (+Stock)
                        </button>
                      )}
                      {po.status === 'Recibida en Almacén' && (
                        <button
                          type="button"
                          disabled={!can('purchasing:receive') && !can('purchasing:pay')}
                          onClick={() => {
                            setInvoiceTarget(po);
                            setInvoiceNumber(`FAC-PA-${Math.floor(1000 + Math.random() * 9000)}`);
                            const due = new Date();
                            due.setDate(due.getDate() + 30);
                            setInvoiceDueDate(due.toISOString().slice(0, 10));
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                        >
                          <FileText className="h-3 w-3" />
                          Registrar Factura
                        </button>
                      )}
                      {po.status === 'Facturada / Por Pagar' && (
                        <button
                          type="button"
                          disabled={!can('purchasing:pay')}
                          onClick={() => {
                            setPayTarget(po);
                            setPaymentRef(`ACH-BG-${new Date().getFullYear()}-${po.code.slice(-3)}`);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap"
                        >
                          <CreditCard className="h-3 w-3" />
                          Pagar ACH
                        </button>
                      )}
                      {po.status === 'Pagada' && (
                        <span className="font-mono text-[11px] text-slate-400">
                          Pagada {formatDate(po.paidAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Nueva Requisición / OC */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva Requisición / Orden de Compra"
        subtitle="Vincula repuestos del catálogo para que al recibirse en Almacén se incremente el stock automáticamente."
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
              form="create-po-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Crear Requisición
            </button>
          </>
        }
      >
        <form id="create-po-form" onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-medium text-slate-700">Proveedor *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
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
              <label className="block font-medium text-slate-700">OT vinculada (opcional)</label>
              <select
                value={workOrderId}
                onChange={(e) => setWorkOrderId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="">Reposición de Almacén</option>
                {state.workOrders
                  .filter((w) => w.status !== 'Completada' && w.status !== 'Cancelada')
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.summary}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Fecha requerida *</label>
              <input
                type="date"
                required
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700">Partidas de compra *</label>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { partId: '', description: '', quantity: 1, unitCost: 0 },
                  ])
                }
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                + Agregar línea
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {lines.map((ln, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-12"
                >
                  <select
                    aria-label="Repuesto de catálogo"
                    value={ln.partId}
                    onChange={(e) => handleLinePartSelect(idx, e.target.value)}
                    className="h-8 rounded border border-slate-300 bg-white px-2 text-xs sm:col-span-4"
                  >
                    <option value="">Ítem libre (no catálogo)</option>
                    {state.parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Descripción"
                    value={ln.description}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, description: e.target.value } : item
                        )
                      )
                    }
                    className="h-8 rounded border border-slate-300 bg-white px-2 text-xs sm:col-span-4"
                  />
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Cant."
                    value={ln.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, quantity: Number(e.target.value) } : item
                        )
                      )
                    }
                    className="h-8 rounded border border-slate-300 bg-white px-2 font-mono text-xs sm:col-span-1"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="USD"
                    value={ln.unitCost}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, unitCost: Number(e.target.value) } : item
                        )
                      )
                    }
                    className="h-8 rounded border border-slate-300 bg-white px-2 font-mono text-xs sm:col-span-2"
                  />
                  <div className="flex items-center justify-end sm:col-span-1">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-slate-400 hover:text-red-700"
                        aria-label="Eliminar partida"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700">Notas / Justificación</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Urgente para liberar excavadora en frente TMF"
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Registrar Factura CxP */}
      <Modal
        open={Boolean(invoiceTarget)}
        onClose={() => setInvoiceTarget(null)}
        title={`Registrar Factura Proveedor · ${invoiceTarget?.code || ''}`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setInvoiceTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (invoiceTarget && invoiceNumber.trim() && invoiceDueDate) {
                  recordPoInvoice(invoiceTarget.id, invoiceNumber.trim(), invoiceDueDate);
                }
                setInvoiceTarget(null);
              }}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Enviar a Cuentas por Pagar
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Número de factura fiscal *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Fecha de vencimiento *</label>
            <input
              type="date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Pagar OC / ACH */}
      <Modal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title={`Registrar Pago ACH · ${payTarget?.code || ''}`}
        subtitle={
          payTarget
            ? `Monto a liquidar: ${formatCurrency(
                computePurchaseOrderTotal(payTarget).total,
                state.settings.currency
              )}`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (payTarget && paymentRef.trim()) {
                  payPurchaseOrder(payTarget.id, paymentRef.trim());
                }
                setPayTarget(null);
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Confirmar Pago
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="block font-medium text-slate-700">Referencia bancaria / ACH *</label>
          <input
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="Ej. ACH-BG-2026-8842"
            className="h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
          />
        </div>
      </Modal>
    </div>
  );
};
