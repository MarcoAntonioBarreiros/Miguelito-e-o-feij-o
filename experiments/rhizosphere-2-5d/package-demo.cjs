// Builds a separate, offline-at-runtime demo. Never writes dist/ or the main game.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||path.join(repo,'rhizosphere-preview'));
if(out===repo||repo.startsWith(out+path.sep))throw new Error('Output must be a separate child/sibling directory.');
const exp=path.join(out,'experiments/rhizosphere-2-5d');fs.mkdirSync(exp,{recursive:true});
for(const name of ['src','assets'])fs.cpSync(path.join(repo,name),path.join(out,name),{recursive:true,filter:p=>!p.split(path.sep).includes('audio')});
const files=['index.html','style.css','scene.js','simulation.js','simulation.test.mjs','bacillus-frames.js','server.cjs','package.json','package-lock.json','prepare-vendor.cjs','package-demo.cjs','browser-test.cjs','README.md'];
for(const name of files)fs.copyFileSync(path.join(__dirname,name),path.join(exp,name));
fs.cpSync(path.join(__dirname,'vendor'),path.join(exp,'vendor'),{recursive:true});
fs.cpSync(path.join(__dirname,'unity'),path.join(exp,'unity'),{recursive:true,filter:p=>!['Temp','Library','Builds'].includes(path.basename(p))});
fs.cpSync(path.join(__dirname,'evidence'),path.join(exp,'evidence'),{recursive:true});
fs.copyFileSync(path.join(__dirname,'ANALISE-TECNICA.md'),path.join(exp,'ANALISE-TECNICA.md'));
fs.copyFileSync(path.join(repo,'LICENSE'),path.join(out,'LICENSE'));
fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({name:'miguelito-webgl-preview',private:true,type:'module',scripts:{start:'node experiments/rhizosphere-2-5d/server.cjs',test:'node --test experiments/rhizosphere-2-5d/simulation.test.mjs'}},null,2));
fs.writeFileSync(path.join(out,'INICIAR.cmd'),'@echo off\r\ncd /d "%~dp0"\r\necho Miguelito 2,5D - abra http://127.0.0.1:4173\r\nnode experiments/rhizosphere-2-5d/server.cjs\r\npause\r\n');
fs.writeFileSync(path.join(out,'LEIA-ME.md'),'# Miguelito 2,5D\n\nCom Node.js instalado, execute INICIAR.cmd ou `npm start` nesta pasta. Abra http://127.0.0.1:4173. Nao e necessario npm install nem acesso a internet para esta distribuicao. Nao abra index.html por file://.\n\nA/D: mover; espaco: saltar; E: inocular; R: reiniciar crescimento; P: pausar; B: comparar iluminacao; H: ocultar interface. Espere cerca de 7 segundos para a ponte amadurecer.\n\nVeja experiments/rhizosphere-2-5d/README.md para fontes, limites e testes.\n');
const records=[];
function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else records.push({path:path.relative(out,p).split(path.sep).join('/'),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}}
walk(path.join(out,'assets'));fs.writeFileSync(path.join(out,'original-assets.sha256.json'),JSON.stringify(records,null,2));
console.log(JSON.stringify({out,assetCount:records.length,assetBytes:records.reduce((s,x)=>s+x.bytes,0)}));
