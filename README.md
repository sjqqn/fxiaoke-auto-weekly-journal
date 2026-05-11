# CRM 周日志自动化

每周五 19:00 自动拉取沈佳琪的工时明细，按模板生成富文本周日志，并写入 CRM `JournalObj`。

## 项目结构

```
crm-auto/
├── src/
│   ├── index.js           # 主入口
│   ├── mcp-client.js      # MCP 查询 / 写入封装
│   ├── summarize.js       # 分组 + 文本模板渲染
│   └── journal-writer.js  # JournalObj 写入
├── .github/
│   └── workflows/
│       └── weekly-journal.yml   # CI 定时任务
├── .env.example
└── package.json
```

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 MCP_TOKEN、OWNER_NAMES、REVIEWER_NAMES
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地测试（dry-run，不写入 CRM）

```bash
node src/index.js --dry-run
```

### 4. 正式执行

```bash
node src/index.js
```

## 定时任务部署

> 纷享 MCP（`open.fxiaoke.com`）对境外 IP 返回 404，GitHub Actions runner（Azure 美国）无法直接调用。
> 因此采用 **本地 macOS launchd** 跑定时任务，GitHub Actions 仅保留手动触发通道用于代码验证。

### 一键安装本地定时（macOS）

```bash
npm install        # 安装依赖
cp .env.example .env && vi .env   # 配置 MCP_TOKEN 等
bash launchd/install.sh           # 注册 launchd 任务
```

完成后：
- 每周五 19:00 CST 自动触发
- 日志输出：`~/Library/Logs/crm-weekly-journal.log`
- 立即测试一次：`launchctl start com.shenjiaqi.crm-weekly-journal`
- 查看状态：`launchctl list | grep crm-weekly-journal`
- 卸载：`bash launchd/uninstall.sh`

> Mac 在触发时刻处于睡眠/关机会自动顺延，launchd 在唤醒后会补跑当次。

### GitHub Actions（可选，仅手动触发）

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret | 说明 |
|---|---|
| `MCP_TOKEN` | MCP 鉴权 Token（FSUTK_xxx） |
| `MINIMAX_API_KEY` | MiniMax API Key（可选） |
| `OPENAI_API_KEY` | OpenAI API Key（可选，二选一） |

在 **Variables** 中添加（可选）：

| Variable | 默认值 | 说明 |
|---|---|---|
| `LLM_MODEL` | `MiniMax-Text-01` / `gpt-4o` | 归纳使用的模型 |
| `OWNER_NAMES` | `沈佳琪` | 工时数据归属人（多人逗号分隔） |
| `REVIEWER_NAMES` | `安春晖yak` | 日志点评人（多人逗号分隔） |

CI 仅支持手动触发（Actions 页面 "Run workflow"），用于代码 lint / 验证。
若要在 CI 跑通数据流，需把仓库 runner 改为国内 self-hosted。

## 周日志输出结构（纯文本）

```
【本周概览】
- 周期：YYYY-MM-DD ~ YYYY-MM-DD HH:mm
- 总工时：N h
- 涉及客户：N 家
- 涉及项目：N 个
- 涉及工作组：N 个
- 工时分类：N 类

【工时大类】【明细分类】

[负责人][客户/项目][支持时长: N ]工作内容：
- ...
- ...

（重复每个分组）

【下周关注】
- ...
```

## 字段映射

### 工时管理明细 `object_2Jn4V__c`

| 业务含义 | API 名 |
|---|---|
| 工时大类 | `classify__c` |
| 明细分类 | `DetailedClassification__c` |
| 客户名称 | `Customer__c` |
| 实施项目（新） | `project__c` |
| 实施工作组 | `implementation_workgroup__c` |
| 工作内容 | `remarks__c` |
| 工时值 | `tasktime__c` |
| 工时所属日期 | `date__c` |
| 负责人 | `owner` |

### 日志 `JournalObj`

| 业务含义 | API 名 |
|---|---|
| 汇报周期 | `period_type` = `weekly` |
| 业务类型 | `record_type` = `default_week__c`（周计划） |
| 时间锚点 | `journal_time`（本周周四 yyyyMMdd） |
| 日志开始时间 | `journal_begin_date`（毫秒时间戳字符串） |
| 日志结束时间 | `journal_end_date`（毫秒时间戳字符串） |
| 本期总结 | `work_summary`（rich_text，纯文本） |
| 下期计划 | `work_plan`（rich_text，纯文本） |
| 本周工作内容 | `field_KkHJK__c`（rich_text，纯文本） |
| 点评人 | `multi_comment_by`（employee_many，员工 ID 数组） |
