# Changelog

Toutes les modifications notables de Mc-Git sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Le versioning suit [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.1.5] — 2026-05-08

### Fixed

- **CI clippy** : 5 violations de la nouvelle lint `clippy::manual_checked_ops` (introduite avec Rust 1.95.0) sur le calcul de pourcentage de progression dans `src-tauri/src/commands/remote.rs` (fetch / push / pull) et `src-tauri/src/git/remote.rs` (transfer_progress / push_transfer_progress). Le pattern `if total > 0 { current * 100 / total }` est remplacé par `current.checked_mul(100).and_then(|n| n.checked_div(total))`, qui couvre à la fois la division par zéro et l'overflow potentiel de `current * 100`. Sémantique préservée pour le consommateur (option `pct` ; `None` quand le pourcentage n'est pas calculable). Détection : 1ʳᵉ run réelle de `tests.yml` sur GitHub Actions.

---

## [0.1.4] — 2026-05-07

### Added

- **Pipeline de release automatique** : nouveau workflow `.github/workflows/release.yml` déclenché sur push de tag `v*.*.*` (ou via `workflow_dispatch` manuel). Le workflow build l'app Tauri sur Ubuntu / macOS / Windows en parallèle via [`tauri-apps/tauri-action@v0`](https://github.com/tauri-apps/tauri-action), crée une GitHub Release sur le tag courant et y attache l'ensemble des bundles (`.deb`, `.AppImage`, `.dmg`, `.msi`, `.exe`).
- Job préliminaire `extract-changelog` qui parse la section `[X.Y.Z]` du `CHANGELOG.md` et l'utilise comme corps de la release publiée.
- Section « Build des artefacts de production » de `docs/release.md` mise à jour : la procédure officielle est désormais le déclenchement du workflow CI sur tag, la procédure manuelle est conservée comme fallback. Note sur l'absence de signature de code (acceptable sur le cycle `0.x`).

---

## [0.1.3] — 2026-05-07

### Added

- **CI GitHub Actions** : nouveau workflow `.github/workflows/tests.yml` exécuté sur chaque push et pull request vers `main`/`dev`. Quatre jobs en parallèle :
  - `frontend-typecheck` (Ubuntu) — `npx tsc --noEmit`
  - `rust-fmt-clippy` (Ubuntu) — `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings`
  - `rust-test` (matrix Ubuntu / macOS / Windows) — `cargo test --all-targets`
  - `rust-coverage` (Ubuntu) — `cargo llvm-cov` avec upload optionnel vers Codecov (best-effort si `CODECOV_TOKEN` configuré)
- **Badges CI et Coverage** ajoutés au `README.md`.

### Changed

- `cargo fmt` appliqué sur le code Rust existant (alignement automatique du style).
- Module `tests/common/` : ajout de `#![allow(dead_code, unused_macros, unused_imports)]` pour neutraliser les warnings sur les helpers en attente de scénarios futurs (compatibilité avec `clippy -D warnings`).

---

## [0.1.2] — 2026-05-06

### Added

- **Écran « À propos » dans les paramètres** : nouvel onglet *À propos* dans le modal Settings (FR/EN/ES) regroupant la version applicative, les conditions d'utilisation, la politique de confidentialité, et les attributions des dépendances tierces (Rust + npm) avec affichage pliable par paquet.
- **Documents légaux embarqués** : `docs/legal/terms-of-use.en.md` (Terms of Use) et `docs/legal/privacy-policy.en.md` (Privacy Policy) en anglais, embarqués dans le binaire et exposés via les commandes Tauri `get_legal_document` et `get_third_party_notices`.
- **Lien vers la Privacy Policy** depuis le `FeedbackDialog` (sous le textarea) — ouvre directement Settings → À propos → section Privacy.

### Changed

- Dépendance npm : ajout de `react-markdown` (rendu des documents légaux et des NOTICES). `docs/THIRD-PARTY-NOTICES-npm.md` régénéré en conséquence.

---

## [0.1.1] — 2026-05-06

### Changed

- Documentation publique restructurée : nouveau dossier `docs/` self-contained dans le dépôt avec `architecture.md`, `add-command.md`, `release.md`, `SETUP.md`, `THIRD-PARTY-NOTICES-{rust,npm}.md` et un `README.md` d'index. Les liens du `README.md` racine sont mis à jour vers ces chemins courts (`docs/<fichier>.md`). Aucun changement fonctionnel côté application.

---

## [0.1.0] — 2026-05-05

Premier commit applicatif du dépôt public Mc-Git, après refonte topologique du dépôt source. Démarrage d'un cycle `0.x` jusqu'à la mise en place de la CI publique et des standards GitHub.

### Notes

- **Périmètre fonctionnel** : équivalent à la dernière version interne 2.39.0 + rebranding Mc-Git. Aucune régression connue.
- **Politique de versioning** : cycle `0.x` avec bumps libres (patches et mineurs au choix, breakings autorisés sans bump majeur). Cap `1.0.0` posé quand la CI GitHub Actions sera verte et les standards GitHub validés.
- **Migration utilisateur** : si vous utilisiez la version interne précédente, vos préférences et données locales sont migrées automatiquement au premier démarrage.
