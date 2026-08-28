import { doctorProject, initProject, inspectReceipt, parseConfig, verifyProject, type BrowserStep, type VibeProofReceipt } from "@mturac/vibeproof";
const step: BrowserStep={op:"assertSelector",selector:"body"};
const config=parseConfig({version:1,project:{name:"x"},commands:{start:{argv:["node","server.js"],readyUrl:"http://127.0.0.1:3000"}},browser:{baseUrl:"http://127.0.0.1:3000",journey:[step]}});
void config; void initProject("."); void doctorProject("."); void inspectReceipt({}); void verifyProject({source:".",configPath:"vibeproof.config.json"});
const receipt={} as VibeProofReceipt; receipt.claims.verified satisfies boolean;
