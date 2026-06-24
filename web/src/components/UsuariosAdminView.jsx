import { useEffect, useState } from "react";
import axios from "axios";

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "jefe_taller") return "Jefe taller";
  if (role === "recepcion") return "Recepcion";
  if (role === "cobranza") return "Cobranza";
  if (role === "mecanico") return "Mecanico";
  return role || "-";
}

export default function UsuariosAdminView({ api }) {
  const [usuarios, setUsuarios] = useState([]);
  const [passwords, setPasswords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/api/system-users`);
      setUsuarios(res.data?.usuarios || []);
    } catch (requestError) {
      console.error(requestError);
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (username) => {
    const password = String(passwords[username] || "").trim();

    if (password.length < 3) {
      alert("Ingrese una clave de al menos 3 caracteres.");
      return;
    }

    try {
      setSaving(username);
      setError("");
      await axios.patch(`${api}/api/system-users/${encodeURIComponent(username)}/password`, { password });
      setPasswords((current) => ({ ...current, [username]: "" }));
      alert("Clave restablecida.");
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo restablecer la clave.");
    } finally {
      setSaving("");
    }
  };

  const toggleActive = async (user) => {
    try {
      setSaving(user.username);
      setError("");
      const nextActive = !user.active;
      await axios.patch(`${api}/api/system-users/${encodeURIComponent(user.username)}/active`, {
        active: nextActive
      });
      setUsuarios((current) =>
        current.map((item) => (item.username === user.username ? { ...item, active: nextActive } : item))
      );
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.error || "No se pudo actualizar el estado del usuario.");
    } finally {
      setSaving("");
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return (
    <section className="panel users-admin-panel">
      <div className="section-heading tracking-heading">
        <div>
          <p className="eyebrow">Administracion</p>
          <h2>Usuarios del sistema</h2>
        </div>
        <button type="button" onClick={cargarUsuarios} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? <p className="error-state">{error}</p> : null}

      <div className="users-admin-list">
        {usuarios.map((user) => (
          <article className={`user-admin-row ${user.active ? "active" : "inactive"}`} key={user.username}>
            <div>
              <strong>{user.name || user.username}</strong>
              <span>{user.username}</span>
              <small>{roleLabel(user.role)}</small>
            </div>
            <span className="user-status-badge">{user.active ? "Activo" : "Desactivado"}</span>
            <label className="field compact-field">
              <span>Nueva clave</span>
              <input
                type="password"
                value={passwords[user.username] || ""}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, [user.username]: event.target.value }))
                }
                placeholder="Nueva clave"
              />
            </label>
            <div className="user-admin-actions">
              <button type="button" onClick={() => resetPassword(user.username)} disabled={saving === user.username}>
                Restablecer
              </button>
              <button
                className={user.active ? "danger-button" : "secondary-button"}
                type="button"
                onClick={() => toggleActive(user)}
                disabled={saving === user.username || user.username === "admin"}
              >
                {user.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </article>
        ))}

        {!loading && usuarios.length === 0 ? <p className="empty-state">No hay usuarios configurados.</p> : null}
      </div>
    </section>
  );
}
