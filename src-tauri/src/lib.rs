// 公开快照中 pro 特性被导出脚本剥离，cfg(feature = "pro") 会触发 unexpected_cfgs 告警
#![allow(unexpected_cfgs)]

mod ai;
mod commands;
mod db;
pub mod period;
pub mod scoring;

use tauri::Manager;

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // 单实例：重复启动时聚焦已有窗口，而不是再开一个新的
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let _ = &args; // 免费构建未使用（深链二次启动仅 Pro 需要）
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            // 通过协议链接二次启动：参数中携带 donetrace:// URL
            #[cfg(feature = "pro")]
            donetrace_pro::tauri_bridge::handle_single_instance_args(app, &args);
        }))
        .setup(|app| {
            app.manage(db::init(app.handle())?);
            // Pro 接线（仅官方安装包编译）：全部业务逻辑在 pro/ 增量 crate 的
            // tauri_bridge 模块（红线目录），这里只注入本地 zip 打包 / 导入两个
            // 闭包并完成初始化。社区构建无本块，也不存在该依赖。
            #[cfg(feature = "pro")]
            {
                let backup_handle = app.handle().clone();
                let backup_provider: donetrace_pro::tauri_bridge::BackupProvider =
                    std::sync::Arc::new(move || {
                        let db = backup_handle.state::<crate::db::Db>();
                        crate::commands::backup::build_backup_zip(&db).map_err(|e| e.to_string())
                    });
                let restore_handle = app.handle().clone();
                let restore_importer: donetrace_pro::tauri_bridge::RestoreImporter =
                    std::sync::Arc::new(move |bytes| {
                        let db = restore_handle.state::<crate::db::Db>();
                        let dir = crate::db::data_dir().map_err(|e| e.to_string())?;
                        let tmp = dir.join(format!(
                            "pro-restore-{}.zip",
                            chrono::Local::now().format("%Y%m%d%H%M%S")
                        ));
                        std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
                        let summary = crate::commands::backup::import_zip(
                            &db,
                            tmp.to_string_lossy().to_string(),
                            "merge".to_string(),
                        )
                        .map_err(|e| e.to_string())?;
                        let _ = std::fs::remove_file(&tmp);
                        Ok(serde_json::to_value(summary).unwrap_or(serde_json::Value::Null))
                    });
                donetrace_pro::tauri_bridge::init(
                    app.handle(),
                    crate::db::data_dir()?.join("pro-state.json"),
                    backup_provider,
                    restore_importer,
                );
                // donetrace:// 协议：官网登录状态转移（注册协议 + 监听深链）
                donetrace_pro::tauri_bridge::setup_deep_link(app.handle())?;
            }
            Ok(())
        });

    // 深链插件（仅官方构建；免费版不注册协议）
    #[cfg(feature = "pro")]
    let builder = builder.plugin(tauri_plugin_deep_link::init());

    // 命令注册（Tauri 2 的 invoke_handler 是**替换**语义，只能单次调用）：
    // 两个 cfg 分支各自展开完整列表。⚠️ 修改核心命令时两个分支必须同步。
    // Pro 命令定义在 pro/ 增量 crate（红线目录），这里仅按路径注册。
    #[cfg(not(feature = "pro"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::settings::is_pro_build,
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
    ]);
    #[cfg(feature = "pro")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::settings::is_pro_build,
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
        donetrace_pro::tauri_bridge::pro_status,
        donetrace_pro::tauri_bridge::pro_set_server,
        donetrace_pro::tauri_bridge::pro_open_website,
        donetrace_pro::tauri_bridge::pro_register,
        donetrace_pro::tauri_bridge::pro_verify,
        donetrace_pro::tauri_bridge::pro_login,
        donetrace_pro::tauri_bridge::pro_unlock,
        donetrace_pro::tauri_bridge::pro_logout,
        donetrace_pro::tauri_bridge::pro_backup_now,
        donetrace_pro::tauri_bridge::pro_list_backups,
        donetrace_pro::tauri_bridge::pro_restore_latest,
    ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(feature = "pro")]
        if let tauri::RunEvent::ExitRequested { .. } = &_event {
            donetrace_pro::tauri_bridge::backup_on_exit(_app_handle);
        }
    });
}
