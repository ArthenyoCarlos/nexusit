import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title ?? 'Confirmar ação'} size="sm">
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} className="btn btn-default">Cancelar</button>
        <button onClick={onConfirm} disabled={loading} className="btn btn-danger">
          {loading ? 'Excluindo...' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  )
}
