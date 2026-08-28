# Contributing

Requirements: Node.js 22+, Git, and a Chromium-family browser.

```bash
npm ci --ignore-scripts
npm run verify
```

Use a focused failing test before changing behavior. Browser claims require a real Chromium test; mocks cannot prove navigation, interaction, screenshots, restart, or persistence.

Changes to configuration or receipt contracts require matching TypeScript types, JSON Schema updates, compatibility notes, and package smoke coverage. Never commit `.vibeproof/`, generated `dist/`, tarballs, secrets, private traces, or host-specific paths.
