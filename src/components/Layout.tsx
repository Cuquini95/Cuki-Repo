import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CircleDot,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Fuel,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { ROLE_LABELS, useFleet } from '../store/FleetContext';
import { NavigationSection, RouteState, UserRole } from '../types/fleet';
import { computeRenewalStatus, computeServiceReminderStatus } from '../utils/format';

interface LayoutProps {
  route: RouteState;
  onNavigate: (next: RouteState) => void;
  breadcrumbs: { label: string; onClick?: () => void }[];
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

interface NavItem {
  id: NavigationSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const Layout: React.FC<LayoutProps> = ({
  route,
  onNavigate,
  breadcrumbs,
  primaryAction,
  children,
}) => {
  const { state, toasts, dismissToast, setActiveRole } = useFleet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const openIssuesCount = useMemo(
    () => state.issues.filter((i) => i.status === 'Abierta' || i.status === 'En atención').length,
    [state.issues]
  );

  const overdueRemindersCount = useMemo(() => {
    const overdueService = state.serviceReminders.filter((r) => {
      const v = state.vehicles.find((veh) => veh.id === r.vehicleId);
      return computeServiceReminderStatus(r, v).status === 'Vencido';
    }).length;
    const overdueRenewals = state.renewalReminders.filter(
      (r) => computeRenewalStatus(r).status === 'Vencido'
    ).length;
    return overdueService + overdueRenewals;
  }, [state.serviceReminders, state.renewalReminders, state.vehicles]);

  const activeWorkOrdersCount = useMemo(
    () =>
      state.workOrders.filter(
        (w) => w.status === 'Abierta' || w.status === 'En progreso' || w.status === 'Esperando repuestos'
      ).length,
    [state.workOrders]
  );

  const lowStockCount = useMemo(
    () => state.parts.filter((p) => p.quantityOnHand <= p.reorderPoint).length,
    [state.parts]
  );

  const activeDowntimeCount = useMemo(
    () => state.downtimeEvents.filter((d) => d.status === 'Activo').length,
    [state.downtimeEvents]
  );

  const wornTiresCount = useMemo(
    () => state.tires.filter((t) => t.status === 'Montada' && t.treadDepthMm <= t.minTreadMm).length,
    [state.tires]
  );

  const openPoCount = useMemo(
    () =>
      state.purchaseOrders.filter(
        (p) =>
          p.status === 'Requisición' ||
          p.status === 'Cotizada' ||
          p.status === 'Aprobada' ||
          p.status === 'Facturada / Por Pagar'
      ).length,
    [state.purchaseOrders]
  );

  const navGroups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Operación',
      items: [
        { id: 'dashboard', label: 'Panel Operativo', icon: LayoutDashboard },
        { id: 'vehicles', label: 'Flota y Equipos', icon: Truck, count: state.vehicles.length },
        { id: 'operations', label: 'Turnos y Downtime', icon: Clock, count: activeDowntimeCount },
        { id: 'inspections', label: 'Inspecciones DVIR', icon: ClipboardCheck },
        { id: 'issues', label: 'Incidencias', icon: AlertTriangle, count: openIssuesCount },
      ],
    },
    {
      title: 'Mantenimiento y Abasto',
      items: [
        { id: 'reminders', label: 'Programas PM y HSE', icon: Bell, count: overdueRemindersCount },
        { id: 'work-orders', label: 'Órdenes de Trabajo', icon: Wrench, count: activeWorkOrdersCount },
        { id: 'tires', label: 'Llantas', icon: CircleDot, count: wornTiresCount },
        { id: 'fuel', label: 'Diésel y Combustible', icon: Fuel },
        { id: 'parts', label: 'Almacén Repuestos', icon: Package, count: lowStockCount },
        { id: 'purchasing', label: 'Compras y CxP', icon: ShoppingCart, count: openPoCount },
      ],
    },
    {
      title: 'Análisis y Sistema',
      items: [
        { id: 'directory', label: 'Directorio', icon: Users },
        { id: 'reports', label: 'Reportes TCO', icon: BarChart3 },
        { id: 'settings', label: 'Configuración', icon: Settings },
        { id: 'audit', label: 'Auditoría V2', icon: FileCheck2 },
      ],
    },
  ];

  const searchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { type: string; title: string; subtitle: string; onSelect: () => void }[] = [];

