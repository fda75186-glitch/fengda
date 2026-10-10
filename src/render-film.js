// Offline production tool, separate from the public user interface.
import {createApp,h,ref} from 'vue';
import ObservatoryJourney from './components/ObservatoryJourney.vue';
createApp({setup(){const film=ref(null),status=ref('准备生成 38 秒原创观星旅程'),busy=ref(false),download=ref('');async function record(){busy.value=true;status.value='正在录制，请保持此页面可见（约 38 秒）';try{const result=await film.value.recordFilm();download.value=result.url;status.value='影片已生成，点击下载。'+Math.round(result.size/1024/1024)+' MB'}catch(e){status.value=e.message}busy.value=false}return()=>h('div',[h('div',{id:'film'},[h(ObservatoryJourney,{ref:film})]),h('div',{class:'controls'},[h('button',{onClick:record,disabled:busy.value},'生成观星影片'),h('p',status.value),download.value?h('a',{href:download.value,download:'xingyu-observatory-journey.webm',style:{color:'white'}},'下载原创观星影片'):null])])}}).mount('#render-app');

