/**
 * MCP HTTP 客户端
 * 封装所有对 fs-mcp-server (纷享销客 CRM MCP) 的调用
 *
 * 认证：token 通过 ?apiKey=FSUTK_xxx 查询参数传递
 * 协议：JSON-RPC 2.0，Accept: application/json, text/event-stream
 */

const MCP_BASE_URL = process.env.MCP_BASE_URL ?? 'https://open.fxiaoke.com/mcp/fs/crm-mcp';
const MCP_TOKEN    = process.env.MCP_TOKEN;

// 支持多人，逗号分隔，例：OWNER_NAMES=沈佳琪,张三
const OWNER_NAMES = (process.env.OWNER_NAMES ?? '沈佳琪')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

let _mcpRequestId = 1;

async function callMcp(toolName, args) {
  const url = `${MCP_BASE_URL}?apiKey=${MCP_TOKEN}`;

  const body = {
    jsonrpc: '2.0',
    id:      _mcpRequestId++,
    method:  'tools/call',
    params:  { name: toolName, arguments: args },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MCP [${toolName}] HTTP ${resp.status}: ${text}`);
  }

  const json = await resp.json();

  if (json.error) {
    throw new Error(`MCP [${toolName}] JSON-RPC 错误: ${JSON.stringify(json.error)}`);
  }

  // MCP 工具结果包装在 content[0].text（JSON 字符串）
  const textContent = json.result?.content?.[0]?.text;
  if (!textContent) {
    throw new Error(`MCP [${toolName}] 返回结构异常: ${JSON.stringify(json.result)}`);
  }

  const parsed = JSON.parse(textContent);

  if (parsed.resultCode && parsed.resultCode !== 'SUCCESS') {
    throw new Error(`MCP [${toolName}] 业务失败: ${JSON.stringify(parsed)}`);
  }

  // 返回 data 层（纷享通用结构 { resultCode, data: { ... } }）
  return parsed.data ?? parsed;
}

/**
 * 通过姓名列表查询员工 ID 列表（PersonnelObj / EmployeeObj 通用）
 *
 * 用于解析 owner、点评人 等 employee 类字段
 * @param {string[]} names  姓名数组
 * @returns {Promise<string[]>}  对应的员工 ID 数组
 */
export async function resolveEmployeeIds(names) {
  const ids = [];

  for (const name of names) {
    const result = await callMcp('QueryRecordIdByName', { query: name });
    // 返回结构：{ totalSize, name2IdPos: [{ id, apiName, name }, ...] }
    const hits = result?.name2IdPos ?? [];

    if (hits.length === 0) {
      console.warn(`[MCP] 未找到人员「${name}」，已跳过`);
      continue;
    }

    // 同名时取第一条，并打印所有候选供排查
    if (hits.length > 1) {
      console.warn(`[MCP] 「${name}」命中 ${hits.length} 条，取第一条:`,
        hits.map(h => `${h.name}(${h.id})`).join(', '));
    }

    console.log(`[MCP] 「${name}」→ id: ${hits[0].id}`);
    ids.push(hits[0].id);
  }

  return ids;
}

/**
 * 查询指定人员近 7 天工时明细
 * @param {Date} endTime  截止时间（周五 19:00）
 * @returns {Array}       工时明细记录列表
 */
export async function fetchTimesheetDetails(endTime) {
  const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 纷享日期过滤用 Unix 毫秒时间戳字符串
  const startTs = String(startTime.getTime());
  const endTs   = String(endTime.getTime());

  // 查询所有配置人员的 ID
  console.log('[MCP] 查询人员 ID，配置人员:', OWNER_NAMES.join('、'));
  const ownerIds = await resolveEmployeeIds(OWNER_NAMES);

  if (ownerIds.length === 0) {
    throw new Error('未能解析到任何人员 ID，请检查 OWNER_NAMES 配置');
  }

  console.log(`[MCP] 查询窗口: ${new Date(+startTs).toISOString()} ~ ${new Date(+endTs).toISOString()}`);
  console.log('[MCP] ownerId 列表:', ownerIds);

  const result = await callMcp('QueryRecordsByTemplate', {
    objectApiName: 'object_2Jn4V__c',
    queryMode:     'RECORD',
    selectFields: [
      '_id',
      'classify__c',
      'DetailedClassification__c',
      'Customer__c',
      'project__c',
      'implementation_workgroup__c',
      'remarks__c',
      'tasktime__c',
      'date__c',
      'owner',
    ],
    searchTemplateQuery: {
      limit:   200,
      filters: [
        // IN 操作符，支持多人
        { field_name: 'owner',   operator: 'IN',  field_values: ownerIds },
        { field_name: 'date__c', operator: 'GTE', field_values: [startTs] },
        { field_name: 'date__c', operator: 'LTE', field_values: [endTs]   },
        // 请假等分类在 JS 层（groupByCategory）过滤，避免操作符兼容问题
      ],
      orders: [{ fieldName: 'date__c', isAsc: true }],
    },
    needCount: true,
  });

  const total = result?.recordResult?.totalNumber ?? result?.totalNumber ?? 'unknown';
  console.log(`[MCP] QueryRecordsByTemplate totalNumber: ${total}`);

  // QueryRecordsByTemplate 返回结构：{ queryMode, recordResult: { records, totalNumber } }
  const rows = result?.recordResult?.records
    ?? result?.recordResult?.dataList
    ?? result?.dataList
    ?? result?.data
    ?? [];
  console.log(`[MCP] 命中记录数: ${Array.isArray(rows) ? rows.length : JSON.stringify(rows)}`);
  return Array.isArray(rows) ? rows : [];
}

/**
 * 往 JournalObj 新建一条周日志
 */
export async function createJournal(journalData) {
  return callMcp('CreateRecordsByData', {
    apiName:         'JournalObj',
    object_api_name: 'JournalObj',
    object_data:     journalData,
    data:            journalData,
  });
}
