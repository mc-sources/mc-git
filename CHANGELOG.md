# Changelog

Toutes les modifications notables de Mc-Git (anciennement `tsgit`) sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Le versioning suit [Semantic Versioning](https://semver.org/).

---

## [3.0.0] — 2026-05-05 — Rebranding Mc-Git

Rebranding complet du projet `tsgit` → **Mc-Git** (marketing) / **`mcgit`** (technique). Préparation à la publication open source GitHub. Aucun changement fonctionnel — l'application reste à fonctionnalités égales avec la 2.39.0. Migration utilisateur transparente au premier démarrage. Livré par FEAT-0140 (US-0003 / US-0004 / US-0005) sous l'EPIC-0003 « Publication GitHub ».

### Changed

- **Identifiant Tauri** : `org.mc.tsgit` → `org.mc.mcgit` (le dossier Tauri local change en conséquence ; voir Notes plus bas).
- **Nom du package npm** (`package.json`) : `tsgit` → `mcgit`.
- **Nom du crate Rust** (`src-tauri/Cargo.toml`) : `tsgit` → `mcgit` ; bibliothèque `tsgit_lib` → `mcgit_lib`.
- **Product name & titre fenêtre** Tauri : « tsgit » → « Mc-Git ».
- **Email de feedback** intégré : `tsgit-feedback@…` → `mcgit-feedback@martingatignol.fr` (l'ancien continue à recevoir).
- **Stores Zustand persistés** (3 clés `localStorage`) renommés : `tsgit-settings` → `mcgit-settings`, `tsgit-repo-store` → `mcgit-repo-store`, `tsgit-staging-ignore` → `mcgit-staging-ignore`. Migration lazy au démarrage : la valeur de l'ancienne clé est copiée puis l'ancienne clé est supprimée, sans intervention utilisateur.
- **Répertoires de configuration filesystem** : `~/.config/tsgit/` → `~/.config/mcgit/` (Linux ; équivalents `dirs::config_dir()` macOS/Windows) et `~/.local/share/tsgit/` → `~/.local/share/mcgit/` (Linux ; équivalents `dirs::data_local_dir()` macOS/Windows). Migration transparente au démarrage via `fs::rename` avec fallback copie + suppression, idempotente.
- **Documentation** : `README.md`, `CLAUDE.md`, `CONTEXT-*.md`, `docs/README.md`, `docs/SETUP.md`, `docs/learning.md`, `GLOSSAIRE.md`, specs techniques et fonctionnelles alignées sur le nouveau nom (~12 fichiers).
- **Outillage** : `src-tauri/about.toml`, `src-tauri/about.hbs`, `src-tauri/deny.toml`, `scripts/build-notice-npm.mjs` mis à jour ; `docs/THIRD-PARTY-NOTICES-rust.md` et `docs/THIRD-PARTY-NOTICES-npm.md` régénérés.
- **Header LICENSE** : « tsgit — Copyright (C) 2025 Charles Martin-Gatignol » → « Mc-Git — Copyright (C) 2025-2026 Charles Martin-Gatignol ».

### Added

- **Identité visuelle Mc-Git** (Direction « Refresh ADN » validée par ANA-0005 / T-0002) : pictogramme M-graphe à 3 nœuds, palette terracotta brûlé `#D2691E` sur fond charbon `#2A2A2A`. Système modulaire 3 lock-ups : picto-mark, word-mark, combiné. Master SVG + script d'export `assets/source/export-icons.sh` (Inkscape + `npx @tauri-apps/cli icon`).
- **Icônes desktop** régénérées : `src-tauri/icons/{32x32,64x64,128x128,128x128@2x}.png`, `icon.icns` (macOS), `icon.ico` (Windows).
- **Favicon dédié** : `public/icon.svg` ; `index.html` corrigé (favicon + `<title>` Mc-Git, suppression du Tauri par défaut).
- **Module de migration backend Rust** : `src-tauri/src/migrations/legacy_paths.rs` (rename + copy_dir_recursive idempotent, 5 tests unitaires) appelé en tête de `pub fn run()`.
- **Module de migration frontend** : `src/migrations/0001-tsgit-to-mcgit.ts` importé en tête de `src/main.tsx` pour s'exécuter avant l'initialisation des stores.
- **CHANGELOG** : présente entrée `[3.0.0]` consolidant le rebranding.

### Notes

- **Désinstallation propre des anciennes installations `tsgit`** : la migration des dossiers de configuration et data est transparente, mais une installation système préexistante (`.deb`, `.AppImage`, `.dmg`, `.msi`) gardera son binaire et son entrée de menu sous l'ancien nom. Pour basculer proprement, désinstaller la version `tsgit` avant d'installer la version `mcgit` ; les données utilisateur seront récupérées au premier lancement.
- **localStorage WebView** : le changement d'identifiant Tauri (`org.mc.tsgit` → `org.mc.mcgit`) déplace le `appLocalDataDir` propre à la WebView. Les données purement WebView (en dehors des 3 stores Zustand listés ci-dessus, qui sont migrés explicitement) sont **réinitialisées** au premier démarrage. C'est un trade-off accepté en exécution (volume de données concerné négligeable, pas d'historique critique).
- **Bump de version** : passage du dernier minor `2.39.0` au major `3.0.0` (sortie d'une série `3.0.0-alpha.1`/`alpha.2`/`alpha.3` posée pendant la livraison des US-0003 / US-0004 / US-0005).
- **Hors périmètre** : split en sous-dépôts (FEAT-0141), publication GitHub effective (URL, namespace, CI), création des comptes externes — autant d'éléments dépendants traités par la suite de l'EPIC-0003.

---

## [2.39.0] — Symétrie unstage répertoire (mode standard)

### Added
- Action *Unstager le répertoire* sur les nœuds répertoire de la vue Changes en mode arborescent, symétrique du *Stager le répertoire* existant. Disponible uniquement en mode standard ; le mode Easy n'expose pas les actions répertoire (cohérence avec la politique power-user). Référence IBP-0007 / FEAT-0139 / US-0002.

## [2.38.0] — Bugfix & stabilisation

### Added
- Menu contextuel minimal dans la vue Changes : clic droit sur un fichier ouvre un menu avec l'action *Afficher dans l'explorateur* (ouvre le répertoire contenant le fichier dans le file manager du système). Disponible dans les 3 modes d'affichage (plat / groupé / arborescent) et sur les fichiers non modifiés. Composant `ContextMenu` générique posé pour accueillir les actions futures (gitignore, copy path, rename, new file). Référence IBP-0005 / FEAT-118 / US-118-02.

### Fixed
- Bugfix Windows : *Ouvrir le dossier* atterrissait dans *Documents* au lieu du répertoire du repo. `open_folder` délègue désormais au plugin `tauri-plugin-opener` (via `openPath` côté frontend) au lieu d'appeler `explorer.exe` / `xdg-open` / `open` directement. Suppression de la commande Rust `open_folder` et de son module. Référence IBP-0001 / FEAT-0138 / US-0001.

## [2.37.0] — Performances de la page History

### Changed
- Virtualisation du rendu dans `CommitList.tsx` (seules les lignes visibles + OVERSCAN=5 sont dans le DOM)
- `tagIndex` useMemo O(1), `laneForOid` Map O(1) dans `computeGraphLayout`
- `React.memo` sur `CommitRow` et `GraphCell`

## [2.36.0] — Migration architecture backend git (F1 + F3)

### Changed
- Extraction de `git/force_push.rs` (`git2_impl` redevient pur libgit2)
- Scission de `git/credentials.rs` en 3 modules (`ssh_keys`, `host_verification`, `https_credentials`)

## [2.35.0] — Proposition d'architecture cible backend git

### Added
- Architecture cible documentée dans `docs/architecture-backend-git-cible.md`
- 6 points de friction adressés, 4 points de décision identifiés

## [2.34.0] — Point d'architecture backend git

### Added
- Cartographie complète de l'architecture backend Rust
- Trait `GitRepository` (66 méthodes), 105 commandes Tauri, 24 modules `git/`
- 6 points de friction documentés dans `docs/architecture-backend-git.md`

## [2.33.0] — Accès à l'authentification depuis la page de lancement

### Added
- Modale de paramètres du `WelcomeScreen` avec 2 onglets : Application + Authentification
- Configuration des credentials HTTPS sans ouvrir de dépôt

## [2.32.1] — Correctif clonage HTTPS

### Fixed
- Clonage HTTPS affichait un message d'erreur SSH trompeur
- `clone.rs` utilise désormais `build_callbacks()` (partagé avec fetch/push)
- `CloneDialog` gère `AUTH_REQUIRED`, `UNKNOWN_HOST` (TOFU) et `MITM_DETECTED`

## [2.32.0] — Mémoriser l'option « Toutes les branches » par dépôt

### Added
- `allBranchesPerRepo` persisté en localStorage par dépôt
- Double fetch (local + all) quand `showAll = true`

## [2.31.1] — Correctif curseur décalé dans l'éditeur de fichier

### Fixed
- Curseur décalé dans l'éditeur : `white-space: pre` + `wrap="off"` sur la textarea
- `pre` passé en `overflow: hidden` pour éviter la double barre de défilement

## [2.31.0] — Auto-fetch en arrière-plan

### Added
- Auto-fetch silencieux avec `setInterval`
- Paramètres `autoFetch` + `autoFetchIntervalMinutes` dans Settings > Application
- Résultats tracés dans le LogPanel

## [2.30.0] — Audit du contenu du dépôt git

### Added
- Scan historique (260 commits, aucun secret)
- Vérification fichiers obligatoires (LICENSE, README, .gitignore)
- Rapport dans `docs/audit-contenu-repo.md`

### Fixed
- `.gitignore` complété (ajout `.env`/`.env.*`)

## [2.29.0] — Audit fonctionnement sans git CLI

### Changed
- `discard_all` et `resolve_deletion_restore` réimplémentés en libgit2 pur
- `discard_changes`, `reset_conflict_file`, `push_force_with_lease` protégés par `git_available()`

### Added
- Politique CLI git documentée dans CLAUDE.md

## [2.28.0] — Rebase interactif

### Added
- Éditeur `InteractiveRebaseEditor` avec drag-and-drop
- Actions pick/reword/squash/fixup/drop
- Implémentation Rust via `git/rebase.rs`
- Menu contextuel "Rebase interactif depuis ici" dans l'historique
- Gestion des conflits de rebase

## [2.27.0] — Mode Facile (implémentation)

### Added
- Pages dupliquées (`EasyChangesView`, `EasyHistoryView`, `EasySidebar`, `EasyToolbar`)
- Toggle persisté dans les paramètres
- Vocabulaire simplifié (22 clés `easy.*`)
- Message de commit automatique
- Résolution de conflits à 2 boutons

## [2.26.0] — Mode Facile (spécification)

### Added
- Spécification complète : 8 composants masqués, vocabulaire simplifié, résolution de conflits simplifiée

## [2.25.0] — Benchmark des clients git populaires

### Added
- Tableau comparatif SourceTree / GitKraken / GitHub Desktop / Fork / Tower vs tsgit
- 10 fonctionnalités manquantes identifiées → lots 88.00–97.00

## [2.24.0] — Correctifs du rafraîchissement d'écran

### Fixed
- 6 correctifs `bumpLogVersion`/`setStatus` : pull, stash pop/apply, rebase/cherry-pick continue, checkout, merge, reset to commit

## [2.23.0] — Spécification du rafraîchissement d'écran

### Added
- Matrice action→données, 6 lacunes identifiées
- Documentation dans `docs/spec-rafraichissement.md`

## [2.22.0] — Optimisation du bundle

### Changed
- `shiki/core` + imports individuels par langue → suppression chunk `emacs-lisp` (779 kB)
- Index réduit de 770 kB à 427 kB
- `manualChunks` pour react/zustand/i18n/tauri

## [2.21.0] — Regroupement des boutons de la Toolbar

### Changed
- `SplitButton` (Fetch + Fetch all, Push + Force push)
- `DropdownButton` Outils (Terminal, Dossier, Éditeur, Feedback, PR)

## [2.20.0] — Remote par défaut

### Added
- Sélecteur de remote par défaut dans RemotePanel
- Persisté via `remote.default` (config git locale)
- Fallback dans Toolbar pour fetch/pull/push

## [2.19.1] — Fix compteur push non rafraîchi après commit

### Fixed
- Ajout de `listBranchesUseCase` dans le `Promise.all` post-commit de `CommitForm.tsx`

## [2.19.0] — Nettoyage de dette technique

### Changed
- `loadPref` extrait, `ignoredSet` mémoïsé
- `invoke` directs remplacés par `systemService`
- Types Wire consolidés, `useEffect` deps corrigés
- `BranchNotFullyMerged` structuré, `unwrap` documenté

## [2.18.0] — Staging batch

### Added
- Stage/unstage de dossiers et multi-sélections en un seul appel IPC

## [2.17.1] — Fix overflow branches/tags dans History

### Fixed
- Plafonnement à 5 badges visibles + indicateur `+N` dans `CommitRow.tsx`

## [2.17.0] — Gestion des upstreams de branches

### Added
- Définir, changer et supprimer l'upstream depuis la BranchList

## [2.16.2] — Fix badges Toolbar

### Fixed
- Haut de la bulle "commits à push" masqué : `py-px` → `py-2`
- Badge "commits à pull" non affiché : rafraîchissement des branches après chaque fetch

## [2.16.1] — Fix scroll overlap dans Changes

### Fixed
- Boutons de fichiers cachés cliquables lors du scroll : ajout de `z-10` sur les en-têtes sticky

## [2.16.0] — Fetch all

### Added
- Bouton "Fetch all" dans la Toolbar
- Fetche toutes les remotes configurées, rapport d'erreur par remote
- Interception TOFU/MITM

## [2.15.0] — Validation des certificats SSH (anti-MITM)

### Added
- Vérification des certificats SSH : `known_hosts` + store TOFU local
- Dialog de confirmation pour les hôtes inconnus
- Rejet MITM si fingerprint change

## [2.14.0] — Correction race condition AppState

### Fixed
- `Mutex<TabState>` unique + `RepoGuard<'a>` : switch d'onglet atomique

## [2.13.0] — Revue de code globale

### Added
- Revue de code globale : 2 critiques, 9 moyens, 6 faibles identifiés

## [2.12.0] — Fichiers non modifiés dans Changes

### Added
- Toggle "○" pour afficher les fichiers trackés non modifiés

## [2.11.0] — Zones staging repliables

### Added
- Zones staging repliables (chevron toggle, état persisté en localStorage)

## [2.10.0] — Persistance de la position entre dépôts

### Added
- Persistance de la position sur les onglets entre dépôts

## [2.9.0] — Mode "toutes les branches" dans l'historique

### Added
- Mode "toutes les branches" (HEAD par défaut, toggle ⎇ pour --all)

## [2.8.0] — Branches remotes hors arbre local dans History

### Added
- Affichage des branches remotes hors arbre local dans History

## [2.7.0] — Réinitialisation de la résolution d'un conflit

### Added
- Annuler / réinitialiser la résolution d'un fichier en conflit

## [2.6.6] — Correctif débordement boutons toolbar

### Fixed
- Boutons débordant en hauteur quand la fenêtre est trop étroite

## [2.6.5] — Correctif scrollbar parasite onglets

### Fixed
- Scrollbar parasite sur la barre des onglets de repo

## [2.6.4] — Correctif conflit fichier distant supprimé

### Fixed
- Fichier distant supprimé non indiqué dans le diff de conflit

## [2.6.3] — Correctifs MergeEditor

### Fixed
- Texte de merge résiduel après "Accepter les 2 versions"
- Résultat fusionné non mis à jour au changement de diff
- Conflit avec modifications identiques : pas de bouton de résolution

## [2.6.2] — Correctif message "supprimé lors du merge"

### Fixed
- Diff affiché comme "Fichier supprimé lors du merge" en dehors de tout contexte de merge

## [2.6.1] — Correctif éditeur externe Windows

### Fixed
- Ouvrir dans un éditeur externe ne fonctionnait pas sous Windows

## [2.6.0] — Ressources d'apprentissage

### Added
- Commande `/learning` : liste des ressources par domaine
- `docs/learning.md` avec guide de démarrage par profil

## [2.5.0] — Intégrations & configuration avancée

### Added
- Outil de diff externe (champ Settings, bouton "↗ tool" dans DiffViewer)
- Signature GPG des commits (liste des clés, sélection, badge "GPG ✓")
- Bouton "Créer une Pull Request" (détection GitHub / GitLab / Bitbucket / Gitea)

## [2.4.0] — Feedback utilisateur

### Added
- Bouton "Feedback" dans la Toolbar
- Dialog avec type (Bug/Suggestion/Autre), version incluse, envoi via `mailto:`

## [2.3.0] — Raccourcis clavier dans les Paramètres

### Added
- Onglet "Raccourcis" dans les Paramètres
- Liste groupée par contexte, traduite en fr/en/es

## [2.2.0] — Création de branche depuis une branche source

### Added
- Sélecteur de branche source dans le formulaire de création
- Tracking upstream automatique si la source est une branche remote

## [2.1.4] — Correction texte remote illisible

### Fixed
- Texte du `<select>` remote illisible en thème sombre dans PushDialog

## [2.1.3] — Correction détection clés SSH

### Fixed
- Clés SSH à nom personnalisé non affichées dans les Paramètres

## [2.1.2] — Correction commit courant non rafraîchi

### Fixed
- `headOid` et `graphCommits` non mis à jour après merge, reset ou rebase

## [2.1.1] — Correction historique non rafraîchi après commit

### Fixed
- Historique non mis à jour dans la page History après un commit

## [2.1.0] — Éditeur de fichier intégré

### Added
- Éditeur de fichier avec coloration syntaxique Shiki
- Overlay textarea, onglet "Éditer" dans Changes et bouton "Édit." dans History

## [2.0.1] — Correction diff persistant au changement de dépôt

### Fixed
- Diff de l'ancien dépôt affiché lors de l'ouverture d'un nouveau dépôt

## [2.0.0] — Historique des modifications d'un fichier

### Added
- Onglet Diff / Historique dans Changes
- Liste des commits ayant modifié le fichier sélectionné, avec diff inline

## [1.9.0] — Fichiers exclus du Stage All

### Added
- Bouton ⊘ par fichier pour l'exclure du Stage All
- Persisté par dépôt, indicateur visuel, compatible tree/group/flat

## [1.8.0] — Tri des fichiers dans Changes par statut

### Added
- Bouton de tri cyclique A→Z / Z→A / ⊙ Statut
- Ordre : conflicté > ajouté > modifié > supprimé > renommé > non suivi

## [1.7.1] — Correction thème clair

### Fixed
- Texte blanc/clair invisible dans le thème clair

## [1.7.0] — Branches remotes dans l'historique

### Added
- Toggle pour afficher les commits des branches remotes dans le graphe
- Distinction visuelle des commits non encore pullés

## [1.6.0] — Statut des branches vs remotes

### Added
- Badge "sans remote" sur les branches locales sans upstream

## [1.5.0] — Validation de la configuration git-flow

### Added
- Avertissement si branche inexistante dans la config git-flow
- Validation de la branche de base avant création

## [1.4.0] — Persistance des toasts dans les logs

### Added
- Persistance des messages toast dans le LogPanel
- Badge non lu, toasts d'erreur sans auto-dismiss

## [1.3.1] — Correctif bandeau merge

### Fixed
- Bandeau "Fusion en cours" persistant après le commit de merge

## [1.3.0] — Discard All dans Changes

### Added
- Bouton "Tout annuler" dans la vue Changes (avec confirmation)

## [1.2.6] — Correctif diff merge

### Fixed
- Diff stale après résolution de conflit dans MergeEditor

## [1.2.5] — Correctif conflit merge diff manquant

### Fixed
- Diff manquant sur fichier supprimé (DU) en conflit
- Conflit "ajouté des deux côtés" (AA) non affiché

## [1.2.4] — Correctif diff fichier supprimé merge

### Fixed
- Diff crash sur un fichier supprimé lors d'un merge

## [1.2.3] — Correctif discard nouveau fichier

### Fixed
- Discard ne fonctionnait pas sur un nouveau fichier

## [1.2.2] — Correctif force push auto-proposé

### Fixed
- Force push proposé automatiquement après un push échoué

## [1.2.1] — Correctif compteur push

### Fixed
- Compteur de commits à pusher non mis à jour après un push

## [1.2.0] — Dialog de push

### Added
- Dialog de push : sélection de branches et de remote

## [1.1.1] — Correctif unstage all

### Fixed
- Unstage all génère une erreur

## [1.1.0] — Backend Git CLI alternatif

### Added
- Backend Git CLI alternatif (sélecteur git2 / git externe dans les Paramètres)

## [1.0.1] — Icône personnalisée

### Added
- Icône personnalisée (logo TSGit + affichage écran d'accueil)

## [1.0.0] — Version initiale

### Added
- Clean Architecture (Tauri 2 + Rust + React 19/TypeScript)
- Clone, Stash, Tags, Reset & Revert
- Merge & résolution de conflits (inline + éditeur 3 panneaux)
- Cherry-pick, Rebase, Staging partiel, Blame
- Branches, Authentification (SSH + HTTPS), Recherche & filtrage
- Diff avancé, Graphe des commits, Reflog
- Multi-dépôt (onglets), Sous-modules & Prune
- Terminal intégré, Internationalisation (FR/EN/ES), Git-flow
- Feedback de progression, Gestion des versions
- Thème clair / sombre, Coloration syntaxique Shiki
- Sélection multiple de fichiers, Modes d'affichage (tree/group/flat)
