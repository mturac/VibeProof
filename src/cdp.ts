import { VibeProofError } from "./errors.js";
interface Envelope { readonly id?: number; readonly method?: string; readonly params?: unknown; readonly result?: unknown; readonly error?: { readonly code: number; readonly message: string; readonly data?: string }; readonly sessionId?: string }
interface Pending { readonly method: string; readonly resolve: (value: any) => void; readonly reject: (error: Error) => void }
interface Waiter { readonly method: string; readonly sessionId?: string; readonly resolve: (value: any) => void; readonly reject: (error: Error) => void; readonly timer: ReturnType<typeof setTimeout> }
export class CdpClient {
  readonly #socket: WebSocket; readonly #pending = new Map<number, Pending>(); readonly #waiters = new Set<Waiter>(); #nextId = 1; #closed = false;
  private constructor(socket: WebSocket) { this.#socket = socket; socket.addEventListener("message", (event: MessageEvent) => this.#message(event)); socket.addEventListener("close", () => this.#closeUnexpected()); socket.addEventListener("error", () => this.#closeUnexpected()); }
  static async connect(url: string, timeoutMs = 10_000): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { socket.close(); reject(new VibeProofError("VP_BROWSER_CONNECT", `Timed out connecting to Chromium CDP at ${url}.`)); }, timeoutMs); const open = () => { clearTimeout(timer); resolve(); }; const fail = () => { clearTimeout(timer); reject(new VibeProofError("VP_BROWSER_CONNECT", `Failed to connect to Chromium CDP at ${url}.`)); }; socket.addEventListener("open", open, { once: true }); socket.addEventListener("error", fail, { once: true }); });
    return new CdpClient(socket);
  }
  async send<T = any>(method: string, params: Readonly<Record<string, unknown>> = {}, sessionId?: string): Promise<T> {
    if (this.#closed) throw new VibeProofError("VP_BROWSER_CLOSED", "Chromium CDP connection is closed."); const id = this.#nextId++; const message: Record<string, unknown> = { id, method, params }; if (sessionId !== undefined) message.sessionId = sessionId;
    return await new Promise<T>((resolve, reject) => { this.#pending.set(id, { method, resolve, reject }); try { this.#socket.send(JSON.stringify(message)); } catch (error) { this.#pending.delete(id); reject(new VibeProofError("VP_BROWSER_SEND", `Failed to send ${method}: ${error instanceof Error ? error.message : String(error)}.`)); } });
  }
  async waitForEvent<T = unknown>(method: string, sessionId: string | undefined, timeoutMs: number): Promise<T> {
    if (this.#closed) throw new VibeProofError("VP_BROWSER_CLOSED", "Chromium CDP connection is closed.");
    return await new Promise<T>((resolve, reject) => { const waiter: Waiter = { method, ...(sessionId === undefined ? {} : { sessionId }), resolve, reject, timer: setTimeout(() => { this.#waiters.delete(waiter); reject(new VibeProofError("VP_BROWSER_EVENT_TIMEOUT", `Timed out waiting for CDP event ${method}.`)); }, timeoutMs) }; this.#waiters.add(waiter); });
  }
  close(): void { if (this.#closed) return; this.#closed = true; this.#socket.close(); this.#rejectAll(new VibeProofError("VP_BROWSER_CLOSED", "Chromium CDP connection closed.")); }
  #message(event: MessageEvent): void { let message: Envelope; try { message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data)) as Envelope; } catch { return; } if (message.id !== undefined) { const pending = this.#pending.get(message.id); if (!pending) return; this.#pending.delete(message.id); if (message.error) pending.reject(new VibeProofError("VP_BROWSER_PROTOCOL", `${pending.method} failed: ${message.error.message}.`, { code: message.error.code, data: message.error.data })); else pending.resolve(message.result); return; } if (!message.method) return; for (const waiter of [...this.#waiters]) { if (waiter.method !== message.method || (waiter.sessionId !== undefined && waiter.sessionId !== message.sessionId)) continue; clearTimeout(waiter.timer); this.#waiters.delete(waiter); waiter.resolve(message.params); } }
  #closeUnexpected(): void { if (this.#closed) return; this.#closed = true; this.#rejectAll(new VibeProofError("VP_BROWSER_CLOSED", "Chromium CDP connection closed unexpectedly.")); }
  #rejectAll(error: Error): void { for (const pending of this.#pending.values()) pending.reject(error); this.#pending.clear(); for (const waiter of this.#waiters) { clearTimeout(waiter.timer); waiter.reject(error); } this.#waiters.clear(); }
}
