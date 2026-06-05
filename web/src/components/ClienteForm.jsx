import FormInput from "./FormInput";
import { clienteFields } from "../constants/formFields";

export default function ClienteForm({ cabecera, onChange }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cliente</p>
          <h2>Datos de contacto</h2>
        </div>
      </div>
      <div className="form-grid">
        {clienteFields.map((field) => (
          <FormInput key={field[0]} field={field} value={cabecera[field[0]]} onChange={onChange} />
        ))}
      </div>
    </article>
  );
}
