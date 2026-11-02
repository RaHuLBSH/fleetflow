import { useState } from "react";
import type { FormEvent } from "react";
import { inviteMember } from "../api/logistics";
import { PageHeading } from "../components/UI";

export function MembersPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"dispatcher" | "driver">("dispatcher");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage(""); setInvitationUrl("");
    try {
      const result = await inviteMember({ email, role });
      setInvitationUrl(result.invitationUrl); setMessage(`Invitation created for ${result.invitation.email}. It expires ${new Date(result.invitation.expiresAt).toLocaleString()}. Copy the link and send it to them.`); setEmail("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create invitation"); }
    finally { setLoading(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(invitationUrl); setMessage("Invitation link copied."); }
    catch { setMessage("Copy is unavailable here. Select and copy the invitation link below."); }
  }
  return <div className="page-stack"><PageHeading title="Members" description="Invite people into this organization. Their role applies only here." />
    <section className="surface member-invite-card"><h2>Invite a member</h2><form className="form-grid" onSubmit={(event) => void submit(event)}>
      <label>Email address<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
      <label>Organization role<select value={role} onChange={(event) => setRole(event.target.value as "dispatcher" | "driver")}><option value="dispatcher">Dispatcher</option><option value="driver">Driver</option></select></label>
      <div className="member-invite-actions"><button className="primary" disabled={loading}>{loading ? "Creating…" : "Create invitation"}</button></div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="status success" role="status">{message}</p>}
    {invitationUrl && <div className="invite-link-box"><label htmlFor="invite-url">One-time invitation link</label><input id="invite-url" readOnly value={invitationUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="secondary" onClick={() => void copyLink()}>Copy link</button></div>}
    </section>
    <p className="field-note">Admins can invite dispatchers and drivers. New members set their own password. This organization’s admin role is reserved for controlled provisioning.</p>
  </div>;
}
