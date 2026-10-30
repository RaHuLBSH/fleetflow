import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { listDrivers, listShipments, listVehicles, login, logout, me, restoreCsrfToken, setCsrfToken } from "./api/logistics";
import type { Resource, Shipment, User } from "./api/logistics";
import { Icon } from "./components/Icon";
import { Dashboard } from "./pages/Dashboard";
import { ShipmentsPage } from "./pages/ShipmentsPage";
import { FleetPage } from "./pages/FleetPage";
import { DriversPage } from "./pages/DriversPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { InsightsPage } from "./pages/InsightsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignIn } from "./pages/SignIn";
import { ErrorState, LoadingState } from "./components/UI";
import "./App.css";

const navigation = [
  { id: "overview", label: "Overview", icon: "overview", roles: ["admin", "dispatcher"] },
  { id: "shipments", label: "Shipments", icon: "shipments", roles: ["admin", "dispatcher", "driver"] },
  { id: "fleet", label: "Live Fleet", icon: "fleet", roles: ["admin", "dispatcher"] },
  { id: "drivers", label: "Drivers", icon: "drivers", roles: ["admin", "dispatcher"] },
  { id: "vehicles", label: "Vehicles", icon: "vehicles", roles: ["admin", "dispatcher"] },
  { id: "insights", label: "AI Insights", icon: "insights", roles: ["admin", "dispatcher"] },
  { id: "activity", label: "Activity / Alerts", icon: "activity", roles: ["admin", "dispatcher", "driver"] },
  { id: "settings", label: "Settings", icon: "settings", roles: ["admin", "dispatcher"] },
];

