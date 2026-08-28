import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { expandVariables } from "./config.js";
import { VibeProofError } from "./errors.js";
import type { CommandResult, CommandSpec } from "./types.js";

export interface RunCommandContext { readonly cwd: string; readonly inheritedEnvironment: readonly string[]; readonly variables: Readonly<Record<string, string>>; readonly redactPatterns: readonly string[]; readonly maxLogBytes: number; readonly logPath?: string }
function compilePattern(source: string): RegExp {
  let flags = "g"; let pattern = source; if (pattern.startsWith("(?i)")) { pattern = pattern.slice(4); flags += "i"; }
  try { return new RegExp(pattern, flags); } catch (error) { throw new VibeProofError("VP_REDACTION_PATTERN", `Invalid redaction pattern: ${source}.`, { cause: error instanceof Error ? error.message : String(error) }); }
}
export function createRedactor(patterns: readonly string[]): (value: string) => string { const compiled = patterns.map(compilePattern); return (value) => compiled.reduce((current, pattern) => current.replace(pattern, "[REDACTED]"), value); }
function boundUtf8(value: string, maxBytes: number): string { const bytes = Buffer.from(value, "utf8"); if (bytes.length <= maxBytes) return value; const marker = `\n...[truncated ${bytes.length - maxBytes} bytes]`; const retained = Math.max(0, maxBytes - Buffer.byteLength(marker)); return bytes.subarray(0, retained).toString("utf8") + marker; }
function buildEnvironment(spec: CommandSpec, context: RunCommandContext): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of context.inheritedEnvironment) { const value = process.env[key]; if (value !== undefined) environment[key] = value; }
  for (const [key, value] of Object.entries(spec.env ?? {})) environment[key] = expandVariables(value, context.variables);
  environment.VIBEPROOF = "1"; return environment;
}
function killProcessGroup(pid: number, signal: NodeJS.Signals): void { try { process.kill(process.platform === "win32" ? pid : -pid, signal); } catch (error) { if ((error as { code?: string }).code !== "ESRCH") throw error; } }
export async function runCommand(spec: CommandSpec, context: RunCommandContext): Promise<CommandResult> {
  if (spec.argv.length === 0) throw new VibeProofError("VP_COMMAND_EMPTY", "Command argv must not be empty.");
  if (process.platform === "win32") throw new VibeProofError("VP_PLATFORM_BLOCKED", "VibeProof v0.1 supports macOS and Linux only.");
  const started = Date.now(); const startedAt = new Date(started).toISOString(); const redactor = createRedactor(context.redactPatterns);
  const argv = spec.argv.map((item) => expandVariables(item, context.variables)); const cwd = resolve(context.cwd, spec.cwd ?? "."); const timeoutMs = spec.timeoutMs ?? 120_000;
  return await new Promise<CommandResult>((resolveResult, reject) => {
    let stdout = "", stderr = "", timedOut = false, settled = false; let timeout: ReturnType<typeof setTimeout> | undefined; let escalation: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(argv[0]!, argv.slice(1), { cwd, env: buildEnvironment(spec, context), shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.setEncoding("utf8"); child.stderr?.setEncoding("utf8"); child.stdout?.on("data", (chunk: string) => { stdout += chunk; }); child.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", (error: Error) => { if (timeout) clearTimeout(timeout); if (escalation) clearTimeout(escalation); if (!settled) { settled = true; reject(new VibeProofError("VP_COMMAND_SPAWN", `Failed to start ${argv[0]}: ${error.message}.`, { argv, cwd })); } });
    timeout = setTimeout(() => { timedOut = true; try { killProcessGroup(child.pid!, "SIGTERM"); } catch {} escalation = setTimeout(() => { try { killProcessGroup(child.pid!, "SIGKILL"); } catch {} }, 250); }, timeoutMs);
    child.once("close", async (code: number | null, signal: string | null) => {
      if (settled) return; settled = true; if (timeout) clearTimeout(timeout); if (escalation) clearTimeout(escalation); const finished = Date.now();
      const result: CommandResult = { argv, cwd, startedAt, finishedAt: new Date(finished).toISOString(), durationMs: Math.max(0, finished - started), exitCode: code, signal, timedOut, stdout: boundUtf8(redactor(stdout), context.maxLogBytes), stderr: boundUtf8(redactor(stderr), context.maxLogBytes), ...(context.logPath === undefined ? {} : { logPath: context.logPath }) };
      if (context.logPath !== undefined) { try { await mkdir(dirname(context.logPath), { recursive: true }); await writeFile(context.logPath, [`$ ${argv.map((part) => JSON.stringify(part)).join(" ")}`, "", result.stdout, result.stderr].join("\n"), "utf8"); } catch (error) { reject(new VibeProofError("VP_LOG_WRITE", `Failed to write command log: ${error instanceof Error ? error.message : String(error)}.`)); return; } }
      resolveResult(result);
    });
  });
}
