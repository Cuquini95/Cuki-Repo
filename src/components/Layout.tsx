import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  children,
}) => {
  const { state, toasts, dismissToast, setActiveRole } = useFleet();
  const drawer = useRef<HTMLDialogElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (mobileSearch) searchInput.current?.focus();
  }, [mobileSearch]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches && drawer.current?.open) drawer.current.close();
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

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
        { id: 'dashboard', label: 'Centro de mando', icon: LayoutDashboard },
        { id: 'operations', label: 'Mi turno', icon: Clock, count: activeDowntimeCount },
        { id: 'work-orders', label: 'Órdenes de trabajo', icon: Wrench, count: activeWorkOrdersCount },
        { id: 'issues', label: 'Fallas', icon: AlertTriangle, count: openIssuesCount },
        { id: 'inspections', label: 'Inspecciones', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Flota',
      items: [
        { id: 'vehicles', label: 'Equipos', icon: Truck, count: state.vehicles.length },
        { id: 'tires', label: 'Llantas', icon: CircleDot, count: wornTiresCount },
        { id: 'reminders', label: 'PM y HSE', icon: Bell, count: overdueRemindersCount },
        { id: 'fuel', label: 'Combustible', icon: Fuel },
      ],
    },
    {
      title: 'Abastecimiento',
      items: [
        { id: 'parts', label: 'Inventario', icon: Package, count: lowStockCount },
        { id: 'purchasing', label: 'Compras', icon: ShoppingCart, count: openPoCount },
      ],
    },
    {
      title: 'Inteligencia',
      items: [
        { id: 'reports', label: 'Reportes', icon: BarChart3 },
        { id: 'audit', label: 'Auditoría funcional', icon: FileCheck2 },
      ],
    },
    {
      title: 'Administración',
      items: [
        { id: 'directory', label: 'Directorio', icon: Users },
        { id: 'settings', label: 'Configuración', icon: Settings },
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
          onSelect: () => onNavigate({ section: 'issues', initialFilter: iss.code }),
        });
      }
    });

    state.parts.forEach((p) => {
      if (p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        results.push({
          type: 'Repuesto',
          title: `${p.sku} · ${p.name}`,
          subtitle: `Stock: ${p.quantityOnHand} · ${p.location}`,
          onSelect: () => onNavigate({ section: 'parts', initialFilter: p.sku }),
        });
      }
    });

    state.tires.forEach((t) => {
      if (t.serial.toLowerCase().includes(q) || t.brand.toLowerCase().includes(q)) {
        results.push({
          type: 'Llanta',
          title: `${t.serial} · ${t.brand} ${t.size}`,
          subtitle: `${t.treadDepthMm} mm · ${t.status}`,
          onSelect: () => onNavigate({ section: 'tires', initialFilter: t.serial }),
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
          onSelect: () => onNavigate({ section: 'purchasing', initialFilter: po.code }),
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

  const renderSidebar = (mobile: boolean) => (
    <div className="vektor-sidebar flex h-full min-h-0 flex-col text-slate-200">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-white/10 px-4 py-4">
        <button
          type="button"
          onClick={() => {
            onNavigate({ section: 'dashboard' });
            drawer.current?.close();
          }}
          className="text-left"
        >
          <img src="/transplus.webp" width="440" height="124" alt="TransPlus" className="h-auto w-36 rounded-md bg-white p-1.5" />
          <span className="mt-2 block text-xs font-semibold tracking-wide text-slate-300">Vektor Flota</span>
        </button>
        {mobile && <button
          type="button"
          autoFocus
          onClick={() => drawer.current?.close()}
          aria-label="Cerrar navegación"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Navegación principal">
        <div className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
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
                          drawer.current?.close();
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`vektor-nav flex min-h-10 w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors whitespace-nowrap ${
                          active
                            ? 'vektor-nav-active font-semibold text-white'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-200' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 bg-white/10 font-mono text-[11px] tabular-nums ${
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

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-medium text-slate-200">{state.settings.activeUserName}</span>
          <span className="font-mono text-[11px] text-slate-400 shrink-0">
            {state.settings.activePositionCode}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400 truncate">
          {state.settings.projectCode} · {state.settings.currency}
        </div>
        <label htmlFor={mobile ? 'mobile-role' : 'desktop-role'} className="mt-2 block text-[11px] text-slate-400">
          Simular rol
        </label>
        <select
          id={mobile ? 'mobile-role' : 'desktop-role'}
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
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:p-3">Ir al contenido</a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">
        {renderSidebar(false)}
      </aside>
      <dialog
        ref={drawer}
        aria-label="Menú de Vektor Flota"
        className="vektor-drawer lg:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX > bounds.right) drawer.current?.close();
          }
        }}
      >
        {renderSidebar(true)}
      </dialog>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => drawer.current?.showModal()}
              aria-label="Abrir menú de navegación"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Ruta actual" className="flex min-w-0 items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.label}-${idx}`}>
                    {idx > 0 && <span className="hidden text-slate-300 xl:inline" aria-hidden="true">/</span>}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        className="hidden truncate text-slate-600 transition-colors hover:text-slate-900 xl:inline"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={`truncate ${
                          isLast ? 'font-bold text-slate-900' : 'hidden text-slate-600 xl:inline'
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

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900" title="Datos de demostración guardados en este navegador">Demo</span>
            <button
              ref={searchButton}
              type="button"
              aria-label="Abrir búsqueda"
              aria-expanded={mobileSearch}
              onClick={() => setMobileSearch((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
            >
              {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <div
              className={mobileSearch ? 'absolute inset-x-0 top-full border-b border-slate-200 bg-white p-3 md:relative md:inset-auto md:border-0 md:p-0' : 'relative hidden md:block'}
              onFocus={() => setSearchFocused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchFocused(false);
                  if (mobileSearch) {
                    setMobileSearch(false);
                    searchButton.current?.focus();
                  }
                }
              }}
            >
              <Search className="pointer-events-none absolute left-5 top-1/2 md:left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInput}
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Buscar equipo, OT o repuesto…"
                aria-label="Búsqueda global"
                className="h-10 w-full rounded-lg border md:w-56 xl:w-64 border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
              {searchFocused && globalQuery.trim().length > 0 && (
                <div className="absolute inset-x-3 top-full z-40 max-h-[60vh] overflow-y-auto rounded-lg md:inset-x-auto md:right-0 md:w-80 border border-slate-200 bg-white shadow-lg">
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
                            onClick={() => {
                              res.onSelect();
                              setGlobalQuery('');
                              setSearchFocused(false);
                              setMobileSearch(false);
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
            
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-3 py-5 sm:px-6 lg:px-8">
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
