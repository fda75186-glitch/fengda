import { defineConfig } from 'vite';
import path from 'node:path';
export default defineConfig({root:import.meta.dirname,base:'/moon-camera-render/',resolve:{alias:{three:path.resolve(import.meta.dirname,'../../../node_modules/three')}},build:{outDir:'build',emptyOutDir:true,target:'es2022'}});
