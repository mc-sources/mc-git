mod commands;
pub mod domain;
pub mod error;
mod events;
pub mod git;
pub mod infrastructure;
pub mod logger;
mod migrations;
mod state;

use commands::{
    auth, branch, cherry_pick, commit, config, diff, external_diff, file_editor, gitflow, gpg,
    history, legal, merge, open_in_editor, rebase, remote, report, repository, stash, status,
    submodule, tag, terminal,
};
use state::AppState;

fn run_legacy_migrations() {
    use migrations::legacy_paths::migrate_legacy_dir;

    if let Some(base) = dirs::config_dir() {
        if let Err(e) = migrate_legacy_dir("tsgit", "mcgit", &base) {
            eprintln!("[migrations] config_dir tsgit→mcgit: {e}");
        }
    }
    if let Some(base) = dirs::data_local_dir() {
        if let Err(e) = migrate_legacy_dir("tsgit", "mcgit", &base) {
            eprintln!("[migrations] data_local_dir tsgit→mcgit: {e}");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_legacy_migrations();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Repository
            repository::open_repository,
            repository::init_repository,
            repository::clone_repository,
            repository::get_repo_info,
            repository::close_repository,
            repository::switch_active_tab,
            repository::close_tab,
            repository::detect_git_binary,
            // Status & Staging
            status::list_tracked_files,
            status::get_status,
            status::stage_file,
            status::stage_paths,
            status::unstage_file,
            status::unstage_paths,
            status::discard_changes,
            status::discard_all,
            status::stage_all,
            status::unstage_all,
            status::write_and_stage_file,
            status::stage_hunk,
            status::unstage_hunk,
            status::reset_conflict_file,
            status::reset_staged_conflict_file,
            status::reset_all_conflict_files,
            status::resolve_deletion_accept,
            status::resolve_deletion_restore,
            status::resolve_deletion_accept_theirs,
            status::resolve_deletion_keep_ours,
            // Commit
            commit::create_commit,
            commit::amend_commit,
            commit::get_head_commit,
            // Diff & Blame
            diff::get_file_diff,
            diff::get_commit_diff,
            diff::get_commit_file_diff,
            diff::get_blame,
            // Merge
            merge::merge_branch,
            merge::abort_merge,
            merge::get_repository_state,
            // Cherry-pick
            cherry_pick::cherry_pick,
            cherry_pick::continue_cherry_pick,
            cherry_pick::abort_cherry_pick,
            // Rebase
            rebase::rebase_branch,
            rebase::continue_rebase,
            rebase::abort_rebase,
            rebase::get_interactive_rebase_commits,
            rebase::apply_interactive_rebase,
            // History
            history::get_log,
            history::get_graph_log,
            history::get_commit_detail,
            history::reset_to_commit,
            history::revert_commit,
            history::get_reflog,
            // Branches
            branch::list_branches,
            branch::create_branch,
            branch::checkout_branch,
            branch::delete_branch,
            branch::rename_branch,
            branch::checkout_remote_branch,
            branch::set_branch_upstream,
            branch::unset_branch_upstream,
            // Config
            config::get_git_config,
            config::set_git_config,
            // Tags
            tag::list_tags,
            tag::create_tag,
            tag::delete_tag,
            tag::push_tag,
            tag::delete_remote_tag,
            // Stash
            stash::stash_save,
            stash::stash_list,
            stash::stash_apply,
            stash::stash_pop,
            stash::stash_drop,
            // Remotes
            remote::list_remotes,
            remote::add_remote,
            remote::remove_remote,
            remote::fetch_remote,
            remote::fetch_all_remotes,
            remote::push_remote,
            remote::push_force_with_lease,
            remote::pull_remote,
            remote::prune_remote,
            terminal::open_terminal,
            file_editor::read_file,
            file_editor::write_file,
            open_in_editor::open_in_editor,
            // Report
            report::save_report,
            report::copy_to_clipboard,
            // Git-flow
            gitflow::get_gitflow_config,
            gitflow::init_gitflow,
            gitflow::start_gitflow_branch,
            gitflow::finish_gitflow_branch,
            // Submodules
            submodule::list_submodules,
            submodule::init_submodule,
            submodule::update_submodule,
            submodule::update_all_submodules,
            submodule::add_submodule,
            // Auth
            auth::save_credentials,
            auth::clear_credentials,
            auth::list_saved_hosts,
            auth::list_ssh_keys,
            auth::trust_ssh_host,
            // GPG
            gpg::list_gpg_keys,
            // External diff
            external_diff::open_external_diff,
            // Legal
            legal::get_legal_document,
            legal::get_third_party_notices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
