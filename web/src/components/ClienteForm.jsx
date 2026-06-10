import FormInput from "./FormInput";
import { clienteFields } from "../constants/formFields";

export default function ClienteForm({ cabecera, buscandoCliente, onBuscarCliente, onChange }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cliente</p>
          <h2>Datos de contacto</h2>
        </div>
        <button
          className="ghost-button"
          type="button"
          disabled={buscandoCliente || !cabecera.CL}
          onClick={onBuscarCliente}
        >
          {buscandoCliente ? "Buscando..." : "Buscar"}
        </button>
      </div>
      <div className="form-grid">
        {clienteFields.map((field) => (
          <FormInput key={field[0]} field={field} value={cabecera[field[0]]} onChange={onChange} />
        ))}
      </div>
    </article>
  );
}
