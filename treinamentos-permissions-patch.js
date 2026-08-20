import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, getDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260820-78';
let perfil = null;
let users = new Map();
let timer = null;
let toastTimer = null;

function text(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim()}
function lower(el){return text(el).toLowerCase()}
function allowed(){
  if(!perfil)return false;
  if(perfil.tipo==='admin')return true;
  if(perfil.tipo!=='cliente')return true;
  if(!Array.isArray(perfil.permissoes))return true;
  return perfil.permissoes.includes('treinamentos');
}
function trainingNavs(){
  return Array.from(document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn')).filter(btn=>lower(btn).includes('treinamento'));
}
function toast(message){
  clearTimeout(toastTimer);
  document.querySelector('[data-train-perm-toast]')?.remove();
  const box=document.createElement('div');
  box.dataset.trainPermToast='true';
  box.textContent=message;
  box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;background:#073F5A;color:#fff;border-radius:14px;padding:12px 14px;font-weight:900;box-shadow:0 18px 42px rgba(5,36,55,.25);max-width:320px;';
  document.body.appendChild(box);
  toastTimer=setTimeout(()=>box.remove(),3000);
}
async function load(user){
  perfil=null;users=new Map();if(!user)return;
  const p=await getDoc(doc(db,'usuarios',user.uid));
  perfil=p.exists()?{id:p.id,...p.data()}:null;
  if(perfil?.tipo==='admin'){
    const s=await getDocs(collection(db,'usuarios'));
    s.docs.forEach(d=>users.set(d.id,{id:d.id,...d.data()}));
  }
}
function enhancePermissionCards(){
  if(perfil?.tipo!=='admin')return;
  document.querySelectorAll('[data-perm-user-card]').forEach(card=>{
    if(card.querySelector('input[value="treinamentos"]'))return;
    const id=card.dataset.userId,u=users.get(id);if(!u||u.tipo==='admin')return;
    const options=card.querySelector('.perm-options');if(!options)return;
    const legacy=!Array.isArray(u.permissoes), checked=legacy||u.permissoes.includes('treinamentos');
    const label=document.createElement('label');label.className='perm-option';
    label.innerHTML=`<input type="checkbox" name="permissao" value="treinamentos" ${checked?'checked':''}><span><b>Treinamentos</b><small class="perm-muted">Plano anual, matriz de competências, realizações, integração, PID e carreira</small></span>`;
    options.appendChild(label);
  });
}
function applyNavPermission(){
  const ok=allowed();
  trainingNavs().forEach(btn=>{
    btn.style.display=ok?'':'none';
    btn.dataset.trainPermission=ok?'allowed':'blocked';
  });
}
function enhance(){enhancePermissionCards();applyNavPermission()}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,50)}

document.addEventListener('click',e=>{
  const all=e.target.closest?.('[data-all-perms]');
  const only=e.target.closest?.('[data-only-apontamento],[data-no-perms]');
  if(all)setTimeout(()=>{const c=all.closest('[data-perm-user-card]')?.querySelector('input[value="treinamentos"]');if(c)c.checked=true},0);
  if(only)setTimeout(()=>{const c=only.closest('[data-perm-user-card]')?.querySelector('input[value="treinamentos"]');if(c)c.checked=false},0);

  const nav=e.target.closest?.('#sidebar .nav-btn,.sidebar .nav-btn');
  if(nav&&lower(nav).includes('treinamento')&&!allowed()){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    toast('Seu usuário não tem permissão para acessar Treinamentos.');
  }
},true);

onAuthStateChanged(auth,async user=>{
  try{await load(user);schedule()}
  catch(e){console.warn('Permissão de treinamentos indisponível:',e)}
});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',schedule);
console.info(`Excellence System® complemento de permissões Treinamentos ${V} carregado.`);
