export class VibeProofError extends Error {
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "VibeProofError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export function asVibeProofError(error: unknown, fallbackCode = "VP_INTERNAL"): VibeProofError {
  if (error instanceof VibeProofError) return error;
  if (error instanceof Error) return new VibeProofError(fallbackCode, error.message);
  return new VibeProofError(fallbackCode, String(error));
}
