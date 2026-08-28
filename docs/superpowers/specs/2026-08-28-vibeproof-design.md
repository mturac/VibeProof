# VibeProof Design Specification

VibeProof independently proves an exact Git commit through the ordered ladder `source -> install -> build -> runtime -> browser -> restart`. It reconstructs a clean clone, runs argv-only commands, supervises the application, drives real Chromium, proves declared persistence, and seals portable evidence. Lower rungs cannot satisfy higher claims. The tool is local-first, fail-closed, dependency-free at runtime, and does not claim full production readiness from one journey.
