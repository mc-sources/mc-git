# Contributing to Mc-Git

Thank you for your interest in contributing to **Mc-Git**! Mc-Git is a desktop Git client built with **Tauri 2 + Rust + React 19/TypeScript**, applying a strict Clean Architecture: all Git logic lives on the Rust side (via `libgit2` / `git2-rs`), and the frontend is a pure presentation layer.

This document explains how to report issues, propose changes, and submit pull requests.

> **Code of Conduct** — This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## Table of Contents

- [Ways to contribute](#ways-to-contribute)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Security issues](#security-issues)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Coding conventions](#coding-conventions)
- [Commit messages](#commit-messages)
- [Branch naming](#branch-naming)
- [Tests](#tests)
- [Pull request process](#pull-request-process)
- [Versioning policy](#versioning-policy)
- [License](#license)

## Ways to contribute

- **Report bugs** through GitHub Issues using the bug report template.
- **Suggest features** through GitHub Issues using the feature request template.
- **Improve documentation** (README, in-app help, code comments).
- **Submit code** via pull requests for bug fixes or features.
- **Triage issues** by reproducing reported bugs, confirming versions, and adding context.

## Reporting bugs

Before opening a bug report:

1. Search the existing issues to make sure it hasn't already been reported.
2. Try the latest `dev` branch to check whether the bug is already fixed.
3. Collect reproduction details: OS, Mc-Git version, Git repository state, exact steps.

Use the **bug report** issue template; it asks for the information maintainers need to investigate efficiently.

## Suggesting features

Use the **feature request** issue template. A good feature request describes:

- The problem you are trying to solve (not just the proposed solution).
- Why current Mc-Git workflows do not address it.
- Optional: mockups, references to similar features in other clients.

Mc-Git favors **clean, predictable workflows** over feature creep. Features that significantly increase UI complexity may be deferred or rejected even if technically interesting.

## Security issues

**Do not open public issues for security vulnerabilities.** Instead, follow the procedure described in [SECURITY.md](SECURITY.md). Vulnerability reports go to `git.security@martingatignol.fr`.

## Development setup

### Prerequisites

- **Rust** stable (latest version recommended; see Tauri 2 requirements)
- **Node.js** 20+ and **npm**
- **System dependencies** for Tauri 2 (see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for your OS)
- **Git** (for development workflow; Mc-Git itself does **not** require the `git` CLI at runtime — see the *CLI policy* below)

### Installation

```bash
git clone https://github.com/mc-sources/mc-git.git
cd mc-git
npm install
```

### Common commands

```bash
# Run in development mode (Vite + Tauri)
npm run tauri dev

# Frontend type check
npx tsc --noEmit

# Backend type / borrow check
cd src-tauri && cargo check

# Production build
npm run tauri build
```

## Project structure

```
mcgit/
├── src/                              <- React/TypeScript frontend
│   ├── domain/                       <- Entities, ports, value objects
│   ├── usecases/                     <- Use case orchestration (thin)
│   ├── infrastructure/               <- IPC, events, repository adapters
│   ├── store/                        <- Zustand state (no IPC)
│   ├── components/                   <- atoms / molecules / organisms
│   └── locales/                      <- i18n (FR / EN / ES)
├── src-tauri/                        <- Rust backend
│   └── src/
│       ├── domain/ports/             <- GitRepository trait
│       ├── infrastructure/           <- Git2Repository implementation
│       ├── git/                      <- Pure git2-rs functions
│       ├── commands/                 <- #[tauri::command] wrappers
│       ├── state.rs                  <- AppState
│       ├── error.rs                  <- AppError (serializable)
│       └── lib.rs                    <- invoke_handler![]
├── docs/specifications/              <- Functional and technical specs
├── tests/                            <- Test suites
├── CHANGELOG.md
├── CONTRIBUTING.md                   <- This file
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE                           <- GPL-3.0-only
└── README.md
```

For deeper detail on architecture, see `docs/specifications/techniques/architecture.md`.

## Coding conventions

### Clean Architecture

- The frontend talks to the backend **only** through `TauriGitRepository.ts`. It is the single file that imports `@tauri-apps/api`. snake_case ↔ camelCase mapping is centralized there.
- Use cases (`src/usecases/`) orchestrate calls. They are thin and never import the IPC layer directly.
- Components call use cases, never the IPC.

### CLI policy

Mc-Git uses **`libgit2` (via `git2-rs`) first**. The `git` binary is invoked **only** for features that are absent from `libgit2` (e.g. `push --force-with-lease`). Before any `Command::new("git")`, call `crate::git::git_available()` and return a clear `AppError::Other` if it is missing. **The application must start and operate without `git` installed**.

### Adding a new Git command

Adding a new Git command requires the **6 mandatory steps**: pure git function → trait method → impl → Tauri command → registration → frontend use case. The full recipe lives in `docs/specifications/techniques/add-command.md`.

### Code style

- **TypeScript**: strict mode; explicit types on public APIs; prefer `interface` for object shapes, `type` for unions; avoid `any` (use `unknown` then narrow).
- **Rust**: idiomatic Rust 2021 edition; `cargo clippy --all-targets -- -D warnings` must pass.
- **Immutability** is the default on the TS side. Mutation is allowed only where idiomatic in Rust (pointer receivers, in-place updates).
- **File size**: many small files preferred over few large ones. Typical 200–400 lines, 800 max.
- **Comments**: only where the *why* is non-obvious. Never explain *what* the code does.

### Tailwind CSS v4

Styling uses **Tailwind CSS v4** via the Vite plugin. The theme is dark zinc throughout (`src/App.css`).

## Commit messages

Mc-Git follows **Conventional Commits**:

```
<type>: <short description>

<optional body>
```

Allowed types:

- **feat** — new feature
- **fix** — bug fix
- **refactor** — code change that neither fixes a bug nor adds a feature
- **docs** — documentation only
- **test** — test additions or fixes
- **chore** — tooling, dependencies, build
- **perf** — performance improvement
- **ci** — CI/CD changes

Examples:

```
feat(tags): delete a tag on a remote — bump 0.9.0
fix(graph): handle empty merge commits in topological layout
docs(readme): add Tauri 2 prerequisites section
```

Keep the subject line under ~72 characters. Use the body to explain *why*, not *what*.

## Branch naming

- Feature branches: `feat/US-NNNN-<slug>` (4-digit User Story numbers for new work) or `feat/US-NNN-<slug>` (3-digit, legacy migrated from older numbering).
- Fix branches: `fix/<short-slug>`.
- All branches start from `dev`. The default integration branch is **`dev`**, not `main`.
- Release branches: `release/X.Y.Z` (optional, cut from `dev` for QA).

## Tests

- **Rust** unit tests in `src-tauri/src/**/*.rs` (under `#[cfg(test)]`). Run with `cargo test`.
- **Frontend** type-check with `npx tsc --noEmit`. Test coverage on the TS side is currently limited; new code is welcome with tests.
- **E2E** tests via Playwright (planned — see `FEAT-134-tests-automatises`).

Aim for **80% coverage** on new logic when feasible, especially on the Rust side where the architecture invites it.

## Pull request process

1. **Open an issue** first for non-trivial changes — it lets us align on scope before you spend time on a PR.
2. **Fork** the repository, create your branch from `dev`.
3. **Implement** the change. Keep the diff focused — one PR, one concern.
4. **Tests**: `cargo test` and `npx tsc --noEmit` pass locally.
5. **Build**: `npm run tauri build` succeeds on your platform.
6. **CHANGELOG.md** — add an entry under `[Unreleased]` (or under the bumped version, depending on the work). Follow the *Keep a Changelog* format (Added / Changed / Fixed / Removed).
7. **Version bump** — if your change merits one according to the [Versioning policy](#versioning-policy), bump `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` in sync on your branch.
8. **Open the PR** against `dev`. Fill in the PR template.
9. **Review** — be ready to discuss design choices and iterate.
10. **Merge** is done by a maintainer once CI is green and review is positive.

### What gets a PR merged faster

- Small, focused diffs.
- Clear *why* in the commit message and PR description.
- Tests for new behavior.
- No mixing of unrelated refactors with feature work.
- Respecting existing conventions (Clean Architecture, naming, file organization).

## Versioning policy

Mc-Git follows **[Semantic Versioning](https://semver.org/)** with a project-specific rule: **1 User Story = 1 version bump**.

| Change | Bump |
|---|---|
| New feature or user-visible change (`Added`/`Changed`) | **Minor** (`X.Y.0` → `X.(Y+1).0`) |
| Bug fix only (`Fixed`) | **Patch** (`X.Y.Z` → `X.Y.(Z+1)`) |
| Breaking change | **Major** — discuss with maintainers first |

Bumps happen on the `feat/US-*` branch and arrive on `dev` at merge time. Release branches `release/X.Y.Z` (optional, for formal QA) are cut from `dev` **without a new bump**. See `docs/specifications/techniques/release.md` for the full release cycle.

## License

By contributing, you agree that your contributions will be licensed under the [GNU GPL v3.0 only](LICENSE), the same license as the project.
