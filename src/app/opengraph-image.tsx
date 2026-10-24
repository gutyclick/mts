import { ImageResponse } from "next/og";
export const alt = "MyTripSim — Stay connected, wherever you go";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#F5F9FC",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "90px",
        color: "#101828",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 35,
          fontWeight: 700,
          marginBottom: 45,
        }}
      >
        MyTrip<span style={{ color: "#087CF5" }}>Sim</span>
        <span style={{ color: "#FF8438" }}>.</span>
      </div>
      <div
        style={{
          fontSize: 76,
          lineHeight: 1.15,
          fontWeight: 700,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>Stay connected,</span>
        <span style={{ color: "#087CF5" }}>wherever you go.</span>
      </div>
      <div style={{ fontSize: 24, marginTop: 35 }}>
        Less roaming. More exploring.
      </div>
    </div>,
    size,
  );
}
