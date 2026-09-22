/**
 * AI 悬浮窗助手 - 自然语言添加备忘
 * 支持单条/多条备忘创建
 * 聊天历史 localStorage 持久化
 */

let aiChatOpen = false;
let aiMessages = [];
const AI_CHAT_STORAGE_KEY = 'ai_chat_history';

function loadChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(AI_CHAT_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveChatHistory() {
  try {
    localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(aiMessages.slice(-100)));
  } catch {}
}

function renderChatHistory() {
  const container = document.getElementById('ai-messages');
  container.innerHTML = '';
  aiMessages.forEach(msg => {
    const el = document.createElement('div');
    el.className = `chat-msg chat-${msg.role}`;
    el.innerHTML = `<div class="chat-bubble">${escapeChatHtml(msg.text)}</div>`;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const btn = document.getElementById('ai-fab');
  aiChatOpen = !aiChatOpen;
  if (aiChatOpen) {
    panel.classList.add('show');
    btn.classList.add('active');
    if (aiMessages.length === 0) {
      aiMessages = loadChatHistory();
      if (aiMessages.length === 0) {
        addChatMessage('ai', '你好！我是智能备忘助手，可以用自然语言创建备忘。\n\n例如：\n• 10月1日提醒我放假，邮箱1206150621@qq.com\n• 9月25日到27日每天提醒早起\n• 明天提醒我开会\n• 工作日每天提醒打卡');
      } else {
        renderChatHistory();
      }
    }
    setTimeout(() => document.getElementById('ai-input').focus(), 300);
  } else {
    panel.classList.remove('show');
    btn.classList.remove('active');
  }
}

function addChatMessage(role, text) {
  aiMessages.push({ role, text });
  saveChatHistory();
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

function removeLastChatMessage() {
  aiMessages.pop();
  saveChatHistory();
  const container = document.getElementById('ai-messages');
  if (container.lastChild) container.removeChild(container.lastChild);
}

async function sendChatMessage() {
  const input = document.getElementById('ai-input');
  const text = input.value.trim();
  if (!text) return;

  addChatMessage('user', text);
  input.value = '';

  addChatMessage('ai', '正在分析并创建备忘...');

  try {
    const res = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();

    removeLastChatMessage();

    if (data.ok) {
      addChatMessage('ai', data.reply);
      await preloadMonthMemos(currentDate.getFullYear(), currentDate.getMonth());
      refresh();
    } else {
      addChatMessage('ai', '创建失败：' + (data.error || '未知错误'));
    }
  } catch (err) {
    removeLastChatMessage();
    addChatMessage('ai', '服务连接失败，请确保服务已启动。');
  }
}

function clearChatHistory() {
  aiMessages = [];
  localStorage.removeItem(AI_CHAT_STORAGE_KEY);
  addChatMessage('ai', '聊天记录已清空。可以用自然语言创建备忘。\n\n例如：\n• 10月1日提醒我放假，邮箱1206150621@qq.com\n• 明天提醒我开会');
}

function handleChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

/**
 * 自然语言解析器（备用，AI 不可用时前端兜底）
 */
function parseMemoCommand(input) {
  const now = new Date();
  const year = now.getFullYear();

  const emailMatch = input.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';

  const wantsReminder = /提醒|通知|邮件|发邮|邮箱/.test(input) || !!email;

  let reminderTime = '08:00';
  let reminderDaysBefore = 0;

  const timeMatch = input.match(/(?:下午|傍晚)\s*(\d{1,2})\s*[点时:：](\d{0,2})/) ;
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const min = timeMatch[2] ? parseInt(timeMatch[2].padEnd(2, '0')) : 0;
    if (/下午|傍晚/.test(input) && hour < 12) hour += 12;
    reminderTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  } else {
    const directTimeMatch = input.match(/(\d{1,2}):(\d{2})/);
    if (directTimeMatch) {
      reminderTime = `${directTimeMatch[1].padStart(2, '0')}:${directTimeMatch[2]}`;
    } else {
      const hourMatch = input.match(/上午\s*(\d{1,2})\s*[点时]/);
      if (hourMatch) {
        reminderTime = `${hourMatch[1].padStart(2, '0')}:00`;
      }
    }
  }

  if (/前一天|前一晚|提前一天|前一日/.test(input)) {
    reminderDaysBefore = 1;
  }
  if (/提前两天|前两天|提前二天/.test(input)) {
    reminderDaysBefore = 2;
  }

  let dates = [];

  const crossMonthRange = input.match(/(\d{1,2})月(\d{1,2})日?[到至](\d{1,2})月(\d{1,2})日?/);
  if (crossMonthRange) {
    const [, m1, d1, m2, d2] = crossMonthRange;
    dates = buildDateRange(year, parseInt(m1) - 1, parseInt(d1), parseInt(m2) - 1, parseInt(d2));
  }

  if (!dates.length) {
    const sameMonthRange = input.match(/(\d{1,2})月(\d{1,2})日?[到至](\d{1,2})日?/);
    if (sameMonthRange) {
      const [, m, d1, d2] = sameMonthRange;
      dates = buildDateRange(year, parseInt(m) - 1, parseInt(d1), parseInt(m) - 1, parseInt(d2));
    }
  }

  if (!dates.length) {
    const multiDates = [...input.matchAll(/(\d{1,2})月(\d{1,2})日?/g)];
    if (multiDates.length) {
      dates = multiDates.map(m => new Date(year, parseInt(m[1]) - 1, parseInt(m[2])));
    }
  }

  if (!dates.length) {
    if (/今天|今日/.test(input)) dates.push(new Date(now));
    if (/明天|明日/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 1));
    if (/后天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 2));
    if (/大后天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() + 3));
    if (/昨天/.test(input)) dates.push(new Date(year, now.getMonth(), now.getDate() - 1));
  }

  if (!dates.length && /每天|每日|天天/.test(input)) {
    const days = parseInt(input.match(/(\d+)天/)?.[1] || '30');
    const maxDays = Math.min(days, 90);
    for (let i = 0; i < maxDays; i++) {
      dates.push(new Date(year, now.getMonth(), now.getDate() + i));
    }
  }

  if (!dates.length && /工作日/.test(input) && /每天|每日|每天/.test(input)) {
    for (let i = 0; i < 365; i++) {
      const d = new Date(year, now.getMonth(), now.getDate() + i);
      if (d.getFullYear() > year) break;
      const type = getDayType(d.getFullYear(), d.getMonth(), d.getDate());
      if (type === 'workday' || type === 'workmakeup') dates.push(d);
    }
  }

  if (!dates.length && /周末|休息日/.test(input) && /每天|每日/.test(input)) {
    for (let i = 0; i < 365; i++) {
      const d = new Date(year, now.getMonth(), now.getDate() + i);
      if (d.getFullYear() > year) break;
      const type = getDayType(d.getFullYear(), d.getMonth(), d.getDate());
      if (type === 'weekend') dates.push(d);
    }
  }

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

  let content = input;

  const colonMatch = input.match(/[：:]\s*(.+)/);
  if (colonMatch) {
    content = colonMatch[1];
  } else {
    content = content
      .replace(/(\d{1,2})月(\d{1,2})日?/g, '')
      .replace(/(\d{1,2})月/g, '')
      .replace(/(\d{1,2})日/g, '')
      .replace(/[到至]/g, '')
      .replace(/今天|今日|明天|明日|后天|大后天|昨天/g, '')
      .replace(/每天|每日|天天|工作日|周末|休息日/g, '')
      .replace(/每周[一二三四五六日天]/g, '')
      .replace(/提醒|通知|邮件|发邮|邮箱/g, '')
      .replace(/前一天|前一晚|提前一天|前一日|晚上|提前两天|前两天|提前二天/g, '')
      .replace(/当天|早上|都要|两个都/g, '')
      .replace(/上午|下午|傍晚/g, '')
      .replace(/\d{1,2}[:：]\d{2}/g, '')
      .replace(/\d{1,2}\s*[点时]\d{0,2}/g, '')
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
      .replace(/[，。、：:帮我把添加设置安排请让代为记下记录个份]/g, ' ')
      .replace(/\d+天/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  content = content.replace(/[\w.-]+@[\w.-]+\.\w+/g, '').trim();

  return {
    dates: dates.filter(d => d.getFullYear() === year),
    content,
    email,
    reminder: wantsReminder && !!email,
    reminderTime,
    reminderDaysBefore,
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

async function showMemoHistory() {
  document.getElementById('ai-messages').style.display = 'none';
  document.querySelector('.ai-chat-input-area').style.display = 'none';
  const panel = document.getElementById('ai-history-panel');
  panel.classList.add('show');
  const list = document.getElementById('ai-history-list');
  list.innerHTML = '<div class="ai-history-empty">加载中...</div>';

  try {
    const res = await fetch('/api/memos');
    const allMemos = await res.json();
    const entries = Object.entries(allMemos).sort((a, b) => b[0].localeCompare(a[0]));

    if (!entries.length) {
      list.innerHTML = '<div class="ai-history-empty">暂无备忘记录</div>';
      return;
    }

    list.innerHTML = entries.map(([date, memos]) => {
      const items = memos.map(m => {
        const tags = [];
        if (m.email) tags.push(`📧 ${m.email}`);
        if (m.reminder) {
          const rt = m.reminderTime || '';
          const db = m.reminderDaysBefore || 0;
          const dayLabel = db === 0 ? '当天' : `提前${db}天`;
          const timeStr = rt.includes(':') ? rt : (rt === 'eve' ? '20:00' : rt === 'both' ? '08:00+20:00' : '08:00');
          tags.push(`🔔 ${dayLabel} ${timeStr}`);
        }
        return `<div class="ai-history-item">
          <div class="ai-history-content">${escapeChatHtml(m.content || '(无内容)')}</div>
          ${tags.length ? `<div class="ai-history-meta">${tags.join(' ')}</div>` : ''}
        </div>`;
      }).join('');
      return `<div class="ai-history-date">${date}</div>${items}`;
    }).join('');
  } catch {
    list.innerHTML = '<div class="ai-history-empty">加载失败，请确保服务已启动</div>';
  }
}

function hideMemoHistory() {
  document.getElementById('ai-messages').style.display = '';
  document.querySelector('.ai-chat-input-area').style.display = '';
  document.getElementById('ai-history-panel').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ai-input').addEventListener('keydown', handleChatKeydown);
});
