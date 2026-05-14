/**
 * 飞书群机器人 Webhook（v2）文本消息
 * https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 */

/** 单条文本上限（字符）；超长则拆成多条依次发送 */
const MAX_CHUNK = 15000;
/** 分片之间间隔，降低限频风险 */
const CHUNK_GAP_MS = 250;

/**
 * 发送单条文本（过长则截断）
 * @param {string | undefined | null} webhookUrl
 * @param {string} text
 */
export async function sendFeishuText(webhookUrl, text) {
  const url = (webhookUrl ?? '').trim();
  if (!url) {
    console.log('[Feishu] 未配置 FEISHU_WEBHOOK_URL，跳过通知');
    return { skipped: true };
  }
  const r = await postFeishuOnce(url, truncate(String(text ?? ''), MAX_CHUNK), { logDone: false });
  if (!r.skipped) console.log('[Feishu] 通知已发送');
  return r;
}

/**
 * 发送完整文本；超过单条上限时自动拆成多条（带 1/N 页眉）
 * @param {string | undefined | null} webhookUrl
 * @param {string} text
 */
export async function sendFeishuTextChunks(webhookUrl, text) {
  const url = (webhookUrl ?? '').trim();
  if (!url) {
    console.log('[Feishu] 未配置 FEISHU_WEBHOOK_URL，跳过通知');
    return { skipped: true };
  }

  const full = String(text ?? '');
  const total = Math.max(1, Math.ceil(full.length / MAX_CHUNK));

  for (let i = 0; i < total; i++) {
    const slice = full.slice(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
    const header = total > 1 ? `【飞书分片 ${i + 1}/${total}】\n` : '';
    await postFeishuOnce(url, header + slice, { logDone: false });
    if (i < total - 1) {
      await sleep(CHUNK_GAP_MS);
    }
  }

  console.log(total > 1 ? `[Feishu] 已发送 ${total} 条通知（日志分片）` : '[Feishu] 通知已发送');
  return { ok: true, parts: total };
}

/**
 * @param {string} url
 * @param {string} bodyText
 * @param {{ logDone?: boolean }} opts
 */
async function postFeishuOnce(url, bodyText, opts = {}) {
  const { logDone = false } = opts;
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    console.log('[Feishu] 未配置 FEISHU_WEBHOOK_URL，跳过通知');
    return { skipped: true };
  }

  const resp = await fetch(trimmedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      msg_type: 'text',
      content:  { text: bodyText },
    }),
  });

  const raw = await resp.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (!resp.ok) {
      throw new Error(`Feishu HTTP ${resp.status}: ${raw.slice(0, 500)}`);
    }
    return { raw };
  }

  if (!resp.ok) {
    throw new Error(`Feishu HTTP ${resp.status}: ${raw.slice(0, 500)}`);
  }

  if (parsed.StatusCode !== undefined && parsed.StatusCode !== 0) {
    throw new Error(`Feishu 响应异常: ${raw.slice(0, 800)}`);
  }
  if (parsed.code !== undefined && parsed.code !== 0) {
    throw new Error(`Feishu 响应异常: ${raw.slice(0, 800)}`);
  }

  if (logDone) {
    console.log('[Feishu] 通知已发送');
  }
  return { ok: true, parsed };
}

function truncate(str, max) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 50)}\n...(已截断，共 ${s.length} 字)`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
