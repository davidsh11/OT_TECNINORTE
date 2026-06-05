import TecniNorteLogo from "./TecniNorteLogo";

export default function BrandHeader() {
  return (
    <div className="brand-header">
      <div className="brand-logo-area">
        <TecniNorteLogo className="brand-logo-svg" />
      </div>
      <div className="brand-page-title">
        <h1>TECNINORTE</h1>
        <p className="brand-subtitle">Servicio automotriz y gestion de ordenes</p>
      </div>
    </div>
  );
}
