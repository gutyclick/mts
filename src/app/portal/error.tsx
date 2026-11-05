"use client";
export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <main className="bp-app bp-access">
      <h1>MyTripSim Business</h1>
      <p>No pudimos cargar tu espacio. / We could not load your workspace.</p>
      <button className="bp-button" onClick={reset}>
        Reintentar / Try again
      </button>
    </main>
  );
}
