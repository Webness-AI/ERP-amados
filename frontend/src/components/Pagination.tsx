type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        Anterior
      </button>
      <span className="pagination__text">
        Pagina {page} de {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Siguiente
      </button>
    </div>
  );
}
