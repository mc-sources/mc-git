# Security Policy

The Mc-Git team takes the security of the application and its users seriously. This document explains how to report a vulnerability and what to expect in return.

## Supported Versions

Mc-Git is currently in **pre-1.0** development. Only the **latest minor release** receives security fixes.

| Version | Supported |
|---------|-----------|
| Latest `0.x` minor | ✅ |
| Older `0.x` minors | ❌ |

Once Mc-Git reaches a 1.x stable release, this policy will be revised to support the most recent stable line for a defined period.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them privately via one of the following channels:

1. **Email** — Send a detailed report to **git.security@martingatignol.fr**.
2. **GitHub Private Vulnerability Reporting** — If enabled on the repository: <https://github.com/mc-sources/mc-git/security/advisories/new>.

### What to include in your report

To help us triage and reproduce the issue quickly, please include the following information when possible:

- **Type of issue** — buffer overflow, command injection, path traversal, authentication bypass, supply-chain risk, etc.
- **Affected component** — Rust backend (`src-tauri/`), frontend (`src/`), IPC boundary (`TauriGitRepository.ts`), CI workflow, build/release artifact, etc.
- **Affected version** — output of `npm run tauri --version` and the commit SHA or release tag.
- **Operating system** — Linux distribution / macOS / Windows version.
- **Reproduction steps** — minimal, deterministic steps that demonstrate the issue.
- **Impact** — confidentiality, integrity, availability; estimated severity.
- **Proof of concept** — code, screenshots, recordings, or sample repository when relevant.
- **Suggested fix** — if you have one in mind (optional but appreciated).

## Response Timeline

Mc-Git is maintained by a small team and cannot guarantee enterprise-grade SLAs, but our intent is:

| Step | Target window |
|------|---------------|
| Acknowledgement of receipt | Within **3 business days** |
| Initial triage and severity assessment | Within **7 business days** |
| Status update | At least **every 14 days** until resolution |
| Coordinated disclosure / public advisory | Once a fix is released, or as agreed with the reporter |

## Disclosure Policy

- Reports are handled privately until a fix is available.
- We follow a **coordinated disclosure** model: we ask reporters not to publish details until a fix has been released, typically within **90 days** of acknowledgement.
- If we cannot fix an issue within 90 days, we will discuss an extension with the reporter or — when applicable — issue a public advisory describing mitigations.
- Public credit is given to reporters in the release notes and in the GitHub advisory, unless they request anonymity.

## Out of Scope

The following are explicitly **out of scope** for this policy:

- Vulnerabilities in third-party dependencies — please report those to the upstream maintainers. We track our exposure via Dependabot and will respond to advisories that affect Mc-Git.
- Issues that require **physical access** to a user's machine or **prior root/admin compromise** of the host system.
- Reports of missing security headers, certificate strictness, or rate limits on **public release artifact downloads** (handled by the hosting platform).
- Findings from automated scanners without a demonstrable impact on Mc-Git itself.

## Hall of Fame

We will list reporters who have responsibly disclosed valid vulnerabilities below, unless they prefer to remain anonymous.

_No entries yet._

## License

This security policy is licensed under [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) — feel free to reuse and adapt it for your own projects.
