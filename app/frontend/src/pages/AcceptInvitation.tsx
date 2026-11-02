import { useState } from "react";
import type { FormEvent } from "react";
import { acceptInvitation } from "../api/logistics";
import type { User } from "../api/logistics";

export function AcceptInvitation({ currentUser, onAccepted }: { currentUser?: User; onAccepted: (user: User) => void }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try { const user = await acceptInvitation({ token, ...(currentUser ? {} : { name, password }) }); window.history.replaceState({}, "", "/"); onAccepted(user); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to accept invitation"); }
    finally { setLoading(false); }
  }
  return <main className="invitation-screen"><section className="surface invitation-card"><div className="brand-lockup"><span className="brand-mark">F</span><b>FleetFlow</b></div><h1>Accept organization invitation</h1>
    {!token ? <p className="form-error" role="alert">This invitation link is missing its token.</p> : <form className="login-form" onSubmit={(event) => void submit(event)}>
      {currentUser ? <p>Continue as <b>{currentUser.email}</b>. The invitation must match this account.</p> : <><label>Your name<input autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Create a password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label></>}
      <button className="primary" disabled={loading}>{loading ? "Accepting…" : "Accept invitation"}</button>
    </form>}{error && <p className="form-error" role="alert">{error}{error.includes("Sign in") && <> · <a href="/">Sign in first, then reopen this invitation.</a></>}</p>}
  </section></main>;
}