    state.vehicles.forEach((v) => {
      if (
        v.code.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q) ||
        v.hseStickerCode.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'Equipo',
          title: `${v.code} · ${v.name}`,
          subtitle: `${v.licensePlate} · ${v.horometerHrs} h · ${v.status}`,
          onSelect: () =>
            onNavigate({
              section: 'vehicle-detail',
              selectedVehicleId: v.id,
              selectedVehicleTab: 'resumen',
            }),
        });
      }
    });

    state.workOrders.forEach((wo) => {
      if (wo.code.toLowerCase().includes(q) || wo.summary.toLowerCase().includes(q)) {
        results.push({
          type: 'Orden de Trabajo',
          title: `${wo.code} · ${wo.summary}`,
          subtitle: `${wo.status} · ${wo.progress}% avance`,
          onSelect: () => onNavigate({ section: 'work-orders', selectedWorkOrderId: wo.id }),
        });
      }
    });

    state.issues.forEach((iss) => {
      if (iss.code.toLowerCase().includes(q) || iss.title.toLowerCase().includes(q)) {
        results.push({
          type: 'Incidencia',
          title: `${iss.code} · ${iss.title}`,
          subtitle: `${iss.status} · Prioridad ${iss.priority}`,
          onSelect: () => onNavigate({ section: 'issues' }),
        });
      }
    });

    state.parts.forEach((p) => {
      if (p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        results.push({
          type: 'Repuesto',
          title: `${p.sku} · ${p.name}`,
          subtitle: `Stock: ${p.quantityOnHand} · ${p.location}`,
          onSelect: () => onNavigate({ section: 'parts' }),
        });
      }
    });

    state.tires.forEach((t) => {
      if (t.serial.toLowerCase().includes(q) || t.brand.toLowerCase().includes(q)) {
        results.push({
          type: 'Llanta',
          title: `${t.serial} · ${t.brand} ${t.size}`,
          subtitle: `${t.treadDepthMm} mm · ${t.status}`,
          onSelect: () => onNavigate({ section: 'tires' }),
        });
      }
    });

    state.purchaseOrders.forEach((po) => {
      if (
        po.code.toLowerCase().includes(q) ||
        (po.invoiceNumber && po.invoiceNumber.toLowerCase().includes(q))
      ) {
        results.push({
          type: 'Orden de Compra',
          title: `${po.code}${po.invoiceNumber ? ` · ${po.invoiceNumber}` : ''}`,
          subtitle: `${po.status} · Solicitó ${po.requestedBy}`,
          onSelect: () => onNavigate({ section: 'purchasing' }),
        });
      }
    });

    return results.slice(0, 8);
  }, [
    globalQuery,
    state.vehicles,
    state.workOrders,
    state.issues,
    state.parts,
    state.tires,
    state.purchaseOrders,
    onNavigate,
  ]);

  const isActiveNav = (id: NavigationSection) => {
    if (id === 'vehicles' && route.section === 'vehicle-detail') return true;
    return route.section === id;
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-5">
        <button
          type="button"
          onClick={() => {
            onNavigate({ section: 'dashboard' });
            setMobileMenuOpen(false);
          }}
          className="text-left"
        >
          <div className="font-display text-sm font-bold tracking-tight text-white whitespace-nowrap">
            Vektor Flota
          </div>
          <div className="text-[11px] text-slate-400 truncate max-w-[175px]">
            {state.settings.organizationName}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar navegación"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 pb-1.5 text-xs font-medium text-slate-400">
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveNav(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate({ section: item.id });
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-slate-800 font-medium text-white'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={`ml-2 font-mono text-xs tabular-nums ${
                              active ? 'text-slate-200' : 'text-slate-400'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-medium text-slate-200">{state.settings.activeUserName}</span>
          <span className="font-mono text-[11px] text-slate-400 shrink-0">
            {state.settings.activePositionCode}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
          {state.settings.projectCode} · {state.settings.currency}
        </div>
        <label htmlFor="sidebar-role-select" className="mt-2 block text-[11px] text-slate-400">
          Rol / Posición activa
        </label>
        <select
          id="sidebar-role-select"
          value={state.settings.activeRole}
          onChange={(e) => setActiveRole(e.target.value as UserRole)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
        >
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((roleKey) => (
            <option key={roleKey} value={roleKey}>
              {ROLE_LABELS[roleKey].positionCode} · {ROLE_LABELS[roleKey].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 lg:fixed lg:inset-y-0 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="fixed inset-0 bg-slate-950/60" aria-hidden="true" />
          <div className="relative z-10 w-64 max-w-[85vw]">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Ruta actual" className="flex min-w-0 items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${idx}`}>
                    {idx > 0 && <span className="text-slate-300" aria-hidden="true">/</span>}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        className="truncate text-slate-500 transition-colors hover:text-slate-900"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={`truncate ${
                          isLast ? 'font-semibold text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                placeholder="Buscar unidad, placa, OT, SKU..."
                aria-label="Búsqueda global"
                className="h-9 w-64 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
              {searchFocused && globalQuery.trim().length > 0 && (
                <div className="absolute right-0 top-10 z-40 w-80 rounded-md border border-slate-200 bg-white shadow-lg">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500">
                      Sin coincidencias para &ldquo;{globalQuery}&rdquo;.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 py-1">
                      {searchResults.map((res, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              res.onSelect();
                              setGlobalQuery('');
                              setSearchFocused(false);
                            }}
                            className="flex w-full flex-col px-3.5 py-2 text-left transition-colors hover:bg-slate-50"
                          >
                            <span className="text-xs font-medium text-slate-900">{res.title}</span>
                            <span className="text-[11px] text-slate-500">
                              {res.type} · {res.subtitle}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {primaryAction && <div className="shrink-0">{primaryAction}</div>}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-md"
            >
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold ${
                    toast.tone === 'error'
                      ? 'text-red-700'
                      : toast.tone === 'warning'
                      ? 'text-amber-700'
                      : toast.tone === 'success'
                      ? 'text-emerald-700'
                      : 'text-slate-900'
                  }`}
                >
                  {toast.title}
                </p>
                {toast.detail && (
                  <p className="mt-0.5 text-xs text-slate-600">{toast.detail}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar aviso"
                className="rounded p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
