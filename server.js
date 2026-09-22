const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

const app = express();
const PORT = process.env.PORT || 6000;

const DATA_FILE = path.join(__dirname, 'data', 'memos.json');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

app.use(express.json());
app.use(express.static(__dirname));

// ===== Config =====
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

function loadMemos() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}

function saveMemos(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== API =====
app.get('/api/memos/:dateKey', (req, res) => {
  const data = loadMemos();
  res.json(data[req.params.dateKey] || []);
});

app.get('/api/memos', (req, res) => {
  res.json(loadMemos());
});

app.post('/api/memos/:dateKey', (req, res) => {
  const { dateKey } = req.params;
  const { memos } = req.body;
  const data = loadMemos();
  if (!memos || !memos.length) {
    delete data[dateKey];
  } else {
    data[dateKey] = memos;
  }
  saveMemos(data);
  res.json({ ok: true });
});

app.delete('/api/memos/:dateKey/:memoId', (req, res) => {
  const { dateKey, memoId } = req.params;
  const data = loadMemos();
  if (data[dateKey]) {
    data[dateKey] = data[dateKey].filter(m => m.id !== memoId);
    if (!data[dateKey].length) delete data[dateKey];
    saveMemos(data);
  }
  res.json({ ok: true });
});

app.post('/api/send-test', async (req, res) => {
  const { email, content, dateKey } = req.body;
  if (!email || !content) {
    return res.json({ ok: false, error: '缺少邮箱或内容' });
  }
  const ok = await sendReminderEmail(
    email,
    `备忘提醒 - ${dateKey}`,
    `您有一条备忘提醒：\n\n${content}`
  );
  res.json({ ok });
});

// ===== Email transporter =====
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendReminderEmail(to, subject, text) {
  const t = getTransporter();
  if (!t) {
    console.log(`[MAIL] 邮件未配置，跳过发送: ${to} - ${subject}`);
    return false;
  }
  try {
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px;">
        <h2 style="color:#6366f1;">考勤日历提醒</h2>
        <p style="font-size:14px;color:#333;">${text}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
        <p style="font-size:12px;color:#999;">此邮件由考勤日历系统自动发送</p>
      </div>`,
    });
    console.log(`[MAIL] 发送成功: ${to} - ${subject}`);
    return true;
  } catch (err) {
    console.error(`[MAIL] 发送失败: ${to}`, err.message);
    return false;
  }
}

// ===== Cron: 每分钟检查自定义提醒时间 =====
function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeReminderTime(m) {
  const rt = m.reminderTime;
  if (rt === 'morning' || !rt) return { time: '08:00', daysBefore: 0 };
  if (rt === 'eve') return { time: '20:00', daysBefore: 1 };
  if (rt === 'both') return [{ time: '08:00', daysBefore: 0 }, { time: '20:00', daysBefore: 1 }];
  if (typeof rt === 'string' && rt.includes(':')) {
    return { time: rt, daysBefore: m.reminderDaysBefore || 0 };
  }
  return { time: '08:00', daysBefore: 0 };
}

const sentReminders = new Set();
function cleanSentReminders() {
  if (sentReminders.size > 10000) sentReminders.clear();
}

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;
  const allMemos = loadMemos();

  for (const [dateKey, memos] of Object.entries(allMemos)) {
    for (const m of memos) {
      if (!m.reminder || !m.email) continue;

      const normalized = normalizeReminderTime(m);
      const entries = Array.isArray(normalized) ? normalized : [normalized];

      for (const { time, daysBefore } of entries) {
        if (time !== currentTime) continue;

        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysBefore);
        const targetKey = getDateKey(targetDate);

        if (targetKey !== dateKey) continue;

        const sentKey = `${dateKey}_${m.id}_${time}_${daysBefore}_${now.toDateString()}`;
        if (sentReminders.has(sentKey)) continue;

        const isAdvance = daysBefore > 0;
        const subject = isAdvance
          ? `备忘提醒 - ${dateKey}（提前${daysBefore}天）`
          : `备忘提醒 - ${dateKey}`;
        const text = isAdvance
          ? `${dateKey}您有以下备忘（提前${daysBefore}天提醒）：\n\n${m.content}`
          : `${dateKey}您有以下备忘：\n\n${m.content}`;

        console.log(`[CRON] 发送提醒: ${m.email} | ${dateKey} | ${time} | 提前${daysBefore}天`);
        await sendReminderEmail(m.email, subject, text);
        sentReminders.add(sentKey);
      }
    }
  }
  cleanSentReminders();
});

app.listen(PORT, () => {
  console.log(`===== 考勤日历服务已启动 =====`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`SMTP: ${SMTP_USER ? '已配置' : '未配置（邮件提醒不可用）'}`);
  console.log(`DeepSeek AI: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置'}`);
  console.log(`提醒节点: 每分钟检查自定义时间触发`);
  console.log(`================================`);
});

// ===== DeepSeek AI Chat API =====
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE || 'https://api.deepseek.com';

const SYSTEM_PROMPT = `你是考勤日历的智能备忘助手。用户会用自然语言告诉你想创建备忘，你需要解析出结构化数据。

当前日期：${new Date().toISOString().split('T')[0]}

你需要返回JSON格式（严格遵守），包含一个 memos 数组，每个元素：
{
  "date": "YYYY-MM-DD",
  "content": "备忘内容",
  "email": "邮箱地址（没有则空字符串）",
  "reminder": true/false,
  "reminderTime": "HH:MM",
  "reminderDaysBefore": 0
}

规则：
- reminderTime: 24小时制时间字符串，如 "08:00"、"20:30"、"14:00"
- reminderDaysBefore: 提前几天，0=当天提醒，1=前一天提醒，2=前两天提醒
- 如果用户提到具体时间如"下午3点""15:00"，直接用该时间
- 如果用户说"前一天""提前一天"，reminderDaysBefore=1
- 如果用户说"提前两天"，reminderDaysBefore=2
- 如果用户说"都要""前一天和当天"，只返回一条，reminderDaysBefore=0，reminderTime设为当天默认时间
- 默认 reminderTime="08:00", reminderDaysBefore=0
- 如果用户提到"提醒""通知""邮件"且提供了邮箱，reminder=true
- 日期范围（如"9月25日到27日"）要展开为多天，每天一条
- "工作日每天"展开为该年所有工作日
- "每天"展开为未来30天
- "每周X"展开为该年所有周X
- "今天""明天""后天"转为具体日期
- 只返回JSON，不要任何其他文字

示例：
用户: 10月1日下午3点提醒我放假，邮箱1206150621@qq.com
返回: {"memos":[{"date":"2026-10-01","content":"放假","email":"1206150621@qq.com","reminder":true,"reminderTime":"15:00","reminderDaysBefore":0}]}

用户: 10月1日提前一天晚上8点提醒我放假，邮箱1206150621@qq.com
返回: {"memos":[{"date":"2026-10-01","content":"放假","email":"1206150621@qq.com","reminder":true,"reminderTime":"20:00","reminderDaysBefore":1}]}

用户: 9月25日到27日每天提醒早起
返回: {"memos":[{"date":"2026-09-25","content":"早起","email":"","reminder":false,"reminderTime":"08:00","reminderDaysBefore":0},{"date":"2026-09-26","content":"早起","email":"","reminder":false,"reminderTime":"08:00","reminderDaysBefore":0},{"date":"2026-09-27","content":"早起","email":"","reminder":false,"reminderTime":"08:00","reminderDaysBefore":0}]}`;

app.post('/api/ai-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ ok: false, error: '消息为空' });

  if (!DEEPSEEK_API_KEY) {
    return res.json({ ok: false, error: 'DeepSeek API Key 未配置' });
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DeepSeek] API error:', response.status, errText);
      return res.json({ ok: false, error: `DeepSeek API 错误: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 提取JSON
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.json({ ok: false, error: 'AI返回格式异常', raw: content });
    }

    const memos = parsed.memos || [];
    if (!memos.length) {
      return res.json({ ok: true, created: 0, memos: [], reply: '未能识别出备忘信息，请尝试更明确的描述。' });
    }

    // 保存到数据文件
    const allMemos = loadMemos();
    let created = 0;
    for (const m of memos) {
      if (!m.date || !m.content) continue;
      if (!allMemos[m.date]) allMemos[m.date] = [];
      allMemos[m.date].push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        content: m.content,
        email: m.email || '',
        reminder: m.reminder || false,
        reminderTime: m.reminderTime || '08:00',
        reminderDaysBefore: m.reminderDaysBefore || 0,
      });
      created++;
    }
    saveMemos(allMemos);

    // 生成回复
    const dateList = [...new Set(memos.map(m => m.date))];
    let reply = `已创建 ${created} 条备忘\n`;
    reply += `日期：${dateList.length === 1 ? dateList[0] : `${dateList[0]} ~ ${dateList[dateList.length - 1]}`}\n`;
    reply += `内容：${memos[0].content}`;
    if (memos[0].email && memos[0].reminder) {
      const rt = memos[0].reminderTime || '08:00';
      const db = memos[0].reminderDaysBefore || 0;
      const dayLabel = db === 0 ? '当天' : `提前${db}天`;
      reply += `\n邮件提醒：${memos[0].email}（${dayLabel} ${rt}）`;
    }

    res.json({ ok: true, created, memos, reply });
  } catch (err) {
    console.error('[DeepSeek] request error:', err.message);
    res.json({ ok: false, error: '请求失败: ' + err.message });
  }
});
