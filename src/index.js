/**
 * 主入口：每周五 19:00 自动生成周日志并写入 JournalObj
 *
 * 用法：
 *   node src/index.js            # 正式执行
 *   node src/index.js --dry-run  # 只查询 + 渲染，不写入 CRM
 */

import 'dotenv/config';
import { fetchTimesheetDetails, resolveEmployeeIds } from './mcp-client.js';
import { groupByCategory, generateJournalContent } from './summarize.js';
import { writeWeeklyJournal } from './journal-writer.js';
import { sendFeishuText } from './feishu-notify.js';

const isDryRun = process.argv.includes('--dry-run');
const FEISHU_URL = process.env.FEISHU_WEBHOOK_URL;

// 点评人（多人逗号分隔，默认安春晖yak）
const REVIEWER_NAMES = (process.env.REVIEWER_NAMES ?? '安春晖yak')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

async function notifyFeishu(text) {
  try {
    await sendFeishuText(FEISHU_URL, text);
  } catch (e) {
    console.warn('[Feishu] 推送失败（不影响主流程）:', e.message);
  }
}

function nowShanghai() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function pickJournalMeta(result) {
  if (!result || typeof result !== 'object') return '';
  const d = result.data ?? result.result ?? result;
  const row = Array.isArray(d) ? d[0]
    : Array.isArray(d?.dataList) ? d.dataList[0]
      : d;
  if (!row || typeof row !== 'object') {
    const s = JSON.stringify(result).slice(0, 400);
    return s ? `\n返回摘要: ${s}` : '';
  }
  const parts = [];
  if (row._id) parts.push(`记录ID: ${row._id}`);
  if (row.name) parts.push(`编号: ${row.name}`);
  if (parts.length) return `\n${parts.join('\n')}`;
  return `\n返回摘要: ${JSON.stringify(row).slice(0, 400)}`;
}

async function main() {
  console.log('=== 周日志自动化任务启动 ===');
  console.log('触发时间:', nowShanghai());
  console.log('模式:', isDryRun ? 'dry-run（不写入CRM）' : '正式执行');

  validateEnv();

  // Step 1: 确定统计截止时间
  const endTime = process.env.OVERRIDE_END_TIME
    ? new Date(process.env.OVERRIDE_END_TIME)
    : new Date();

  const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
  console.log(`\n[Step 1] 统计窗口: ${formatISO(startTime)} ~ ${formatISO(endTime)}`);

  // Step 2: MCP 查询工时明细
  console.log('\n[Step 2] 查询工时明细...');
  const records = await fetchTimesheetDetails(endTime);
  console.log(`  命中 ${records.length} 条工时记录`);

  if (records.length === 0) {
    console.warn('  ⚠️  本周无工时数据，跳过写入。');
    await notifyFeishu(
      `【周日志】无工时数据，已跳过写入\n`
      + `时间: ${nowShanghai()}\n`
      + `窗口: ${formatISO(startTime)} ~ ${formatISO(endTime)}`,
    );
    return;
  }

  // Step 3: 分组
  console.log('\n[Step 3] 按工时大类/明细分类分组...');
  const groups = groupByCategory(records);
  console.log(`  共 ${groups.length} 个分组:`,
    groups.map(g => `${g.category}/${g.subCategory}`).join(', '));

  // Step 4: 纯文本模板渲染
  const weekRange = `${formatISO(startTime).slice(0, 10)} ~ ${formatISO(endTime).slice(0, 16).replace('T', ' ')}`;
  console.log('\n[Step 4] 模板渲染中...');
  const { workSummary, workPlan, workDetail } = await generateJournalContent(groups, weekRange);

  console.log('\n--- 本期总结 ---\n', workSummary);
  console.log('\n--- 分组明细 ---\n', workDetail);
  console.log('\n--- 下期计划 ---\n', workPlan);

  // Step 5: 解析点评人 ID
  console.log('\n[Step 5] 解析点评人:', REVIEWER_NAMES.join('、'));
  const reviewerIds = REVIEWER_NAMES.length > 0
    ? await resolveEmployeeIds(REVIEWER_NAMES)
    : [];
  if (reviewerIds.length === 0) {
    console.warn('  ⚠️  未解析到任何点评人 ID，将不写入 multi_comment_by 字段。');
  }

  // Step 6: 写入 JournalObj
  console.log('\n[Step 6] 写入 JournalObj...');
  const writeResult = await writeWeeklyJournal({
    endTime,
    workSummary,
    workPlan,
    workDetail,
    reviewerIds,
    dryRun: isDryRun,
  });

  console.log('\n=== 任务完成 ===');

  const modeLine = isDryRun ? '模式: dry-run（未写 CRM）' : '模式: 已写入 CRM';
  await notifyFeishu(
    `【周日志】执行成功\n`
    + `${modeLine}\n`
    + `时间: ${nowShanghai()}\n`
    + `周期: ${weekRange}\n`
    + `工时条数: ${records.length}，分组数: ${groups.length}\n`
    + `点评人: ${REVIEWER_NAMES.join('、')}${isDryRun ? '' : pickJournalMeta(writeResult)}`,
  );
}

function validateEnv() {
  if (!process.env.MCP_TOKEN) {
    console.error('缺少必要环境变量: MCP_TOKEN');
    process.exit(1);
  }
}

function formatISO(d) {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

main().catch(async err => {
  console.error('\n[ERROR]', err);
  await notifyFeishu(
    `【周日志】执行失败\n`
    + `时间: ${nowShanghai()}\n`
    + `错误: ${err?.message ?? String(err)}\n`
    + `${err?.stack ? err.stack.slice(0, 1200) : ''}`,
  );
  process.exit(1);
});
