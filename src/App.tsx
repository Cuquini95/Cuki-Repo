import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Layout } from './components/Layout';
import { FleetProvider, useFleet } from './store/FleetContext';
import { RouteState } from './types/fleet';
import { AuditDossierView } from './views/AuditDossierView';
import { DashboardView } from './views/DashboardView';
import { DirectoryView } from './views/DirectoryView';
import { FuelView } from './views/FuelView';
import { InspectionsView } from './views/InspectionsView';
import { IssuesView } from './views/IssuesView';
import { OperationsView } from './views/OperationsView';
import { PartsView } from './views/PartsView';
import { PurchasingView } from './views/PurchasingView';
import { RemindersView } from './views/RemindersView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { TiresView } from './views/TiresView';
import { VehicleDetailView } from './views/VehicleDetailView';
import { VehiclesView } from './views/VehiclesView';
import { WorkOrdersView } from './views/WorkOrdersView';

const SECTION_TITLES: Record<RouteState['section'], string> = {
  dashboard: 'Panel Operativo',
  vehicles: 'Flota y Equipos',
  'vehicle-detail': 'Ficha de Equipo',
  operations: 'Turnos, Downtime y HSE',
  inspections: 'Inspecciones DVIR',
  issues: 'Incidencias',
  reminders: 'Programas PM y HSE',
  'work-orders': 'Órdenes de Trabajo',
  tires: 'Control de Llantas',
  fuel: 'Diésel y Combustible',
  parts: 'Almacén de Repuestos',
  purchasing: 'Compras y Cuentas por Pagar',
  directory: 'Directorio',
  reports: 'Reportes TCO',
  settings: 'Configuración',
  audit: 'Auditoría V2',
};

function getInitialRoute(): RouteState {
  try {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section') as RouteState['section'] | null;
    if (sec && sec in SECTION_TITLES && sec !== 'vehicle-detail') {
      return { section: sec };
    }
  } catch {
    // Ignore URL parse issues
  }
  return { section: 'dashboard' };
}

const FleetAppShell: React.FC = () => {
  const { state, can } = useFleet();
  const [route, setRoute] = useState<RouteState>(getInitialRoute);
  const [vehicleCreateSignal, setVehicleCreateSignal] = useState(0);

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

  const primaryAction = useMemo(() => {
    if (route.section === 'dashboard') {
      return (
        <button
          type="button"
          onClick={() => {
            setRoute({ section: 'vehicles' });
            setVehicleCreateSignal((n) => n + 1);
          }}
          disabled={!can('vehicle:create')}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo Equipo
        </button>
      );
    }
    return undefined;
  }, [route.section, can]);

  return (
    <Layout
      route={route}
      onNavigate={(next) => setRoute(next)}
      breadcrumbs={breadcrumbs}
      primaryAction={primaryAction}
    >
      {route.section === 'dashboard' && <DashboardView onNavigate={setRoute} />}
      {route.section === 'vehicles' && (
        <VehiclesView onNavigate={setRoute} openCreateSignal={vehicleCreateSignal} />
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
      {route.section === 'issues' && <IssuesView onNavigate={setRoute} />}
      {route.section === 'reminders' && <RemindersView onNavigate={setRoute} />}
      {route.section === 'work-orders' && (
        <WorkOrdersView
          selectedWorkOrderId={route.selectedWorkOrderId}
          onSelectWorkOrder={(id) =>
            setRoute({ section: 'work-orders', selectedWorkOrderId: id })
          }
          onNavigate={setRoute}
        />
      )}
      {route.section === 'tires' && <TiresView onNavigate={setRoute} />}
      {route.section === 'fuel' && <FuelView onNavigate={setRoute} />}
      {route.section === 'parts' && <PartsView />}
      {route.section === 'purchasing' && <PurchasingView onNavigate={setRoute} />}
      {route.section === 'directory' && <DirectoryView />}
      {route.section === 'reports' && <ReportsView onNavigate={setRoute} />}
      {route.section === 'settings' && <SettingsView />}
      {route.section === 'audit' && <AuditDossierView />}
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
