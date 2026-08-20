(function(){
  const V='20260820-80';
  let timer=null;
  let modulePromise=null;

  const txt=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const low=el=>txt(el).toLowerCase();

  function isAdminSidebar(){
    const side=document.querySelector('#sidebar,.sidebar');
    if(!side)return false;
    return low(side).includes('painel administrativo');
  }

  function nav(){
    return document.querySelector('#sidebar .nav-group,.sidebar .nav-group,#sidebar nav,.sidebar nav');
  }

  function buttons(){
    return Array.from(document.querySelectorAll('#sidebar .nav-btn,.sidebar .nav-btn'));
  }

  function existingTraining(){
    return buttons().find(b=>low(b).includes('treinamento'));
  }

  function mainLooksTraining(){
    const main=document.querySelector('.main');
    const t=low(main);
    return t.includes('treinamento')||t.includes('matriz de competências')||t.includes('plano anual')||(t.includes('pid')&&t.includes('desenvolvimento'));
  }

  function toast(message){
    document.querySelector('[data-train-menu-toast]')?.remove();
    const box=document.createElement('div');
    box.dataset.trainMenuToast='true';
    box.textContent=message;
    box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;background:#073F5A;color:#fff;border-radius:14px;padding:12px 14px;font-weight:900;box-shadow:0 18px 42px rgba(5,36,55,.25);max-width:360px;';
    document.body.appendChild(box);
    setTimeout(()=>box.remove(),3500);
  }

  function extractPackedSource(wrapperText){
    const block=wrapperText.match(/const\s+parts\s*=\s*\[([\s\S]*?)\];/);
    if(!block)throw new Error('Pacote de Treinamentos não encontrado.');
    const parts=[];
    const re=/'([^']+)'/g;
    let m;
    while((m=re.exec(block[1])))parts.push(m[1]);
    if(!parts.length)throw new Error('Pacote de Treinamentos vazio.');
    return parts.join('');
  }

  async function gunzipBase64(b64){
    if(!('DecompressionStream' in window))throw new Error('Navegador sem suporte ao carregador de Treinamentos.');
    const bin=atob(b64);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  function declarationNames(source){
    const names=new Set();
    for(const m of source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g))names.add(m[1]);
    for(const m of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g))names.add(m[1]);
    return [...names];
  }

  function enrichSource(source){
    const firebaseUrl=new URL('./firebase-config.js',location.href).href;
    source=source.replace("from './firebase-config.js'",`from '${firebaseUrl}'`);
    const names=declarationNames(source);
    const expose=names.map(name=>`try{if(typeof ${name}==='function')window.__EXCELLENCE_TRAINING_FUNCTIONS['${name}']=${name}}catch(_){}`).join(';');
    return `${source}\n;window.__EXCELLENCE_TRAINING_FUNCTIONS=window.__EXCELLENCE_TRAINING_FUNCTIONS||{};${expose};window.__EXCELLENCE_TRAINING_MODULE_LOADED=true;window.dispatchEvent(new CustomEvent('excellence-training-module-ready'));`;
  }

  async function loadTrainingModule(){
    if(window.__EXCELLENCE_TRAINING_MODULE_LOADED)return;
    if(modulePromise)return modulePromise;
    modulePromise=(async()=>{
      const response=await fetch(`./treinamentos-patch.js?v=${V}&raw=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error('Não foi possível carregar o módulo de Treinamentos.');
      const wrapper=await response.text();
      const source=await gunzipBase64(extractPackedSource(wrapper));
      const instrumented=enrichSource(source);
      const url=URL.createObjectURL(new Blob([instrumented],{type:'text/javascript'}));
      try{await import(url)}finally{URL.revokeObjectURL(url)}
    })().catch(error=>{modulePromise=null;throw error});
    return modulePromise;
  }

  function candidateFunctions(){
    const api=window.__EXCELLENCE_TRAINING_FUNCTIONS||{};
    const entries=Object.entries(api).filter(([,fn])=>typeof fn==='function');
    const score=name=>{
      const n=name.toLowerCase();let s=0;
      if(n==='rendertreinamentos'||n==='rendertrainings')s+=1000;
      if(n.includes('render')&&n.includes('trein'))s+=700;
      if(n.includes('trein')&&(n.includes('home')||n.includes('dashboard')||n.includes('visao')||n.includes('painel')))s+=550;
      if(n.includes('abrir')&&n.includes('trein'))s+=500;
      if(n.includes('open')&&n.includes('train'))s+=500;
      if(n.includes('trein'))s+=300;
      return s;
    };
    return entries.sort((a,b)=>score(b[0])-score(a[0]));
  }

  async function invokeTraining(){
    // Primeiro tenta uma entrada que o próprio módulo tenha criado.
    const internal=buttons().find(b=>low(b).includes('treinamento')&&!b.dataset.trainingMenuV80);
    if(internal){
      internal.click();
      await new Promise(r=>setTimeout(r,100));
      if(mainLooksTraining())return true;
    }

    for(const [name,fn] of candidateFunctions()){
      if(!/trein|train|render/i.test(name)||fn.length>1)continue;
      try{
        const result=fn.length===1?fn('visao'):fn();
        if(result&&typeof result.then==='function')await result;
        await new Promise(r=>setTimeout(r,80));
        if(mainLooksTraining())return true;
      }catch(error){console.debug(`Treinamentos: ${name} não abriu a tela.`,error)}
    }
    return false;
  }

  async function openTraining(btn){
    buttons().forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    document.getElementById('sidebar')?.classList.remove('open');

    try{
      // Se o controlador v79 estiver ativo, ele pode resolver imediatamente.
      const helper=buttons().find(b=>b!==btn&&b.dataset.trainingEntryV79);
      if(helper){
        helper.click();
        await new Promise(r=>setTimeout(r,120));
        if(mainLooksTraining())return;
      }

      await loadTrainingModule();
      await new Promise(r=>setTimeout(r,80));
      if(await invokeTraining())return;

      window.dispatchEvent(new CustomEvent('excellence-open-trainings',{detail:{source:'menu-v80'}}));
      document.dispatchEvent(new CustomEvent('excellence-open-trainings',{detail:{source:'menu-v80'}}));
      await new Promise(r=>setTimeout(r,100));
      if(mainLooksTraining())return;

      toast('Treinamentos carregou, mas a tela não abriu. Me envie o próximo print para eu corrigir a abertura.');
    }catch(error){
      console.error('Treinamentos v80:',error);
      toast('Não foi possível abrir Treinamentos.');
    }
  }

  function bind(btn){
    if(!btn||btn.dataset.trainingMenuV80==='bound')return;
    btn.dataset.trainingMenuV80='bound';
    btn.addEventListener('click',ev=>{
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
      openTraining(btn);
    },true);
  }

  function ensure(){
    const n=nav();
    if(!n)return;

    let btn=existingTraining();
    if(btn){
      if(isAdminSidebar())btn.style.display='';
      bind(btn);
      return;
    }

    // Esta correção é garantida para o painel administrativo.
    // Usuários clientes continuam sendo controlados pelo patch de permissões.
    if(!isAdminSidebar())return;

    btn=document.createElement('button');
    btn.type='button';
    btn.className='nav-btn';
    btn.innerHTML='<span>▤</span>Treinamentos';
    bind(btn);

    const apont=buttons().find(b=>low(b).includes('apontamento'));
    const quem=buttons().find(b=>low(b).includes('quem somos'));
    if(apont?.parentElement===n)apont.insertAdjacentElement('afterend',btn);
    else if(quem?.parentElement===n)n.insertBefore(btn,quem);
    else n.appendChild(btn);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(ensure,20)}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',schedule);
  document.addEventListener('DOMContentLoaded',schedule);
  schedule();
  console.info(`Excellence System® menu Treinamentos ${V} carregado.`);
})();