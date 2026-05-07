use std::path::PathBuf;

/// Returns all SSH private key paths found in `~/.ssh/`, in order of preference.
///
/// Standard key names (`id_ed25519`, `id_rsa`, `id_ecdsa`, `id_dsa`) are listed
/// first, then any other key pairs found alphabetically.
///
/// Each entry is `(public_key_path, private_key_path)`.
pub fn discover() -> Vec<(PathBuf, PathBuf)> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };
    let ssh = home.join(".ssh");

    let read_dir = match std::fs::read_dir(&ssh) {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let mut keys: Vec<(PathBuf, PathBuf)> = read_dir
        .flatten()
        .filter_map(|entry| {
            let pub_path = entry.path();
            if pub_path.extension().and_then(|e| e.to_str()) != Some("pub") {
                return None;
            }
            let private = pub_path.with_extension("");
            if private.exists() {
                Some((pub_path, private))
            } else {
                None
            }
        })
        .collect();

    let order = ["id_ed25519", "id_rsa", "id_ecdsa", "id_dsa"];
    keys.sort_by(|(_, a), (_, b)| {
        let ai = order
            .iter()
            .position(|&n| a.file_name().and_then(|f| f.to_str()) == Some(n))
            .unwrap_or(usize::MAX);
        let bi = order
            .iter()
            .position(|&n| b.file_name().and_then(|f| f.to_str()) == Some(n))
            .unwrap_or(usize::MAX);
        ai.cmp(&bi).then(a.cmp(b))
    });

    keys
}
