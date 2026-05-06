# Architecture générale — Mc-Git

Mc-Git est un client Git desktop construit avec [Tauri 2](https://tauri.app), [React 19](https://react.dev) et [Rust](https://www.rust-lang.org). Il applique une **Clean Architecture** stricte : toute la logique git vit côté Rust, le frontend est une couche de présentation pure.

---

## Vue d'ensemble des couches

```
Frontend (React / TypeScript)
  │
  │  invoke("command_name", args)   ← Tauri IPC (sérialisation JSON)
  │
Backend (Rust)
  │
  └─ git2 (libgit2 via FFI), avec fallback CLI git pour les opérations non couvertes
```

---

## Structure du code

```
src/
  domain/
    entities/                    Interfaces TypeScript (camelCase) — modèle métier frontend
    ports/
      IGitRepository.ts          Interface abstraite — jamais d'import Tauri ici
    value-objects/               CommitMessage (validation 72 car.), BranchName
  usecases/                      Fonctions d'orchestration minces (staging/, commit/, history/…)
  infrastructure/
    ipc/
      TauriGitRepository.ts      SEUL fichier qui importe @tauri-apps/api
    events/
      useGitLog.ts               Listener d'événements Tauri (listen)
    GitRepositoryContext.tsx     Contexte React exposant IGitRepository
  store/                         Zustand — état pur, pas d'IPC
    repoStore.ts                 Dépôt courant, dépôts récents (persisté localStorage)
    gitStore.ts                  Statut, branches, log
    uiStore.ts                   Vue active, fichier/commit sélectionné, diff courant
    authStore.ts                 Credentials
    settingsStore.ts             Préférences utilisateur
  components/                    Composants React — appellent les use cases, jamais l'IPC

src-tauri/src/
  domain/
    ports/
      repository.rs              Trait GitRepository — toutes les opérations git
  infrastructure/
    git2_impl.rs                 Git2Repository : implémente le trait via git2 / libgit2
    cli_impl.rs                  CliRepository : implémente le trait via la CLI git (fallback)
  git/                           Fonctions git2 pures (pas de Tauri, pas de trait)
    types.rs                     Types Rust sérialisables (snake_case)
    *.rs                         Un fichier par domaine (branch, commit, diff, history, …)
  commands/                      Wrappers Tauri (#[tauri::command]) — minces
    *.rs                         Un fichier par domaine
  state.rs                       AppState : Mutex<Option<Box<dyn GitRepository + Send>>>
  error.rs                       AppError → sérialisable pour l'IPC
  lib.rs                         invoke_handler![] — registration de toutes les commandes
```

---

## Flux de données

```
Action utilisateur
  └─ Composant React
       └─ use case (src/usecases/)
            └─ IGitRepository (interface)
                 └─ TauriGitRepository.invoke("command_name", args)
                      └─ Rust : commands/*.rs
                           └─ state.lock_repo() → GitRepository trait
                                └─ Git2Repository (ou CliRepository)
                                     └─ git/*.rs (git2)
                                          └─ Résultat
                 ← Mapping wire (snake_case) → entité (camelCase)
            └─ Zustand store.set(...)
       └─ React re-render
```

---

## Conventions de nommage à la frontière IPC

| Côté Rust (wire) | Côté TypeScript (domaine) |
|------------------|--------------------------|
| `head_branch`    | `headBranch`             |
| `short_oid`      | `shortOid`               |
| `is_binary`      | `isBinary`               |
| `parent_oids`    | `parentOids`             |

Le mapping est centralisé dans `TauriGitRepository.ts` (fonctions `map*`). **Aucun autre fichier** ne connaît les types wire — c'est une règle stricte de la frontière IPC.

---

## Politique CLI git

Toute opération git utilise **`git2-rs`** (libgit2) en priorité. Le binaire `git` n'est appelé qu'en dernier recours pour les fonctionnalités absentes de libgit2 (par exemple `push --force-with-lease`).

Avant tout `Command::new("git")`, le code appelle `crate::git::git_available()` et retourne une erreur claire si le binaire est absent. **L'application doit démarrer et fonctionner sans `git` installé.**

Le sélecteur de backend (git2 / CLI) est exposé dans les paramètres utilisateur ; le défaut est `git2`.

---

## AppState et gestion des onglets

`AppState` (`src-tauri/src/state.rs`) gère un pool de dépôts pour les onglets multiples :

```rust
pub struct AppState {
    pub repo: Mutex<Option<Box<dyn GitRepository + Send>>>,            // onglet actif
    pub repo_pool: Mutex<HashMap<String, Box<dyn GitRepository + Send>>>, // onglets inactifs
    pub active_tab_id: Mutex<Option<String>>,
}
```

Toutes les commandes accèdent au dépôt actif via `state.lock_repo()`.

---

## Gestion des erreurs

`AppError` (`src-tauri/src/error.rs`) encapsule toutes les erreurs Rust et implémente `Serialize` pour l'IPC :

```rust
pub enum AppError {
    Git(#[from] git2::Error),
    NoRepository,
    Io(#[from] std::io::Error),
    Other(String),
}
```

Côté TypeScript, les erreurs IPC arrivent comme des chaînes de caractères dans le `catch` du `invoke()`.

---

## Dépendances principales

| Outil | Version | Rôle |
|-------|---------|------|
| Tauri | 2 | Shell desktop + IPC |
| React | 19 | UI |
| TypeScript | ~5.8 | Typage frontend |
| Zustand | 5 | État global frontend |
| Tailwind CSS | 4 | Styling (via `@tailwindcss/vite`) |
| i18next | 25 | Internationalisation (fr, en, es) |
| Shiki | 4 | Coloration syntaxique |
| git2 (Rust) | 0.19 | Bindings libgit2 |
| serde | 1 | Sérialisation JSON IPC |
| thiserror | 2 | Dérivation d'erreurs Rust |

---

## Aller plus loin

- [`add-command.md`](./add-command.md) — recette pour ajouter une nouvelle commande Tauri (6 étapes)
- [`release.md`](./release.md) — politique de versioning, procédure de release, build artifacts
- [`SETUP.md`](./SETUP.md) — installation de l'environnement de développement
