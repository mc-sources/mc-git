# Documentation Mc-Git

Documentation à destination des contributeurs et utilisateurs avancés de Mc-Git.

## Index

| Fichier | Contenu |
|---------|---------|
| [`SETUP.md`](./SETUP.md) | Installation de l'environnement de développement (Node.js, Rust, Tauri CLI, dépendances système Linux/macOS/Windows) |
| [`architecture.md`](./architecture.md) | Architecture générale — Clean Architecture, frontière IPC Tauri, mapping snake_case ↔ camelCase, politique CLI git, gestion d'état |
| [`add-command.md`](./add-command.md) | Recette pour ajouter une nouvelle commande Tauri en 6 étapes (fonction git2 pure → trait → impl → command → registration → frontend) |
| [`release.md`](./release.md) | Politique de versioning, conventions de branches (`feat/*`, `fix/*`, `bugfix/*`, `hotfix/*`, `release/*`), procédure de release, build des artefacts |
| [`THIRD-PARTY-NOTICES-rust.md`](./THIRD-PARTY-NOTICES-rust.md) | Attribution des dépendances Rust (généré par `cargo about`) |
| [`THIRD-PARTY-NOTICES-npm.md`](./THIRD-PARTY-NOTICES-npm.md) | Attribution des dépendances npm (généré par `scripts/build-notice-npm.mjs`) |

## Pour démarrer

1. Lire [`SETUP.md`](./SETUP.md) pour installer l'environnement
2. Lire [`architecture.md`](./architecture.md) pour comprendre la structure du code
3. Suivre [`add-command.md`](./add-command.md) si vous ajoutez une fonctionnalité côté backend
4. Consulter [`release.md`](./release.md) avant toute mise en production

## Stack technique

Voir le tableau « Stack technique » dans le [`README.md`](../README.md) racine du dépôt.
