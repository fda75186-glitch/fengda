import { onMounted, onUnmounted, watch, nextTick } from 'vue';

// Translate content with scroll progress. Hero image dimensions remain fixed.
export function useScrollReveal(route) {
  let frame=0, timer=0, elements=[], observer;
  const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selector=[
    '.page-shell > .page-title-row', '.page-shell > h1', '.page-shell > .section-top',
    '.page-shell > .search-field', '.page-shell > .filter-row',
    '.page-shell > .atlas-layout', '.page-shell > .planet-selector',
    '.page-shell > .studio-layout', '.page-shell > .quiz-card',
    '.page-shell > .guide-tips', '.page-shell > .guide-layout', '.page-shell > .place-list',
    '.page-shell > .notebook-stats', '.page-shell > .section-heading',
    '.article-grid > .article-card', '.saved-card-grid > .saved-card',
    '.ar-workbench', '.ar-controls', '.community-intro', '.community-post', '.community-ending', '.editorial-top', '.feature-links > button', '.home-ending > h2',
    '.home-ending > p', '.home-ending > .button', '[data-reveal]',
  ].join(',');
  function collect(){
    elements=[...document.querySelectorAll(selector)].filter(e=>!e.closest('.assistant-v2'));
    elements.forEach(e=>e.classList.add('scroll-reveal'));
    update();
  }
  function update(){if(frame)return;frame=requestAnimationFrame(()=>{
    const bottom=window.innerHeight;
    elements=elements.filter(e=>e.isConnected);
    for(const element of elements){
      const shift=parseFloat(element.style.getPropertyValue('--reveal-shift'))||0;
      const top=element.getBoundingClientRect().top-shift;
      const progress=reduce()?1:Math.max(0,Math.min(1,(bottom-top-18)/Math.min(220,bottom*.28)));
      element.style.setProperty('--reveal-opacity',String(progress));
      element.style.setProperty('--reveal-shift',`${(1-progress)*46}px`);
    }
    frame=0;
  })}
  const refresh=async()=>{await nextTick();clearTimeout(timer);timer=setTimeout(collect,460)};
  watch(route,refresh);
  onMounted(()=>{collect();observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(collect,80)});observer.observe(document.getElementById('main-content'),{childList:true,subtree:true});window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);document.addEventListener('focusin',update)});
  onUnmounted(()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',update);cancelAnimationFrame(frame);clearTimeout(timer);observer?.disconnect()});
}
