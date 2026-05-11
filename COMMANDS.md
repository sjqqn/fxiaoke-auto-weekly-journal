# 常用命令备忘

## 日常运行

```bash
cd /Users/shenjiaqi/cursor/crm-auto

# 安装依赖（首次或依赖变更后）
npm install

# Dry-run（只拉数 + 渲染，不写 CRM）
node src/index.js --dry-run

# 正式执行（写入 JournalObj）
node src/index.js
```

### 可选环境变量（调试）

在 `.env` 中配置，或单行前缀执行：

```bash
OVERRIDE_END_TIME='2026-05-09T19:00:00+08:00' node src/index.js --dry-run
```

## macOS launchd 定时任务

定时任务已在安装后由系统调度（每周五 19:00 CST，项目路径见 plist）。

```bash
# 一键安装（会复制 plist 到 ~/Library/LaunchAgents/）
bash launchd/install.sh

# 卸载
bash launchd/uninstall.sh

# 手动立即执行一次（会按当前 .env 写 CRM；慎用）
launchctl start com.shenjiaqi.crm-weekly-journal

# 查看任务是否在列表中（第一列若为「-」表示空闲，非数字错误码需排查）
launchctl list | grep crm-weekly-journal

# 定时任务 stdout/stderr 合并日志
tail -f ~/Library/Logs/crm-weekly-journal.log
```

> `launchctl` 会继承 **GUI 用户** 环境下的部分路径；项目依赖 `WorkingDirectory` 与 plist 内的 `PATH`。若脚本报 `node not found`，将 plist 中 `ProgramArguments` 的第一项改为 `which node` 的绝对路径后重新安装。

## 飞书机器人通知（可选）

在 `.env` 中配置 `FEISHU_WEBHOOK_URL`（群机器人 Webhook 完整地址）。

- 配置后：每次运行结束会推送 **状态摘要 + 完整终端日志**（与控制台输出一致；过长自动分多条）
- **勿将 Webhook 提交到 Git**；仅用 `.env` 或 GitHub `secrets.FEISHU_WEBHOOK_URL`。

详见根目录 `.env.example`。

## Git 与远端

```bash
git status
git add .
git commit -m "feat: ..."
git push origin main
```

## GitHub Actions（可选）

需在仓库 Secrets 配置 `MCP_TOKEN`；境外 Runner 通常无法直连纷享 MCP，仅适合手动校验流程。

在项目目录外使用 `gh`：

```bash
gh workflow run "周日志自动生成" --repo sjqqn/fxiaoke-auto-weekly-journal -f dry_run=true
```
