# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the details to the maintainer or use [GitHub's private vulnerability reporting](https://github.com/Wintersta7e/mz-scene-builder/security/advisories/new)
3. Include steps to reproduce and potential impact

You should receive a response within 7 days. Security fixes will be prioritized and released as patch versions.

## Security Model

Timeline Scene Builder is an Electron desktop application with the following security measures:

- **Context isolation enabled** — renderer process has no direct Node.js access
- **Sandbox enabled** — renderer runs in a sandboxed environment
- **IPC whitelist** — only approved channels are exposed via `contextBridge`
- **Path traversal protection** — `isPathSafe()` validates all file paths before access
- **External URL whitelist** — `shell.openExternal()` restricted to approved domains

## Scope

Security issues in the following areas are in scope:

- Path traversal or arbitrary file access
- IPC channel bypass or privilege escalation
- Code injection via crafted `.mzscene` or RPG Maker project files
- External URL whitelist bypass
