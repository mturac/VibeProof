import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { VibeProofError } from "./errors.js";
import { runCommand } from "./command.js";
export interface CloneRepositoryOptions { readonly source: string; readonly ref: string; readonly destination: string }
export interface CloneProof { readonly source: string; readonly requestedRef: string; readonly commitSha: string; readonly clean: boolean; readonly destination: string }
async function git(argv: readonly [string, ...string[]], cwd: string, code: string): Promise<string> {
  const result = await runCommand({ argv, timeoutMs: 120_000 }, { cwd, inheritedEnvironment: ["PATH", "HOME", "USER", "TMPDIR", "TEMP", "TMP"], variables: {}, redactPatterns: [], maxLogBytes: 1_000_000 });
  if (result.exitCode !== 0) throw new VibeProofError(code, result.stderr.trim() || result.stdout.trim() || `Git command failed: ${argv.join(" ")}.`, { argv, exitCode: result.exitCode, signal: result.signal });
  return result.stdout.trim();
}
export async function cloneRepository(options: CloneRepositoryOptions): Promise<CloneProof> {
  const source = /^(?:https?|ssh|git):/i.test(options.source) || options.source.startsWith("git@") ? options.source : resolve(options.source);
  const destination = resolve(options.destination); await mkdir(dirname(destination), { recursive: true });
  await git(["git", "clone", "--no-local", "--no-hardlinks", "--no-checkout", source, destination], dirname(destination), "VP_GIT_CLONE");
  await git(["git", "checkout", "--detach", options.ref], destination, "VP_GIT_CHECKOUT");
  const commitSha = await git(["git", "rev-parse", "HEAD"], destination, "VP_GIT_IDENTITY");
  const status = await git(["git", "status", "--porcelain", "--untracked-files=all"], destination, "VP_GIT_STATUS");
  return { source, requestedRef: options.ref, commitSha, clean: status.length === 0, destination };
}
export async function inspectRepository(source: string): Promise<{ root: string; commitSha: string; clean: boolean }> {
  const root = await git(["git", "rev-parse", "--show-toplevel"], resolve(source), "VP_GIT_SOURCE");
  const commitSha = await git(["git", "rev-parse", "HEAD"], root, "VP_GIT_SOURCE");
  const status = await git(["git", "status", "--porcelain", "--untracked-files=all"], root, "VP_GIT_SOURCE");
  return { root, commitSha, clean: status.length === 0 };
}
