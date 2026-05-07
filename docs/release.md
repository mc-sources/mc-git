# Processus de release

## Vue d'ensemble

Mc-Git suit un git flow simple avec une politique « **1 livraison = 1 bump de version** » : chaque branche `feat/*` ou `fix/*` bumpe la version sur sa propre branche avant merge sur `dev`. Une **release** correspond à un moment où l'on souhaite figer formellement une version pour packaging et distribution.

Le projet est actuellement sur le **cycle `0.x`**. Le **cap `1.0.0`** sera posé quand la CI publique est verte et que les standards d'un dépôt GitHub de référence sont en place. Tant que cette double condition n'est pas remplie, le choix patch/minor reste libre.

```
feat/*  ou  fix/*                          (code + bump version + entrée CHANGELOG)
 │
 ├─► dev                                   (merge — dev porte la version bumpée)
 │    │
 │    ├─► [optionnel] release/X.Y.Z        (cut depuis dev pour figer la version)
 │    │      │                              pas de nouveau bump à ce moment
 │    │      │
 │    │      ├─[1]─ tests fonctionnels
 │    │      ├─[2]─ bugfix/* ──┐           (anomalies détectées en test)
 │    │      │                 │            → merge retour sur release/X.Y.Z
 │    │      │◄────────────────┘
 │    │      │
 │    │      ├─[3a]─► main ─── tag vX.Y.Z  (validation finale)
 │    │      │        │
 │    │      │        └─[3b]─► dev          (merge retour — bugfix de la release)
 │    │
 │    └─► [alternative] hotfix/*            (correctif urgent partant de main)
```

---

## Politique de bump

La version est bumpée sur la branche `feat/*` ou `fix/*` **avant** son merge sur `dev`.

### Cycle `0.x` (en cours)

