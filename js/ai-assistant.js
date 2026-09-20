/**
 * AI 悬浮窗助手 - 自然语言添加备忘
 * 支持单条/多条备忘创建
 */

let aiChatOpen = false;
let aiMessages = [];

function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const btn = document.getElementById('ai-fab');
  aiChatOpen = !aiChatOpen;
  if (aiChatOpen) {
    panel.classList.add('show');
    btn.classList.add('active');
    if (aiMessages.length === 0) {
      addChatMessage('ai', '你好！我是智能备忘助手，可以用自然语言创建备忘。\n\n例如：\n• 10月1日提醒我放假，邮箱1206150621@qq.com\n• 9月25日到27日每天提醒早起\n• 明天提醒我开会\n• 工作日每天提醒打卡');
    }
    setTimeout(() => document.getElementById('ai-input').focus(), 300);
  } else {
    panel.classList.remove('show');
    btn.classList.remove('active');
  }
}

function addChatMessage(role, text) {
  aiMessages.push({ role, text });
  const container = document.getElementById('ai-messages');
  const msg = document.createElement('div');
  msg.className = `chat-msg chat-${role}`;
  msg.innerHTML = `<div class="chat-bubble">${escapeChatHtml(text)}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function escapeChatHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML.replace(/\n/g, '<br>');
}

async function sendChatMessage() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';

  // 显示"思考中"
  addChatMessage('ai', '正在分析并创建备忘...');

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();

    // 移除"正在分析"的占位消息
    const container = document.getElementById('ai-messages');
    container.removeChild(container.lastChild);
    aiMessages.pop();

    if (data.ok) {
      addChatMessage('ai', data.reply);
      await preloadMonthMemos(currentDate.getFullYear(), currentDate.getMonth());
      refresh();
    } else {
      addChatMessage('ai', '创建失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    const container = document.getElementById('ai-messages');
    container.removeChild(container.lastChild);
    aiMessages.pop();
    addChatMessage('ai', '服务连接失败，请确保服务已启动。');
  }
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

/**
 * 自然语言解析器
 * 支持格式：
 *   - 10月1日 / 10月1号
 *   - 9月25日到27日 / 9月25日至9月27日
 *   - 今天 / 明天 / 后天 / 大后天
 *   - 每天 / 工作日 / 周末
 *   - 邮箱提取
 *   - 提醒时间：前一天 / 当天 / 都要
 */
function parseMemoCommand(input) {
  const now = new Date();
  const year = now.getFullYear();

  const emailMatch = input.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';

  const wantsReminder = /提醒|通知|邮件|发邮|邮箱/.test(input) || !!email;

  let reminderTime = 'morning';
  if (/前一天|前一晚|提前一天|晚上|前一日/.test(input)) {
    reminderTime = 'eve';
  }
  if (/都要|两个都|前一天.*当天|当天.*前一天/.test(input)) {
    reminderTime = 'both';
  }

  let dates = [];

  // 1. 跨月日期范围：X月X日到Y月Y日
  const crossMonthRange = input.match(/(\d{1,2})月(\d{1,2})日?[到至](\d{1,2})月(\d{1,2})日?/);
  if (crossMonthRange) {
    const [, m1, d1, m2, d2] = crossMonthRange;
    dates = buildDateRange(year, parseInt(m1) - 1, parseInt(d1), parseInt(m2) - 1, parseInt(d2));
  }

  // 2. 同月日期范围：X月X日到Y日
  if (!dates.length) {
    const sameMonthRange = input.match(/(\d{1,2})月(\d{1,2})日?[到至](\d{1,2})日?/);
    if (sameMonthRange) {
      const [, m, d1, d2] = sameMonthRange;
      dates = buildDateRange(year, parseInt(m) - 1, parseInt(d1), parseInt(m) - 1, parseInt(d2));
    }
  }

  // 3. 多个独立日期：X月X日、Y月Y日
  if (!dates.length) {
    const multiDates = [...input.matchAll(/(\d{1,2})月(\d{1,2})日?/g)];
    if (multiDates.length) {
      dates = multiDates.map(m => new Date(year, parseInt(m[1]) - 1, parseInt(m[2])));
    }
  }

  // 4. 相对日期
  if (!dates.length) {
    if (/今天|今日/.test(input)) dates.push(new Date(now));
    if (/明天|明日/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 1));
    if (/后天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 2));
    if (/大后天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 3));
    if (/昨天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() - 1));
  }

  // 5. 每天 / 每日
  if (!dates.length && /每天|每日|天天/.test(input)) {
    const days = parseInt(input.match(/(\d+)天/)?.[1] || '30');
    const maxDays = Math.min(days, 90);
    for (let i = 0; i < maxDays; i++) {
      dates.push(new Date(year, now.getMonth(), now.getDate() + i));
    }
  }

  // 6. 工作日每天
  if (!dates.length && /工作日/.test(input) && /每天|每日|每天/.test(input)) {
    for (let i = 0; i < 365; i++) {
      const d = new Date(year, now.getMonth(), now.getDate() + i);
      if (d.getFullYear() > year) break;
      const type = getDayType(d.getFullYear(), d.getMonth(), d.getDate());
      if (type === 'workday' || type === 'workmakeup') dates.push(d);
    }
  }

  // 7. 周末每天
  if (!dates.length && /周末|休息日/.test(input) && /每天|每日/.test(input)) {
    for (let i = 0; i < 365; i++) {
      const d = new Date(year, now.getMonth(), now.getDate() + i);
      if (d.getFullYear() > year) break;
      const type = getDayType(d.getFullYear(), d.getMonth(), d.getDate());
      if (type === 'weekend') dates.push(d);
    }
  }

  // 8. 每周X
  if (!dates.length) {
    const weekDayMatch = input.match(/每周([一二三四五六日天])/);
    if (weekDayMatch) {
      const weekMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
      const targetDow = weekMap[weekDayMatch[1]];
      for (let i = 0; i < 365; i++) {
        const d = new Date(year, now.getMonth(), now.getDate() + i);
        if (d.getFullYear() > year) break;
        if (d.getDay() === targetDow) dates.push(d);
      }
    }
  }

  // 提取内容
  let content = input;

  // 如果有冒号，取冒号后的内容
  const colonMatch = input.match(/[：:]\s*(.+)/);
  if (colonMatch) {
    content = colonMatch[1];
  } else {
    // 移除已知模式
    content = content
      .replace(/(\d{1,2})月(\d{1,2})日?/g, '')
      .replace(/(\d{1,2})月/g, '')
      .replace(/(\d{1,2})日/g, '')
      .replace(/[到至]/g, '')
      .replace(/今天|今日|明天|明日|后天|大后天|昨天/g, '')
      .replace(/每天|每日|天天|工作日|周末|休息日/g, '')
      .replace(/每周[一二三四五六日天]/g, '')
      .replace(/提醒|通知|邮件|发邮|邮箱/g, '')
      .replace(/前一天|前一晚|提前一天|前一日|晚上/g, '')
      .replace(/当天|早上|都要|两个都/g, '')
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
      .replace(/[，。、：:帮我把添加设置安排请让代为记下记录个份]/g, ' ')
      .replace(/\d+天/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 清理内容中的邮箱
  content = content.replace(/[\w.-]+@[\w.-]+\.\w+/g, '').trim();

  return {
    dates: dates.filter(d => d.getFullYear() === year),
    content,
    email,
    reminder: wantsReminder && !!email,
    reminderTime,
  };
}

function buildDateRange(year, m1, d1, m2, d2) {
  const dates = [];
  const start = new Date(year, m1, d1);
  const end = new Date(year, m2, d2);
  if (start > end) return [start];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ai-input').addEventListener('keydown', handleChatKeydown);
});
