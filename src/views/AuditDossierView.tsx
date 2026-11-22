import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Play } from 'lucide-react';
import { TableViewport } from '../components/TableViewport';
import {
  AUDIT_PARAMETERS,
  COVERAGE_MATRIX,
  FUNCTIONAL_MAP,
  SCREEN_DICTIONARY,
} from '../data/auditData';
import { useFleet } from '../store/FleetContext';
import { AutomatedTestResult } from '../types/fleet';
import { exportRowsToCsv } from '../utils/format';

export const AuditDossierView: React.FC = () => {
  const { runAutomatedVerificationSuite } = useFleet();
  const [subTab, setSubTab] = useState<'overview' | 'coverage' | 'dictionary' | 'tests'>('overview');
  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [testResults, setTestResults] = useState<AutomatedTestResult[]>(() =>
    runAutomatedVerificationSuite()
  );

  const filteredCoverage = useMemo(
    () =>
      typeFilter === 'Todos'
        ? COVERAGE_MATRIX
        : COVERAGE_MATRIX.filter((r) => r.type === typeFilter),
    [typeFilter]
  );

  // Separate denominators per level (Prompt Maestro V2 §7.4)
  const levelDenominators = useMemo(() => {
    const levels = ['Navegación', 'Pantalla', 'Pestaña', 'Estado', 'Acción', 'Recorrido'] as const;
    return levels.map((lvl) => {
      const items = COVERAGE_MATRIX.filter((c) => c.type === lvl);
      return {
        level: lvl,
        discovered: items.length,
        documented: items.filter((i) => i.referenceState === 'Documentado').length,
        blockedRef: items.filter((i) => i.referenceState === 'Bloqueado').length,
        implemented: items.filter(
          (i) => i.ownProductState === 'Implementado y Verificado' || i.ownProductState === 'Implementado'
        ).length,
        passedTests: items.filter((i) => i.testResult === 'Aprobada').length,
      };
    });
  }, []);

  const handleRunTests = () => {
    setTestResults(runAutomatedVerificationSuite());
  };

  const handleExportMatrix = () => {
    exportRowsToCsv(
      'vektor_matriz_cobertura_v2.csv',
      [
        'ID',
        'Tipo',
        'Padre',
        'Entrada',
        'Estado de Referencia',
        'Estado en Producto Propio',
        'Prueba',
        'Resultado',
        'Evidencia',
        'Pendiente',
      ],
      COVERAGE_MATRIX.map((r) => [
        r.id,
        r.type,
        r.parent,
        r.entry,
        r.referenceState,
        r.ownProductState,
        r.testId,
        r.testResult,
        r.evidence,
        r.pending,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Auditoría funcional
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Cobertura de pantallas y pruebas del prototipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportMatrix}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => {
              handleRunTests();
              setSubTab('tests');
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            Ejecutar pruebas
          </button>
        </div>
      </div>

      {/* Subtabs */}
      <div className="vektor-tabs" role="group" aria-label="Vistas disponibles">
        {(
          [
            ['overview', 'Alcance'],
            ['coverage', 'Cobertura'],
            ['dictionary', 'Pantallas y controles'],
            ['tests', 'Resultados de pruebas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            aria-pressed={subTab === id}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Explicit Blocker Callout */}
          <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 text-xs">
            <h2 className="text-sm font-semibold text-amber-900">
              Bloqueo Registrado y Desbloqueo Exacto (Cuenta Privada privada)
            </h2>
            <p className="mt-1.5 leading-relaxed text-amber-900/90">
              La URL <span className="font-mono font-medium">Fleetio</span> requiere sesión autenticada en Fleetio y el motor CLI <span className="font-mono">.cany</span> no está instalado en este entorno. Siguiendo el Prompt Maestro V2 (§1 y §6.5), se avanzó de forma autónoma con documentación oficial vigente del Help Center de Fleetio y se implementó la reconstrucción completa utilizable con identidad propia, dejando toda configuración específica de la cuenta <span className="font-mono">privada</span> marcada como <strong>Bloqueado / Propuesto</strong> sin declarar paridad no comprobada.
            </p>
            <p className="mt-2 font-medium text-amber-950">
              Para desbloquear la auditoría en vivo de la cuenta privada: comparte capturas o exportaciones CSV/JSON de tus vistas, roles y campos personalizados, o indica qué módulos específicos de tu plan deseas ajustar.
            </p>
          </section>

          {/* Parameters */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Parámetros del Encargo</h2>
            </div>
            <TableViewport label="Parámetros de auditoría">
              <table className="vektor-data-table" style={{ minWidth: 620 }} aria-label="Parámetros de auditoría">
                <colgroup>
                  <col style={{ width: 180 }} />
                  <col />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="w-44 px-5 py-2.5 font-medium">Parámetro</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Descripción</th>
                    <th scope="col" className="w-32 px-5 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {AUDIT_PARAMETERS.map((row) => (
                    <tr key={row.param}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{row.param}</td>
                      <td className="px-5 py-3 text-slate-700">{row.value}</td>
                      <td
                        className={`px-5 py-3 font-medium ${
                          row.status === 'Bloqueado'
                            ? 'text-red-700'
                            : row.status === 'Observado'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          </section>

          {/* Functional Map */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Mapa Funcional del Producto</h2>
            </div>
            <TableViewport label="Mapa funcional">
              <table className="vektor-data-table" style={{ minWidth: 655 }} aria-label="Mapa funcional">
                <colgroup>
                  <col style={{ width: 170 }} />
                  <col />
                  <col style={{ width: 115 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="w-56 px-5 py-2.5 font-medium">Dimensión</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Hallazgo</th>
                    <th scope="col" className="w-32 px-5 py-2.5 font-medium">Clasificación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FUNCTIONAL_MAP.map((row) => (
                    <tr key={row.dimension}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{row.dimension}</td>
                      <td className="px-5 py-3 text-slate-700 leading-relaxed">{row.finding}</td>
                      <td className="px-5 py-3 font-medium text-slate-700">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          </section>
        </div>
      )}

      {subTab === 'coverage' && (
        <div className="space-y-5">
          {/* Denominators per level */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Denominadores Separados por Nivel (Sin porcentaje global engañoso)
              </h2>
            </div>
            <TableViewport label="Cobertura por nivel">
              <table className="vektor-data-table" style={{ minWidth: 660 }} aria-label="Cobertura por nivel">
                <colgroup>
                  <col />
                  <col style={{ width: 95 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 105 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="px-4 py-2.5 font-medium">Nivel</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Inventariados</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Documentados (Ref)</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Bloqueados (Ref)</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Implementados (Propio)</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Pruebas aprobadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {levelDenominators.map((d) => (
                    <tr key={d.level}>
                      <td className="px-4 py-2.5 font-sans font-semibold text-slate-900">{d.level}</td>
                      <td className="px-4 py-2.5 text-right text-slate-800">{d.discovered}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{d.documented}</td>
                      <td className="px-4 py-2.5 text-right text-red-700">{d.blockedRef}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700">{d.implemented}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{d.passedTests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          </section>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtrar nivel:</span>
            {['Todos', 'Navegación', 'Pantalla', 'Pestaña', 'Estado', 'Acción', 'Recorrido'].map(
              (lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setTypeFilter(lvl)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    typeFilter === lvl
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {lvl}
                </button>
              )
            )}
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <TableViewport label="Matriz de cobertura">
              <table className="vektor-data-table" style={{ minWidth: 1080 }} aria-label="Matriz de cobertura">
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 105 }} />
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 135 }} />
                  <col style={{ width: 125 }} />
                  <col style={{ width: 180 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                    <th scope="col" className="px-3 py-2.5 font-medium">ID</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Tipo</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Padre</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Entrada</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Estado Ref.</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Producto Propio</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Prueba / Resultado</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCoverage.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {row.id}
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{row.type}</td>
                      <td className="px-3 py-3 font-mono text-slate-500 whitespace-nowrap">{row.parent}</td>
                      <td className="max-w-xs px-3 py-3 font-medium text-slate-900">{row.entry}</td>
                      <td
                        className={`px-3 py-3 font-medium whitespace-nowrap ${
                          row.referenceState === 'Bloqueado' ? 'text-red-700' : 'text-slate-700'
                        }`}
                      >
                        {row.referenceState}
                      </td>
                      <td className="px-3 py-3 text-emerald-700 font-medium whitespace-nowrap">
                        {row.ownProductState}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono text-slate-500">{row.testId}</span> ·{' '}
                        <span
                          className={
                            row.testResult === 'Aprobada'
                              ? 'font-medium text-emerald-700'
                              : 'font-medium text-red-700'
                          }
                        >
                          {row.testResult}
                        </span>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-[11px] text-slate-600">{row.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
          </div>
        </div>
      )}

      {subTab === 'dictionary' && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Diccionario de Pantallas, Controles y Equivalencia Fleetio → Vektor Flota
            </h2>
          </div>
          <TableViewport label="Diccionario de pantallas">
            <table className="vektor-data-table" style={{ minWidth: 905 }} aria-label="Diccionario de pantallas">
              <colgroup>
                <col style={{ width: 85 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 95 }} />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Nodo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Pantalla</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Control Referencia (Fleetio)</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Control Destino (Vektor Flota)</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Unidades</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Validación y Efecto Cruzado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SCREEN_DICTIONARY.map((row) => (
                  <tr key={row.nodeId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {row.nodeId}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {row.screen}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.referenceControl}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{row.ownControl}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {row.unitOrCurrency}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-700">{row.validationAndEffect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
        </section>
      )}

      {subTab === 'tests' && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Suite de Verificación de Flujos Críticos en Vivo
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ejecuta aserciones reales sobre copias aisladas del motor de estado (sin contaminar tus registros operativos).
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunTests}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              <Play className="h-3 w-3" />
              Volver a ejecutar ({testResults.filter((r) => r.status === 'Aprobada').length}/{testResults.length})
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {testResults.map((res) => (
              <li key={res.id} className="flex flex-col gap-2 px-5 py-4 text-xs sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        res.status === 'Aprobada' ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    />
                    <span className="font-mono font-semibold text-slate-900">{res.id}</span>
                    <span className="font-semibold text-slate-900">{res.name}</span>
                  </div>
                  <p className="mt-1 pl-6 text-slate-600">{res.assertionSummary}</p>
                  <div className="mt-1 pl-6 text-[11px] text-slate-400">
                    Módulos: {res.module} · Ejecutada: {res.executedAt} · {res.durationMs} ms
                  </div>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    res.status === 'Aprobada' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {res.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
