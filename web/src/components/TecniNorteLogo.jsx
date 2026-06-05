import { getTecniNorteLogoSvg } from "../utils/logoSvg";

export default function TecniNorteLogo({ className = "tecninorte-logo" }) {
  return <div dangerouslySetInnerHTML={{ __html: getTecniNorteLogoSvg(className) }} />;
}
