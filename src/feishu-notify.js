/**
 * 飞书群机器人 Webhook（v2）文本消息
 * https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 */

const MAX_TEXT = 14000;

/**
 * @param {string | undefined | null} webhookUrl
 * @param {string} text
 */
export async function sendFeishuText(webhookUrl, text) {
  const url = (webhookUrl ?? '').trim();
  if (!url) {
    console.log('[Feishu] 未配置 FEISHU_WEBHOOK_URL，跳过通知');
    return { skipped: true };
  }

  const bodyText = truncate(text, MAX_TEXT);
  const resp = await fetch(url, {
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

  console.log('[Feishu] 通知已发送');
  return { ok: true, parsed };
}

function truncate(str, max) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 50)}\n...(已截断，共 ${s.length} 字)`;
}
