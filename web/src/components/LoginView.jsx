import { useState } from "react";
import TecniNorteLogo from "./TecniNorteLogo";
import { authenticateUser } from "../constants/users";

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitLogin = (event) => {
    event.preventDefault();
    const user = authenticateUser(username, password);

    if (!user) {
      setError("Usuario o clave incorrectos.");
      return;
    }

    setError("");
    onLogin(user);
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <TecniNorteLogo className="login-logo" />
        <div>
          <p className="eyebrow">Acceso</p>
          <h1>Sistema OT</h1>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <label className="field">
            <span>Usuario</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>Clave</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="error-state">{error}</p> : null}

          <button className="primary-button" type="submit">
            Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}
