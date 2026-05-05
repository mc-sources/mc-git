# Mc-Git

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](package.json)
[![Licence](https://img.shields.io/badge/licence-GPL--3.0--only-green.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-yellow.svg)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)

## À propos

**Mc-Git** (technique : `mcgit`) est un client git desktop libre, rapide et universel, conçu pour les développeurs de tous niveaux. Il combine une **interface complète** pour les utilisateurs expérimentés et un **mode Facile** pour les personnes non familières avec git qui souhaitent néanmoins historiser leur travail. Construit avec **Tauri 2 + Rust + React 19**, Mc-Git applique une Clean Architecture stricte : toute la logique git vit côté Rust (via `libgit2`), le frontend est une couche de présentation pure.

<!-- TODO screenshots :
     docs/screenshots/hero-dark.png           — vue globale sur thème sombre (History + Changes)
     docs/screenshots/merge-editor.png        — éditeur de fusion 3 panneaux
     docs/screenshots/easy-mode.png           — mode Facile en action
-->

## Fonctionnalités

### Historique & branches
- Graphe des commits avec branches et tags intégrés
- Arborescence des branches locales et remotes
- Navigation branche → historique, position persistante par dépôt
- Mode « toutes les branches » configurable
- Reflog avec création de branche depuis une entrée

### Changes & commit
- Staging complet et partiel (hunk, ligne, sélection multiple)
- Stage / unstage par groupe ou répertoire
- Plusieurs modes d'affichage des fichiers (liste, arborescence) et tri par statut
- Discard all, marquage de fichiers à ignorer
- Éditeur de fichier intégré avec coloration syntaxique
- Refresh automatique du statut

### Merge & conflits
- Résolution inline des conflits avec éditeur de fusion 3 panneaux
- Gestion avancée des conflits (statut par fichier, annulation, reset)
- Cherry-pick, rebase simple et **rebase interactif** (squash, fixup, reword, drop, reorder)
- Reset, revert, résolution des fichiers supprimés en conflit

### Remotes & authentification
- Clone, push, pull, fetch, **fetch all** (toutes les remotes)
- Dialog de push avec sélection de remote et de branches
- Authentification SSH (clés, agent) et HTTPS (credentials store)
- **Validation des certificats SSH** (anti-MITM)
- Gestion des upstreams de branches, remote par défaut
- **Auto-fetch** en arrière-plan configurable
- Détection et support des dépôts avec sous-modules

### Productivité & navigation
- **Gestion multi-dépôt** par onglets, état persistant
- Blame, historique par fichier, reflog
- Recherche et filtrage (commits, branches, fichiers)
- Terminal git intégré
- Raccourcis clavier, toolbar repliable en groupes
- Mode **Git-flow** intégré

### Interface utilisateur
- Thème clair / sombre avec contraste optimisé
- Internationalisation (FR, EN, ES)
- **Mode Facile** : interface épurée avec vocabulaire accessible pour non-techniciens
- Feedback de progression pour opérations longues (clone, fetch, rebase)
- Messages toast persistés dans les logs
- Menu contextuel natif désactivé (interface WebView propre)

## Installation

### Prérequis

- **Node.js** ≥ 20
- **Rust stable** via [rustup](https://rustup.rs)
- **Tauri CLI v2** : `cargo install tauri-cli --version "^2"`

**Linux (Debian/Ubuntu)** :
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf build-essential libssl-dev pkg-config
```

**macOS** : Xcode Command Line Tools (`xcode-select --install`)

**Windows** : Visual Studio Build Tools avec le workload « Desktop development with C++ »

### Cloner et installer

```bash
git clone <url-du-depot>
cd mcgit
npm install
```

## Développement

```bash
npm run tauri dev           # lance Vite + l'app Tauri avec hot-reload
npx tsc --noEmit            # vérification TypeScript seule
cd src-tauri && cargo check # vérification Rust seule (rapide)
cd src-tauri && cargo test  # tests unitaires Rust
```

Voir [`docs/SETUP.md`](docs/SETUP.md) pour la résolution des problèmes d'installation courants, et [`docs/specifications/techniques/add-command.md`](docs/specifications/techniques/add-command.md) pour la recette d'ajout d'une nouvelle commande git.

## Build de production

```bash
npm run tauri build
```

Les binaires sont générés dans `src-tauri/target/release/bundle/` :

- **Linux** : `.deb`, `.AppImage`
- **macOS** : `.dmg`, `.app`
- **Windows** : `.msi`, `.exe` (NSIS)

Le processus de release complet *(branche `release/X.Y.Z`, recette, UAT, tag, merge retour)* est documenté dans [`docs/specifications/techniques/release.md`](docs/specifications/techniques/release.md).

## Architecture

Mc-Git applique une **Clean Architecture** stricte à travers la frontière IPC Tauri :

```
Frontend (React/TS)            IPC (Tauri invoke)         Backend (Rust)
──────────────────             ──────────────────         ──────────────
domain/ports                   TauriGitRepository    →    domain/ports/repository.rs   (trait GitRepository)
usecases                       (seul fichier qui           infrastructure/git2_impl.rs  (Git2Repository)
store (Zustand)                importe @tauri-apps/api)    git/         (fonctions git2 pures)
components                                                 commands/    (wrappers Tauri)
```

Tous les détails — flux de données, conventions de nommage snake_case ↔ camelCase, politique de choix du backend git (`libgit2` / CLI `git`) — sont dans [`docs/specifications/techniques/architecture.md`](docs/specifications/techniques/architecture.md).

<!-- TODO screenshot :
     docs/screenshots/architecture-diagram.png   — diagramme des couches Frontend/IPC/Backend
-->

## Contribuer

Ce projet suit le **mode startup v2** défini dans le repo frère [`claude.shared`](../../../claude.shared/mods/startup/v2/). Le cycle de développement est :

```
Init → Conception (Analyse + Architecture + Design + Planning) → Réalisation (epic par epic) → Retours d'utilisation → Nouveau cycle
```

Les nouvelles fonctionnalités et corrections sont organisées en **features** (`project.management/backlog/FEAT-NNNN-[slug]/`) regroupées en **epics datés** (`project.management/epics/EPIC-NNNN-YYYY-MM-[slug]/`). Chaque user story passe par une branche `feat/US-NNNN-[slug]` mergée sur `dev` avec revue de code.

> 📄 **CONTRIBUTING.md** (guide détaillé : style de commit, PR template, code of conduct) — *à venir via la feature FEAT-114*.

Pour comprendre la structure de documentation du projet, voir [`docs/README.md`](docs/README.md).

## Stack technique

| Outil | Version | Rôle |
|---|---|---|
| [Tauri](https://v2.tauri.app) | 2 | Shell desktop, IPC, packaging multi-plateforme |
| [Rust](https://www.rust-lang.org) | stable | Backend, logique git |
| [git2-rs](https://docs.rs/git2) | 0.19 | Bindings `libgit2` |
| [React](https://react.dev) | 19 | UI |
| [TypeScript](https://www.typescriptlang.org) | ~5.8 | Typage frontend |
| [Zustand](https://github.com/pmndrs/zustand) | 5 | État global frontend |
| [Tailwind CSS](https://tailwindcss.com) | 4 | Styling (via `@tailwindcss/vite`) |
| [i18next](https://www.i18next.com) | 25 | Internationalisation (fr, en, es) |
| [Shiki](https://shiki.style) | 4 | Coloration syntaxique |

## Licence

**GPL-3.0-only** — voir [`LICENSE`](LICENSE).

Mc-Git est un logiciel libre. Vous pouvez le redistribuer et le modifier sous les termes de la GNU General Public License telle que publiée par la Free Software Foundation, version 3.
