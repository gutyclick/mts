import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">404 · MYTRIPSIM</span>
      <h1>
        This page is off the map.
        <br />
        Esta página no está en el mapa.
      </h1>
      <p>Explore a new destination. / Explora un nuevo destino.</p>
      <div>
        <Link className="button button-primary" href="/en">
          English
        </Link>
        <Link className="button button-secondary" href="/es">
          Español
        </Link>
      </div>
    </main>
  );
}
