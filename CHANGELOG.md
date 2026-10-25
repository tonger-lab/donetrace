# Changelog

All notable changes to this project will be documented in this file.
Pro-only features are marked with `(Pro)`.

## [0.2.1] - 2026-10-25

### Added
- 中英双语 README（页签切换），并补充 GitHub Releases 安装指引
- GitHub Release 二进制发布：Windows 安装包 + SHA256 校验（随源码发布自动产出）

### Changed
- 无

### Fixed
- 无
## [0.2.0] - 2026-10-25

### Added
- 英文界面（English UI）：设置页新增「语言」选项（跟随系统 / English / 中文）
- AI 复盘提示词随界面语言本地化（中英双套，上下文与工时格式同步切换）

### Changed
- 窗口标题统一为 "DoneTrace"
- 后端错误信息改为错误码，由前端按当前语言显示

### Fixed
- 重复启动不再新开窗口：应用运行中再次点击图标将聚焦已有窗口
- 切换语言后界面立即生效（含左侧菜单与全部弹窗）
- AI 周期分析提示词明确「1 天 = 8 个工时」，避免工时超过 1 天时被理解为 24 小时