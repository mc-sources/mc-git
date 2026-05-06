# Setup de l'environnement de développement

## Prérequis

### Node.js
Version LTS recommandée (≥ 20). Vérifier avec :
```bash
node --version
npm --version
```

### Rust
Via [rustup](https://rustup.rs) :
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable
```

### Tauri CLI
```bash
cargo install tauri-cli --version "^2"
```

### Dépendances système

**Linux (Debian/Ubuntu)** :
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf build-essential libssl-dev pkg-config
```

**macOS** : Xcode Command Line Tools suffisent :
```bash
xcode-select --install
```

**Windows** : Visual Studio Build Tools avec le workload « Desktop development with C++ ».

---

## Installation

```bash
git clone <url-du-depot>
cd mcgit
npm install
```

---

## Lancer en mode développement

```bash
npm run tauri dev
```

Cette commande démarre en parallèle :
- Vite (serveur de développement frontend, hot-reload)
- L'application Tauri (fenêtre native avec rechargement automatique)

---

## Vérifications rapides (sans lancer l'app)

**TypeScript uniquement** (frontend) :
```bash
npx tsc --noEmit
```

**Rust uniquement** (backend, rapide — pas de compilation complète) :
```bash
cd src-tauri && cargo check
```

---

## Build de production

```bash
npm run tauri build
```

Les artefacts sont générés dans `src-tauri/target/release/bundle/` :
- Linux : `.deb`, `.AppImage`
- macOS : `.dmg`, `.app`
- Windows : `.msi`, `.exe`

---

## Fichiers de configuration

| Fichier | Rôle |
|---------|------|
| `src-tauri/tauri.conf.json` | Identifiant app, titre fenêtre, permissions Tauri, bundle |
| `src-tauri/Cargo.toml` | Dépendances Rust (git2, serde, tauri…) |
| `vite.config.ts` | Configuration Vite + plugin Tailwind CSS v4 |
| `tsconfig.json` | Configuration TypeScript |
| `package.json` | Dépendances et scripts frontend |

---

## Résolution des problèmes courants

### `error: failed to run custom build command for openssl-sys`
Installer `libssl-dev` et `pkg-config` (Linux) :
```bash
sudo apt install libssl-dev pkg-config
```

### `webkit2gtk` introuvable
S'assurer que `libwebkit2gtk-4.1-dev` est installé. Sur Ubuntu 22.04, utiliser `libwebkit2gtk-4.0-dev`.

### Erreur TypeScript après `npm install`
Supprimer le cache et réinstaller :
```bash
rm -rf node_modules && npm install
```

### `cargo check` échoue avec des erreurs de version
S'assurer que la toolchain Rust stable est à jour :
```bash
rustup update stable
```
