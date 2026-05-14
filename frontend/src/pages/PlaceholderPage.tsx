type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section>
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <article className="panel">
        <p>
          Vista en construccion. El modulo queda preparado en el router y la
          navegacion.
        </p>
      </article>
    </section>
  );
}
