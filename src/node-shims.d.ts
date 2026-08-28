declare module "node:child_process";
declare module "node:crypto";
declare module "node:fs";
declare module "node:fs/promises";
declare module "node:http";
declare module "node:net";
declare module "node:os";
declare module "node:path";
declare module "node:url";
declare const Buffer: any;
declare const process: any;
declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined }
  type Signals = string;
}
