(function(){
  const V='20260820-80';
  let timer=null;

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

  function openTraining(btn){
    buttons().forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    document.getElementById('sidebar')?.classList.remove('open');
    window.dispatchEvent(new CustomEvent('excellence-open-trainings',{detail:{source:'menu-v80'}}));
    document.dispatchEvent(new CustomEvent('excellence-open-trainings',{detail:{source:'menu-v80'}}));

    // Compatibilidade com o controlador v79: se ele criou uma entrada própria oculta,
    // utiliza a rotina já existente sem duplicar visualmente o menu.
    const helper=buttons().find(b=>b!==btn && b.dataset.trainingEntryV79);
    if(helper) helper.click();
  }

  function bind(btn){
    if(!btn || btn.dataset.trainingMenuV80==='bound')return;
    btn.dataset.trainingMenuV80='bound';
    btn.addEventListener('click',ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      openTraining(btn);
    },true);
  }

  function ensure(){
    const n=nav();
    if(!n)return;

    let btn=existingTraining();
    if(btn){
      // Admin sempre enxerga. Para cliente, o patch de permissões continua podendo ocultar.
      if(isAdminSidebar()) btn.style.display='';
      bind(btn);
      return;
    }

    if(!isAdminSidebar()) return;

    btn=document.createElement('button');
    btn.type='button';
    btn.className='nav-btn';
    btn.dataset.trainingMenuV80='bound';
    btn.innerHTML='<span>▤</span>Treinamentos';
    btn.addEventListener('click',ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      openTraining(btn);
    },true);

    const apont=buttons().find(b=>low(b).includes('apontamento'));
    const quem=buttons().find(b=>low(b).includes('quem somos'));
    if(apont?.parentElement===n) apont.insertAdjacentElement('afterend',btn);
    else if(quem?.parentElement===n) n.insertBefore(btn,quem);
    else n.appendChild(btn);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(ensure,20)}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',schedule);
  document.addEventListener('DOMContentLoaded',schedule);
  schedule();
  console.info(`Excellence System® menu Treinamentos ${V} carregado.`);
})();