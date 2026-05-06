# Changelog

Toutes les modifications notables de Mc-Git sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Le versioning suit [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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
