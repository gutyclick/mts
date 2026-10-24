import { Cat, ScanLine } from "lucide-react";
// A stylized suitcase, deliberately not a QR matrix or an activation payload.
export function SampleCode() {
  return (
    <div className="sample-code" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <div>
        <Cat size={52} />
        <ScanLine size={30} />
      </div>
      <strong>DEMO</strong>
    </div>
  );
}
