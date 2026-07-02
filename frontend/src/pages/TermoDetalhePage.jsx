import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { addOcorrencia, getTermo, termoPdfUrl } from '../services/termos'

const DATE = v => v ? new Date(v).toLocaleString('pt-BR') : '—'
const DATED = v => v ? new Date(v+'T00:00').toLocaleDateString('pt-BR') : '—'
const OCC_EMPTY = { tipo:'OUTRO', descricao:'', pecasSubstituidas:'', custo:'', responsabilidade:'EMPRESA', registradoPor:'' }

export default function TermoDetalhePage(){
 const {id}=useParams(); const [termo,setTermo]=useState(null); const [modal,setModal]=useState(false); const [occ,setOcc]=useState(OCC_EMPTY); const [saving,setSaving]=useState(false)
 const load=()=>getTermo(id).then(setTermo); useEffect(()=>{load()},[id])
 const saveOcc=async e=>{e.preventDefault(); setSaving(true); try{await addOcorrencia(id,{...occ,custo:occ.custo?Number(occ.custo):null}); setModal(false); setOcc(OCC_EMPTY); load()} finally{setSaving(false)}}
 if(!termo) return <Layout><div className="page">Carregando...</div></Layout>
 return <Layout><div className="page fade-up">
  <div className="page-header"><div className="page-header-left"><h1>{termo.numeroTermo}</h1><p>{termo.responsavelNome} · {termo.tombamento}</p></div><div style={{display:'flex',gap:8}}>{!termo.assinado&&<Link className="btn btn-primary" to={`/termos/${id}/assinar`}>Assinar</Link>}{termo.assinado&&<a className="btn btn-primary" href={termoPdfUrl(id)} target="_blank">Download PDF</a>}<button className="btn btn-default" onClick={()=>setModal(true)}>+ Ocorrência</button></div></div>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
   <Card title="Responsável"><Info k="Nome" v={termo.responsavelNome}/><Info k="CPF" v={termo.cpf}/><Info k="Cargo" v={termo.cargo}/><Info k="Setor" v={termo.setor}/><Info k="Entrega" v={DATED(termo.dataEntrega)}/><Info k="Status" v={termo.status}/></Card>
   <Card title="Equipamento"><Info k="Tipo" v={termo.tipoEquipamento}/><Info k="Marca" v={termo.marca}/><Info k="Modelo" v={termo.modelo}/><Info k="Série" v={termo.numeroSerie}/><Info k="Tombamento" v={termo.tombamento}/><Info k="Condição" v={termo.condicaoInicial}/></Card>
  </div>
  <Card title="Acessórios e observações"><ul>{(termo.acessorios||[]).map(a=><li key={a}>{a}</li>)}</ul><p style={{whiteSpace:'pre-wrap'}}>{termo.observacoes||'Sem observações.'}</p>{termo.assinado&&<p style={{marginTop:12,fontSize:12,color:'var(--text-tertiary)'}}>Assinado em {DATE(termo.dataHoraAssinatura)} · IP {termo.ipAssinante} · Hash {termo.hashDocumento}</p>}</Card>
  <Card title="Histórico de ocorrências"><div style={{display:'flex',flexDirection:'column',gap:8}}>{termo.ocorrencias?.length?termo.ocorrencias.map(o=><div key={o.id} style={{border:'1px solid var(--border-muted)',borderRadius:10,padding:12}}><b>{o.tipo}</b><span style={{marginLeft:8,color:'var(--text-tertiary)',fontSize:12}}>{DATE(o.data)}</span><p style={{marginTop:6}}>{o.descricao}</p><p style={{fontSize:12,color:'var(--text-tertiary)'}}>Peças: {o.pecasSubstituidas||'—'} · Custo: {o.custo?`R$ ${o.custo}`:'—'} · Responsabilidade: {o.responsabilidade||'—'} · Por: {o.registradoPor||'—'}</p></div>):<p style={{color:'var(--text-tertiary)'}}>Nenhuma ocorrência registrada.</p>}</div></Card>
  <Modal open={modal} onClose={()=>setModal(false)} title="Registrar ocorrência" size="lg"><form onSubmit={saveOcc} style={{display:'flex',flexDirection:'column',gap:10}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Field label="Tipo"><select className="input" value={occ.tipo} onChange={e=>setOcc(o=>({...o,tipo:e.target.value}))}>{['DANO_FISICO','TROCA_PECA','MANUTENCAO','PERDA','ROUBO','OUTRO'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Responsabilidade"><select className="input" value={occ.responsabilidade} onChange={e=>setOcc(o=>({...o,responsabilidade:e.target.value}))}><option>EMPRESA</option><option>FUNCIONARIO</option></select></Field><Field label="Custo"><input className="input" type="number" step="0.01" value={occ.custo} onChange={e=>setOcc(o=>({...o,custo:e.target.value}))}/></Field><Field label="Registrado por"><input className="input" value={occ.registradoPor} onChange={e=>setOcc(o=>({...o,registradoPor:e.target.value}))}/></Field></div><Field label="Descrição"><textarea required className="input" rows={3} value={occ.descricao} onChange={e=>setOcc(o=>({...o,descricao:e.target.value}))}/></Field><Field label="Peças substituídas"><textarea className="input" rows={2} value={occ.pecasSubstituidas} onChange={e=>setOcc(o=>({...o,pecasSubstituidas:e.target.value}))}/></Field><div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" className="btn btn-default" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" disabled={saving}>Salvar</button></div></form></Modal>
 </div></Layout>
}
function Card({title,children}){return <section className="card" style={{marginTop:16}}><h2 style={{fontSize:14,fontWeight:800,marginBottom:12}}>{title}</h2>{children}</section>}
function Info({k,v}){return <p style={{display:'flex',justifyContent:'space-between',gap:12,borderBottom:'1px solid var(--border-muted)',padding:'7px 0'}}><span style={{color:'var(--text-tertiary)'}}>{k}</span><b style={{textAlign:'right'}}>{v||'—'}</b></p>}
function Field({label,children}){return <div><label className="input-label">{label}</label>{children}</div>}
