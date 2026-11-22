import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Layout } from './components/Layout';
import { FleetProvider, useFleet } from './store/FleetContext';
import { RouteState } from './types/fleet';
import { DashboardView } from './views/DashboardView';

const AuditDossierView = lazy(() => import('./views/AuditDossierView').then((module) => ({ default: module.AuditDossierView })));
const DirectoryView = lazy(() => import('./views/DirectoryView').then((module) => ({ default: module.DirectoryView })));
const FuelView = lazy(() => import('./views/FuelView').then((module) => ({ default: module.FuelView })));
const InspectionsView = lazy(() => import('./views/InspectionsView').then((module) => ({ default: module.InspectionsView })));
const IssuesView = lazy(() => import('./views/IssuesView').then((module) => ({ default: module.IssuesView })));
const OperationsView = lazy(() => import('./views/OperationsView').then((module) => ({ default: module.OperationsView })));
const PartsView = lazy(() => import('./views/PartsView').then((module) => ({ default: module.PartsView })));
const PurchasingView = lazy(() => import('./views/PurchasingView').then((module) => ({ default: module.PurchasingView })));
const RemindersView = lazy(() => import('./views/RemindersView').then((module) => ({ default: module.RemindersView })));
const ReportsView = lazy(() => import('./views/ReportsView').then((module) => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((module) => ({ default: module.SettingsView })));
const TiresView = lazy(() => import('./views/TiresView').then((module) => ({ default: module.TiresView })));
const VehicleDetailView = lazy(() => import('./views/VehicleDetailView').then((module) => ({ default: module.VehicleDetailView })));
const VehiclesView = lazy(() => import('./views/VehiclesView').then((module) => ({ default: module.VehiclesView })));
const WorkOrdersView = lazy(() => import('./views/WorkOrdersView').then((module) => ({ default: module.WorkOrdersView })));

const SECTION_TITLES: Record<RouteState['section'], string> = {
  dashboard: 'Centro de mando',
  vehicles: 'Equipos',
  'vehicle-detail': 'Ficha de Equipo',
  operations: 'Mi turno',
  inspections: 'Inspecciones',
  issues: 'Fallas',
  reminders: 'Mantenimiento PM',
  'work-orders': 'Órdenes de trabajo',
  tires: 'Control de Llantas',
  fuel: 'Diésel y Combustible',
  parts: 'Inventario',
  purchasing: 'Compras',
  directory: 'Directorio',
  reports: 'Reportes TCO',
  settings: 'Configuración',
  audit: 'Auditoría funcional',
};

function getInitialRoute(): RouteState {
  try {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section') as RouteState['section'] | null;
    if (sec && Object.hasOwn(SECTION_TITLES, sec) && sec !== 'vehicle-detail') {
      return { section: sec };
    }
  } catch {
    // Ignore URL parse issues
  }
  return { section: 'dashboard' };
}

const FleetAppShell: React.FC = () => {
  const { state } = useFleet();
  const [route, setRoute] = useState<RouteState>(getInitialRoute);
  const [workOrderCreateSignal, setWorkOrderCreateSignal] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.section, route.selectedVehicleId, route.selectedWorkOrderId]);

  const breadcrumbs = useMemo(() => {
    const base = [
      {
        label: state.settings.organizationName,
        onClick: () => setRoute({ section: 'dashboard' }),
      },
    ];

    if (route.section === 'vehicle-detail') {
      const veh = state.vehicles.find((v) => v.id === route.selectedVehicleId);
      return [
        ...base,
        { label: 'Flota y Equipos', onClick: () => setRoute({ section: 'vehicles' }) },
        { label: veh ? `${veh.code} · ${veh.name}` : 'Detalle' },
      ];
    }

    if (route.section === 'work-orders' && route.selectedWorkOrderId) {
      const wo = state.workOrders.find((w) => w.id === route.selectedWorkOrderId);
      return [
        ...base,
        {
          label: 'Órdenes de Trabajo',
          onClick: () => setRoute({ section: 'work-orders' }),
        },
        { label: wo ? wo.code : 'Detalle' },
      ];
    }

    return [...base, { label: SECTION_TITLES[route.section] }];
  }, [route, state.vehicles, state.workOrders, state.settings.organizationName]);

  return (
    <Layout
      route={route}
      onNavigate={(next) => setRoute(next)}
      breadcrumbs={breadcrumbs}
    >
      <Suspense fallback={<p role="status" className="p-4 text-sm text-slate-600">Cargando módulo…</p>}>
        {route.section === 'dashboard' && (
          <DashboardView
            onNavigate={setRoute}
            onCreateWorkOrder={() => {
              setWorkOrderCreateSignal((signal) => signal + 1);
              setRoute({ section: 'work-orders' });
            }}
          />
        )}
        {route.section === 'vehicles' && (
          <VehiclesView onNavigate={setRoute} />
        )}
        {route.section === 'vehicle-detail' && route.selectedVehicleId && (
          <VehicleDetailView
            vehicleId={route.selectedVehicleId}
            activeTab={route.selectedVehicleTab || 'resumen'}
            onChangeTab={(tab) => setRoute({ ...route, selectedVehicleTab: tab })}
            onNavigate={setRoute}
          />
        )}
        {route.section === 'operations' && <OperationsView onNavigate={setRoute} />}
        {route.section === 'inspections' && <InspectionsView onNavigate={setRoute} />}
        {route.section === 'issues' && <IssuesView key={route.initialFilter} initialQuery={route.initialFilter} onNavigate={setRoute} />}
        {route.section === 'reminders' && <RemindersView onNavigate={setRoute} />}
        {route.section === 'work-orders' && (
          <WorkOrdersView
            openCreateSignal={workOrderCreateSignal}
            onConsumeCreateSignal={() => setWorkOrderCreateSignal(0)}
            selectedWorkOrderId={route.selectedWorkOrderId}
            onSelectWorkOrder={(id) =>
              setRoute({ section: 'work-orders', selectedWorkOrderId: id })
            }
            onNavigate={setRoute}
          />
        )}
        {route.section === 'tires' && <TiresView key={route.initialFilter} initialQuery={route.initialFilter} onNavigate={setRoute} />}
        {route.section === 'fuel' && <FuelView onNavigate={setRoute} />}
        {route.section === 'parts' && <PartsView key={route.initialFilter} initialQuery={route.initialFilter} />}
        {route.section === 'purchasing' && <PurchasingView key={route.initialFilter} initialQuery={route.initialFilter} onNavigate={setRoute} />}
        {route.section === 'directory' && <DirectoryView />}
        {route.section === 'reports' && <ReportsView onNavigate={setRoute} />}
        {route.section === 'settings' && <SettingsView />}
        {route.section === 'audit' && <AuditDossierView />}
      </Suspense>
    </Layout>
  );
};

export default function App() {
  return (
    <FleetProvider>
      <FleetAppShell />
    </FleetProvider>
  );
}
