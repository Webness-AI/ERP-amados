import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="panel">
      <h2>Pagina no encontrada</h2>
      <p>La ruta solicitada no existe en este frontend.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Volver al dashboard
      </Link>
    </section>
  );
}
