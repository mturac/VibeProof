import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { cloneRepository, createRedactor, findFreePort, runCommand } from "../dist/index.js";
function git(cwd,...args){const r=spawnSync("git",args,{cwd,encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();}
const ctx=(cwd,logPath)=>({cwd,inheritedEnvironment:["PATH","HOME","TMPDIR","TMP"],variables:{},redactPatterns:["(?i)token=[^\\s]+"],maxLogBytes:1024,...(logPath?{logPath}:{})});
test("runCommand captures, redacts, bounds, and times out",async()=>{const root=await mkdtemp(join(tmpdir(),"vp-command-"));try{const log=join(root,"log.txt");const ok=await runCommand({argv:[process.execPath,"-e","console.log('token=secret')"]},ctx(root,log));assert.equal(ok.exitCode,0);assert.match(ok.stdout,/REDACTED/);assert.match(await readFile(log,"utf8"),/REDACTED/);const timeout=await runCommand({argv:[process.execPath,"-e","setInterval(()=>{},1000)"],timeoutMs:50},ctx(root));assert.equal(timeout.timedOut,true);const large=await runCommand({argv:[process.execPath,"-e","console.log('x'.repeat(5000))"]},ctx(root));assert.match(large.stdout,/truncated/);}finally{await rm(root,{recursive:true,force:true});}});
test("cloneRepository checks exact clean commit",async()=>{const root=await mkdtemp(join(tmpdir(),"vp-git-"));try{const source=join(root,"source");await import("node:fs/promises").then(({mkdir})=>mkdir(source));git(source,"init","-b","main");git(source,"config","user.email","x@y.z");git(source,"config","user.name","X");await writeFile(join(source,"a.txt"),"a\n");git(source,"add",".");git(source,"commit","-m","a");const sha=git(source,"rev-parse","HEAD");const proof=await cloneRepository({source,ref:sha,destination:join(root,"clone")});assert.equal(proof.commitSha,sha);assert.equal(proof.clean,true);await assert.rejects(()=>cloneRepository({source,ref:"missing",destination:join(root,"bad")}),/checkout|pathspec|reference/i);}finally{await rm(root,{recursive:true,force:true});}});
test("redactor and free port helpers work",async()=>{assert.equal(createRedactor(["(?i)secret"])("SECRET"),"[REDACTED]");assert.ok((await findFreePort())>0);});
