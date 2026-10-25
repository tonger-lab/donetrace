mod ai;
mod commands;
mod db;
pub mod period;
pub mod scoring;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // 单实例：重复启动时聚焦已有窗口，而不是再开一个新的
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            app.manage(db::init(app.handle())?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::list_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::toggle_task_done,
            commands::tasks::delete_task,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::move_project,
            commands::projects::set_core_project,
            commands::projects::archive_project,
            commands::projects::reactivate_project,
            commands::projects::get_project_detail,
            commands::analysis::get_analysis,
            commands::ai::analyze_period,
            commands::ai::analyze_project,
            commands::ai::list_project_logs,
            commands::ai::get_project_log,
            commands::settings::get_deepseek_config,
            commands::settings::set_deepseek_config,
            commands::settings::test_deepseek_connection,
            commands::settings::get_language,
            commands::settings::set_language,
            commands::settings::get_system_locale,
            commands::backup::export_data,
            commands::backup::pick_backup_file,
            commands::backup::preview_import,
            commands::backup::import_data,
            commands::backup::clear_all_data,
            commands::icons::pick_project_icon,
            commands::icons::load_project_icon_preview,
            commands::icons::crop_project_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
