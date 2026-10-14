// A navigable scale atlas, not a claim to map every object in the universe.
export function cosmicMapNodes(stops) {
  const coordinates = [[165,445],[320,410],[470,355],[590,275],[445,165],[705,150],[815,325]];
  return stops.map((stop,index)=>({id:stop.id,name:stop.name,x:coordinates[index][0],y:coordinates[index][1],radius:10+index*3,kind:stop.kind,stop}));
}
export function regionMapNodes(stop) {
  const bodies=(stop?.bodies || []).filter(body=>!body.nonInteractive);
  const extent=Math.max(1,...bodies.map(body=>Math.hypot(body.position?.[0]||0,body.position?.[2]||0)+body.radius));
  return bodies.map(body=>({id:body.id,name:body.name,x:500+(body.position?.[0]||0)/extent*380,y:295+(body.position?.[2]||0)/extent*210-(body.position?.[1]||0)/extent*80,radius:Math.max(5,Math.min(24,Math.sqrt(body.radius||1)*9)),kind:body.kind,body,stop}));
}
export function mapDestination(node) {
  return node ? {stop:node.stop,bodyId:node.body?.id || null} : null;
}
export function zoomMap(view, factor, anchor={x:500,y:300}) {
  const zoom=Math.max(.65,Math.min(6,view.zoom*factor)),ratio=zoom/view.zoom;
  return {zoom,x:Math.max(-5000,Math.min(5000,anchor.x-(anchor.x-view.x)*ratio)),y:Math.max(-3000,Math.min(3000,anchor.y-(anchor.y-view.y)*ratio))};
}
