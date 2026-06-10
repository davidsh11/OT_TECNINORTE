export default function FormInput({ field, value, onChange }) {
  const [key, label] = field;
  const numericFields = ["Anio", "Kilometraje", "Telefonos"];
  const searchableFields = ["CL", "Placa"];

  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={searchableFields.includes(key) ? "searchable-input" : undefined}
        type={key === "CorreoElectronico" ? "email" : "text"}
        inputMode={
          numericFields.includes(key) ? "numeric" : key === "CorreoElectronico" ? "email" : "text"
        }
        required={["Propietario", "Telefonos", "Placa"].includes(key)}
        maxLength={key === "Telefonos" ? 10 : undefined}
        pattern={key === "Telefonos" ? "\\d{10}" : undefined}
        title={key === "Telefonos" ? "Ingrese 10 digitos numericos." : undefined}
        value={value}
        onChange={(event) => onChange(key, event.target.value)}
      />
    </label>
  );
}
