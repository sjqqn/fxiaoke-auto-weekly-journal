#!/usr/bin/env bash
# 安装本地定时任务（macOS launchd）
# 用法：bash launchd/install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.shenjiaqi.crm-weekly-journal.plist"
SRC_PLIST="$SCRIPT_DIR/$PLIST_NAME"
DST_PLIST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.shenjiaqi.crm-weekly-journal"
LOG_DIR="$HOME/Library/Logs"

echo "[crm-weekly-journal] 项目目录: $PROJECT_DIR"

# 0) 校验依赖
command -v node >/dev/null || { echo "未找到 node，先 brew install node"; exit 1; }
[ -f "$PROJECT_DIR/.env" ] || { echo "缺少 .env，先按 .env.example 配置"; exit 1; }
[ -d "$PROJECT_DIR/node_modules" ] || { echo "未安装依赖，先 npm install"; exit 1; }

# 1) 准备日志目录
mkdir -p "$LOG_DIR"

# 2) 卸载旧任务（如果存在）
if launchctl list | grep -q "$LABEL"; then
    echo "[crm-weekly-journal] 卸载旧任务..."
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$DST_PLIST" 2>/dev/null || true
fi

# 3) 拷贝 plist（用户目录是绝对路径，直接复制即可）
mkdir -p "$HOME/Library/LaunchAgents"
cp "$SRC_PLIST" "$DST_PLIST"
echo "[crm-weekly-journal] plist 已写入: $DST_PLIST"

# 4) 加载任务
launchctl bootstrap "gui/$(id -u)" "$DST_PLIST" 2>/dev/null || launchctl load "$DST_PLIST"
echo "[crm-weekly-journal] 已加载到 launchd"

# 5) 检查状态
launchctl list | grep "$LABEL" || {
    echo "未能在 launchctl list 中看到任务，检查 plist 语法"
    exit 1
}

echo "[crm-weekly-journal] 安装完成"
echo "  - 触发时间: 每周五 19:00 CST"
echo "  - 日志: $LOG_DIR/crm-weekly-journal.log"
echo "  - 立即测试: launchctl start $LABEL"
echo "  - 查看状态: launchctl list | grep $LABEL"
echo "  - 卸载: bash launchd/uninstall.sh"
