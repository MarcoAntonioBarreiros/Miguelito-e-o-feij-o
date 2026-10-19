// Start preview-rhizoctonia.cjs first; supply runtime paths when necessary.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const out=path.resolve(process.env.RHIZO_QA_OUTPUT || 'outputs/rhizoctonia-phase6'); fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1020},deviceScaleFactor:1});
 const errors=[],requests=[],snapshots=[],consoleErrors=[];
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message)); page.on('requestfailed',r=>requests.push(r.url()));
 page.on('response',r=>{if(r.status()>=400) requests.push(`${r.status()}: ${r.url()}`)});
 await page.goto('http://127.0.0.1:4186/experiments/rhizoctonia-mycelium/');
 await page.waitForFunction(()=>!document.querySelector('#restart').disabled);
 const game=page.frames().find(f=>f.url().includes('dist/index.html'));
 async function closeCard(){await game.evaluate(()=>{if(window.miguelitoTutorial?.isOpen) for(const type of ['keydown','keyup']) dispatchEvent(new KeyboardEvent(type,{code:'Escape',key:'Escape',bubbles:true}));})}
 let closing=false; const closer=setInterval(()=>{if(!closing){closing=true;closeCard().catch(()=>{}).finally(()=>{closing=false})}},150);
 const read=()=>game.evaluate(()=>{
  const sim=window.miguelitoSim,s=sim.state,e=s.level.enemies.find(e=>e.debut&&e.logicIndex===1),h=e.hostPlatform;
  const visual=sim.rhizoctoniaControl?.visualSnapshot?.(e)||window.miguelitoRhizoctoniaSnapshot?.(e)||null;
  return {time:s.time,gameState:s.gameState,phase:s.campaign.phase,webgl:window.miguelito25DMode(),colonization:e.colonization,alive:e.alive,damage:h.rootDamage,health:h.rootHealth,pressure:h.rhizoctoniaPressure,bacillus:e.bacillusControl,iron:e.ironLimitation,contact:e.trichodermaContact||0,lysis:e.trichodermaLysis||0,suppression:e.trichodermaSuppression||0,player:{x:s.player.x,y:s.player.y,vitality:s.player.vitality,deaths:s.player.deaths,exudates:s.player.exudates},followers:sim.trichodermaColonies.followerCount,colonies:sim.trichodermaColonies.colonies.map(c=>({id:c.id,growth:c.growth,vigor:c.vigor,stage:c.stage,sourceCount:c.sourceCount})),host:{x:h.x,y:h.y,w:h.w,h:h.h},enemyId:e.trichodermaRhizoId||null,visual};
 });
 async function until(predicate,label,timeout=180000){const end=Date.now()+timeout;let nextLog=Date.now()+5000;while(Date.now()<end){const s=await read();if(predicate(s))return s;if(s.player.deaths)throw Error(`Player died during ${label}: ${JSON.stringify(s)}`);if(Date.now()>nextLog){console.log(JSON.stringify({waiting:label,time:s.time,state:s.gameState,colonization:s.colonization,contact:s.contact,lysis:s.lysis,player:s.player}));nextLog=Date.now()+5000;}await page.waitForTimeout(100)}throw Error(`Timed out ${label}: ${JSON.stringify(await read())}`)}
 async function capture(label){await closeCard();await page.waitForTimeout(70);const s={label,...await read()};snapshots.push(s);await page.locator('#game').screenshot({path:path.join(out,`${label}.png`)});console.log(JSON.stringify(s));return s}
 async function warpToPoint(x,y,platform=null){await game.evaluate(({x,y,platform})=>{const s=window.miguelitoSim.state; const p=platform==null?null:s.level.platforms[platform];window.miguelitoSim.setInputs({});Object.assign(s.player,{x:x-s.player.w/2,y:y-s.player.h/2,vx:0,vy:0,onGround:false,supportPlatform:p,facing:1,dashTime:0,jetpackActive:false});},{x,y,platform})}
 async function keyE(){await game.evaluate(()=>dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',key:'e',bubbles:true})));await page.waitForTimeout(350);await game.evaluate(()=>dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',key:'e',bubbles:true})));await page.waitForTimeout(250);}
 async function select(type){await game.evaluate(type=>{const sel=window.miguelitoSim.inoculumSelection;for(let i=0;i<12&&sel.current?.type!==type;i++)sel.cycle();if(sel.current?.type!==type)throw Error(`Selection unavailable: ${type}`);},type)}
 try {
  await closeCard(); await until(s=>s.gameState==='play','opening');
  await page.waitForFunction(()=>document.querySelector('#game').contentWindow.miguelito25DMode()); await capture('01-focus-initial');
  if(process.env.RHIZO_LOW_LOAD!=='1'){
   await until(s=>s.colonization>=.40,'branching'); await capture('02-expansion');
   await until(s=>s.colonization>=.76,'advanced colonization');
  }
  const before=await capture(process.env.RHIZO_LOW_LOAD==='1'?'03-low-load-before-control':'03-necrosis');
  const exudate=await game.evaluate(()=>{const e=window.miguelitoSim.state.level.exudates.find(e=>e.id==='p6-trichoderma-recruitment-exudate'&&!e.taken);return{x:e.x,y:e.y}});
  await warpToPoint(exudate.x,exudate.y);await until(s=>s.player.exudates>=1,'real exudate pickup',10000);
  const agent=await game.evaluate(()=>{const s=window.miguelitoSim;const a=s.ecology.agents.find(a=>a.type==='trichoderma'&&!a.hyphalAttack&&a.recruitedUntil<=s.state.time)||s.ecology.agents.find(a=>a.type==='trichoderma'&&!a.hyphalAttack);return{x:a.x,y:a.y}});
  await warpToPoint(agent.x-12,agent.y);await select('exudate');await keyE();
  await until(s=>s.followers>0,'real Trichoderma recruitment',10000);
  await page.locator('#root').click(); await page.waitForTimeout(700); await closeCard(); await select('trichoderma'); await keyE();
  await until(s=>s.colonies.length>0,'real inoculation',8000);
  await until(s=>s.contact>=.4&&s.lysis<.15,'hyphal contact',15000);await capture('04-trichoderma-coils');
  await until(s=>s.lysis>=.55&&s.alive,'real lysis',25000);await capture('05-regression');
  await until(s=>!s.alive,'biological elimination',25000);const after=await capture('06-controlled');
  assert(before.colonization>after.colonization);assert.equal(after.visual.remainingLength,0);assert.equal(after.visual.damage,after.damage,'The scar must follow the real damage, not disappearance of the fungus');assert.equal(after.player.deaths,0);assert.equal(errors.length,0);assert.equal(consoleErrors.length,0);
  await page.locator('#mode').click();await page.waitForTimeout(300);assert.equal((await read()).webgl,false);await capture('07-canvas-compatibility');
  const config=await page.evaluate(()=>localStorage.getItem('miguelito:phase-lab:v6'));
  assert.equal(config,null);assert.equal(requests.length,0);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({scenario:'Real phase 6; shortcuts alter player position only. Pickups, recruitment, E inoculation and all biology use normal game frames.',snapshots,errors,consoleErrors,requests,labConfigAfterRestart:config},null,2));
 } finally {clearInterval(closer);await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
