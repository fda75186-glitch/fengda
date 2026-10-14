import { journeyStops, exoplanetStop } from './catalog.js';
const nasa='https://science.nasa.gov/';
const galaxySource=nasa+'universe/galaxies/';
const node=(id,name,kind,radius,position,description,extra={})=>({id,name,kind,radius,position,color:'#adb8c3',description,detailFacts:['位置、尺度与内部恒星采样为科普示意。'],sourceName:'NASA Science',sourceUrl:galaxySource,...extra});
const galaxy=(id,name,radius,position,morphology,path,description)=>node(id,name,'galaxy',radius,position,description,{morphology,sourceUrl:nasa+'mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/'+path+'/',detailFacts:['该星系属于室女座星系团。','星系形态依据NASA科普资料，内部星点位置为结构采样。']});

export const branchStops=[
  {id:'filaments',name:'丝状结构内部',kind:'cosmic',parentId:'cosmic',scale:'星系团与空洞 · 结构示意',subtitle:'沿细丝探索密集节点',description:'在宇宙网内部，星系沿细丝与节点分布。空洞是较稀疏的空间。选择本星系群或室女座节点，可以继续放大探索。',voice:'我们进入了宇宙网内部。沿细丝可以找到更密集的星系节点，现在可以继续进入星系群与星系团。',bodies:[
    node('filament-local','本星系群','cluster',2.2,[-12,-1,8],'我们的银河系与仙女座星系所在的邻域。',{targetStop:'local-group'}),
    node('filament-virgo','室女座节点','cluster',4.3,[11,1,-8],'室女座星系团包含许多星系，M87是其中心区域的重要星系。',{targetStop:'virgo',sourceUrl:nasa+'asset/hubble/m87-and-surrounding-galaxies-in-the-virgo-cluster/'}),
    node('filament-network','细丝背景','web',18,[0,0,-23],'用于表现大尺度结构的连续细丝背景。',{nonInteractive:true}),
  ],entryPose:{position:[0,2,9],target:[8,1,-8]}},
  {id:'virgo',name:'室女座星系团',kind:'group',parentId:'cosmic',scale:'星系团内部 · 结构示意',subtitle:'M87、M49、M60 与 M90',description:'这里展示室女座星系团的代表性成员。椭圆星系有较平滑的恒星分布，旋涡星系则有盘面与旋臂；选择任一成员可以进入内部结构。',voice:'欢迎进入室女座星系团。这里包括椭圆星系M87、M49、M60，以及旋涡星系M90。选择一个星系，继续进入其内部结构。',bodies:[
    galaxy('m87','M87 · 椭圆星系',5,[0,0,0],'elliptical','messier-87','M87是室女座星系团中心区域的大型椭圆星系，拥有中央超大质量黑洞和大量球状星团。'),
    galaxy('m49','M49 · 椭圆星系',3.4,[-13,1,7],'elliptical','messier-49','M49是室女座星系团的巨大椭圆星系，外观以平滑恒星光分布为主。'),
    galaxy('m60','M60 · 椭圆星系',3,[12,-1,8],'elliptical','messier-60','M60属于室女座星系团，是一颗大型椭圆星系。'),
    galaxy('m90','M90 · 旋涡星系',3.1,[7,2,-13],'spiral','messier-90','M90是室女座方向的明亮旋涡星系，可观察盘面与旋臂结构。'),
    node('virgo-field','星系团成员背景','cluster',19,[0,0,-5],'大量细小光点表示星系团成员的结构采样。',{nonInteractive:true}),
  ]},
];

export function resolveStop(id){return journeyStops.find(stop=>stop.id===id)||branchStops.find(stop=>stop.id===id)||null;}
export function scaleIndex(stop){
  if(Number.isInteger(stop?.scaleLevel))return stop.scaleLevel;
  const visited=new Set();let item=stop;
  while(item&&!visited.has(item.id)){
    const index=journeyStops.findIndex(base=>base.id===item.id);if(index>=0)return index;
    visited.add(item.id);item=resolveStop(item.parentId);
  }
  return 3;
}

function galaxyInterior(body,parent){
  const elliptical=body.morphology==='elliptical';
  const stars=Array.from({length:8},(_,i)=>{
    const angle=i/8*Math.PI*2,r=7+(i%3)*2.3;
    return node(`${body.id}:sample-star-${i}`,`恒星样本 ${i+1} · 示意`,'star',.36+(i%3)*.1,[Math.cos(angle)*r,(i%3-1)*1.2,Math.sin(angle)*r],
      '这是用于近距离认识恒星与行星关系的示意样本，不代表在这个星系中已经观测到的具名行星系统。',
      {color:i%3?'#e8c394':'#d79e81',demonstrationSystem:true,detailFacts:['可进入科普行星系统示意。','没有将银河系内的NASA系外行星目录搬到这个星系。']});
  });
  return {id:'inside:'+body.id,name:body.name+'内部',kind:'galaxy',parentId:parent?.id||'local-group',returnStop:parent,scaleLevel:scaleIndex(parent),scale:'星系内部 · 恒星采样',subtitle:elliptical?'三维恒星分布与核球':'恒星、核球与旋臂',description:body.description+' 内部恒星位置采用结构采样；选择恒星样本可进入明确标注的科普行星系统。',voice:'现在进入星系内部。周围恒星是示意采样，你可以靠近中央区域，也可以选择恒星样本探索行星系统示意。',sourceUrl:body.sourceUrl,sourceName:body.sourceName,bodies:[
    {...body,id:body.id+':structure',name:'星系结构背景',radius:21,position:[0,0,-4],nonInteractive:true},
    node(body.id+':nucleus','中央核区','nebula',1.5,[0,0,-4],'核区包含密集恒星。这里的颜色、位置和尺度采用示意。'),...stars,
  ],entryPose:{position:[4,1,9],target:[0,0,-4]}};
}
function demonstrationSystem(body,parent){
  const planets=Array.from({length:4},(_,i)=>node(`${body.id}:planet-${i}`,`示意行星 ${i+1}`,'planet',.46+i*.14,[Math.cos(i*1.6)*(7+i*3.5),0,Math.sin(i*1.6)*(7+i*3.5)],
    '用于展示行星围绕母恒星运行的科普示意，不是这个星系中已确认的行星。',{color:['#b08b70','#6f9bab','#bba98e','#728baa'][i],detailFacts:['表面、轨道与大小均为示意。','真实行星资料请从宇宙地图的NASA目录查看。']}));
  return {id:'sample-system:'+body.id,name:body.name+'行星系统',kind:'system',parentId:parent?.id,returnStop:parent,scaleLevel:scaleIndex(parent),scale:'科普示意系统',subtitle:'母恒星与四颗示意行星',description:'这个教学场景用于理解恒星与行星的关系，不表示观测到该星系中的具体行星系统。',voice:'这里是科普行星系统示意。母恒星位于中央，四颗示意行星分布在周围。它们不是已确认的观测目标。',bodies:[{...body,id:body.id+':host',name:'母恒星 · 示意',radius:2.1,position:[0,0,0],demonstrationSystem:false},...planets]};
}

export function explorationFor(body,catalog,parent){
  if(!body||body.nonInteractive)return null;
  const target=body.targetStop||(body.id==='virgo-cluster'?'virgo':body.id==='cosmic-web'?'filaments':null);
  if(target)return resolveStop(target);
  if(body.systemName){const system=catalog?.systems.find(item=>item.name===body.systemName);return system?exoplanetStop(system):null;}
  if(body.kind==='galaxy')return galaxyInterior(body,parent);
  if(body.demonstrationSystem)return demonstrationSystem(body,parent);
  return null;
}
