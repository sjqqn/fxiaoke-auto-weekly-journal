---
name: crm-weekly-journal
description: >-
  Pulls Fxiaoke timesheet rows via MCP, renders plain-text weekly journal, and creates
  JournalObj (or dry-run). Bundled runnable JS in runner/ (npm install + node index.js).
  On first use per agent or workspace, guide the user to create runner/.env locally
  before running; never exchange secrets in chat. Use for CRM 周日志, 纷享周计划,
  weekly journal, dry-run, or 首次配置 .env / 周日志环境变量.
disable-model-invocation: false
---

# CRM 周日志自动生成

本技能自带 **可执行脚本**（`runner/` 目录），不依赖仓库根目录的 `src/`。整份复制到其他 Agent 平台后，在 `runner/` 内配置 `.env` 并运行即可。

## 密钥与对话（硬约束）

**禁止在对话（用户消息与 Agent 回复）中出现、索要、复述或引用以下内容的明文或片段**：`MCP_TOKEN`、纷享/第三方 **API Key**、**飞书 Webhook** 完整 URL、以及任何等价密钥字符串。

- **用户**：只在本地编辑器中编辑 `runner/.env`，**不要**把上述密钥粘贴到聊天里。  
- **Agent**：**不得**请用户「把 Token / Webhook 发给我」；**不得**在回复中抄写、总结或部分展示用户误发的密钥；**不得**把密钥写入非 `.env` 的文件供「方便复制」。若用户已在对话中误发密钥，应提醒其**立即轮换**（在纷享/飞书侧作废并重新生成），后续仅在本地 `.env` 配置。

校验是否已配置时：可本地读 `runner/.env` 做判断，但回复用户时**只**用不含秘密的表述（例如「`MCP_TOKEN` 行已非占位符」「飞书 Webhook 行已填写」），**不要**回显变量值。

## 前置条件

- Node.js 18+（原生 `fetch` + ESM）
- 可访问纷享 MCP 的网络（**境外 IP 常无法直连** `open.fxiaoke.com`）

## 首次使用（每个 Agent / 每个工作区）

**同一台机器、不同对话或不同 Agent，只要没有可用的 `runner/.env`，都视为首次**，必须先完成配置再执行脚本。

**判定「尚未就绪」**（满足任一即停跑、先引导）：

- `runner/.env` 不存在；或
- `runner/.env` 内无 `MCP_TOKEN=`，或值为空 / 占位符（如 `FSUTK_xxx`、`your_token`、`changeme`）。

就绪后再执行 `npm install`（若未装）与 `node index.js`。

## 对话式引导（Agent 必须遵守）

在未就绪时，**不要**直接运行 `node index.js`（会失败或误用空配置）。按下面顺序用自然语言引导；**凡密钥类变量一律只在用户本机 `runner/.env` 中填写，不得经对话传递**（见上文「密钥与对话」）。

**开场（简要说明目的）**

- 说明：周日志需要纷享 MCP 与可选飞书通知；**`MCP_TOKEN`、`FEISHU_WEBHOOK_URL` 等密钥只能在本地 `runner/.env` 填写，请勿在聊天中发送。**  
- 指示：`cp runner/.env.example runner/.env`（若尚无），用编辑器打开 `runner/.env`，在本地从企业/IDE 凭据处复制 Token 与 Webhook 到对应行（**不要**粘贴到对话里）。

**问题顺序（一次问 1～2 项；密钥相关只指路、不索要值）**

1. **纷享 MCP Token（必填，仅本地填写）**  
   - 问：是否已在 **`runner/.env`** 里写好 `MCP_TOKEN=` 这一行？（是 / 否即可，**不要**让用户在对话里贴 Token。）  
   - 说明获取方式时**只**给路径或菜单名称（例如「在 Cursor 的 MCP 配置里查看纷享 CRM 的 apiKey」），**不要**在对话或回复中给出任何示例 Token 字符串。  
   - 用户填好后回复「已本地保存」即可；Agent 仅做占位符检测（见「首次使用」），**不得**要求用户把值发来核对。

2. **工时归属人（必填，至少一人；可在对话中说明姓名）**  
   - 问：周报要汇总谁的工时？姓名需与 CRM 一致；多人用英文逗号分隔。  
   - Agent 可将确认的姓名写入 `runner/.env` 的 `OWNER_NAMES=`（姓名非密钥），或请用户自行写入。  
   - 若用户跳过：说明将使用 `runner/.env.example` 里的默认值，并请其确认姓名是否正确。

3. **点评人（可选；可在对话中说明姓名）**  
   - 问：周日志「点评人」要写谁？多人逗号分隔；不需要可答「跳过」用默认。  
   - Agent 可写入 `REVIEWER_NAMES=` 或请用户自行写入。

4. **MCP 地址（可选）**  
   - 问：是否使用官方默认 MCP 地址？仅在企业有自定义网关时改。  
   - 默认：`MCP_BASE_URL=https://open.fxiaoke.com/mcp/fs/crm-mcp`（该 URL 非密钥，可写在对话里。）

5. **飞书通知（可选，仅本地填写 Webhook）**  
   - 问：是否需要任务结束推送到飞书？若需要，请**仅在 `runner/.env` 中**填写 `FEISHU_WEBHOOK_URL=`，在对话中只需回答「要 / 不要」。**禁止**让用户把 Webhook 链接发到聊天。  
   - 提醒：**勿**将 `runner/.env` 提交到 Git。

