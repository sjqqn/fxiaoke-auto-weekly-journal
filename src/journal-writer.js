/**
 * JournalObj 写入模块
 *
 * 负责：
 * 1. 计算 journal_time（本周周四日期，格式 yyyyMMdd）
 * 2. 构建 object_data
 * 3. 调用 MCP CreateRecordsByData
 */

import { createJournal } from './mcp-client.js';

/**
 * @param {Date}     endTime       周五 19:00（任务触发时间）
 * @param {string}   workSummary   本期总结（rich_text → 传纯文本）
 * @param {string}   workPlan      下期计划
 * @param {string}   workDetail    分组明细正文（本周工作内容字段）
 * @param {string[]} reviewerIds   点评人员工 ID 列表（写入 multi_comment_by）
 * @param {boolean}  dryRun        true 时只打印不写入
 */
export async function writeWeeklyJournal({
  endTime,
  workSummary,
  workPlan,
  workDetail,
  reviewerIds = [],
  dryRun = false,
}) {
  const { beginDate, endDate, journalTime, weekLabel } = calcWeekMeta(endTime);

  const objectData = {
    // 汇报周期：周日志固定 weekly
    period_type: 'weekly',
    // 业务类型：周计划
    record_type: 'default_week__c',

    // 时间锚点：本周周四日期 yyyyMMdd
    journal_time: journalTime,

    // 日志日期范围（date_time 字段需毫秒时间戳字符串）
    journal_begin_date: String(beginDate.getTime()),
    journal_end_date:   String(endDate.getTime()),

    // 正文
    work_summary:   workSummary,
    work_plan:      workPlan,
    field_KkHJK__c: workDetail,
  };

  // 点评人（employee_many：传字符串 ID 数组）
  if (reviewerIds.length > 0) {
    objectData.multi_comment_by = reviewerIds;
  }

  console.log(`\n[Journal] 准备写入周日志 —— ${weekLabel}`);
  console.log('[Journal] object_data:', JSON.stringify(objectData, null, 2));

  if (dryRun) {
    console.log('[Journal] dry-run 模式，跳过 MCP 写入。');
    return { dryRun: true, weekLabel };
  }

  const result = await createJournal(objectData);
  console.log('[Journal] 写入成功:', result);
  return result;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * 根据 endTime（任务触发时间）计算周日志元数据
 *
 * 与取数窗口对齐：begin = endTime - 7 天，end = endTime
 * journal_time：取窗口中的周四日期（CRM 周报用周四作时间锚点）
 */
function calcWeekMeta(endTime) {
  // begin = 7 天前的 00:00:00
  const beginDate = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
  beginDate.setHours(0, 0, 0, 0);

  // 找窗口内的周四作为锚点：
  //   从 beginDate 起向后扫，第一个 weekday=4 的日期即为本周周四
  const thursday = new Date(beginDate);
  while (thursday.getDay() !== 4) {
    thursday.setDate(thursday.getDate() + 1);
  }

  const journalTime = formatDateCompact(thursday);
  const weekLabel   = `${formatDateDash(beginDate)} ~ ${formatDateDash(endTime)}`;

  return {
    beginDate,
    endDate: endTime,
    journalTime,
    weekLabel,
  };
}

/** Date → 'yyyyMMdd' */
function formatDateCompact(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Date → 'YYYY-MM-DD' */
function formatDateDash(d) {
  return d.toISOString().slice(0, 10);
}
