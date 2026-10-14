// Custom shaders must participate in the same depth convention as built-in
// materials: the launch deck and distant sky share one camera.
export function useFlightDepth(material) {
  if (!material?.isShaderMaterial || material.userData.flightDepth) return material;
  const append = (source, chunk) => source.replace(/}\s*$/, `\n#include <${chunk}>\n}`);
  material.vertexShader = '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + append(material.vertexShader, 'logdepthbuf_vertex');
  material.fragmentShader = '#include <logdepthbuf_pars_fragment>\n' + append(material.fragmentShader, 'logdepthbuf_fragment');
  material.userData.flightDepth = true;
  return material;
}
