# VibeProof

<p align="center">
  <img src="docs/assets/vibeproof-hero.png" alt="VibeProof — clean-clone, browser, restart and persistence proof for vibe-coded products" width="100%" />
</p>

[![CI](https://github.com/mturac/VibeProof/actions/workflows/ci.yml/badge.svg)](https://github.com/mturac/VibeProof/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](package.json)

**VibeProof answers the question every vibe coder eventually has to ask: does the product actually work from a clean checkout, or did the agent merely say it was done?**

VibeProof reconstructs an exact Git commit in an isolated clone, runs declared install/build commands, starts the product, completes a real Chromium journey, restarts the process, verifies persisted state, and seals the evidence into a canonical receipt.

It is designed for software produced with Codex, Claude Code, Cursor, OpenHands, Cline, Roo Code, and custom coding agents. It is equally useful in conventional CI whenever a passing unit suite does not prove that the web product boots and completes its critical user flow.

## Proof ladder

```text
exact commit
   ↓
clean isolated clone
   ↓
install → build → readiness
   ↓
real browser journey
   ↓
process restart
   ↓
persisted user-visible state
   ↓
receipt + evidence hashes
```

A lower rung cannot satisfy a higher claim. A README does not prove installation. A health endpoint does not prove the browser journey. A screenshot does not prove restart persistence. An agent's “done” message proves none of them.

## Quick start

Requirements: Node.js 22+, Git, macOS or Linux, and a Chromium-family browser.

```bash
git clone https://github.com/mturac/VibeProof.git
cd VibeProof
npm ci --ignore-scripts
npm run build
```

Generate a starter contract in the product repository:

```bash
vibeproof init .
git add vibeproof.config.json .gitignore
git commit -m "test: add executable product proof"
```

Check prerequisites, then run:

```bash
vibeproof doctor .
vibeproof verify . --output .vibeproof/latest
```

A successful run exits `0` and produces:

```text
.vibeproof/latest/
├── contract.snapshot.json
├── logs/
├── screenshots/
├── receipt.json
├── report.md
└── report.html
```

`receipt.json` is the machine authority. `report.html` is the local human view.

## CLI

```text
vibeproof init [repo] [--config path] [--json]
vibeproof doctor [repo] [--config path] [--browser path] [--json]
vibeproof verify [repo] [--config path] [--output path] [--browser path] [--keep-workspace] [--json]
vibeproof inspect <receipt.json> [--json]
vibeproof --version
vibeproof --help
```

| Exit | Meaning |
|---:|---|
| `0` | Verified or command succeeded |
| `1` | Invalid configuration or operational error |
| `2` | Proof failed, doctor blocked, or receipt integrity invalid |

VibeProof v0.1 verifies local Git repositories. Clone remote sources first, then pass the local path. This makes the exact commit and dirty-source boundary explicit.

## Configuration

Commands are argv arrays and never pass through a shell. Paths are repository-relative. URLs must be loopback unless `security.allowRemoteUrls` is explicitly enabled.

```json
{
  "$schema": "https://raw.githubusercontent.com/mturac/VibeProof/main/schema/vibeproof-config.schema.json",
  "version": 1,
  "project": { "name": "my-product", "root": "." },
  "commands": {
    "install": { "argv": ["npm", "ci"] },
    "build": { "argv": ["npm", "run", "build"] },
    "start": {
      "argv": ["npm", "start"],
      "env": { "PORT": "${VIBEPROOF_PORT}" },
      "readyUrl": "http://127.0.0.1:${VIBEPROOF_PORT}/health"
    }
  },
  "browser": {
    "baseUrl": "http://127.0.0.1:${VIBEPROOF_PORT}",
    "journey": [
      { "op": "goto", "path": "/" },
      { "op": "fill", "selector": "#title", "value": "Proof item" },
      { "op": "click", "selector": "#save" },
      { "op": "waitForText", "text": "Saved: Proof item" },
      { "op": "screenshot", "name": "created" }
    ],
    "afterRestart": [
      { "op": "goto", "path": "/" },
      { "op": "waitForText", "text": "Current: Proof item" },
      { "op": "screenshot", "name": "persisted" }
    ]
  },
  "proof": {
    "requireCleanClone": true,
    "requireBuild": true,
    "requireBrowser": true,
    "requireRestart": true
  }
}
```

See [`schema/vibeproof-config.schema.json`](schema/vibeproof-config.schema.json) and the runnable [`examples/vibeproof.config.json`](examples/vibeproof.config.json).

## Browser operations

VibeProof drives Chromium through CDP without accepting arbitrary JavaScript from configuration.

- `goto`
- `waitForSelector`
- `waitForText`
- `assertText`
- `assertSelector`
- `fill`
- `click`
- `assertUrl`
- `screenshot`

A failed selector, timeout, command, readiness probe, or post-restart assertion fails closed.

## Receipt and evidence

The receipt records the portable source identity, exact commit SHA, proof stages, timings, browser results, explicit claims, and SHA-256 hashes for contract, log, and screenshot evidence. Its `receiptHash` covers the canonical receipt content excluding the hash field.

Derived Markdown and HTML reports contain the receipt hash but are not included in the receipt artifact list, avoiding a circular hash relationship.

```bash
vibeproof inspect .vibeproof/latest/receipt.json --json
```

## Privacy and security

VibeProof is local-first and sends no telemetry.

- command environment values are masked in contract snapshots;
- browser input, text, and URL assertion values are masked;
- configured secret patterns are redacted from logs;
- logs are size-bounded;
- portable receipts omit absolute source paths and URL credentials;
- child process groups are terminated on timeout and shutdown.

Screenshots are content-bearing evidence. Inspect them before sharing.

VibeProof executes repository code and is not a malware sandbox. Use disposable workers or virtual machines for untrusted code.

## Scope

A successful VibeProof run proves only the declared executable journey and restart boundary. It does not prove complete requirement coverage, public deployment health, production capacity, security, accessibility, compliance, disaster recovery, or cross-browser compatibility.

Pair VibeProof with product-specific tests and security/operational review.

## Library API

```ts
import { doctorProject, inspectReceipt, verifyProject } from "@mturac/vibeproof";

const result = await verifyProject({
  source: process.cwd(),
  configPath: "vibeproof.config.json",
  outputDirectory: ".vibeproof/latest"
});

if (!result.receipt.claims.verified) process.exitCode = 2;
```

## Development

```bash
npm ci --ignore-scripts
npm run verify
```

The verification command runs strict TypeScript compilation, public API type tests, deterministic unit tests, real Chromium tests, restart/persistence integration tests, PNG checks, and a real npm tarball consumer proof.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
