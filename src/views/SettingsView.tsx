import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import { ROLE_LABELS, useFleet } from '../store/FleetContext';
import { UserRole } from '../types/fleet';

const SAMPLE_SHEETS_ROWS = `Codigo\tNombre\tMarca\tModelo\tPlaca\tHorometro\tOdometro\tEstado
GTP-VOL-09\tVolquete Volvo FMX 460 #09\tVolvo\tFMX 460 8x4\tTM-9012\t3450\t88200\tActivo
GTP-RET-03\tRetroexcavadora CAT 420F2 #03\tCaterpillar\t420F2\tEQ-4203\t2180\t0\tEn Taller`;

export const SettingsView: React.FC = () => {
  const {
    state,
    can,
    updateSettings,
    setActiveRole,
    resetToFixtures,
    importFleetRowsFromText,
  } = useFleet();

  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vektor_flota_gtp_respaldo_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleStatusLock = (key: string) => {
    const nextStatuses = state.settings.workOrderStatuses.map((s) =>
      s.key === key ? { ...s, marksCompleted: !s.marksCompleted } : s
    );
    updateSettings({ workOrderStatuses: nextStatuses });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setImportText(content);
      setImportFeedback(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportFleet = () => {
    setImportFeedback(null);
    const res = importFleetRowsFromText(importText);
    if (!res.ok) {
      setImportFeedback({ ok: false, text: res.error || 'Error al procesar los datos.' });
      return;
    }
    const { imported = 0, updated = 0 } = res.data || {};
    setImportFeedback({
      ok: true,
      text: `Importación completada: ${imported} equipo(s) nuevo(s) creado(s) y ${updated} equipo(s) existente(s) actualizado(s).`,
    });
    setImportText('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Configuración
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Proyecto, importación de equipos y roles de demostración.
        </p>
      </div>


      {/* Operation Identity */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Identidad de Operación</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Personaliza el nombre de la empresa y el proyecto o frente activo que aparece en el encabezado, reportes y exportaciones.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Empresa / Operador</label>
            <input
              type="text"
              disabled={!can('settings:manage')}
              value={state.settings.organizationName}
              onChange={(e) => updateSettings({ organizationName: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700">Proyecto / Frente Activo</label>
            <input
              type="text"
              disabled={!can('settings:manage')}
              value={state.settings.projectCode}
              onChange={(e) => updateSettings({ projectCode: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Real Data Importer (CSV / Google Sheets FLOTA) */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Importar equipos
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Copia y pega filas directamente desde tu hoja <span className="font-mono">FLOTA</span> en Google Sheets o sube un archivo <span className="font-mono">.csv</span> / <span className="font-mono">.tsv</span>. Si el código ya existe, actualiza horómetro, odómetro y estado automáticamente.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setImportText(SAMPLE_SHEETS_ROWS);
                setImportFeedback(null);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cargar ejemplo
            </button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5" />
              Subir CSV / TSV
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Columnas soportadas (por orden):{' '}
          <span className="font-mono text-slate-700">
            Codigo, Nombre, Marca, Modelo, Placa, Horometro, Odometro, Estado
          </span>
        </div>

        <textarea
          rows={5}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Pega aquí las filas copiadas de Google Sheets o un archivo CSV..."
          className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50/50 p-3 font-mono text-xs text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
        />

        {importFeedback && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-xs ${
              importFeedback.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {importFeedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{importFeedback.text}</span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            Procesamiento 100% local en navegador · Sin exposición de credenciales externas.
          </span>
          <button
            type="button"
            disabled={!can('vehicle:create') || !importText.trim()}
            onClick={handleImportFleet}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-4 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-300 whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar / Actualizar Flota
          </button>
        </div>
      </section>

      {/* Role Switcher (RBAC Testing) */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Perfil Activo y Matriz de Permisos (8 Roles · Grupo Trans Plus)
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Cambia de rol en cualquier momento para comprobar restricciones reales de creación, aprobaciones de OC, avances de OT, inventario y configuración en toda la aplicación.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => {
            const active = state.settings.activeRole === roleKey;
            const meta = ROLE_LABELS[roleKey];
            return (
              <button
                key={roleKey}
                type="button"
                onClick={() => setActiveRole(roleKey)}
                className={`rounded-md border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-blue-700 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">{meta.label}</span>
                  {active ? (
                    <span className="text-[11px] font-semibold text-blue-700">Activo</span>
                  ) : (
                    <span className="font-mono text-[10px] text-slate-400">
                      {meta.positionCode}
                    </span>
                  )}
                </div>
                {active && (
                  <div className="mt-0.5 font-mono text-[10px] text-blue-700/80">
                    {meta.positionCode}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                  {meta.summary}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Units & Localization */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Unidades y Moneda</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700">Moneda operativa</label>
            <select
              disabled={!can('settings:manage')}
              value={state.settings.currency}
              onChange={(e) =>
                updateSettings({ currency: e.target.value as 'USD' | 'MXN' })
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-100"
            >
              <option value="USD">Dólar Estadounidense / Balboa (USD)</option>
              <option value="MXN">Peso Mexicano (MXN)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Unidad de distancia</label>
            <select
              disabled={!can('settings:manage')}
              value={state.settings.distanceUnit}
              onChange={(e) =>
                updateSettings({ distanceUnit: e.target.value as 'km' | 'mi' })
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-100"
            >
              <option value="km">Kilómetros (km)</option>
              <option value="mi">Millas (mi)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700">Unidad de volumen</label>
            <select
              disabled={!can('settings:manage')}
              value={state.settings.volumeUnit}
              onChange={(e) =>
                updateSettings({ volumeUnit: e.target.value as 'gal' | 'L' })
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 disabled:bg-slate-100"
            >
              <option value="gal">Galones (gal · Panamá)</option>
              <option value="L">Litros (L)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Work Order Status Rules (Fleetio Parity) */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Estados de Órdenes de Trabajo (Reglas de Bloqueo)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Un estado marcado como &ldquo;Finaliza OT&rdquo; bloquea la edición posterior hasta que un usuario autorizado la reabra.
          </p>
        </div>
        <TableViewport label="Estados de órdenes de trabajo">
          <table className="vektor-data-table" style={{ minWidth: 630 }} aria-label="Estados de órdenes de trabajo">
            <colgroup>
              <col style={{ width: 125 }} />
              <col />
              <col style={{ width: 95 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                <th scope="col" className="px-5 py-2.5 font-medium">Estado</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Descripción</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Por defecto</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Cierra y bloquea la OT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.settings.workOrderStatuses.map((st) => (
                <tr key={st.key}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{st.key}</td>
                  <td className="px-5 py-3 text-slate-600">{st.description}</td>
                  <td className="px-5 py-3 text-slate-700">{st.isDefault ? 'Sí' : '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      disabled={!can('settings:manage')}
                      onClick={() => toggleStatusLock(st.key)}
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        st.marksCompleted
                          ? 'bg-emerald-700 text-white'
                          : 'border border-slate-300 bg-white text-slate-600'
                      } disabled:opacity-40`}
                    >
                      {st.marksCompleted ? 'Sí (Bloquea)' : 'No'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableViewport>
      </section>

      {/* Data & Fixtures Management */}
      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Datos de demostración
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Los cambios quedan en este navegador. Puedes exportarlos o restaurar los datos de ejemplo.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={resetToFixtures}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3.5 text-xs font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar datos de ejemplo
          </button>
        </div>
      </section>
    </div>
  );
};
