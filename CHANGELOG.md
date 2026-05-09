# Changelog

Toutes les modifications notables de Mc-Git sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Le versioning suit [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.3.0] — 2026-05-09

### Added

- **Création de tag depuis la `TagList`** : nouveau formulaire persistant en tête de la vue Tags. Champs : nom, cible (`HEAD`, branche locale, branche remote, ou OID arbitraire via le nouveau composant `TargetRefPicker`), case « Annoté » (cochée par défaut, conformément à la décision T-0001/T-0002) et zone message visible uniquement quand le tag est annoté. Le bouton « Créer » est désactivé tant que le nom est invalide ou que (annoté && message vide) ou que la création est en cours. Au succès, refresh implicit de la liste + `bumpLogVersion` pour rafraîchir l'historique.
- **Composant `TargetRefPicker`** (`molecules/`) : sélecteur réutilisable basculant entre un dropdown (HEAD + branches locales + branches remote + entrée « OID personnalisé… ») et un mode texte libre 40 caractères avec bouton retour `←`. Mutualisable hors tags pour de futures opérations type checkout-by-OID.
- **Validation regex frontend du nom de tag** (`usecases/tags/validation.ts`) : refuse vide, espaces, début par `-`, fin par `.lock`, séquences `..` `//` `/.` `@{`, et caractères spéciaux `~:^?*[\`. La raison est exposée comme clé i18n (`empty` / `spaces` / `dots` / `special` / `startDash` / `endLock`) et affichée en rouge sous le champ nom dès que celui-ci est non vide et invalide. Le backend libgit2 reste en filet pour les cas non couverts.
- **Dialog pédagogique HEAD détachée** : si l'utilisateur tente de créer un tag sur `HEAD` alors qu'aucune branche locale n'a `isHead`, un dialog bloquant explique le risque (commit potentiellement orphelin) et propose « Créer quand même » / « Annuler ». L'annulation reset le formulaire.
- **Gestion erreur typée `TagAlreadyExistsLocal`** : parsing de la chaîne d'erreur (`"already exists"` ou variant `TagAlreadyExistsLocal` à venir) → toast localisé `tags.create.alreadyExists`. Sinon toast brut `tags.create.failed`.
- **Default annoté pour `TagCreateDialog`** (utilisé depuis `CommitRow`) : `useState(true)` au lieu de `useState(false)`. Aligne sur la décision T-0001/T-0002.
- **i18n FR/EN/ES** : nouvelles clés `tags.create.*` (placeholders, boutons, raisons d'invalidité, dialog detached) et `targetRefPicker.*` (head, branchLocal, branchRemote, customOid, back).

Bump minor (`0.2.0 → 0.3.0`). Le chemin de création principal de FEAT-0145 est désormais opérationnel — couvre l'objectif EPIC-0004 « tagger une release depuis l'UI ». Suppression locale et opérations remote arrivent dans US-0014, US-0017+.

---

## [0.2.0] — 2026-05-09

### Added

- **Listing local des tags dans la vue `Tags`** : la `TagList` affiche désormais tous les tags locaux du dépôt, regroupés en section `LOCAL (n)`. Chaque entrée présente le nom du tag, l'OID court (7 caractères) du commit ciblé, un badge `Annoté` (bleu) ou `Light` (ambre), et au survol un bouton « Voir dans l'historique » qui bascule sur l'onglet History et met en évidence le commit. Pour les tags annotés, le badge expose en tooltip le nom du tagger et la date locale formatée (`Signature.when` × 1000).
- **Filtre texte** au-dessus de la liste, case-insensitive sur le nom du tag, avec compteur dynamique sur la section `LOCAL`. Bouton clear (`✕`) à droite quand un filtre est actif.
- **Bouton « Actualiser »** dans l'en-tête de la `TagList` : recharge la liste via `listTagsUseCase` (idempotent — alimente le même `gitStore.tags` que celui consommé par `CommitList`). Refresh automatique au montage et à chaque changement de `currentRepo.path`.
- **Highlight depuis `setHighlightedTagName`** : si la valeur du store correspond au nom d'un tag affiché, la ligne reçoit un ring bleu et est auto-scrollée dans la viewport (`scrollIntoView({ block: "nearest" })`). Expiration automatique après 3 secondes via `setHighlightedTagName(null)` (préparation US-0020 — navigation depuis `CommitRow`).
- **Section `REMOTE (n)`** : affichée uniquement quand `gitStore.remoteTagPresence` est non vide. Pour cette version, seul le compteur est exposé — la liste détaillée et l'indicateur multi-remotes par tag arriveront dans les US suivantes (US-0016).
- **Clés i18n** ajoutées dans FR/EN/ES : `tags.local`, `tags.remote`, `tags.filterPlaceholder`, `tags.refresh`, `tags.empty`, `tags.showInHistory`, `tags.annotated`, `tags.lightweight`. La clé `tags.placeholder` (US-0011) est retirée — remplacée par `tags.empty` qui est conditionnel à `localTags.length === 0`.

Première US à valeur utilisateur visible de FEAT-0145 — la vue Tags devient consultable. Création, suppression et opérations remote arrivent dans les US suivantes (US-0013, US-0014, US-0017+).

---

## [0.1.8] — 2026-05-09

### Added

- **Entrée `Tags` dans la sidebar** : nouveau point d'entrée navigationnel inséré entre `Branches` et `Remotes`, ouvrant une vue plein-écran `TagList` (skeleton). La vue affiche pour le moment un titre et un placeholder « Aucun tag à afficher pour le moment. » — les opérations (listing, création, push, suppression) seront livrées dans les US suivantes de FEAT-0145.
- **Store `uiStore.highlightedTagName`** : nouveau champ `string | null` (initial `null`) avec setter `setHighlightedTagName`, intégré aux opérations `reset` et `resetAndRestore`. Préparé pour la navigation depuis `CommitRow` vers la TagList (consommation en US-0012/US-0020).
- **i18n** : clés `sidebar.tags`, `tags.title`, `tags.placeholder` ajoutées dans les locales FR, EN et ES.

Coquille du chantier FEAT-0145 (gestion des tags Mc-Git). Pas de logique métier dans cette version — uniquement le point d'ancrage UI sur lequel les US suivantes greffent leur contenu.

---

## [0.1.7] — 2026-05-09

### Added

- **Backend `list_remote_tags(remote_name)`** : nouvelle commande Tauri (côté Rust `git/tag.rs`) listant les tags advertisés par un remote (équivalent `git ls-remote --tags`). Strippe le préfixe `refs/tags/` et filtre les peeled refs `^{}` ; résultat trié et dédupliqué. Ajout au trait `GitRepository` (port) avec impl `Git2Repository` (libgit2) et stub `CliGitRepository` (`Err::unsupported`). Use case TS `listRemoteTagsUseCase` exposé.
- **Cache `gitStore.remoteTagPresence`** : `Map<remoteName, Set<tagName>>` non persistant (RAM uniquement), source de vérité de la présence d'un tag par remote pour l'indicateur multi-remotes à venir (US-0016). Setters `setRemoteTagPresenceForRemote(remote, tagNames)` et `clearRemoteTagPresence()`.
- **Branchement automatique** sur `fetchUseCase`, `fetchAllUseCase`, `pullUseCase` et `pruneRemoteUseCase` : après succès de l'opération réseau, `list_remote_tags` est appelé sur le remote concerné et le cache mis à jour. Échec silencieux en cas d'erreur de `list_remote_tags` (le cache reste inchangé, l'indicateur restera à l'état « inconnu »).

Première US backend de FEAT-0145 (gestion des tags Mc-Git). Pas de surface UI dans cette US — les indicateurs et opérations qui consomment le cache arrivent en US-0016+.

---

## [0.1.6] — 2026-05-08

### Fixed

- **Compatibilité glibc des bundles Linux** : le workflow `release.yml` utilisait `ubuntu-latest`, désormais aliasé sur **Ubuntu 24.04** (glibc 2.39). Le `.deb` 0.1.5 publié refusait ainsi de démarrer sur Debian 12 bookworm (glibc 2.36) et toute distribution antérieure, avec l'erreur `version 'GLIBC_2.38' not found`. La matrice `build` est épinglée à `ubuntu-22.04` (glibc 2.35), ce qui rend les binaires portables sur Debian 12+, Ubuntu 22.04+, RHEL 9+, et la plupart des distributions courantes. Le binaire 0.1.5 reste publié sur GitHub mais n'est exécutable que sur les distributions livrant glibc ≥ 2.39 — voir 0.1.6 pour un binaire portable. Détection : test à blanc REQ-RELEASE-D2 par le HU sur Debian 12.

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
