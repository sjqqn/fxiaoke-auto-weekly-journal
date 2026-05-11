#!/usr/bin/env bash
# 卸载本地定时任务（macOS launchd）
# 用法：bash launchd/uninstall.sh

set -euo pipefail

PLIST_NAME="com.shenjiaqi.crm-weekly-journal.plist"
DST_PLIST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.shenjiaqi.crm-weekly-journal"

if launchctl list | grep -q "$LABEL"; then
    echo "[crm-weekly-journal] 停止并卸载任务..."
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$DST_PLIST" 2>/dev/null || true
fi

if [ -f "$DST_PLIST" ]; then
    rm -f "$DST_PLIST"
    echo "[crm-weekly-journal] 已删除 $DST_PLIST"
fi

echo "[crm-weekly-journal] 卸载完成"
