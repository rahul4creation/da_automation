import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import ExcelPdfReviewApp from "./ExcelPdfReviewApp";
import "./styles.css";

const validLogin = { username: "Rahul_Raj", password: "Alpha1" };
const authKey = "excel-pdf-review-authenticated";
const authUsernameKey = "excel-pdf-review-username";

function StandaloneExcelPdfReview() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(authKey) === "true");
  const [username, setUsername] = useState(() => sessionStorage.getItem(authUsernameKey) || validLogin.username);
  const [error, setError] = useState("");

  function handleLogin(nextUsername: string, password: string) {
    if (nextUsername === validLogin.username && password === validLogin.password) {
      sessionStorage.setItem(authKey, "true");
      sessionStorage.setItem(authUsernameKey, nextUsername);
      setAuthenticated(true);
      setUsername(nextUsername);
      setError("");
      return;
    }

    setError("Invalid username or password.");
  }

  if (!authenticated) {
    return <LoginScreen error={error} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell excel-pdf-standalone-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">DA</span>
          <div>
            <strong>DA Workflow</strong>
            <small>Reporting factory</small>
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-heading">
            <span>Agent Intake</span>
          </div>
          <div className="menu-card active">
            <strong>Excel + PDF</strong>
            <small>Data evidence review</small>
          </div>
          <div className="menu-card">
            <strong>Read-only</strong>
            <small>Local source inspection</small>
          </div>
          <div className="menu-card">
            <strong>Packet output</strong>
            <small>Findings and reconciliation</small>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <ExcelPdfReviewApp username={username} />
      </main>
    </div>
  );
}

function LoginScreen({ error, onLogin }: { error: string; onLogin: (username: string, password: string) => void }) {
  const [username, setUsername] = useState(validLogin.username);
  const [password, setPassword] = useState("");

  function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin(username.trim(), password);
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submitLogin}>
        <span className="login-kicker">REPORT & DASHBOARD REVIEW</span>
        <h1>Sign In</h1>
        <p>Use your dashboard username and password.</p>
        <label className="login-field">
          <span>Username</span>
          <input autoComplete="username" onChange={(event) => setUsername(event.target.value)} value={username} />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" type="submit">
          Sign In
        </button>
      </form>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StandaloneExcelPdfReview />
  </React.StrictMode>
);
