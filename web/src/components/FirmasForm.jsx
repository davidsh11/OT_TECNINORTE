import SignatureCanvas from "react-signature-canvas";

export default function FirmasForm({ sigCliente, sigRecep }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Firmas</p>
          <h2>Autorizaciones</h2>
        </div>
      </div>
      <div className="signature-grid">
        <div className="signature-box">
          <div className="signature-title">
            <span>Cliente</span>
            <button type="button" onClick={() => sigCliente.current?.clear()}>
              Limpiar
            </button>
          </div>
          <SignatureCanvas
            ref={sigCliente}
            penColor="#111827"
            canvasProps={{ className: "signature-canvas", width: 420, height: 170 }}
          />
        </div>

        <div className="signature-box">
          <div className="signature-title">
            <span>Recepcion</span>
            <button type="button" onClick={() => sigRecep.current?.clear()}>
              Limpiar
            </button>
          </div>
          <SignatureCanvas
            ref={sigRecep}
            penColor="#111827"
            canvasProps={{ className: "signature-canvas", width: 420, height: 170 }}
          />
        </div>
      </div>
    </article>
  );
}
