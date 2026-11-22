import React, { useMemo, useState } from 'react';
import { Plus, Search, Wrench } from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { FailureCategory, Issue, IssuePriority, IssueStatus, RouteState } from '../types/fleet';
import {
  formatDate,
  issuePriorityTextClass,
  issueStatusTextClass,
  todayIso,
} from '../utils/format';

interface IssuesViewProps {
  initialQuery?: string;
  onNavigate: (next: RouteState) => void;
}

const STATUS_FILTERS: ('Todas' | IssueStatus)[] = [
  'Todas',
  'Abierta',
  'En atención',
  'Resuelta',
  'Cerrada',
];

export const IssuesView: React.FC<IssuesViewProps> = ({ onNavigate, initialQuery }) => {
  const { state, can, addIssue, resolveIssue, updateIssueStatus, createWorkOrder } = useFleet();
  const [statusFilter, setStatusFilter] = useState<'Todas' | IssueStatus>('Todas');
  const [priorityFilter, setPriorityFilter] = useState<'Todas' | IssuePriority>('Todas');
  const [query, setQuery] = useState(initialQuery ?? '');

  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Issue | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const [draft, setDraft] = useState({
    vehicleId: state.vehicles[0]?.id || '',
    title: '',
    description: '',
    category: 'Hidráulico' as FailureCategory,
    priority: 'Alta' as IssuePriority,
    assignedToId: '',
  });

  const technicians = state.contacts.filter(
    (c) => c.role === 'Mecánico' || c.role === 'Jefe de Taller'
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.issues
      .filter((i) => (statusFilter === 'Todas' ? true : i.status === statusFilter))
      .filter((i) => (priorityFilter === 'Todas' ? true : i.priority === priorityFilter))
      .filter((i) => {
        if (!q) return true;
        const veh = state.vehicles.find((v) => v.id === i.vehicleId);
        return (
          i.code.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          (veh?.code.toLowerCase().includes(q) ?? false) ||
          (veh?.name.toLowerCase().includes(q) ?? false)
        );
      });
  }, [state.issues, state.vehicles, statusFilter, priorityFilter, query]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const res = addIssue({
      vehicleId: draft.vehicleId,
      title: draft.title,
      description: draft.description || 'Reportada desde panel de incidencias.',
      category: draft.category,
      priority: draft.priority,
      assignedToId: draft.assignedToId || undefined,
    });
    if (res.ok) {
      setCreateOpen(false);
      setDraft({ ...draft, title: '', description: '' });
    }
  };

  const handleConvertToWorkOrder = (issue: Issue) => {
    const veh = state.vehicles.find((v) => v.id === issue.vehicleId);
    const defaultTech = technicians[0];
    const res = createWorkOrder({
      vehicleId: issue.vehicleId,
      status: 'Abierta',
      priority: issue.priority,
      failureCategory: issue.category || 'Motor y Tren Motriz',
      progress: 0,
      vendorId: state.vendors.find((v) => v.type === 'Taller Mecánico')?.id,
      summary: `Atención ${issue.code}: ${issue.title}`,
      description: issue.description,
      scheduledDate: todayIso(),
      odometerKm: veh?.odometerKm || 0,
      horometerHrs: veh?.horometerHrs || undefined,
      linkedIssueIds: [issue.id],
      linkedReminderIds: [],
      laborItems: defaultTech
        ? [
            {
              id: `lab-init-${Date.now()}`,
              taskName: `Diagnóstico y reparación: ${issue.title}`,
              technicianId: defaultTech.id,
              hours: 2,
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Fallas</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Fallas reportadas en campo, taller e inspecciones.
          </p>
        </div>
        <button
          type="button"
          disabled={!can('issue:create')}
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Reportar Incidencia
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="vektor-tabs" role="group" aria-label="Vistas disponibles">
          {STATUS_FILTERS.map((st) => {
            const count =
              st === 'Todas'
                ? state.issues.length
                : state.issues.filter((i) => i.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                aria-pressed={statusFilter === st}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st} <span className="ml-1 font-mono text-[11px] text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Folio, falla o equipo"
              aria-label="Buscar falla"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs sm:w-56 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <select
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'Todas' | IssuePriority)}
            className="min-h-10 w-full max-w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 sm:w-auto"
          >
            <option value="Todas">Todas las prioridades</option>
            <option value="Crítica">Crítica</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
      </div>

      {/* Issues Table */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500">
            No hay incidencias que coincidan con el filtro actual.
          </div>
        ) : (
          <TableViewport label="Fallas registradas">
            <table className="vektor-data-table" style={{ minWidth: 825 }} aria-label="Fallas registradas">
              <colgroup>
                <col />
                <col style={{ width: 155 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 115 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Falla</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Equipo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Prioridad</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Origen</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((iss) => {
                  const veh = state.vehicles.find((v) => v.id === iss.vehicleId);
                  const linkedWo = state.workOrders.find((w) => w.id === iss.workOrderId);
                  return (
                    <tr key={iss.id} className="hover:bg-slate-50/70">
                      <td className="max-w-md px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          <span className="font-mono text-slate-500">{iss.code}</span> · {iss.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {iss.description}
                          {iss.resolutionNote ? ` · Nota cierre: ${iss.resolutionNote}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              section: 'vehicle-detail',
                              selectedVehicleId: iss.vehicleId,
                              selectedVehicleTab: 'incidencias',
                            })
                          }
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {veh ? `${veh.code} · ${veh.make}` : iss.vehicleId}
                        </button>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap ${issuePriorityTextClass(iss.priority)}`}>
                        {iss.priority}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`vektor-status ${issueStatusTextClass(iss.status)}`}>{iss.status}</div>
                        {linkedWo && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({ section: 'work-orders', selectedWorkOrderId: linkedWo.id })
                            }
                            className="font-mono text-[11px] text-blue-700 hover:underline"
                          >
                            {linkedWo.code}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <div>{iss.source}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {formatDate(iss.reportedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {iss.status === 'Abierta' && (
                            <>
                              <button
                                type="button"
                                disabled={!can('workorder:manage')}
                                onClick={() => handleConvertToWorkOrder(iss)}
                                className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Wrench className="h-3 w-3" />
                                Crear OT
                              </button>
                              <button
                                type="button"
                                disabled={!can('issue:resolve')}
                                onClick={() => {
                                  setResolveTarget(iss);
                                  setResolutionNote('');
                                }}
                                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                Resolver
                              </button>
                            </>
                          )}
                          {iss.status === 'Resuelta' && can('issue:resolve') && (
                            <button
                              type="button"
                              onClick={() => updateIssueStatus(iss.id, 'Cerrada')}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900"
                            >
                              Cerrar
                            </button>
                          )}
                          {(iss.status === 'Resuelta' || iss.status === 'Cerrada') && can('issue:resolve') && (
                            <button
                              type="button"
                              onClick={() => updateIssueStatus(iss.id, 'Abierta')}
                              className="text-xs font-medium text-blue-700 hover:underline"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableViewport>
        )}
      </div>

      {/* Create Issue Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Reportar Reportar falla"
        maxWidthClass="max-w-lg"
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
              form="create-issue-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Incidencia
            </button>
          </>
        }
      >
        <form id="create-issue-form" onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Vehículo *</label>
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
              <label className="block font-medium text-slate-700">Prioridad *</label>
              <select
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as IssuePriority })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="Crítica">Crítica</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Resumen del defecto *</label>
            <input
              type="text"
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ej. Fuga en radiador superior"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Descripción técnica</label>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Sistema / Categoría</label>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as FailureCategory })
                }
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {(
                  [
                    'Hidráulico',
                    'Motor y Tren Motriz',
                    'Frenos y Neumático',
                    'Eléctrico',
                    'Tren de Rodaje',
                    'Llantas',
                    'PM Preventivo',
                    'Cabina y HSE',
                  ] as FailureCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Mecánico asignado</label>
              <select
                value={draft.assignedToId}
                onChange={(e) => setDraft({ ...draft, assignedToId: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                <option value="">Sin asignar</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.positionCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Resolve Issue Modal */}
      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title={resolveTarget ? `Resolver ${resolveTarget.code}` : ''}
        subtitle={resolveTarget?.title}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setResolveTarget(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (resolveTarget) {
                  resolveIssue(resolveTarget.id, resolutionNote);
                  setResolveTarget(null);
                }
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Confirmar Resolución
            </button>
          </>
        }
      >
        <div className="space-y-2 text-xs">
          <label className="block font-medium text-slate-700">Nota de resolución</label>
          <textarea
            rows={3}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Indica la acción correctiva realizada..."
            className="w-full rounded-md border border-slate-300 p-2.5"
          />
        </div>
      </Modal>
    </div>
  );
};
