import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile } from '../services/users'
import Layout from '../components/Layout'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [nameForm, setNameForm] = useState({ name: user?.name ?? '' })
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [nameSaving, setNameSaving] = useState(false)
  const [passSaving, setPassSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState(null)
  const [passMsg, setPassMsg] = useState(null)

  async function handleNameSave(e) {
    e.preventDefault()
    if (!nameForm.name.trim()) return
    setNameSaving(true); setNameMsg(null)
    try {
      const { data } = await updateProfile({ name: nameForm.name.trim() })
      updateUser({ name: data.name })
      setNameMsg({ ok: true, text: 'Nome atualizado com sucesso.' })
    } catch { setNameMsg({ ok: false, text: 'Erro ao atualizar nome.' }) }
    finally { setNameSaving(false) }
  }

  async function handlePassSave(e) {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ ok: false, text: 'As senhas não coincidem.' }); return
    }
    if (passForm.newPassword.length < 6) {
      setPassMsg({ ok: false, text: 'Mínimo de 6 caracteres.' }); return
    }
    setPassSaving(true); setPassMsg(null)
    try {
      await updateProfile({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword })
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPassMsg({ ok: true, text: 'Senha alterada com sucesso.' })
    } catch (err) {
      setPassMsg({ ok: false, text: err?.response?.data?.message ?? 'Erro ao alterar senha.' })
    } finally { setPassSaving(false) }
  }

  const initials = user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? 'U'

  return (
    <Layout>
      <div className="page fade-up" style={{ maxWidth: 660 }}>
        <div className="page-header">
          <div className="page-header-left">
            <h1>Meu Perfil</h1>
            <p>Gerencie suas informações pessoais e senha</p>
          </div>
        </div>

        {/* Avatar card */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 58, height: 58, borderRadius: 14, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name}</p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{user?.email}</p>
            <span className={user?.role === 'ADMIN' ? 'badge badge-purple' : 'badge badge-blue'} style={{ marginTop: 6, display: 'inline-flex' }}>
              {user?.role === 'ADMIN' ? 'Administrador' : 'Técnico'}
            </span>
          </div>
        </div>

        {/* Name */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 14 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Atualizar nome de exibição</p>
          <form onSubmit={handleNameSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Nome completo</label>
              <input type="text" value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} className="input" />
            </div>
            {nameMsg && (
              <p style={{ fontSize: 13, color: nameMsg.ok ? 'var(--green)' : 'var(--red)' }}>{nameMsg.text}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={nameSaving || !nameForm.name.trim()} className="btn btn-primary">
                {nameSaving ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
          </form>
        </div>

        {/* Password */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Alterar senha</p>
          <form onSubmit={handlePassSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="input-label">Senha atual</label>
              <input type="password" value={passForm.currentPassword} onChange={e => setPassForm(f => ({ ...f, currentPassword: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="input-label">Nova senha</label>
              <input type="password" value={passForm.newPassword} onChange={e => setPassForm(f => ({ ...f, newPassword: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="input-label">Confirmar nova senha</label>
              <input type="password" value={passForm.confirmPassword} onChange={e => setPassForm(f => ({ ...f, confirmPassword: e.target.value }))} className="input" />
            </div>
            {passMsg && (
              <p style={{ fontSize: 13, color: passMsg.ok ? 'var(--green)' : 'var(--red)' }}>{passMsg.text}</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={passSaving} className="btn btn-primary">
                {passSaving ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
