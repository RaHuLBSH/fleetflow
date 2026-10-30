import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeading } from "../components/UI";
import { Icon } from "../components/Icon";

export function SettingsPage() {
  const [saved, setSaved] = useState(false); const [toggles, setToggles] = useState([true, true, false, false]);
  function save(event: FormEvent) { event.preventDefault(); setSaved(true); }
  const toggleLabels = ["Email me about critical alerts", "Desktop notifications for delays", "Daily operations summary", "Require second approver for reassignment"];
  return <div className="page-stack"><PageHeading title="Settings" description="Workspace preferences are prototype-only and are not stored by the backend."/>{saved && <div className="toast success" role="status"><Icon name="check"/>Preferences applied in this view only.</div>}<form onSubmit={save} className="settings-form"><section className="surface settings-section"><header><h2>Organization</h2></header><div className="settings-grid"><label>Organization name<input defaultValue="FleetFlow workspace"/></label><label>Operating region<input defaultValue="Not configured"/></label><label>Default time zone<input defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}/></label><label>Delay threshold (minutes)<input type="number" min="1" defaultValue="20"/></label></div></section><section className="surface settings-section"><header><h2>Notifications</h2></header><div className="settings-toggles">{toggleLabels.map((label, i) => <label key={label}>{label}<input type="checkbox" checked={toggles[i]} onChange={() => setToggles((items) => items.map((value, index) => index === i ? !value : value))}/></label>)}</div></section><section className="surface settings-section"><header><h2>User provisioning</h2></header><p>Accounts are created by administrators. Public sign-up is disabled. User provisioning is available through the authenticated admin API.</p></section><div className="settings-actions"><span className="data-source-note">No settings endpoint is available; values stay in this page only.</span><button className="primary">Apply for this view</button></div></form></div>;
}
