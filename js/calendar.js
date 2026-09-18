/**
 * 考勤日历核心逻辑
 * 版本：v2.0.0
 */

const APP_VERSION = 'v2.0.0';

const DAY_TYPES = {
  workday:    { label: '工作日',     short: '班', color: '#2563eb', bg: '#dbeafe' },
  weekend:    { label: '休息日',     short: '休', color: '#64748b', bg: '#e2e8f0' },
  holiday:    { label: '法定假日',   short: '假', color: '#dc2626', bg: '#fef2f2' },
  workmakeup: { label: '调休上班',   short: '调', color: '#d97706', bg: '#fffbeb' },
};

const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

let currentDate = new Date();
let activeFilter = null;

function pad2(n) { return String(n).padStart(2, '0'); }

function formatDateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function getDayType(year, month, day) {
  const key = formatDateKey(year, month, day);
  if (HOLIDAY_DATA[key]) return HOLIDAY_DATA[key].type;
  const dow = new Date(year, month, day).getDay();
  return (dow === 0 || dow === 6) ? 'weekend' : 'workday';
}

function getDayInfo(year, month, day) {
  const key = formatDateKey(year, month, day);
  const type = getDayType(year, month, day);
  const holidayInfo = HOLIDAY_DATA[key];
  return {
    day,
    type,
    label: holidayInfo ? holidayInfo.name : '',
    isToday: isSameDay(new Date(year, month, day), new Date()),
  };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getMonthDays(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  const dow = new Date(year, month, 1).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function calculateMonthStats(year, month) {
  const days = getMonthDays(year, month);
  const stats = {
    totalDays: days,
    workdays: 0,
    weekends: 0,
    holidays: 0,
    workmakeups: 0,
    attendanceDays: 0,
  };
  for (let d = 1; d <= days; d++) {
    const type = getDayType(year, month, d);
    if (type === 'workday') stats.workdays++;
    else if (type === 'weekend') stats.weekends++;
    else if (type === 'holiday') stats.holidays++;
    else if (type === 'workmakeup') stats.workmakeups++;
  }
  stats.attendanceDays = stats.workdays + stats.workmakeups;
  return stats;
}

function calculateYearStats(year) {
  const stats = {
    totalDays: 0,
    workdays: 0,
    weekends: 0,
    holidays: 0,
    workmakeups: 0,
    attendanceDays: 0,
  };
  for (let m = 0; m < 12; m++) {
    const ms = calculateMonthStats(year, m);
    stats.totalDays += ms.totalDays;
    stats.workdays += ms.workdays;
    stats.weekends += ms.weekends;
    stats.holidays += ms.holidays;
    stats.workmakeups += ms.workmakeups;
    stats.attendanceDays += ms.attendanceDays;
  }
  return stats;
}

function renderCalendar(year, month) {
  const container = document.getElementById('calendar-grid');
  container.innerHTML = '';

  const firstDow = getFirstDayOfWeek(year, month);
  const days = getMonthDays(year, month);

  for (let i = 0; i < firstDow; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    container.appendChild(cell);
  }

  for (let d = 1; d <= days; d++) {
    const info = getDayInfo(year, month, d);
    const cell = document.createElement('div');
    cell.className = `day-cell day-${info.type}`;
    cell.dataset.type = info.type;
    cell.dataset.day = d;
    if (info.isToday) cell.classList.add('today');

    const typeMeta = DAY_TYPES[info.type];

    cell.innerHTML = `
      <div class="day-num">${d}</div>
      <div class="day-badge">${typeMeta.short}</div>
      ${info.label ? `<div class="day-label">${info.label}</div>` : ''}
    `;
    const dateKey = formatDateKey(year, month, d);
    const memos = memoCache[dateKey] || [];
    if (memos.length) {
      cell.classList.add('has-memo');
      if (memos.some(m => m.reminder)) cell.classList.add('has-reminder');
    }
    container.appendChild(cell);
  }

  const totalCells = firstDow + days;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remaining; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    container.appendChild(cell);
  }
}

function renderStats(year, month) {
  const stats = calculateMonthStats(year, month);
  const yearStats = calculateYearStats(year);

  document.getElementById('stat-month').textContent = `${year}年${month + 1}月`;
  document.getElementById('stat-total').textContent = stats.totalDays;
  document.getElementById('stat-workday').textContent = stats.workdays;
  document.getElementById('stat-weekend').textContent = stats.weekends;
  document.getElementById('stat-holiday').textContent = stats.holidays;
  document.getElementById('stat-workmakeup').textContent = stats.workmakeups;
  document.getElementById('stat-attendance').textContent = stats.attendanceDays;

  document.getElementById('stat-year-attendance').textContent = yearStats.attendanceDays;
  document.getElementById('stat-year-holiday').textContent = yearStats.holidays;
  document.getElementById('stat-year-workmakeup').textContent = yearStats.workmakeups;
  document.getElementById('stat-year-total').textContent = yearStats.totalDays;
}

function renderHolidaySummary() {
  const tbody = document.getElementById('holiday-summary-body');
  tbody.innerHTML = '';
  HOLIDAY_SUMMARIES.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.name}</td>
      <td>${h.dates}</td>
      <td><span class="badge badge-holiday">${h.days}</span></td>
      <td>${h.makeup === '无' ? '<span class="text-muted">无</span>' : `<span class="badge badge-workmakeup">${h.makeup}</span>`}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateHeader(year, month) {
  document.getElementById('current-month').textContent = `${year}年 ${MONTH_LABELS[month]}`;
}

async function changeMonth(delta) {
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth() + delta;
  if (month < 0) { month = 11; year--; }
  else if (month > 11) { month = 0; year++; }
  currentDate = new Date(year, month, 1);
  await preloadMonthMemos(year, month);
  refresh();
}

async function goToToday() {
  currentDate = new Date();
  await preloadMonthMemos(currentDate.getFullYear(), currentDate.getMonth());
  refresh();
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function renderYearProgress() {
  const now = new Date();
  const year = now.getFullYear();
  const week = getISOWeek(now);
  const dayOfYear = getDayOfYear(now);
  const totalDays = isLeapYear(year) ? 366 : 365;
  const remaining = totalDays - dayOfYear;

  document.getElementById('yp-week').textContent = week;
  document.getElementById('yp-day').textContent = dayOfYear;
  document.getElementById('yp-remaining').textContent = remaining;
}

function toggleFilter(type) {
  if (type === 'all') {
    activeFilter = null;
  } else if (activeFilter === type) {
    activeFilter = null;
  } else {
    activeFilter = type;
  }
  applyFilter();
  updateFilterPills();
}

function applyFilter() {
  const cells = document.querySelectorAll('#calendar-grid .day-cell:not(.empty)');
  const filterTypes = activeFilter === 'attendance'
    ? ['workday', 'workmakeup']
    : activeFilter ? [activeFilter] : null;
  cells.forEach(cell => {
    if (filterTypes && !filterTypes.includes(cell.dataset.type)) {
      cell.classList.add('dimmed');
    } else {
      cell.classList.remove('dimmed');
    }
  });
}

function updateFilterPills() {
  document.querySelectorAll('.stat-pill.filter').forEach(pill => {
    const type = pill.dataset.type;
    const isActive = type === 'all' ? activeFilter === null : type === activeFilter;
    pill.classList.toggle('filter-active', isActive);
  });
}

function refresh() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  updateHeader(year, month);
  renderCalendar(year, month);
  renderStats(year, month);
  applyFilter();
}

async function init() {
  document.getElementById('app-version').textContent = APP_VERSION;
  renderHolidaySummary();
  renderYearProgress();

  await preloadMonthMemos(currentDate.getFullYear(), currentDate.getMonth());
  refresh();

  document.getElementById('calendar-grid').addEventListener('click', function(e) {
    const cell = e.target.closest('.day-cell:not(.empty)');
    if (!cell || !cell.dataset.day) return;
    const d = parseInt(cell.dataset.day);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const info = getDayInfo(year, month, d);
    const dateKey = formatDateKey(year, month, d);
    openMemo(dateKey, d, info);
  });

  document.getElementById('memo-modal').addEventListener('click', function(e) {
    if (e.target === this) closeMemo();
  });
}

async function preloadMonthMemos(year, month) {
  const days = getMonthDays(year, month);
  const promises = [];
  for (let d = 1; d <= days; d++) {
    const key = formatDateKey(year, month, d);
    if (!memoCache[key]) promises.push(fetchMemo(key));
  }
  await Promise.all(promises);
}

// ===== Memo functions (API + localStorage fallback) =====
const memoCache = {};
const useLocalFallback = location.protocol === 'file:';

function getLocalStore() {
  try { return JSON.parse(localStorage.getItem('calendar_memos') || '{}'); }
  catch { return {}; }
}

function saveLocalStore(store) {
  localStorage.setItem('calendar_memos', JSON.stringify(store));
}

async function fetchMemo(dateKey) {
  if (memoCache[dateKey]) return memoCache[dateKey];

  if (useLocalFallback) {
    const store = getLocalStore();
    memoCache[dateKey] = store[dateKey] || [];
    return memoCache[dateKey];
  }

  try {
    const res = await fetch(`/api/memos/${dateKey}`);
    const data = await res.json();
    memoCache[dateKey] = Array.isArray(data) ? data : [];
    return memoCache[dateKey];
  } catch {
    const store = getLocalStore();
    memoCache[dateKey] = store[dateKey] || [];
    return memoCache[dateKey];
  }
}

async function saveMemoToServer(dateKey, memos) {
  memoCache[dateKey] = memos;

  if (useLocalFallback) {
    const store = getLocalStore();
    if (memos.length) store[dateKey] = memos;
    else delete store[dateKey];
    saveLocalStore(store);
    return;
  }

  try {
    await fetch(`/api/memos/${dateKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memos }),
    });
  } catch (e) {
    const store = getLocalStore();
    if (memos.length) store[dateKey] = memos;
    else delete store[dateKey];
    saveLocalStore(store);
  }
}

function getMemoSync(dateKey) {
  return Array.isArray(memoCache[dateKey]) ? memoCache[dateKey] : [];
}

let currentMemoKey = null;
let editingMemoId = null;

async function openMemo(dateKey, day, info) {
  currentMemoKey = dateKey;
  editingMemoId = null;

  document.getElementById('memo-date').textContent = dateKey;
  document.getElementById('memo-day-info').textContent =
    `${DAY_TYPES[info.type].label}${info.label ? ' · ' + info.label : ''}`;
  document.getElementById('memo-list').innerHTML = '<div class="memo-empty">加载中...</div>';
  document.getElementById('memo-footer').style.display = 'none';
  document.getElementById('memo-modal').classList.add('show');

  await fetchMemo(dateKey);
  renderMemoList();
}

function renderMemoList() {
  const container = document.getElementById('memo-list');
  const memos = getMemoSync(currentMemoKey);

  if (!memos.length) {
    container.innerHTML = '<div class="memo-empty"></div>';
    return;
  }

  let html = '<div class="memo-list">';
  memos.forEach(m => {
    const timeLabel = m.reminderTime === 'eve' ? '前一晚 20:00' : m.reminderTime === 'morning' ? '当天 08:00' : m.reminderTime === 'both' ? '前一晚+当天' : '';
    html += `
      <div class="memo-item">
        <div class="memo-item-body">
          <div class="memo-item-content">${escapeHtml(m.content)}</div>
          <div class="memo-item-meta">
            ${m.email ? `<span class="memo-item-email">📧 ${escapeHtml(m.email)}</span>` : ''}
            ${m.reminder ? `<span class="memo-item-badge">🔔 邮件提醒${timeLabel ? ' · ' + timeLabel : ''}</span>` : ''}
          </div>
        </div>
        <div class="memo-item-actions">
          <button class="memo-edit-btn" onclick="startEditMemo('${m.id}')">✎ 编辑</button>
          <button class="memo-del-btn" onclick="deleteMemoItem('${m.id}')">🗑 删除</button>
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function startNewMemo() {
  editingMemoId = null;
  showMemoForm('', '', false, 'morning');
}

function startEditMemo(id) {
  const memos = getMemoSync(currentMemoKey);
  const m = memos.find(x => x.id === id);
  if (!m) return;
  editingMemoId = id;
  showMemoForm(m.content, m.email, m.reminder, m.reminderTime || 'morning');
}

function showMemoForm(content, email, reminder, reminderTime) {
  const container = document.getElementById('memo-list');
  const memos = getMemoSync(currentMemoKey).filter(m => m.id !== editingMemoId);

  let html = '';
  if (memos.length) {
    html = '<div class="memo-list">';
    memos.forEach(m => {
      const timeLabel = m.reminderTime === 'eve' ? '前一晚 20:00' : m.reminderTime === 'morning' ? '当天 08:00' : m.reminderTime === 'both' ? '前一晚+当天' : '';
      html += `
        <div class="memo-item">
          <div class="memo-item-body">
            <div class="memo-item-content">${escapeHtml(m.content)}</div>
            <div class="memo-item-meta">
              ${m.email ? `<span class="memo-item-email">📧 ${escapeHtml(m.email)}</span>` : ''}
              ${m.reminder ? `<span class="memo-item-badge">🔔 邮件提醒${timeLabel ? ' · ' + timeLabel : ''}</span>` : ''}
            </div>
          </div>
          <div class="memo-item-actions">
            <button class="memo-edit-btn" onclick="startEditMemo('${m.id}')">✎ 编辑</button>
            <button class="memo-del-btn" onclick="deleteMemoItem('${m.id}')">🗑 删除</button>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  html += `
    <div class="memo-form" id="memo-form">
      <label class="modal-label">备忘内容</label>
      <textarea class="memo-textarea" id="memo-content" placeholder="输入备忘内容..." rows="3">${escapeHtml(content)}</textarea>
      <label class="modal-label">邮件提醒</label>
      <input type="email" class="memo-email" id="memo-email" placeholder="输入邮箱地址" value="${escapeHtml(email)}" />
      <label class="modal-check"><input type="checkbox" id="memo-reminder" ${reminder ? 'checked' : ''} /> 启用邮件提醒</label>
      <div id="reminder-time-wrap" style="display:${reminder ? 'block' : 'none'};margin-top:8px;">
        <label class="modal-label">提醒时间</label>
        <select class="memo-select" id="memo-reminder-time">
          <option value="morning" ${reminderTime === 'morning' ? 'selected' : ''}>当天早上 08:00</option>
          <option value="eve" ${reminderTime === 'eve' ? 'selected' : ''}>前一天晚上 20:00</option>
          <option value="both" ${reminderTime === 'both' ? 'selected' : ''}>前一天晚上 + 当天早上</option>
        </select>
      </div>
      <button class="btn-send-now" id="btn-send-now" onclick="sendTestEmail()" style="display:${reminder ? 'block' : 'none'};">立即发送测试邮件</button>
    </div>`;

  container.innerHTML = html;
  document.getElementById('memo-footer').style.display = 'flex';
  document.getElementById('memo-content').focus();

  document.getElementById('memo-reminder').addEventListener('change', function() {
    document.getElementById('reminder-time-wrap').style.display = this.checked ? 'block' : 'none';
    document.getElementById('btn-send-now').style.display = this.checked ? 'block' : 'none';
  });
}

function cancelEditMemo() {
  editingMemoId = null;
  renderMemoList();
  document.getElementById('memo-footer').style.display = 'none';
}

async function saveMemoItem() {
  const content = document.getElementById('memo-content').value.trim();
  const email = document.getElementById('memo-email').value.trim();
  const reminder = document.getElementById('memo-reminder').checked;
  const reminderTime = document.getElementById('memo-reminder-time')
    ? document.getElementById('memo-reminder-time').value
    : 'morning';

  if (!content) {
    alert('请输入备忘内容');
    return;
  }
  if (reminder && !email) {
    alert('启用邮件提醒需要填写邮箱地址');
    return;
  }

  const memos = getMemoSync(currentMemoKey);
  if (editingMemoId) {
    const idx = memos.findIndex(m => m.id === editingMemoId);
    if (idx >= 0) memos[idx] = { ...memos[idx], content, email, reminder, reminderTime };
  } else {
    memos.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), content, email, reminder, reminderTime });
  }

  await saveMemoToServer(currentMemoKey, memos);
  editingMemoId = null;
  renderMemoList();
  document.getElementById('memo-footer').style.display = 'none';
  refresh();
}

async function deleteMemoItem(id) {
  let memos = getMemoSync(currentMemoKey);
  memos = memos.filter(m => m.id !== id);

  await saveMemoToServer(currentMemoKey, memos);
  editingMemoId = null;
  renderMemoList();
  document.getElementById('memo-footer').style.display = 'none';
  refresh();
}

function closeMemo() {
  document.getElementById('memo-modal').classList.remove('show');
  currentMemoKey = null;
  editingMemoId = null;
}

async function sendTestEmail() {
  const content = document.getElementById('memo-content').value.trim();
  const email = document.getElementById('memo-email').value.trim();

  if (!content) { alert('请先输入备忘内容'); return; }
  if (!email) { alert('请输入邮箱地址'); return; }

  const btn = document.getElementById('btn-send-now');
  btn.textContent = '发送中...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, content, dateKey: currentMemoKey }),
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = '已发送';
      setTimeout(() => { btn.textContent = '立即发送测试邮件'; btn.disabled = false; }, 2000);
    } else {
      btn.textContent = '发送失败';
      setTimeout(() => { btn.textContent = '立即发送测试邮件'; btn.disabled = false; }, 2000);
      alert('邮件发送失败：' + (data.error || '请检查SMTP配置'));
    }
  } catch {
    btn.textContent = '立即发送测试邮件';
    btn.disabled = false;
    alert('服务器未运行，无法发送邮件。请先启动服务：npm start');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