function initials(user: User) { return user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function pageLabel(page: string) { return navigation.find((item) => item.id === page)?.label ?? "Shipments"; }

function App() {
  const [user, setUser] = useState<User | null>(null); const [authReady, setAuthReady] = useState(false); const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState("");
  const [page, setPage] = useState("overview"); const [collapsed, setCollapsed] = useState(false); const [mobileNav, setMobileNav] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]); const [shipmentTotal, setShipmentTotal] = useState(0); const [drivers, setDrivers] = useState<Resource[]>([]); const [vehicles, setVehicles] = useState<Resource[]>([]); const [dataLoading, setDataLoading] = useState(false); const [dataError, setDataError] = useState("");
  const [globalSearch, setGlobalSearch] = useState(""); const [shipmentSearchSeed, setShipmentSearchSeed] = useState(""); const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const loadData = useCallback(async (activeUser: User) => {
    setDataLoading(true); setDataError("");
    try {
      const shipmentResult = await listShipments({ page: 1, limit: 100 }); setShipments(shipmentResult.shipments); setShipmentTotal(shipmentResult.pagination.total);
      if (activeUser.role !== "driver") { const [driverResult, vehicleResult] = await Promise.all([listDrivers(), listVehicles()]); setDrivers(driverResult.drivers); setVehicles(vehicleResult.vehicles); }
      else { setDrivers([]); setVehicles([]); }
    } catch (error) { setDataError(error instanceof Error ? error.message : "Unable to load FleetFlow data"); }
    finally { setDataLoading(false); }
  }, []);
  useEffect(() => { const expireSession = () => { setUser(null); setShipments([]); setDrivers([]); setVehicles([]); setCsrfToken(""); setAuthError("Your session expired. Please sign in again."); }; window.addEventListener("fleetflow:unauthorized", expireSession); restoreCsrfToken(); me().then(({ user: current }) => { setUser(current); setPage(current.role === "driver" ? "shipments" : "overview"); void loadData(current); }).catch(() => {}).finally(() => setAuthReady(true)); return () => window.removeEventListener("fleetflow:unauthorized", expireSession); }, [loadData]);
  const visibleNavigation = useMemo(() => navigation.filter((item) => user && item.roles.includes(user.role)), [user]);
  async function handleLogin(email: string, password: string) { setAuthLoading(true); setAuthError(""); try { const current = await login(email, password); setUser(current); setPage(current.role === "driver" ? "shipments" : "overview"); await loadData(current); } catch (error) { setAuthError(error instanceof Error ? error.message : "Unable to sign in"); } finally { setAuthLoading(false); } }
  async function handleLogout() { try { await logout(); } catch { /* The session may already have expired. */ } setCsrfToken(""); setUser(null); setShipments([]); setShipmentTotal(0); setDrivers([]); setVehicles([]); setPage("overview"); }
  function navigate(next: string) { setPage(next); setMobileNav(false); }
  function searchSubmit(event: FormEvent) { event.preventDefault(); setShipmentSearchSeed(globalSearch); navigate("shipments"); }
  if (!authReady) return <div className="app-loading"><LoadingState label="Checking your session…"/></div>;
  if (!user) return <SignIn onLogin={handleLogin} loading={authLoading} error={authError}/>;

  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}><div className="sidebar-brand"><span className="brand-mark"><Icon name="activity"/></span>{!collapsed && <b>FleetFlow</b>}<button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileNav(false)}><Icon name="close"/></button></div><nav aria-label="Main navigation">{visibleNavigation.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}><Icon name={item.icon}/>{!collapsed && <span>{user.role === "driver" && item.id === "shipments" ? "My Shipments" : item.label}</span>}{!collapsed && item.id === "activity" && <small className="nav-count">{shipments.filter((s) => s.status === "delayed").length || ""}</small>}</button>)}</nav><div className="sidebar-bottom">{!collapsed && <div className="prototype-chip"><b>{dataLoading ? "Connecting API…" : dataError ? "API unavailable" : "API connected"}</b><small>Telemetry and AI panels use labeled sample data.</small></div>}<button className="collapse-button" onClick={() => setCollapsed((value) => !value)}><Icon name="collapse"/>{!collapsed && <span>Collapse</span>}</button></div></aside>
    <div className="main-column"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><span>☰</span></button><div className="breadcrumb"><span>FleetFlow</span><i>/</i><b>{user.role === "driver" && page === "shipments" ? "My Shipments" : pageLabel(page)}</b></div><form className="global-search" onSubmit={searchSubmit}><Icon name="search"/><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search shipment reference…" aria-label="Search shipment reference"/><button aria-label="Search"><Icon name="arrow"/></button></form><button className="top-notification icon-button" aria-label="View activity and alerts" onClick={() => navigate("activity")}><Icon name="bell"/>{shipments.some((s) => s.status === "delayed") && <i/>}</button><div className="org-pill"><span/>FleetFlow workspace<Icon name="collapse"/></div><button className="user-avatar" aria-label={`Sign out ${user.name}`} title={`${user.name} · sign out`} onClick={() => void handleLogout()}>{initials(user)}</button></header>
      <main className="content-area">{dataLoading && shipments.length === 0 ? <LoadingState label="Loading your workspace…"/> : dataError && shipments.length === 0 ? <ErrorState message={dataError} onRetry={() => void loadData(user)}/> : <>{dataError && <ErrorState message={dataError} onRetry={() => void loadData(user)}/>} {page === "overview" && user.role !== "driver" && <Dashboard shipments={shipments} shipmentTotal={shipmentTotal} drivers={drivers} vehicles={vehicles} onNavigate={navigate} onShipment={setSelectedShipment}/>} {page === "shipments" && <ShipmentsPage key={shipmentSearchSeed} drivers={drivers} vehicles={vehicles} onDataChanged={() => void loadData(user)} searchSeed={shipmentSearchSeed} role={user.role}/>} {page === "fleet" && user.role !== "driver" && <FleetPage/>}{page === "drivers" && user.role !== "driver" && <DriversPage drivers={drivers} shipments={shipments} vehicles={vehicles} onDataChanged={() => void loadData(user)}/>} {page === "vehicles" && user.role !== "driver" && <VehiclesPage vehicles={vehicles} shipments={shipments} drivers={drivers} onDataChanged={() => void loadData(user)}/>} {page === "insights" && user.role !== "driver" && <InsightsPage/>}{page === "activity" && <ActivityPage shipments={shipments}/>} {page === "settings" && user.role !== "driver" && <SettingsPage/>}</>}</main>
      <footer className="app-footer"><span>FleetFlow operations</span><span className="footer-separator">·</span><span>Prototype data is labeled where used</span><button onClick={() => void loadData(user)} disabled={dataLoading}>{dataLoading ? "Refreshing…" : "Refresh data"}</button></footer>
    </div>
    {selectedShipment && <DashboardShipmentDialog shipment={selectedShipment} onClose={() => setSelectedShipment(null)}/>}
  </div>;
}

function DashboardShipmentDialog({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-label={`Shipment ${shipment.reference}`}><header className="modal-header"><h2>{shipment.reference}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button></header><div className="shipment-detail"><p>{shipment.customerName || "Customer not provided"}</p><p><b>{shipment.origin.address}</b> → <b>{shipment.destination.address}</b></p><p>Status: {shipment.status.replaceAll("_", " ")}</p><p className="field-note">Open the Shipments screen for assignment, status history, and available actions.</p><button className="primary" onClick={onClose}>Close</button></div></section></div>;
}

export default App;
