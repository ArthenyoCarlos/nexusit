import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SignaturePad from 'signature_pad'
import { getTermo, getTermoTemplate, signTermo } from '../services/termos'

export default function TermoAssinarPage(){
 const {id}=useParams(); const nav=useNavigate(); const canvas=useRef(null); const pad=useRef(null); const [termo,setTermo]=useState(null); const [template,setTemplate]=useState(null); const [saving,setSaving]=useState(false)
 useEffect(()=>{Promise.all([getTermo(id),getTermoTemplate()]).then(([t,tp])=>{setTermo(t);setTemplate(tp)})},[id])
 useEffect(()=>{ if(!canvas.current) return; const resize=()=>{const c=canvas.current; const ratio=Math.max(window.devicePixelRatio||1,1); const rect=c.getBoundingClientRect(); c.width=rect.width*ratio; c.height=220*ratio; c.getContext('2d').scale(ratio,ratio); pad.current?.clear()}; pad.current=new SignaturePad(canvas.current,{backgroundColor:'rgb(255,255,255)',penColor:'rgb(15,23,42)'}); resize(); window.addEventListener('resize',resize); return()=>window.removeEventListener('resize',resize)},[termo])
 const submit=async()=>{ if(!pad.current || pad.current.isEmpty()) return alert('Assine no campo antes de confirmar.'); setSaving(true); try{await signTermo(id,pad.current.toDataURL('image/png')); nav(`/termos/${id}`)} finally{setSaving(false)} }
 if(!termo) return <div style={page}>Carregando...</div>
 return <div style={page}><main style={wrap}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:16}}><div><h1 style={{fontSize:24}}>Assinatura do Termo</h1><p style={muted}>{termo.numeroTermo} · {termo.responsavelNome}</p></div><Link to={`/termos/${id}`} className="btn btn-default">Voltar</Link></div>
   <section style={card}><h2>Leia antes de assinar</h2><p>Declaro que recebi o equipamento abaixo e aceito as responsabilidades descritas neste termo.</p><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}><Info k="Responsável" v={termo.responsavelNome}/><Info k="CPF" v={termo.cpf}/><Info k="Equipamento" v={`${termo.tipoEquipamento} ${termo.marca||''} ${termo.modelo||''}`}/><Info k="Tombamento" v={termo.tombamento}/><Info k="Série" v={termo.numeroSerie}/><Info k="Condição" v={termo.condicaoInicial}/></div><h3 style={{marginTop:16}}>Acessórios</h3><ul>{(termo.acessorios||[]).map(a=><li key={a}>{a}</li>)}</ul><h3 style={{marginTop:16}}>Cláusulas</h3><div style={{whiteSpace:'pre-wrap',fontSize:14,lineHeight:1.6,color:'#334155'}}>{template?.clausulas}</div></section>
   <section style={card}><h2>Assine com o dedo ou mouse</h2><canvas ref={canvas} style={{width:'100%',height:220,border:'1px solid #cbd5e1',borderRadius:12,background:'#fff',touchAction:'none'}}/><div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:12}}><button className="btn btn-default" onClick={()=>pad.current?.clear()}>Limpar</button><button className="btn btn-primary" disabled={saving} onClick={submit}>{saving?'Enviando...':'Confirmar assinatura'}</button></div></section>
 </main></div>
}
const page={minHeight:'100vh',background:'#f8fafc',padding:16,color:'#0f172a'}
const wrap={maxWidth:900,margin:'0 auto'}
const card={background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:18,marginBottom:14,boxShadow:'0 8px 24px rgba(15,23,42,.06)'}
const muted={color:'#64748b',fontSize:13}
function Info({k,v}){return <p style={{fontSize:13,background:'#f8fafc',padding:10,borderRadius:10}}><b>{k}:</b> {v||'—'}</p>}
