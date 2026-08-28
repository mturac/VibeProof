import { isAbsolute, normalize as normalizePath, sep } from "node:path";
import { VibeProofError } from "./errors.js";
import type { BrowserStep, CommandSpec, VibeProofConfig } from "./types.js";

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_LOG_BYTES = 2_000_000;
const DEFAULT_ENV = ["PATH", "HOME", "USER", "TMPDIR", "TEMP", "TMP", "SHELL", "CI"] as const;
const DEFAULT_REDACTIONS = [
  "(?i)(api[_-]?key|token|secret|password|authorization)\\s*[:=]\\s*[^\\s]+",
  "gh[pousr]_[A-Za-z0-9_]{20,}",
  "sk-[A-Za-z0-9_-]{20,}"
] as const;

function fail(code: string, message: string, details?: Record<string, unknown>): never { throw new VibeProofError(code, message, details); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("VP_CONFIG_TYPE", `${path} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) fail("VP_CONFIG_UNKNOWN_KEY", `${path} contains unknown key(s): ${unknown.join(", ")}.`, { path, unknown });
}
function string(value: unknown, path: string, options: { nonEmpty?: boolean } = {}): string {
  if (typeof value !== "string") fail("VP_CONFIG_TYPE", `${path} must be a string.`);
  if (options.nonEmpty !== false && value.trim().length === 0) fail("VP_CONFIG_VALUE", `${path} must not be empty.`);
  return value;
}
function boolean(value: unknown, path: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail("VP_CONFIG_TYPE", `${path} must be a boolean.`);
  return value;
}
function positiveInteger(value: unknown, path: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) <= 0) fail("VP_CONFIG_VALUE", `${path} must be a positive integer.`);
  return value as number;
}
function safeRelativePath(value: unknown, path: string, fallback?: string): string {
  if (value === undefined && fallback !== undefined) return fallback;
  const raw = string(value, path);
  if (isAbsolute(raw)) fail("VP_CONFIG_PATH", `${path} must be repository-relative.`);
  const normalized = normalizePath(raw);
  const parts = normalized.split(sep);
  if (normalized === ".." || parts.includes("..")) fail("VP_CONFIG_PATH", `${path} must not escape the repository.`);
  return normalized === "" ? "." : normalized;
}
function stringArray(value: unknown, path: string, fallback: readonly string[]): readonly string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) fail("VP_CONFIG_TYPE", `${path} must be an array of non-empty strings.`);
  return [...value] as string[];
}
function parseCommand(value: unknown, path: string, options: { requireReadyUrl?: boolean } = {}): CommandSpec {
  const input = object(value, path);
  exactKeys(input, ["argv", "cwd", "timeoutMs", "env", "readyUrl", "readyTimeoutMs"], path);
  if (!Array.isArray(input.argv) || input.argv.length === 0 || input.argv.some((part) => typeof part !== "string" || part.length === 0)) fail("VP_CONFIG_COMMAND", `${path}.argv must be a non-empty array of non-empty strings.`);
  const envInput = input.env === undefined ? undefined : object(input.env, `${path}.env`);
  const env = envInput === undefined ? undefined : Object.fromEntries(Object.entries(envInput).map(([key, item]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof item !== "string") fail("VP_CONFIG_ENV", `${path}.env must map environment names to string values.`);
    return [key, item];
  }));
  const command: CommandSpec = {
    argv: [...input.argv] as [string, ...string[]],
    ...(input.cwd === undefined ? {} : { cwd: safeRelativePath(input.cwd, `${path}.cwd`) }),
    ...(input.timeoutMs === undefined ? {} : { timeoutMs: positiveInteger(input.timeoutMs, `${path}.timeoutMs`, 1) }),
    ...(env === undefined ? {} : { env }),
    ...(input.readyUrl === undefined ? {} : { readyUrl: string(input.readyUrl, `${path}.readyUrl`) }),
    ...(input.readyTimeoutMs === undefined ? {} : { readyTimeoutMs: positiveInteger(input.readyTimeoutMs, `${path}.readyTimeoutMs`, 1) })
  };
  if (options.requireReadyUrl && command.readyUrl === undefined) fail("VP_CONFIG_READY_URL", `${path}.readyUrl is required.`);
  return command;
}
function safeArtifactName(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) || value.includes("..")) fail("VP_CONFIG_ARTIFACT", "Screenshot names must contain only letters, numbers, dot, underscore, or dash and may not contain '..'.");
  return value.endsWith(".png") ? value : `${value}.png`;
}
function parseStep(value: unknown, index: number, path: string): BrowserStep {
  const input = object(value, `${path}[${index}]`);
  const op = string(input.op, `${path}[${index}].op`);
  const prefix = `${path}[${index}]`;
  switch (op) {
    case "goto": exactKeys(input, ["op", "path", "timeoutMs"], prefix); return { op, path: string(input.path, `${prefix}.path`), ...(input.timeoutMs === undefined ? {} : { timeoutMs: positiveInteger(input.timeoutMs, `${prefix}.timeoutMs`, 1) }) };
    case "waitForSelector":
    case "click": exactKeys(input, ["op", "selector", "timeoutMs"], prefix); return { op, selector: string(input.selector, `${prefix}.selector`), ...(input.timeoutMs === undefined ? {} : { timeoutMs: positiveInteger(input.timeoutMs, `${prefix}.timeoutMs`, 1) }) };
    case "waitForText": exactKeys(input, ["op", "text", "timeoutMs"], prefix); return { op, text: string(input.text, `${prefix}.text`), ...(input.timeoutMs === undefined ? {} : { timeoutMs: positiveInteger(input.timeoutMs, `${prefix}.timeoutMs`, 1) }) };
    case "assertText": exactKeys(input, ["op", "text"], prefix); return { op, text: string(input.text, `${prefix}.text`) };
    case "assertSelector": exactKeys(input, ["op", "selector"], prefix); return { op, selector: string(input.selector, `${prefix}.selector`) };
    case "fill": exactKeys(input, ["op", "selector", "value"], prefix); return { op, selector: string(input.selector, `${prefix}.selector`), value: string(input.value, `${prefix}.value`, { nonEmpty: false }) };
    case "assertUrl": {
      exactKeys(input, ["op", "value"], prefix);
      if (typeof input.value === "string") return { op, value: string(input.value, `${prefix}.value`) };
      const pattern = object(input.value, `${prefix}.value`); exactKeys(pattern, ["pattern"], `${prefix}.value`);
      return { op, value: { pattern: string(pattern.pattern, `${prefix}.value.pattern`) } };
    }
    case "screenshot":
      exactKeys(input, ["op", "name", "fullPage"], prefix);
      if (input.fullPage !== undefined && typeof input.fullPage !== "boolean") fail("VP_CONFIG_TYPE", `${prefix}.fullPage must be a boolean.`);
      return { op, name: safeArtifactName(string(input.name, `${prefix}.name`)), ...(input.fullPage === undefined ? {} : { fullPage: input.fullPage }) };
    default: fail("VP_CONFIG_BROWSER_OP", `${prefix}.op is not supported: ${op}.`);
  }
}
function parseSteps(value: unknown, path: string, required: boolean): readonly BrowserStep[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || (required && value.length === 0)) fail("VP_CONFIG_BROWSER", `${path} must be a non-empty array.`);
  return value.map((item, index) => parseStep(item, index, path));
}
export function isLoopbackUrl(value: string): boolean {
  try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}
export function expandVariables(value: string, variables: Readonly<Record<string, string>>): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    const replacement = variables[name]; if (replacement === undefined) fail("VP_VARIABLE_MISSING", `Variable ${name} is not defined.`); return replacement;
  });
}
export function parseConfig(value: unknown): VibeProofConfig {
  const input = object(value, "config");
  exactKeys(input, ["$schema", "version", "project", "commands", "browser", "proof", "security", "output"], "config");
  if (input.version !== 1) fail("VP_CONFIG_VERSION", "config.version must be exactly 1.");
  const projectInput = object(input.project, "project"); exactKeys(projectInput, ["name", "root", "ref"], "project");
  const project = { name: string(projectInput.name, "project.name"), root: safeRelativePath(projectInput.root, "project.root", "."), ...(projectInput.ref === undefined ? {} : { ref: string(projectInput.ref, "project.ref") }) };
  const commandsInput = object(input.commands, "commands"); exactKeys(commandsInput, ["install", "build", "start"], "commands");
  const start = parseCommand(commandsInput.start, "commands.start", { requireReadyUrl: true }) as CommandSpec & { readyUrl: string };
  const browserInput = object(input.browser, "browser"); exactKeys(browserInput, ["executable", "baseUrl", "journey", "afterRestart", "defaultTimeoutMs"], "browser");
  const browser = {
    ...(browserInput.executable === undefined ? {} : { executable: string(browserInput.executable, "browser.executable") }),
    baseUrl: string(browserInput.baseUrl, "browser.baseUrl"), journey: parseSteps(browserInput.journey, "browser.journey", true),
    ...(browserInput.afterRestart === undefined ? {} : { afterRestart: parseSteps(browserInput.afterRestart, "browser.afterRestart", false) }),
    defaultTimeoutMs: positiveInteger(browserInput.defaultTimeoutMs, "browser.defaultTimeoutMs", DEFAULT_TIMEOUT)
  };
  const proofInput = input.proof === undefined ? {} : object(input.proof, "proof"); exactKeys(proofInput, ["requireCleanClone", "requireBuild", "requireBrowser", "requireRestart"], "proof");
  const proof = { requireCleanClone: boolean(proofInput.requireCleanClone, "proof.requireCleanClone", true), requireBuild: boolean(proofInput.requireBuild, "proof.requireBuild", commandsInput.build !== undefined), requireBrowser: boolean(proofInput.requireBrowser, "proof.requireBrowser", true), requireRestart: boolean(proofInput.requireRestart, "proof.requireRestart", false) };
  const securityInput = input.security === undefined ? {} : object(input.security, "security"); exactKeys(securityInput, ["allowRemoteUrls", "inheritEnv", "redactPatterns", "maxLogBytes"], "security");
  const security = { allowRemoteUrls: boolean(securityInput.allowRemoteUrls, "security.allowRemoteUrls", false), inheritEnv: stringArray(securityInput.inheritEnv, "security.inheritEnv", DEFAULT_ENV), redactPatterns: stringArray(securityInput.redactPatterns, "security.redactPatterns", DEFAULT_REDACTIONS), maxLogBytes: positiveInteger(securityInput.maxLogBytes, "security.maxLogBytes", DEFAULT_LOG_BYTES) };
  const outputInput = input.output === undefined ? {} : object(input.output, "output"); exactKeys(outputInput, ["keepWorkspaceOnFailure", "keepWorkspaceOnSuccess"], "output");
  const output = { keepWorkspaceOnFailure: boolean(outputInput.keepWorkspaceOnFailure, "output.keepWorkspaceOnFailure", true), keepWorkspaceOnSuccess: boolean(outputInput.keepWorkspaceOnSuccess, "output.keepWorkspaceOnSuccess", false) };
  if (!security.allowRemoteUrls) {
    for (const [path, url] of [["commands.start.readyUrl", start.readyUrl], ["browser.baseUrl", browser.baseUrl]] as const) {
      const expanded = url.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g, "43210"); if (!isLoopbackUrl(expanded)) fail("VP_CONFIG_REMOTE_URL", `${path} must be a loopback URL unless security.allowRemoteUrls is true.`);
    }
    const base = browser.baseUrl.replace(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g, "43210");
    for (const [index, step] of [...browser.journey, ...(browser.afterRestart ?? [])].entries()) {
      if (step.op !== "goto") continue;
      let resolvedUrl: string; try { resolvedUrl = new URL(step.path, base).href; } catch { fail("VP_CONFIG_REMOTE_URL", `browser step ${index + 1} contains an invalid navigation URL.`); }
      if (!isLoopbackUrl(resolvedUrl)) fail("VP_CONFIG_REMOTE_URL", `browser step ${index + 1} must navigate to a loopback URL unless security.allowRemoteUrls is true.`);
    }
  }
  if (proof.requireBuild && commandsInput.build === undefined) fail("VP_CONFIG_BUILD", "proof.requireBuild is true but commands.build is not declared.");
  if (proof.requireRestart && (browser.afterRestart === undefined || browser.afterRestart.length === 0)) fail("VP_CONFIG_RESTART", "proof.requireRestart requires browser.afterRestart steps.");
  return { version: 1, project, commands: { ...(commandsInput.install === undefined ? {} : { install: parseCommand(commandsInput.install, "commands.install") }), ...(commandsInput.build === undefined ? {} : { build: parseCommand(commandsInput.build, "commands.build") }), start }, browser, proof, security, output };
}
