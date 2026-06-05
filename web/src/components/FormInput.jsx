export default function FormInput({ field, value, onChange }) {
  const [key, label] = field;
  const numericFields = ["Anio", "Kilometraje", "Telefonos"];

  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode={numericFields.includes(key) ? "numeric" : "text"}
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
