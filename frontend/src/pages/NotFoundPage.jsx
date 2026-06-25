import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f1f5f9' }}>
      <div className="text-center">
        <div className="text-[8rem] font-black leading-none mb-2"
          style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </div>
        <h1 className="text-xl font-bold text-slate-700 mb-2">Página não encontrada</h1>
        <p className="text-slate-400 text-sm mb-6">O endereço que você acessou não existe ou foi removido.</p>
        <Link to="/dashboard"
          className="btn btn-primary px-6 py-2.5 text-sm">
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
