import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { ContactRole, FleetGroup, VendorType } from '../types/fleet';
import {
  computePurchaseOrderTotal,
  computeWorkOrderTotals,
  formatCurrency,
  formatDate,
} from '../utils/format';

export const DirectoryView: React.FC = () => {
  const { state, can, addContact, addVendor } = useFleet();
  const [subTab, setSubTab] = useState<'contacts' | 'vendors'>('contacts');
  const [contactOpen, setContactOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  const [cDraft, setCDraft] = useState({
    positionCode: 'TP-PER-029',
    name: '',
    role: 'Operador' as ContactRole,
    email: '',
    phone: '',
    group: 'TMF Panamá · Movimiento de Tierras' as FleetGroup,
    licenseNumber: '',
    licenseExpiry: '',
    hourlyRate: 30,
  });

  const [vDraft, setVDraft] = useState({
    name: '',
    type: 'Taller Mecánico' as VendorType,
    contactName: '',
    phone: '',
    email: '',
    city: 'Panamá',
    rating: 4.5,
  });

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cDraft.name.trim()) return;
    const isTech = cDraft.role === 'Mecánico' || cDraft.role === 'Jefe de Taller';
    const res = addContact({
      positionCode: cDraft.positionCode.trim() || 'TP-PER-099',
      name: cDraft.name.trim(),
      role: cDraft.role,
      email: cDraft.email.trim(),
      phone: cDraft.phone.trim(),
      group: cDraft.group,
      licenseNumber: cDraft.licenseNumber.trim() || undefined,
      licenseExpiry: cDraft.licenseExpiry || undefined,
      hourlyRate: isTech ? Number(cDraft.hourlyRate) : undefined,
      active: true,
    });
    if (res.ok) {
      setContactOpen(false);
      setCDraft({
        ...cDraft,
        positionCode: `TP-PER-${String(state.contacts.length + 30).padStart(3, '0')}`,
        name: '',
        email: '',
        phone: '',
        licenseNumber: '',
      });
    }
  };

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vDraft.name.trim()) return;
    const res = addVendor({
      ...vDraft,
      name: vDraft.name.trim(),
      rating: Number(vDraft.rating),
    });
    if (res.ok) {
      setVendorOpen(false);
      setVDraft({ ...vDraft, name: '', contactName: '', phone: '', email: '', city: 'Panamá' });
    }
  };

  const vendorSpend = (vendorId: string) => {
    const woSpend = state.workOrders
      .filter((w) => w.vendorId === vendorId && w.status !== 'Cancelada')
      .reduce((acc, w) => acc + computeWorkOrderTotals(w).total, 0);
    const fuelSpend = state.fuelEntries
      .filter((f) => f.vendorId === vendorId)
      .reduce((acc, f) => acc + f.totalCost, 0);
    const poSpend = state.purchaseOrders
      .filter((p) => p.vendorId === vendorId && p.status !== 'Rechazada')
      .reduce((acc, p) => acc + computePurchaseOrderTotal(p).total, 0);
    return woSpend + fuelSpend + poSpend;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Directorio</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Personal, talleres y proveedores.
          </p>
        </div>
        <button
          type="button"
          disabled={!can('directory:manage')}
          onClick={() => (subTab === 'contacts' ? setContactOpen(true) : setVendorOpen(true))}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          {subTab === 'contacts' ? 'Nuevo Contacto' : 'Nuevo Proveedor'}
        </button>
      </div>

      <div className="vektor-tabs" role="group" aria-label="Vistas disponibles">
        <button
          type="button"
          onClick={() => setSubTab('contacts')}
          aria-pressed={subTab === 'contacts'}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'contacts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Contactos y Personal{' '}
          <span className="ml-1 font-mono text-[11px] text-slate-400">{state.contacts.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('vendors')}
          aria-pressed={subTab === 'vendors'}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'vendors' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Proveedores y Talleres{' '}
          <span className="ml-1 font-mono text-[11px] text-slate-400">{state.vendors.length}</span>
        </button>
      </div>

      {subTab === 'contacts' ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <TableViewport label="Personal">
            <table className="vektor-data-table" style={{ minWidth: 925 }} aria-label="Personal">
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 180 }} />
                <col />
                <col style={{ width: 105 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Nombre</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Rol</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contacto</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Licencia / Tarifa</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Equipos asignados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.contacts.map((cnt) => {
                  const assignedCount = state.vehicles.filter(
                    (v) => v.assignedOperatorId === cnt.id
                  ).length;
                  return (
                    <tr key={cnt.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{cnt.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{cnt.positionCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{cnt.role}</td>
                      <td className="px-4 py-3 text-slate-600">{cnt.group}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{cnt.email}</div>
                        <div className="font-mono text-[11px] text-slate-400">{cnt.phone}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                        {(cnt.role === 'Mecánico' || cnt.role === 'Jefe de Taller') && cnt.hourlyRate
                          ? `${formatCurrency(cnt.hourlyRate, state.settings.currency)}/h`
                          : cnt.licenseNumber
                          ? `${cnt.licenseNumber} · Vence ${formatDate(cnt.licenseExpiry)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                        {assignedCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableViewport>
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <TableViewport label="Proveedores">
            <table className="vektor-data-table" style={{ minWidth: 875 }} aria-label="Proveedores">
              <colgroup>
                <col style={{ width: 190 }} />
                <col style={{ width: 145 }} />
                <col />
                <col style={{ width: 125 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 125 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Proveedor</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Clasificación</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contacto</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Ciudad</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Calificación</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Gasto acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.vendors.map((vnd) => (
                  <tr key={vnd.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{vnd.name}</td>
                    <td className="px-4 py-3 text-slate-700">{vnd.type}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{vnd.contactName}</div>
                      <div className="text-[11px] text-slate-400">
                        {vnd.email} · {vnd.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{vnd.city}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {vnd.rating.toFixed(1)} / 5.0
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-slate-900">
                      {formatCurrency(vendorSpend(vnd.id), state.settings.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
        </div>
      )}

      {/* Add Contact Modal */}
      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Registrar Contacto / Personal"
        footer={
          <>
            <button
              type="button"
              onClick={() => setContactOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="add-contact-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Contacto
            </button>
          </>
        }
      >
        <form id="add-contact-form" onSubmit={handleAddContact} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700">Código posición (TP-PER) *</label>
              <input
                type="text"
                required
                value={cDraft.positionCode}
                onChange={(e) => setCDraft({ ...cDraft, positionCode: e.target.value })}
                placeholder="TP-PER-029"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Nombre completo *</label>
              <input
                type="text"
                required
                value={cDraft.name}
                onChange={(e) => setCDraft({ ...cDraft, name: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Rol operativo</label>
              <select
                value={cDraft.role}
                onChange={(e) => setCDraft({ ...cDraft, role: e.target.value as ContactRole })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Operador">Operador</option>
                <option value="Mecánico">Mecánico</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Jefe de Taller">Jefe de Taller</option>
                <option value="Almacén">Almacén</option>
                <option value="Gerencia">Gerencia</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Frente / Grupo</label>
              <select
                value={cDraft.group}
                onChange={(e) => setCDraft({ ...cDraft, group: e.target.value as FleetGroup })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="TMF Panamá · Movimiento de Tierras">TMF Panamá · Movimiento de Tierras</option>
                <option value="Acarreo y Volquetes">Acarreo y Volquetes</option>
                <option value="Taller y Soporte Técnico">Taller y Soporte Técnico</option>
                <option value="Supervisión HSE y Campo">Supervisión HSE y Campo</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Correo</label>
              <input
                type="email"
                value={cDraft.email}
                onChange={(e) => setCDraft({ ...cDraft, email: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Teléfono</label>
              <input
                type="text"
                value={cDraft.phone}
                onChange={(e) => setCDraft({ ...cDraft, phone: e.target.value })}
                placeholder="+507 6XXX-XXXX"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            {cDraft.role === 'Mecánico' || cDraft.role === 'Jefe de Taller' ? (
              <div className="col-span-2">
                <label className="block font-medium text-slate-700">
                  Tarifa mano de obra / hora ({state.settings.currency})
                </label>
                <input
                  type="number"
                  min={0}
                  value={cDraft.hourlyRate}
                  onChange={(e) => setCDraft({ ...cDraft, hourlyRate: Number(e.target.value) })}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
                />
              </div>
            ) : (
              <div className="col-span-2">
                <label className="block font-medium text-slate-700">Número de licencia (ATTT / Equipo Pesado)</label>
                <input
                  type="text"
                  value={cDraft.licenseNumber}
                  onChange={(e) => setCDraft({ ...cDraft, licenseNumber: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 font-mono"
                />
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal
        open={vendorOpen}
        onClose={() => setVendorOpen(false)}
        title="Registrar Proveedor o Taller"
        footer={
          <>
            <button
              type="button"
              onClick={() => setVendorOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="add-vendor-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Proveedor
            </button>
          </>
        }
      >
        <form id="add-vendor-form" onSubmit={handleAddVendor} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700">Razón social / Nombre *</label>
              <input
                type="text"
                required
                value={vDraft.name}
                onChange={(e) => setVDraft({ ...vDraft, name: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Tipo</label>
              <select
                value={vDraft.type}
                onChange={(e) => setVDraft({ ...vDraft, type: e.target.value as VendorType })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Taller Mecánico">Taller Mecánico</option>
                <option value="Proveedor de Repuestos">Proveedor de Repuestos</option>
                <option value="Distribuidor Diésel / Combustible">Distribuidor Diésel / Combustible</option>
                <option value="Proveedor de Llantas">Proveedor de Llantas</option>
                <option value="Aseguradora / HSE">Aseguradora / HSE</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Persona de contacto</label>
              <input
                type="text"
                value={vDraft.contactName}
                onChange={(e) => setVDraft({ ...vDraft, contactName: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Ciudad</label>
              <input
                type="text"
                value={vDraft.city}
                onChange={(e) => setVDraft({ ...vDraft, city: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Teléfono</label>
              <input
                type="text"
                value={vDraft.phone}
                onChange={(e) => setVDraft({ ...vDraft, phone: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700">Correo</label>
              <input
                type="email"
                value={vDraft.email}
                onChange={(e) => setVDraft({ ...vDraft, email: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
