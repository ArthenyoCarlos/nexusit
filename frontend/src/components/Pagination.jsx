export default function Pagination({ page, totalPages, totalElements, onPageChange }) {
  if (totalPages <= 1) return null

  const canPrev = page > 0
  const canNext = page < totalPages - 1

  return (
    <div className="pagination">
      <span className="pagination-info">
        Página {page + 1} de {totalPages} · {totalElements} item(s)
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-default btn-sm"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="btn btn-default btn-sm"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima →
        </button>
      </div>
    </div>
  )
}
