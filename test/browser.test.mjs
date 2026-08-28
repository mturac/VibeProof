import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findBrowserExecutable, runBrowserJourney } from "../dist/index.js";
async function server(){const s=createServer((_q,r)=>{r.writeHead(200,{"content-type":"text/html"});r.end('<h1>Hello proof</h1><input id="name"><button id="go" onclick="document.body.dataset.done=\'yes\';location.hash=\'done\'">Go</button>')});await new Promise(r=>s.listen(0,"127.0.0.1",r));const a=s.address();return{s,url:`http://127.0.0.1:${a.port}`};}
test("findBrowserExecutable resolves a browser",async()=>assert.ok((await findBrowserExecutable()).length>0));
test("runBrowserJourney drives real Chromium and captures PNG",async()=>{const {s,url}=await server();const dir=await mkdtemp(join(tmpdir(),"vp-browser-"));try{const result=await runBrowserJourney({baseUrl:url,screenshotsDirectory:dir,defaultTimeoutMs:3000,steps:[{op:"goto",path:"/"},{op:"assertText",text:"Hello proof"},{op:"fill",selector:"#name",value:"X"},{op:"click",selector:"#go"},{op:"assertUrl",value:{pattern:"#done$"}},{op:"screenshot",name:"proof"}]});assert.equal(result.steps.every(x=>x.status==="passed"),true);assert.equal(result.steps.at(-1).evidence,"screenshots/proof.png");assert.deepEqual((await readFile(join(dir,"proof.png"))).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));}finally{s.close();await rm(dir,{recursive:true,force:true});}});
test("browser assertion fails closed",async()=>{const {s,url}=await server();const dir=await mkdtemp(join(tmpdir(),"vp-browser-fail-"));try{await assert.rejects(()=>runBrowserJourney({baseUrl:url,screenshotsDirectory:dir,defaultTimeoutMs:500,steps:[{op:"goto",path:"/"},{op:"assertSelector",selector:"#missing"}]}),/Browser step 2/);}finally{s.close();await rm(dir,{recursive:true,force:true});}});
