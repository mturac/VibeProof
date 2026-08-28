# Security Policy

Report vulnerabilities privately through GitHub security advisories. Do not publish credentials, private repositories, traces, or screenshots.

VibeProof executes install, build, and start commands from the repository under test. Run untrusted repositories only on disposable CI workers, containers, or virtual machines. VibeProof is not a malware sandbox.

Security boundaries:

- commands use argv arrays with `shell: false`;
- only an explicit environment allowlist is inherited;
- loopback application URLs are required by default;
- logs are bounded and redacted;
- portable receipts omit absolute source paths and URL credentials;
- contract snapshots mask environment values and browser input/assertion values;
- process groups are terminated on timeout and shutdown.
