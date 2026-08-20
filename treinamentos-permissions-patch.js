import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { collection, getDoc, getDocs, doc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const V = '20260820-78';
let perfil = null;
let users = new Map();
let timer = null;

function esc(v=''){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
async function load(user){
  perfil=null;users=new Map();if(!user)return;
  const p=await getDoc(doc(db,'usuarios',user.uid));perfil=p.exists()?{id:p.id,...p.data()}:null;
  if(perfil?.tipo==='admin'){
    const s=await getDocs(collection(db,'usuarios'));s.docs.forEach(d=>users.set(d.id,{id:d.id,...d.data()}));
  }
}
function enhance(){
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
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,50)}
document.addEventListener('click',e=>{
  const all=e.target.closest?.('[data-all-perms]');
  const only=e.target.closest?.('[data-only-apontamento],[data-no-perms]');
  if(all)setTimeout(()=>{const c=all.closest('[data-perm-user-card]')?.querySelector('input[value="treinamentos"]');if(c)c.checked=true},0);
  if(only)setTimeout(()=>{const c=only.closest('[data-perm-user-card]')?.querySelector('input[value="treinamentos"]');if(c)c.checked=false},0);
},true);
onAuthStateChanged(auth,async user=>{try{await load(user);schedule()}catch(e){console.warn('Permissão de treinamentos indisponível:',e)}});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
console.info(`Excellence System® complemento de permissões Treinamentos ${V} carregado.`);
