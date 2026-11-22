import React, { useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import { Modal } from '../components/Modal';
import { useFleet } from '../store/FleetContext';
import { InspectionItemResult, InspectionResponseItem, RouteState } from '../types/fleet';
import { formatDate, formatDistance, formatHours } from '../utils/format';

interface InspectionsViewProps {
  onNavigate: (next: RouteState) => void;
}

export const InspectionsView: React.FC<InspectionsViewProps> = ({ onNavigate }) => {
  const { state, can, submitInspection, addInspectionForm } = useFleet();
  const [subTab, setSubTab] = useState<'submissions' | 'forms'>('submissions');
  const [runOpen, setRunOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [newFormOpen, setNewFormOpen] = useState(false);

  const defaultForm = state.inspectionForms[0];
  const defaultVehicle = state.vehicles[0];
  const operators = state.contacts.filter((c) => c.role === 'Operador' || c.role === 'Supervisor');

  const [runFormId, setRunFormId] = useState(defaultForm?.id || '');
  const [runVehicleId, setRunVehicleId] = useState(defaultVehicle?.id || '');
  const [runOperatorId, setRunOperatorId] = useState(operators[0]?.id || '');
  const [runOdometer, setRunOdometer] = useState(defaultVehicle?.odometerKm || 0);
  const [runHorometer, setRunHorometer] = useState(defaultVehicle?.horometerHrs || 0);
  const [runNotes, setRunNotes] = useState('');
  const [runError, setRunError] = useState('');
  const [responses, setResponses] = useState<Record<string, { result: InspectionItemResult; note: string }>>({});

  // New Form Draft
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFreq, setFormFreq] = useState<'Diaria' | 'Semanal' | 'Mensual' | 'Pre-Viaje'>('Pre-Viaje');
  const [formItemsText, setFormItemsText] = useState(
    'Frenos y pedal\nNeumáticos y birlos\nLuces y señalización\nNiveles de fluidos'
  );

  const openRunModal = () => {
    const f = state.inspectionForms[0];
    const v = state.vehicles[0];
    setRunFormId(f?.id || '');
    setRunVehicleId(v?.id || '');
    setRunOperatorId(v?.assignedOperatorId || operators[0]?.id || '');
    setRunOdometer(v?.odometerKm || 0);
    setRunHorometer(v?.horometerHrs || 0);
    setRunNotes('');
    setRunError('');
    const init: Record<string, { result: InspectionItemResult; note: string }> = {};
    f?.items.forEach((it) => {
      init[it.id] = { result: 'Pasa', note: '' };
    });
    setResponses(init);
    setRunOpen(true);
  };

  const handleSelectForm = (fid: string) => {
    setRunFormId(fid);
    const f = state.inspectionForms.find((item) => item.id === fid);
    const init: Record<string, { result: InspectionItemResult; note: string }> = {};
    f?.items.forEach((it) => {
      init[it.id] = { result: 'Pasa', note: '' };
    });
    setResponses(init);
  };

  const handleSelectVehicle = (vid: string) => {
    setRunVehicleId(vid);
    const v = state.vehicles.find((item) => item.id === vid);
    if (v) {
      setRunOdometer(v.odometerKm);
      setRunHorometer(v.horometerHrs);
      if (v.assignedOperatorId) setRunOperatorId(v.assignedOperatorId);
    }
  };

  const activeTemplate = state.inspectionForms.find((f) => f.id === runFormId);

  const handleSubmitRun = (e: React.FormEvent) => {
    e.preventDefault();
    setRunError('');
    if (!activeTemplate) return;

    const items: InspectionResponseItem[] = activeTemplate.items.map((item) => ({
      itemId: item.id,
      label: item.label,
      result: responses[item.id]?.result || 'Pasa',
      note: responses[item.id]?.note?.trim() || undefined,
    }));

    const res = submitInspection({
      formId: activeTemplate.id,
      vehicleId: runVehicleId,
      operatorId: runOperatorId,
      odometerKm: Number(runOdometer),
      horometerHrs: Number(runHorometer) > 0 ? Number(runHorometer) : undefined,
      items,
      notes: runNotes.trim() || undefined,
    });

    if (!res.ok) {
      setRunError(res.error || 'Error al registrar inspección.');
      return;
    }
    setRunOpen(false);
  };

  const handleCreateForm = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = formItemsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!formName.trim() || lines.length === 0) return;

    const res = addInspectionForm({
      name: formName.trim(),
      description: formDesc.trim() || 'Formulario personalizado de inspección DVIR.',
      frequency: formFreq,
      active: true,
      items: lines.map((label, idx) => ({
        id: `custom-fi-${Date.now()}-${idx}`,
        label,
        category: 'General',
        required: true,
        criticalOnFail: idx === 0,
      })),
    });
    if (res.ok) {
      setNewFormOpen(false);
      setFormName('');
      setFormDesc('');
    }
  };

  const selectedSubmission = state.inspections.find((s) => s.id === selectedSubmissionId);
  const inspectionSubtitle = selectedSubmission
    ? [
        selectedSubmission.formName,
        formatDate(selectedSubmission.submittedAt),
        selectedSubmission.horometerHrs ? formatHours(selectedSubmission.horometerHrs) : null,
        selectedSubmission.odometerKm ? formatDistance(selectedSubmission.odometerKm, state.settings.distanceUnit) : null,
      ].filter(Boolean).join(' · ')
    : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Inspecciones</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Las fallas registradas generan una incidencia vinculada al equipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subTab === 'forms' && (
            <button
              type="button"
              disabled={!can('inspection:manage_forms')}
              onClick={() => setNewFormOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Formulario
            </button>
          )}
          <button
            type="button"
            disabled={!can('inspection:submit')}
            onClick={openRunModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap"
          >
            <ClipboardCheck className="h-4 w-4" />
            Nueva inspección
          </button>
        </div>
      </div>

      {/* Subtabs */}
      <div className="vektor-tabs" role="group" aria-label="Vistas disponibles">
        <button
          type="button"
          onClick={() => setSubTab('submissions')}
          aria-pressed={subTab === 'submissions'}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'submissions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Registradas <span className="ml-1 font-mono text-[11px] text-slate-400">{state.inspections.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('forms')}
          aria-pressed={subTab === 'forms'}
          className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'forms' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Formularios <span className="ml-1 font-mono text-[11px] text-slate-400">{state.inspectionForms.length}</span>
        </button>
      </div>

      {subTab === 'submissions' ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <TableViewport label="Inspecciones registradas">
            <table className="vektor-data-table vektor-mobile-cards" style={{ minWidth: 1015 }} aria-label="Inspecciones registradas" role="table">
              <colgroup>
                <col style={{ width: 100 }} />
                <col style={{ width: 180 }} />
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 105 }} />
                <col style={{ width: 105 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead role="rowgroup">
                <tr role="row" className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Folio</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Equipo</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Formulario</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Operador</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Fecha</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 text-right font-medium">Medidores</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 font-medium">Resultado</th>
                  <th role="columnheader" scope="col" className="px-4 py-2.5 text-right font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody role="rowgroup" className="divide-y divide-slate-100">
                {state.inspections.map((insp) => {
                  const veh = state.vehicles.find((v) => v.id === insp.vehicleId);
                  const op = state.contacts.find((c) => c.id === insp.operatorId);
                  return (
                    <tr role="row" key={insp.id} className="hover:bg-slate-50/70">
                      <td role="cell" data-label="Inspección" className="px-4 py-3 font-mono font-semibold text-slate-900">{insp.code}</td>
                      <td role="cell" data-label="Equipo" data-card-wide className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({
                              section: 'vehicle-detail',
                              selectedVehicleId: insp.vehicleId,
                              selectedVehicleTab: 'inspecciones',
                            })
                          }
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {veh ? `${veh.code} · ${veh.name}` : insp.vehicleId}
                        </button>
                      </td>
                      <td role="cell" data-label="Formulario" data-card-wide className="px-4 py-3 text-slate-700">{insp.formName}</td>
                      <td role="cell" data-label="Operador" className="px-4 py-3 text-slate-700">{op?.name || '—'}</td>
                      <td role="cell" data-label="Fecha" className="px-4 py-3 font-mono text-slate-600">{formatDate(insp.submittedAt)}</td>
                      <td role="cell" data-label="Medidores" className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {typeof insp.horometerHrs === 'number' && insp.horometerHrs > 0 && (
                          <div>{formatHours(insp.horometerHrs)}</div>
                        )}
                        {insp.odometerKm > 0 && (
                          <div className="text-[11px] text-slate-500">
                            {formatDistance(insp.odometerKm, state.settings.distanceUnit)}
                          </div>
                        )}
                      </td>
                      <td role="cell" data-label="Resultado" className="px-4 py-3">
                        <span className={insp.failedCount > 0 ? 'font-semibold text-red-700' : 'font-medium text-emerald-700'}>
                          {insp.status}
                        </span>{' '}
                        <span className="text-slate-500">
                          · {insp.passedCount} OK / {insp.failedCount} fallas
                        </span>
                      </td>
                      <td role="cell" data-card-wide className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmissionId(insp.id)}
                          className="font-medium text-blue-700 hover:text-blue-800"
                        >
                          Ver inspección
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableViewport>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {state.inspectionForms.map((form) => (
            <section key={form.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{form.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{form.description}</p>
                </div>
                <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  {form.frequency}
                </span>
              </div>
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-xs">
                {form.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2">
                    <span className="text-slate-800">{it.label}</span>
                    <span className="text-[11px] text-slate-500">
                      {it.category}
                      {it.criticalOnFail ? ' · Crítico al fallar' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Run Inspection Modal */}
      <Modal
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title="Nueva inspección Vehicular (DVIR)"
        subtitle="Cada punto marcado como Falla creará automáticamente una incidencia y actualizará el odómetro."
        footer={
          <>
            <button
              type="button"
              onClick={() => setRunOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="run-dvir-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Enviar Inspección
            </button>
          </>
        }
      >
        <form id="run-dvir-form" onSubmit={handleSubmitRun} className="space-y-4 text-xs">
          {runError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-700">
              {runError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700">Formulario *</label>
              <select
                value={runFormId}
                onChange={(e) => handleSelectForm(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {state.inspectionForms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Vehículo *</label>
              <select
                value={runVehicleId}
                onChange={(e) => handleSelectVehicle(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {state.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} · {v.name} ({v.horometerHrs > 0 ? `${v.horometerHrs} h` : `${v.odometerKm.toLocaleString('es-PA')} km`})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700">Operador *</label>
              <select
                value={runOperatorId}
                onChange={(e) => setRunOperatorId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
              >
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.positionCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700">Horómetro (h)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={runHorometer}
                  onChange={(e) => setRunHorometer(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700">Odómetro (km)</label>
                <input
                  type="number"
                  min={0}
                  value={runOdometer}
                  onChange={(e) => setRunOdometer(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2.5 font-mono"
                />
              </div>
            </div>
          </div>

          {activeTemplate && (
            <div className="space-y-2.5 border-t border-slate-200 pt-3">
              <div className="font-semibold text-slate-800">Puntos de verificación</div>
              {activeTemplate.items.map((item) => {
                const current = responses[item.id] || { result: 'Pasa', note: '' };
                return (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 bg-slate-50/50 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-medium text-slate-900">{item.label}</span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          {item.category}
                          {item.criticalOnFail ? ' · Crítico' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {(['Pasa', 'Falla', 'N/A'] as InspectionItemResult[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...current, result: opt },
                              }))
                            }
                            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                              current.result === opt
                                ? opt === 'Falla'
                                  ? 'bg-red-700 text-white'
                                  : opt === 'Pasa'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-slate-700 text-white'
                                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {current.result === 'Falla' && (
                      <input
                        type="text"
                        value={current.note}
                        onChange={(e) =>
                          setResponses((prev) => ({
                            ...prev,
                            [item.id]: { ...current, note: e.target.value },
                          }))
                        }
                        placeholder="Describe el defecto detectado (se copiará a la incidencia automática)..."
                        className="mt-2 h-8 w-full rounded border border-red-200 bg-white px-2.5 text-xs text-slate-900 focus:border-red-500 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700">Observaciones generales</label>
            <textarea
              rows={2}
              value={runNotes}
              onChange={(e) => setRunNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5"
            />
          </div>
        </form>
      </Modal>

      {/* Submission Detail Modal */}
      <Modal
        open={Boolean(selectedSubmission)}
        onClose={() => setSelectedSubmissionId(null)}
        title={selectedSubmission ? `Inspección ${selectedSubmission.code}` : ''}
        subtitle={inspectionSubtitle}
        footer={
          <button
            type="button"
            onClick={() => setSelectedSubmissionId(null)}
            className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
        }
      >
        {selectedSubmission && (
          <div className="space-y-3 text-xs">
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {selectedSubmission.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-4 px-4 py-2.5">
                  <div>
                    <div className="font-medium text-slate-900">{it.label}</div>
                    {it.note && <div className="mt-0.5 text-slate-600">{it.note}</div>}
                    {it.createdIssueId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmissionId(null);
                          onNavigate({ section: 'issues' });
                        }}
                        className="mt-1 text-[11px] font-medium text-blue-700 hover:underline"
                      >
                        Ver incidencia generada →
                      </button>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-medium ${
                      it.result === 'Falla'
                        ? 'text-red-700'
                        : it.result === 'Pasa'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {it.result}
                  </span>
                </li>
              ))}
            </ul>
            {selectedSubmission.notes && (
              <p className="text-slate-600">
                <span className="font-medium text-slate-800">Notas: </span>
                {selectedSubmission.notes}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* New Inspection Form Modal */}
      <Modal
        open={newFormOpen}
        onClose={() => setNewFormOpen(false)}
        title="Crear Formulario de Inspección DVIR"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewFormOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="new-dvir-template-form"
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Guardar Formulario
            </button>
          </>
        }
      >
        <form id="new-dvir-template-form" onSubmit={handleCreateForm} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Nombre del formulario *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ej. Inspección de Caja Refrigerada"
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Frecuencia</label>
            <select
              value={formFreq}
              onChange={(e) => setFormFreq(e.target.value as typeof formFreq)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="Pre-Viaje">Pre-Viaje</option>
              <option value="Diaria">Diaria</option>
              <option value="Semanal">Semanal</option>
              <option value="Mensual">Mensual</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Descripción</label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">
              Ítems de verificación (uno por línea) *
            </label>
            <textarea
              rows={5}
              required
              value={formItemsText}
              onChange={(e) => setFormItemsText(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
