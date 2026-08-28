import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
for(const name of ["vibeproof-config.schema.json","vibeproof-receipt.schema.json"]){test(`${name} exposes strict schema metadata`,async()=>{const schema=JSON.parse(await readFile(new URL(`../schema/${name}`,import.meta.url),"utf8"));assert.equal(schema.$schema,"https://json-schema.org/draft/2020-12/schema");assert.equal(schema.type,"object");assert.equal(schema.additionalProperties,false);assert.ok(Object.keys(schema.properties).length>=8);assert.ok(Object.keys(schema.$defs??{}).length>=3);});}
