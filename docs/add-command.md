# Guide d'ajout d'une commande

> Toute logique git vit côté Rust. Le frontend ne fait qu'appeler l'IPC.
> Pour le contexte d'architecture global, voir [`architecture.md`](./architecture.md).

Ce guide illustre les **6 étapes obligatoires** avec un exemple concret : récupérer le message du dernier commit (`get_last_commit_message`).

---

## Étape 1 — Fonction git2 pure dans `src-tauri/src/git/`

Créer ou compléter le fichier correspondant (ex. `src-tauri/src/git/commit.rs`) :

```rust
use git2::Repository;
use crate::error::Result;

pub fn get_last_commit_message(repo: &Repository) -> Result<String> {
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    Ok(commit.message().unwrap_or("").to_string())
}
```

Règles :

- Pas d'import Tauri ici
- Pas de référence au trait `GitRepository`
- Retourner `Result<T>` avec `AppError`

---

## Étape 2 — Méthode dans le trait `GitRepository`

Dans `src-tauri/src/domain/ports/repository.rs` :

```rust
pub trait GitRepository: Send {
    // ... méthodes existantes ...

    fn get_last_commit_message(&self) -> Result<String>;
}
```

---

## Étape 3 — Implémentation dans `Git2Repository`

Dans `src-tauri/src/infrastructure/git2_impl.rs` :

```rust
use crate::git::commit::get_last_commit_message;

impl GitRepository for Git2Repository {
    // ... implémentations existantes ...

    fn get_last_commit_message(&self) -> Result<String> {
        get_last_commit_message(&self.repo)
    }
}
```

> Si une variante CLI est fournie (`infrastructure/cli_impl.rs`), implémenter la méthode équivalente.

---

## Étape 4 — Wrapper Tauri dans `src-tauri/src/commands/`

Créer ou compléter `src-tauri/src/commands/commit.rs` :

```rust
use tauri::{AppHandle, State};
use crate::error::{AppError, Result};
use crate::logger::log_result;
use crate::state::AppState;

#[tauri::command]
pub fn get_last_commit_message(app: AppHandle, state: State<AppState>) -> Result<String> {
    let result = {
        let guard = state.lock_repo()?;
        let repo = guard.as_ref().ok_or(AppError::NoRepository)?;
        repo.get_last_commit_message()
    };
    log_result(&app, "get_last_commit_message", result)
}
```

Pattern obligatoire :

1. `state.lock_repo()?` — verrouiller le mutex
2. `guard.as_ref().ok_or(AppError::NoRepository)?` — vérifier qu'un dépôt est ouvert
3. Appeler la méthode du trait
4. Passer par `log_result` pour la journalisation

---

## Étape 5 — Registration dans `lib.rs`

Dans `src-tauri/src/lib.rs`, ajouter dans `invoke_handler![]` :

```rust
.invoke_handler(tauri::generate_handler![
    // ... commandes existantes ...
    commit::get_last_commit_message,
])
```

Si le module `commit` n'est pas encore importé en haut du fichier :

```rust
use commands::{/* ... */ commit};
```

---

## Étape 6 — Côté frontend

### 6a. Ajouter la méthode à l'interface (`src/domain/ports/IGitRepository.ts`)

```typescript
export interface IGitRepository {
  // ... méthodes existantes ...
  getLastCommitMessage(): Promise<string>;
}
```

### 6b. Implémenter dans `TauriGitRepository.ts`

```typescript
// src/infrastructure/ipc/TauriGitRepository.ts
async getLastCommitMessage(): Promise<string> {
  return invoke<string>("get_last_commit_message");
}
```

Si le type retourné est un struct Rust complexe (snake_case), définir un type wire et une fonction de mapping :

```typescript
interface WireMyData { some_field: string; }

function mapMyData(w: WireMyData): MyData {
  return { someField: w.some_field };
}

async getMyData(): Promise<MyData> {
  const wire = await invoke<WireMyData>("get_my_data");
  return mapMyData(wire);
}
```

### 6c. Créer un use case (`src/usecases/commit/index.ts`)

```typescript
import type { IGitRepository } from "../../domain/ports/IGitRepository";

export async function getLastCommitMessageUseCase(
  repo: IGitRepository
): Promise<string> {
  return repo.getLastCommitMessage();
}
```

### 6d. Utiliser depuis un composant

```typescript
const repo = useGitRepository(); // injecté via GitRepositoryContext

const message = await getLastCommitMessageUseCase(repo);
```

---

## Checklist

- [ ] Fonction pure dans `git/`
- [ ] Méthode dans le trait `repository.rs`
- [ ] Implémentation dans `git2_impl.rs` (et `cli_impl.rs` si applicable)
- [ ] Wrapper `#[tauri::command]` dans `commands/`
- [ ] Enregistré dans `invoke_handler![]` de `lib.rs`
- [ ] Méthode dans `IGitRepository.ts`
- [ ] Implémentation dans `TauriGitRepository.ts` (avec mapping si nécessaire)
- [ ] Use case dans `usecases/`