6. **调试截止时间（可选）**  
   - 问：是否按「当前时间」作为统计截止？若要复现某周，可提供 ISO 时间（例 `2026-05-09T19:00:00+08:00`）。  
   - Agent 可写入 `OVERRIDE_END_TIME=` 或请用户写入（时间字符串一般可经对话确认，**不要**与密钥混在同一行粘贴）。

**收尾**

- 复制模板：`runner/.env.example` → `runner/.env`（若尚未创建）。  
- Agent 可代写 **非密钥** 行（`OWNER_NAMES`、`REVIEWER_NAMES`、`MCP_BASE_URL`、`OVERRIDE_END_TIME`）；**`MCP_TOKEN` 与 `FEISHU_WEBHOOK_URL` 必须由用户在本机编辑器中填写**，Agent 不通过对话接收、不写入自己从聊天里拿到的「用户口述密钥」（用户若在对话里口述密钥，应拒绝使用并提醒轮换与改走本地文件）。  
- 向用户确认时**只**回显非秘密项；对密钥仅报告状态（已配置 / 仍为占位 / 未填写），**永不**回显其值。  
- 提示下一步：在 `runner/` 下 `npm install`（首次），再 `node index.js --dry-run`；确认输出后再正式写入。

**若用户已在对话中误发密钥**

- Agent **不要**重复该内容；简短提醒：到纷享/飞书侧轮换凭据，并只在 `runner/.env` 更新本地文件。

## 执行步骤（配置已就绪后）

1. `cd` 到本技能下的 **`runner`** 目录（与 `package.json`、`index.js` 同级）。
2. 首次：`npm install`
3. 已具备有效的 `runner/.env`（见上文「首次使用」）。
4. 先验证：`node index.js --dry-run`
5. 写入 CRM：`node index.js`
6. 若配置了 `FEISHU_WEBHOOK_URL`，结束会推送摘要 + 完整终端输出。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `MCP_TOKEN` | 是 | 纷享 MCP Token，用于请求 `?apiKey=`；**仅写在 `runner/.env`，禁止在对话中发送或复述** |
| `MCP_BASE_URL` | 否 | 默认 `https://open.fxiaoke.com/mcp/fs/crm-mcp` |
| `OWNER_NAMES` | 否 | 工时归属人，逗号分隔；默认 `沈佳琪` |
| `REVIEWER_NAMES` | 否 | 点评人姓名，逗号分隔；默认 `安春晖yak` → `multi_comment_by` |
| `OVERRIDE_END_TIME` | 否 | ISO 时间，覆盖统计截止时间；窗口为截止前 7 天 |
| `FEISHU_WEBHOOK_URL` | 否 | 飞书自定义机器人 Webhook；**仅写在 `runner/.env`，禁止在对话中发送**；**勿提交 Git** |

以上密钥类变量的**值**只允许出现在本机 `runner/.env`，与「密钥与对话」硬约束一致。

## 流水线逻辑

1. `endTime` = `OVERRIDE_END_TIME` 或当前时刻；`startTime` = `endTime - 7 天`。
2. MCP `QueryRecordIdByName`（`OWNER_NAMES`）→ `QueryRecordsByTemplate`（`object_2Jn4V__c`，`owner` + `date__c`，limit 200）。
3. `groupByCategory`：按大类/明细分组；剔除明细「请假」。
4. 纯文本模板 → `work_summary`、`work_plan`、`field_KkHJK__c`（总结与本周工作内容同源）。
5. 点评人姓名 → ID → `multi_comment_by`。
6. `CreateRecordsByData` → `JournalObj`；`--dry-run` 跳过创建。

## JournalObj 字段（写入）

| 业务 | API 名 | 说明 |
|------|--------|------|
| 汇报周期 | `period_type` | `weekly` |
| 业务类型 | `record_type` | `default_week__c` |
| 时间锚点 | `journal_time` | 窗口内第一个周四 `yyyyMMdd` |
| 起止 | `journal_begin_date` / `journal_end_date` | 毫秒时间戳字符串 |
| 本期总结 | `work_summary` | 纯文本 |
| 下期计划 | `work_plan` | 纯文本 |
| 本周工作 | `field_KkHJK__c` | 纯文本 |
| 点评人 | `multi_comment_by` | 员工 ID 数组（可空） |

## 工时对象查询字段

`object_2Jn4V__c`：`classify__c`、`DetailedClassification__c`、`Customer__c`、`project__c`、`implementation_workgroup__c`、`remarks__c`、`tasktime__c`、`date__c`、`owner`。

## 输出正文结构

- `【本周概览】`、总工时、按分类汇总行
- 各 `【大类】【明细】` 分组块（聚合策略见 `summarize.js`）
- `【下周关注】`

## `runner/` 内文件

| 文件 | 作用 |
|------|------|
| `index.js` | 入口 |
| `mcp-client.js` | MCP JSON-RPC |
| `summarize.js` | 分组与模板 |
| `journal-writer.js` | JournalObj 组装与写入 |
| `feishu-notify.js` | 飞书 Webhook |
| `log-capture.js` | 终端日志捕获 |
| `package.json` | 仅依赖 `dotenv` |
| `.env.example` | 环境变量模板 |

## 与 crm-auto 仓库同步

若你在 **本仓库** 修改了根目录 `src/*.js`，请把相同逻辑复制到本技能的 `runner/*.js`，避免两处长期分叉。

## 跨平台复制

复制整个 `crm-weekly-journal/` 文件夹（含 `SKILL.md` 与 `runner/`）。敏感配置只放 `runner/.env` 或平台密钥管理。
