export default function ActionsBar({ guardando, onGuardar }) {
  return (
    <footer className="actions-bar">
      <span>Revise datos, detalle, firmas y evidencias antes de guardar.</span>
      <button className="primary-button" type="button" onClick={onGuardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar OT"}
      </button>
    </footer>
  );
}
