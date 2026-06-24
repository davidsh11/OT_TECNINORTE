import { useState } from "react";
import axios from "axios";
import TecniNorteLogo from "./TecniNorteLogo";

export default function LoginView({ api, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      const res = await axios.post(`${api}/api/auth/login`, { username, password });
      onLogin(res.data.user);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "Usuario o clave incorrectos.");
    } finally {
      setLoading(false);
    }
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

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