- Bumps **libres** : patches (`0.Y.Z` → `0.Y.(Z+1)`) et mineurs (`0.Y.0` → `0.(Y+1).0`) au choix.
- Breakings autorisés sans bump majeur (le projet n'est pas encore stabilisé).
- Guide indicatif :
  - **Minor** — ajout de fonctionnalité visible (`Added` / `Changed` au CHANGELOG)
  - **Patch** — correctif (`Fixed`) ou changement interne sans impact utilisateur

### Cycle `≥ 1.0.0` (futur)

SemVer strict :

- **Minor** (`X.Y.0` → `X.(Y+1).0`) — fonctionnalité (`Added` / `Changed`)
- **Patch** (`X.Y.Z` → `X.Y.(Z+1)`) — correctif (`Fixed`)
- **Major** (`X.0.0` → `(X+1).0.0`) — rupture (rare)

### Fichiers à synchroniser

Toujours bumpés **ensemble** :

- `package.json`
- `src-tauri/tauri.conf.json`

Le CHANGELOG reçoit une entrée sous la version qui vient d'être bumpée (pas de section `[Unreleased]` si la livraison est immédiatement mergée, sinon une section `[Unreleased]` provisoire).

> ⚠️ **Pas de bump sur `dev` ni sur `release/X.Y.Z`** — le bump arrive sur `dev` via le merge des branches de travail. Une `release/X.Y.Z` cut depuis `dev` hérite de la version déjà en place.

---

## Conventions de branches

| Préfixe | Origine | Cible | Usage |
|---|---|---|---|
| `feat/<description>` | `dev` | `dev` | Nouvelle fonctionnalité |
| `fix/<description>` | `dev` | `dev` | Correctif non urgent |
| `bugfix/<description>` | `release/X.Y.Z` | `release/X.Y.Z` | Correctif détecté pendant la phase release (sans bump) |
| `hotfix/<description>` | `main` | `main` + `dev` | Correctif urgent en production (avec bump patch) |
| `release/X.Y.Z` | `dev` | `main` + retour `dev` | Phase de figement / packaging avant tag |

Pas de commit direct sur `main` ni sur `dev`.

---

## Étapes détaillées d'une release

### [0] Bump pendant la livraison

Avant le merge de `feat/*` (ou `fix/*`) sur `dev`, bumper :

```json
// package.json
{ "version": "X.Y.Z" }
```

```json
// src-tauri/tauri.conf.json
{ "version": "X.Y.Z" }
```

Le commit de bump peut être inclus dans le commit de livraison ou en commit séparé (`chore: bump version to X.Y.Z`).

### [1] Cut de la branche `release/X.Y.Z` (optionnel)

Quand on souhaite figer formellement une version :

```bash
git checkout dev
git pull origin dev
git checkout -b release/X.Y.Z
```

`X.Y.Z` reflète la version **déjà présente** dans `dev`.

### [2] Tests fonctionnels

Sur `release/X.Y.Z` :

- Parcours utilisateur principaux (ouvrir un dépôt, commit, push, pull, merge)
- Non-régression sur les flows critiques (création de branche, checkout, stash, reset, rebase)
- Tests manuels sur les plateformes cibles (Linux, macOS, Windows) si changements UI

### [3] Anomalies en phase release — branches `bugfix/*`

Toute anomalie détectée pendant la phase release est traitée par une branche `bugfix/*` partant de `release/X.Y.Z` :

```bash
git checkout release/X.Y.Z
git checkout -b bugfix/<description-courte>
# ... correction + commit(s) — pas de bump de version
git checkout release/X.Y.Z
git merge --no-ff bugfix/<description-courte>
git branch -d bugfix/<description-courte>
```

Après un merge de `bugfix/*`, **une nouvelle passe de tests** est exécutée.

### [4] Validation finale et livraison

#### [4a] Merge sur `main` + tag

```bash
git checkout main
git pull origin main
git merge --no-ff release/X.Y.Z -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

#### [4b] Merge retour sur `dev`

Obligatoire pour que `dev` reçoive les bugfix de la release :

```bash
git checkout dev
git merge --no-ff release/X.Y.Z -m "Merge release/X.Y.Z back to dev"
```

#### Nettoyage

```bash
git branch -d release/X.Y.Z
```

#### Push

```bash
git push origin main dev vX.Y.Z
```

### [5] Build des artefacts de production

Le build officiel est **automatisé** par le workflow `.github/workflows/release.yml`, déclenché sur push d'un tag `v*.*.*` (ou via `workflow_dispatch` manuel). Le workflow compile l'app sur Ubuntu, macOS et Windows en parallèle, crée la GitHub Release sur le tag courant et y attache l'ensemble des bundles.

```
push origin vX.Y.Z
  └── release.yml déclenché
        ├── extract-changelog (Ubuntu) ── parse [X.Y.Z] depuis CHANGELOG.md → release body
        └── build (matrix Ubuntu / macOS / Windows)
              └── tauri-apps/tauri-action@v0
                    └── npm ci + npm run tauri build + upload artefacts à la GitHub Release
```

Bundles produits et attachés à la release :

```
Linux   → mcgit_X.Y.Z_amd64.deb, mcgit_X.Y.Z_amd64.AppImage
macOS   → mcgit_X.Y.Z_aarch64.dmg                              (runner Apple Silicon par défaut)
Windows → mcgit_X.Y.Z_x64_en-US.msi, mcgit_X.Y.Z_x64-setup.exe
```

**Signature de code** : non couverte sur le cycle `0.x`. Sur macOS, l'utilisateur verra « developer cannot be verified » au premier lancement (clic droit → Ouvrir contourne) ; sur Windows, SmartScreen affichera un avertissement (« Plus d'infos » → « Exécuter quand même »). Linux n'est pas impacté. Notarisation et code signing seront couverts par une US ultérieure avant le passage à `1.0.0`.

#### Build manuel (fallback)

Si le workflow CI est indisponible ou pour un test local :

```bash
git checkout main
npm run tauri build
```

Les binaires sont générés dans `src-tauri/target/release/bundle/` :

```
deb/      → mcgit_X.Y.Z_amd64.deb         (Linux)
appimage/ → mcgit_X.Y.Z_amd64.AppImage    (Linux)
dmg/      → mcgit_X.Y.Z_aarch64.dmg       (macOS, Apple Silicon)
macos/    → Mc-Git.app                    (macOS)
msi/      → mcgit_X.Y.Z_x64_en-US.msi     (Windows)
nsis/     → mcgit_X.Y.Z_x64-setup.exe     (Windows)
```

> **Cross-platform** : Tauri ne supporte pas la compilation croisée nativement. Le workflow CI couvre les 3 OS via runners GitHub Actions. En manuel, il faut compiler sur chaque plateforme.

---

## Hotfix urgent en production

Pour un correctif critique sans passer par un cycle de release complet, utiliser une branche **`hotfix/*`** partant de `main` :

```bash
git checkout main
git pull origin main
git checkout -b hotfix/<description-courte>
# ... correction + bump patch (ex. 0.1.0 → 0.1.1) ...

git checkout main
git merge --no-ff hotfix/<description-courte>
git tag -a vX.Y.Z -m "Hotfix vX.Y.Z"

git checkout dev
git merge --no-ff hotfix/<description-courte>
git branch -d hotfix/<description-courte>
git push origin main dev vX.Y.Z
```

Le merge retour sur `dev` est obligatoire pour que `dev` reçoive la correction et le bump.

---

## Régénération des notices de licences

Avant chaque release, régénérer les fichiers d'attribution des dépendances tierces :

```bash
# Notices npm (runtime)
npx license-checker-rseidelsohn --production --json \
  | node scripts/build-notice-npm.mjs > docs/THIRD-PARTY-NOTICES-npm.md

# Notices Rust
cargo about generate about.hbs > docs/THIRD-PARTY-NOTICES-rust.md
# (configuration dans src-tauri/about.toml + about.hbs)
```

Les fichiers générés sont commités sur `dev` avant le cut release.

---

## Configuration du bundle Tauri

La section `bundle` de `src-tauri/tauri.conf.json` contrôle le packaging :

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- `"targets": "all"` — génère tous les formats pour la plateforme courante
- Pour cibler un format spécifique : `"targets": ["deb", "appimage"]`

---

## Checklist consolidée d'une release

```
Pendant la livraison de chaque branche feat/*/fix/*
- [ ] Bump version dans package.json + tauri.conf.json
- [ ] Entrée CHANGELOG sous la nouvelle version
- [ ] Merge sur dev (la version arrive sur dev)

Avant le cut release/X.Y.Z (optionnel — quand on veut releaser)
- [ ] dev porte bien la version X.Y.Z cible
- [ ] npx tsc --noEmit passe
- [ ] cd src-tauri && cargo check passe
- [ ] cd src-tauri && cargo clippy -- -D warnings passe
- [ ] cd src-tauri && cargo test passe
- [ ] npm run tauri build réussit
- [ ] NOTICES regénérées et commitées

Sur release/X.Y.Z
- [ ] Branche release/X.Y.Z créée depuis dev (pas de nouveau bump)
- [ ] Tests fonctionnels OK
- [ ] Tous les bugfix/* éventuels mergés et revalidés

Clôture
- [ ] Merge release/X.Y.Z sur main
- [ ] Tag vX.Y.Z créé sur main
- [ ] Merge retour release/X.Y.Z sur dev
- [ ] Branche release/X.Y.Z supprimée localement
- [ ] git push origin main dev vX.Y.Z

Artefacts
- [ ] npm run tauri build sur main
- [ ] Binaires vérifiés dans src-tauri/target/release/bundle/
```

---

## Règles de base (rappel)

- ❌ **Pas de commit direct** sur `main` ni sur `dev`
- ❌ **Pas de bump de version sur `dev` ni sur `release/X.Y.Z`** — le bump se fait uniquement sur `feat/*`, `fix/*` ou `hotfix/*`
- ✅ **1 livraison = 1 bump** (cycle `0.x` : choix patch/minor libre ; à partir de `1.0.0` : SemVer strict)
- ✅ **Cap `1.0.0`** posé quand la CI publique est verte et les standards GitHub de référence sont en place
- ✅ **Tag `vX.Y.Z`** uniquement sur `main`, après merge validé, jamais sur `dev`
