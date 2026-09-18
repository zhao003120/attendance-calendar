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

// ===== Cron: 每天早上 8:00 和前一天晚上 20:00 检查 =====
function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 每天晚上 20:00 检查明天的备忘（提前提醒）
cron.schedule('0 20 * * *', async () => {
  console.log('[CRON] 运行前一晚提醒检查...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = getDateKey(tomorrow);
  const data = loadMemos();
  const memos = data[dateKey] || [];
  for (const m of memos) {
    if (m.reminder && m.email && m.reminderTime === 'eve') {
      await sendReminderEmail(
        m.email,
        `明日备忘提醒 - ${dateKey}`,
        `明天(${dateKey})您有以下备忘：\n\n${m.content}`
      );
    }
  }
});

// 每天早上 8:00 检查今天的备忘（当天提醒）
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] 运行当天早上提醒检查...');
  const today = new Date();
  const dateKey = getDateKey(today);
  const data = loadMemos();
  const memos = data[dateKey] || [];
  for (const m of memos) {
    if (m.reminder && m.email && (m.reminderTime === 'morning' || !m.reminderTime)) {
      await sendReminderEmail(
        m.email,
        `今日备忘提醒 - ${dateKey}`,
        `今天(${dateKey})您有以下备忘：\n\n${m.content}`
      );
    }
  }
});

app.listen(PORT, () => {
  console.log(`===== 考勤日历服务已启动 =====`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`SMTP: ${SMTP_USER ? '已配置' : '未配置（邮件提醒不可用）'}`);
  console.log(`提醒节点: 每天 08:00（当天提醒）, 20:00（前一晚提醒）`);
  console.log(`================================`);
});
