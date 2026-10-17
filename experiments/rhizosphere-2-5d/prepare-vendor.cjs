const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const source=path.join(root,'node_modules/three');
const target=path.join(root,'vendor');
fs.mkdirSync(path.join(target,'addons'),{recursive:true});
for(const name of ['three.module.js','three.core.js'])fs.copyFileSync(path.join(source,'build',name),path.join(target,name));
fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'THREE-LICENSE.txt'));
const files={postprocessing:['EffectComposer','RenderPass','ShaderPass','UnrealBloomPass','Pass','OutputPass','MaskPass'],shaders:['CopyShader','LuminosityHighPassShader','OutputShader']};
for(const [folder,names]of Object.entries(files)){fs.mkdirSync(path.join(target,'addons',folder),{recursive:true});for(const name of names)fs.copyFileSync(path.join(source,'examples/jsm',folder,name+'.js'),path.join(target,'addons',folder,name+'.js'));}
console.log('Three.js r186 preparado localmente, sem CDN em runtime.');
