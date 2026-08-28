export interface CommandSpec {
  readonly argv: readonly [string, ...string[]];
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly env?: Readonly<Record<string, string>>;
  readonly readyUrl?: string;
  readonly readyTimeoutMs?: number;
}
export type BrowserStep =
  | { readonly op: "goto"; readonly path: string; readonly timeoutMs?: number }
  | { readonly op: "waitForSelector"; readonly selector: string; readonly timeoutMs?: number }
  | { readonly op: "waitForText"; readonly text: string; readonly timeoutMs?: number }
  | { readonly op: "assertText"; readonly text: string }
  | { readonly op: "assertSelector"; readonly selector: string }
  | { readonly op: "fill"; readonly selector: string; readonly value: string }
  | { readonly op: "click"; readonly selector: string; readonly timeoutMs?: number }
  | { readonly op: "assertUrl"; readonly value: string | { readonly pattern: string } }
  | { readonly op: "screenshot"; readonly name: string; readonly fullPage?: boolean };
export interface VibeProofConfig {
  readonly version: 1;
  readonly project: { readonly name: string; readonly root: string; readonly ref?: string };
  readonly commands: { readonly install?: CommandSpec; readonly build?: CommandSpec; readonly start: CommandSpec & { readonly readyUrl: string } };
  readonly browser: { readonly executable?: string; readonly baseUrl: string; readonly journey: readonly BrowserStep[]; readonly afterRestart?: readonly BrowserStep[]; readonly defaultTimeoutMs: number };
  readonly proof: { readonly requireCleanClone: boolean; readonly requireBuild: boolean; readonly requireBrowser: boolean; readonly requireRestart: boolean };
  readonly security: { readonly allowRemoteUrls: boolean; readonly inheritEnv: readonly string[]; readonly redactPatterns: readonly string[]; readonly maxLogBytes: number };
  readonly output: { readonly keepWorkspaceOnFailure: boolean; readonly keepWorkspaceOnSuccess: boolean };
}
export interface CommandResult { readonly argv: readonly string[]; readonly cwd: string; readonly startedAt: string; readonly finishedAt: string; readonly durationMs: number; readonly exitCode: number | null; readonly signal: string | null; readonly timedOut: boolean; readonly stdout: string; readonly stderr: string; readonly logPath?: string }
export type ProofStageName = "source" | "install" | "build" | "runtime" | "browser" | "restart";
export type ProofStageStatus = "passed" | "failed" | "skipped";
export interface ProofStage { readonly name: ProofStageName; readonly required: boolean; readonly status: ProofStageStatus; readonly startedAt?: string; readonly finishedAt?: string; readonly durationMs?: number; readonly evidence: readonly string[]; readonly error?: { readonly code: string; readonly message: string } }
export interface BrowserStepResult { readonly index: number; readonly op: BrowserStep["op"]; readonly status: "passed" | "failed"; readonly startedAt: string; readonly finishedAt: string; readonly durationMs: number; readonly evidence?: string; readonly error?: string }
export interface ArtifactReceipt { readonly path: string; readonly mediaType: string; readonly bytes: number; readonly sha256: string }
export interface VibeProofReceipt {
  readonly receiptVersion: 1; readonly runId: string; readonly projectName: string; readonly createdAt: string;
  readonly source: { readonly requested: string; readonly requestedRef: string; readonly commitSha: string; readonly cleanClone: boolean; readonly projectRoot: string };
  readonly environment: { readonly platform: string; readonly architecture: string; readonly nodeVersion: string; readonly browserExecutable?: string; readonly browserVersion?: string };
  readonly stages: readonly ProofStage[];
  readonly browser: { readonly journey: readonly BrowserStepResult[]; readonly afterRestart: readonly BrowserStepResult[] };
  readonly artifacts: readonly ArtifactReceipt[];
  readonly claims: { readonly sourceVerified: boolean; readonly installPassed: boolean | null; readonly buildPassed: boolean | null; readonly runtimeReady: boolean; readonly browserJourneyPassed: boolean; readonly restartPassed: boolean | null; readonly verified: boolean };
  readonly result: { readonly status: "verified" | "failed"; readonly failedStage: ProofStageName | null };
  readonly receiptHash: string;
}
export interface VerifyOptions { readonly source: string; readonly configPath: string; readonly outputDirectory?: string; readonly keepWorkspace?: boolean; readonly browserExecutable?: string }
export interface VerificationResult { readonly receipt: VibeProofReceipt; readonly outputDirectory: string; readonly workspaceDirectory?: string }
