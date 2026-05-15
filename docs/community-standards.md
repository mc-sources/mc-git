# Mc-Git — Checklist & audit "repo GitHub de référence"

Ce document décrit les éléments attendus d'un dépôt GitHub de qualité professionnelle et l'état du dépôt **mc-sources/mc-git** au regard de cette checklist. Il sert de référence vivante pour les audits ultérieurs.

- **Périmètre** : dépôt public **mc-sources/mc-git** (code applicatif). Les repos privés `project.management` et le wrapper `mcgit-main` ne sont pas couverts.
- **Origine** : US-114-01 — *Mise à niveau du dépôt GitHub aux standards communautaires* (FEAT-114).
- **Dernier audit** : 2026-05-15.

## Légende

- ✅ **Présent** — l'élément existe et est à jour.
- ⚠️ **À améliorer / à committer** — présent mais incomplet, périmé, ou non versionné.
- ❌ **Absent** — l'élément manque et doit être créé.
- 🔍 **Vérification manuelle GitHub UI** — non vérifiable depuis le dépôt, à valider sur l'interface GitHub.

---

## A. Fichiers racine obligatoires (community profile GitHub)

| # | Item | Fichier attendu | Pourquoi | État | Note |
|---|---|---|---|---|---|
| A1 | Description du projet | `README.md` | Première porte d'entrée ; quoi/pourquoi/comment | ✅ | Badges CI/Coverage/Tauri/Rust/React présents |
| A2 | Licence | `LICENSE` | Conditions légales de contribution/fork | ✅ | GPL-3.0-only |
| A3 | Historique des versions | `CHANGELOG.md` | Traçabilité ; obligatoire pour un projet versionné | ✅ | Format *Keep a Changelog* |
| A4 | Code de conduite | `CODE_OF_CONDUCT.md` | Standard GitHub ; rassure sur le climat | ✅ | Contributor Covenant v2.1 |
| A5 | Guide de contribution | `CONTRIBUTING.md` | Cycle bugs / features / PRs | ✅ | Couvre setup, conventions, PR process, versioning |
| A6 | Politique de sécurité | `SECURITY.md` | Canal privé pour les vulnérabilités | ✅ | Contact `git.security@martingatignol.fr` |
| A7 | Support | `SUPPORT.md` | Oriente les questions hors-bug | ✅ | Renvoie vers Discussions + issues + sécurité |

## B. Templates GitHub (`.github/`)

| # | Item | Fichier attendu | Pourquoi | État | Note |
|---|---|---|---|---|---|
| B1 | Template de bug | `.github/ISSUE_TEMPLATE/bug_report.yml` | Force la collecte d'infos repro | ✅ | GitHub Forms YAML |
| B2 | Template de feature | `.github/ISSUE_TEMPLATE/feature_request.yml` | Cadre les propositions | ✅ | GitHub Forms YAML |
| B3 | Config des templates | `.github/ISSUE_TEMPLATE/config.yml` | Désactive blank issues, ajoute liens contact | ✅ | Liens sécurité + discussions |
| B4 | Template de PR | `.github/PULL_REQUEST_TEMPLATE.md` | Standardise la description des PRs | ✅ | Checklist version bump / CHANGELOG / tests |
| B5 | Codeowners | `.github/CODEOWNERS` | Auto-assignation des reviewers | ✅ | Voir CODEOWNERS pour les patterns |
| B6 | Financement | `.github/FUNDING.yml` | GitHub Sponsors | ❌ | Optionnel — uniquement si Sponsors activé sur l'org |

## C. CI/CD et qualité

| # | Item | Fichier attendu | Pourquoi | État | Note |
|---|---|---|---|---|---|
| C1 | Workflow tests | `.github/workflows/tests.yml` | Vérifie chaque push/PR | ✅ | Rust + TS + build Tauri |
| C2 | Workflow release | `.github/workflows/release.yml` | Build multi-plateforme + artefacts | ✅ | Présent |
| C3 | Veille dépendances | `.github/dependabot.yml` | Mises à jour automatiques + alertes sécurité | ✅ | cargo + npm + github-actions, hebdomadaire |
| C4 | Badge CI dans le README | `README.md` (badges) | Signal de santé visible immédiatement | ✅ | CI + Coverage + Tauri + Rust + React |

## D. Configuration GitHub (UI — vérification manuelle)

Ces points ne sont pas vérifiables depuis le code source et doivent être validés sur l'interface GitHub par un mainteneur disposant des droits administrateur.

| # | Item | État | Action |
|---|---|---|---|
| D1 | Description repo + URL site | 🔍 | À renseigner dans *Settings → About* |
| D2 | Topics pertinents | 🔍 | Suggestions : `tauri`, `rust`, `react`, `typescript`, `git-client`, `desktop-app`, `libgit2` |
| D3 | Branche par défaut cohérente | 🔍 | Vérifier que `dev` est la branche d'intégration et que `main` est la branche de release |
| D4 | Branch protection rules | 🔍 | Sur `dev` et `main` : require PR, require CI green, restrict force-push |
| D5 | Discussions activées | 🔍 | Recommandé — canal Q&A non-bug, référencé dans `SUPPORT.md` et `ISSUE_TEMPLATE/config.yml` |
| D6 | Releases tag + notes | 🔍 | Vérifier que chaque tag `vX.Y.Z` a une release GitHub avec notes |
| D7 | Security advisories activées | 🔍 | *Settings → Security → Private vulnerability reporting* |

## E. Documentation projet (au-delà du minimum)

| # | Item | Fichier attendu | Pourquoi | État |
|---|---|---|---|---|
| E1 | Architecture technique | `docs/architecture.md` | Onboarding contributeurs | ✅ |
| E2 | Recette d'ajout de commande | `docs/add-command.md` | Réduit la barrière d'entrée | ✅ |
| E3 | Notices tierces | `docs/legal/THIRD-PARTY-NOTICES-*.md` | Conformité licences | ✅ |
| E4 | Setup environnement | `docs/SETUP.md` | Démarrage rapide | ✅ |
| E5 | Cycle de release | `docs/release.md` | Documente release/QA, hotfix, tags | ✅ |

---

## Reste-à-faire HU (post-livraison US-114-01)

Les items 🔍 de la section D nécessitent une intervention sur l'interface GitHub par un administrateur du dépôt. Ils ne bloquent pas la fermeture de US-114-01 (purement code/docs) mais doivent être listés au backlog si non encore traités.

## Mise à jour de ce document

Ce document est mis à jour à chaque audit communautaire. La prochaine relecture est recommandée :

- À chaque ajout/retrait d'un fichier communautaire racine.
- À chaque changement majeur de l'organisation GitHub (renommage repo, changement d'org).
- Au moins une fois par an pour valider que les standards GitHub n'ont pas évolué.
