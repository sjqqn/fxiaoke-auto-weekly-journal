/**
 * 分组 + 周日志正文生成（HTML 富文本）
 *
 * 输入：工时明细记录数组
 * 输出：work_summary / work_plan / field_KkHJK__c
 *
 * 各明细分类的聚合策略：
 *   - 项目专属团队：按客户/项目聚合（汇总工时 + 多内容合并）
 *   - 实施工作组  ：按工作组聚合
 *   - 区域/机构交付体系建设：按周聚合（整周一行）
 *   - 学习培训    ：按周聚合（整周一行，内容分行）
 *   - 其他（售前支持/售前POC 等）：每条独立一行
 */

/**
 * 分组（保留每条原始明细）
 */
export function groupByCategory(records) {
  const EXCLUDE_SUB = new Set(['请假']);

  const groups = new Map();

  for (const r of records) {
    const category    = r.classify__c__r ?? r.classify__c ?? '未分类';
    const subCategory = r.DetailedClassification__c__r ?? r.DetailedClassification__c ?? '未分类';
    if (EXCLUDE_SUB.has(subCategory)) continue;

    const key = `${category}||${subCategory}`;
    if (!groups.has(key)) {
      groups.set(key, { category, subCategory, entries: [] });
    }

    groups.get(key).entries.push({
      owner:     r.owner__r?.name ?? (Array.isArray(r.owner__l) ? r.owner__l[0]?.name : null) ?? '',
      customer:  r.Customer__c__r ?? r.Customer__c?.name ?? null,
      project:   r.project__c__r  ?? r.project__c?.name  ?? null,
      workgroup: r.implementation_workgroup__c__r ?? r.implementation_workgroup__c?.name ?? null,
      tasktime:  toNum(r.tasktime__c),
      content:   (r.remarks__c ?? '').trim(),
      date:      r.date__c__r ?? '',
    });
  }

  return [...groups.values()];
}

export async function generateJournalContent(groups, weekRange) {
  return buildContentByTemplate(groups, weekRange);
}

// ─── 模板渲染（纯文本） ─────────────────────────────────────────────────────

function buildContentByTemplate(groups, weekRange) {
  const overview = buildOverview(groups, weekRange);
  const blocks   = groups.map(buildGroupBlock);
  const workSummary = [overview, ...blocks].join('\n\n');
  return {
    workSummary,
    workDetail: workSummary,
    workPlan:   buildPlan(groups, weekRange),
  };
}

/**
 * 「本周概览」：总工时 / 客户数 / 项目数 / 工作组数 / 分类数
 * 已自动剔除"请假"等不展示分类
 */
function buildOverview(groups, weekRange) {
  const all = groups.flatMap(g => g.entries);

  const total      = all.reduce((s, e) => s + (e.tasktime || 0), 0);
  const customers  = new Set();
  const projects   = new Set();
  const workgroups = new Set();

  for (const e of all) {
    if (e.customer)  customers.add(e.customer);
    if (e.project)   projects.add(e.project);
    if (e.workgroup) workgroups.add(e.workgroup);
  }

  return [
    '【本周概览】',
    `- 周期：${weekRange}`,
    `- 总工时：${formatTime(total) || 0} h`,
    `- 涉及客户：${customers.size} 家`,
    `- 涉及项目：${projects.size} 个`,
    `- 涉及工作组：${workgroups.size} 个`,
    `- 工时分类：${groups.length} 类`,
  ].join('\n');
}

function buildGroupBlock(g) {
  const header = `【${g.category}】【${g.subCategory}】`;
  const lines  = renderEntries(g);
  return [header, '', ...lines].join('\n');
}

/**
 * 根据明细分类选择聚合策略
 */
function renderEntries(g) {
  switch (g.subCategory) {
    case '项目专属团队':
      return renderAggregated(g.entries, e => e.customer || e.project || '—', 'merge');

    case '实施工作组':
      return renderAggregated(g.entries, e => e.workgroup || '—', 'merge');

    case '区域/机构交付体系建设':
      return renderAggregated(g.entries, () => '__week__', 'merge', { showRef: false });

    case '学习培训':
      return renderAggregated(g.entries, () => '__week__', 'lines', { showRef: false });

    default:
      // 售前支持 / 售前POC 等：每条独立一行
      return g.entries.map(formatSingleLine);
  }
}

/**
 * 聚合渲染
 *
 * @param entries  原始明细
 * @param keyFn    聚合 key 提取函数
 * @param contentMode  'merge'：单条时内联；'lines'：多条时分行
 * @param opts.showRef  是否在标签里显示聚合 key（默认 true）
 */
function renderAggregated(entries, keyFn, contentMode, opts = {}) {
  const { showRef = true } = opts;
  const buckets = new Map();

  for (const e of entries) {
    const k = keyFn(e);
    if (!buckets.has(k)) buckets.set(k, { ref: k, owner: e.owner, time: 0, contents: [] });
    const b = buckets.get(k);
    b.time += e.tasktime;
    if (e.content) b.contents.push(e.content);
  }

  return [...buckets.values()].map(b => {
    const dedup  = dedupeStrings(b.contents);
    const time   = formatTime(b.time);
    const refTag = showRef && b.ref !== '__week__' ? `[${b.ref}]` : '';
    const tagPart = `[${b.owner || '—'}]${refTag}${time ? `[支持时长: ${time} ]` : ''}`;

    if (dedup.length === 0) {
      return `${tagPart}工作内容：—`;
    }
    if (dedup.length === 1 && contentMode !== 'lines') {
      return `${tagPart}工作内容：${dedup[0]}`;
    }
    // 多条：分行展示
    return [`${tagPart}工作内容：`, ...dedup.map(c => `- ${c}`)].join('\n');
  });
}

/**
 * 单条独立行（默认策略）
 */
function formatSingleLine(e) {
  const owner = e.owner || '—';
  const ref   = e.customer || e.project || e.workgroup;
  const time  = formatTime(e.tasktime);

  const parts = [`[${owner}]`];
  if (ref)  parts.push(`[${ref}]`);
  if (time) parts.push(`[支持时长: ${time} ]`);

  return `${parts.join('')}工作内容：${e.content || '—'}`;
}

function buildPlan(groups, weekRange) {
  const cats = [...new Set(groups.map(g => g.category))];
  const lines = [];
  if (cats.length > 0) {
    lines.push(`- 持续推进本周已启动事项，重点跟进：${cats.slice(0, 3).join('、')}。`);
  }
  lines.push('- 对跨部门协同与售前支持事项保持响应节奏，确保需求评估及时输出。');
  lines.push(`- 复盘本周期（${weekRange}）执行结果，识别后续待办与潜在风险。`);
  return ['【下周关注】', ...lines].join('\n');
}

// ─── helpers ────────────────────────────────────────────────────────────────

function dedupeStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const k = (s || '').replace(/\s+/g, '').toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTime(n) {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}
