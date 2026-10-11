import path from 'node:path';
const dependencyRoot=path.resolve(import.meta.dirname, '../../../node_modules/three');
export default {
  root: import.meta.dirname,
  base:'/telescope-camera-render/',
  resolve:{alias:[{find:'three/addons',replacement:path.join(dependencyRoot,'examples/jsm')},{find:'three',replacement:path.join(dependencyRoot,'build/three.module.js')}]},
  build:{outDir:'dist',target:'es2022'},
};
