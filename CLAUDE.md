# Mc-Git — Code source applicatif

Client git desktop **Tauri 2 + Rust + React 19/TypeScript**, Clean Architecture
stricte : toute la logique git côté Rust (libgit2 / git2-rs), le frontend est
une couche de présentation pure. Cibles : Linux / macOS / Windows.

Ce dépôt contient uniquement le **code source applicatif**. La gouvernance
projet (analyses, backlog, IBP) vit dans un dépôt privé séparé
`mcgit-project-management`, agrégé avec celui-ci par le repo maître
`mcgit-main` via submodules.

Pour les contributeurs internes ayant accès à la gouvernance complète,
travailler depuis `mcgit-main/` (cf. son `CLAUDE.md` et ses `CONTEXT*.md`).

## Stack

- Backend : Rust + Tauri 2 (commandes IPC), git2-rs / libgit2
- Frontend : React 19 + TypeScript + Vite
- Tests : `cargo test` + `npx tsc --noEmit`
- Lancement dev : `npm run tauri dev`

## Branches

- `main` — état publié (tags `vX.Y.Z`)
- `dev` — intégration interne
- `feat/US-NNNN-<slug>` — branches de travail issues de `dev`

## Versioning

Politique « 1 US = 1 bump » : à chaque US livrée, bump de `package.json` +
`src-tauri/tauri.conf.json` + entrée `CHANGELOG.md`. Tag `vX.Y.Z` posé sur
`main` au cut release.
