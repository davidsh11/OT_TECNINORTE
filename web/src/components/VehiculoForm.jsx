import FormInput from "./FormInput";
import { vehiculoFields } from "../constants/formFields";

export default function VehiculoForm({ cabecera, onChange }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Vehiculo</p>
          <h2>Informacion tecnica</h2>
        </div>
      </div>
      <div className="form-grid compact">
        {vehiculoFields.map((field) => (
          <FormInput key={field[0]} field={field} value={cabecera[field[0]]} onChange={onChange} />
        ))}
      </div>
    </article>
  );
}
