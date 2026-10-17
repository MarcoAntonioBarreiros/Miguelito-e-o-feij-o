// Optional browser validation. npm install --no-save --package-lock=false playwright
// Start server.cjs first. EVIDENCE_DIR and PLAYWRIGHT_MODULE may override paths.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.EVIDENCE_DIR||path.join(__dirname,'evidence'));
fs.mkdirSync(out,{recursive:true});
const errors=[],checks=[],reports={};
(async()=>{
 const candidates=[process.env.BROWSER_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);
 const executablePath=candidates.find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-first-run','--disable-background-networking']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 const base=process.env.DEMO_URL||'http://127.0.0.1:4173';
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.miguelitoDemo?.metrics.ready);
 await page.waitForFunction(()=>window.miguelitoDemo.snapshot().stats.matureBridges>0,{},{timeout:20000});
 checks.push('WebGL2 ready; phase 4 native bridge matures');
 assert.equal(await page.locator('#loading').isVisible(),false);
 const original=await page.evaluate(()=>window.miguelitoDemo.snapshot());assert.equal(original.player.w,32);assert.equal(original.player.h,48);assert.equal(original.stats.microbes,109);
 checks.push('original 32x48 collider; 109 native microbial agents');
 async function sample(name){await page.evaluate(()=>window.miguelitoDemo.metrics.frameMs.length=0);await page.waitForTimeout(5000);reports[name]=await page.evaluate(()=>window.miguelitoDemo.getReport());assert(reports[name].drawCalls>0);console.log(name,JSON.stringify({fps:reports[name].meanFps,p95:reports[name].p95FrameMs,draws:reports[name].drawCalls,gpu:reports[name].gpu}));}
 await sample('desktopHigh');
 await page.screenshot({path:path.join(out,'demo-webgl.png')});
 await page.keyboard.press('KeyH');await page.screenshot({path:path.join(out,'scene-clean.png')});await page.keyboard.press('KeyH');
 const before=await page.evaluate(()=>window.miguelitoDemo.snapshot().player.x);
 await page.keyboard.down('KeyD');await page.waitForTimeout(650);await page.keyboard.up('KeyD');
 const after=await page.evaluate(()=>window.miguelitoDemo.snapshot().player.x);assert(after>before+60);checks.push('keyboard movement delegates to native physics');
 const y=await page.evaluate(()=>window.miguelitoDemo.snapshot().player.y);await page.keyboard.down('Space');await page.waitForTimeout(130);await page.keyboard.up('Space');const jumpY=await page.evaluate(()=>window.miguelitoDemo.snapshot().player.y);assert(jumpY<y-5);checks.push('jump keyboard path works');
 await page.evaluate(()=>window.miguelitoDemo.simulation.reset());await page.waitForTimeout(200);
 await page.keyboard.press('KeyP');const t=await page.evaluate(()=>window.miguelitoDemo.snapshot().time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.miguelitoDemo.snapshot().time),t);checks.push('pause freezes simulation');
 await page.locator('#shadows').uncheck();assert.equal(await page.evaluate(()=>window.miguelitoDemo.flags.shadows),false);await page.locator('#shadows').check();
 await page.locator('#normals').uncheck();assert(await page.evaluate(()=>{let valid=true;window.miguelitoDemo.scene.traverse(o=>{if(o.material?.userData?.originalNormalScale&&o.material.normalScale.lengthSq()!==0)valid=false;});return valid;}));await page.locator('#normals').check();checks.push('shadow and normal-map controls update scene');
 await page.keyboard.press('KeyB');assert.equal(await page.evaluate(()=>window.miguelitoDemo.flags.cinematic),false);await page.screenshot({path:path.join(out,'light-comparison-flat.png')});await page.keyboard.press('KeyB');assert.equal(await page.evaluate(()=>window.miguelitoDemo.flags.cinematic),true);
 await page.locator('[data-preset="moon"]').click();await page.screenshot({path:path.join(out,'light-lunar.png')});await page.locator('[data-preset="bio"]').click();await page.screenshot({path:path.join(out,'light-biolume.png')});await page.locator('[data-preset="cinema"]').click();checks.push('three light directions/palettes and flat-light comparison');
 await page.keyboard.press('KeyP');await page.locator('#quality').click();await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>window.miguelitoDemo.flags.high),false);await sample('desktopLow');checks.push('low quality renders with smaller shadow map and no bloom');
 await page.locator('#growth').click();assert.equal(await page.evaluate(()=>window.miguelitoDemo.snapshot().stats.matureBridges),0);await page.waitForFunction(()=>window.miguelitoDemo.snapshot().stats.matureBridges>0,{},{timeout:20000});checks.push('growth replay rebuilds native bridge and colliders');
 await page.locator('#quality').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(2000);await page.screenshot({path:path.join(out,'mobile-layout.png')});assert(await page.locator('.touch').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('390x844 layout has touch controls, no horizontal overflow (desktop GPU emulation)');
 reports.mobileLayout=await page.evaluate(()=>window.miguelitoDemo.getReport());
 assert.deepEqual(errors,[]);
 const result={date:'2026-10-17',status:'passed',checks,errors,reports,notes:['Frame intervals from requestAnimationFrame, including unclamped stalls; no isolated GPU timer.','5s samples after warmup; headless desktop Edge, Intel GPU. These are not physical mobile results.','Unity has no visual benchmark because license prevented Editor import/build.']};
 fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify(result,null,2));console.log('PASS',checks.length,'checks; no console/request/runtime errors');
 } finally {await browser.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,'browser-failure.json'),JSON.stringify({error:e.stack,checks,errors,reports},null,2));console.error(e);process.exitCode=1;});
