(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { accounts: [], selectedId: null, loading: false };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = (v) => {
    if (v == null || v === '') return '기록 없음';
    const d = new Date(typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : v);
    return Number.isNaN(d.getTime()) ? '기록 없음' : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  };
  const idOf = (a) => String(a.userId ?? '');
  const active = (a) => Boolean(a.active);

  function notice(message, type = 'error') {
    const el = $('notice'); el.textContent = message || ''; el.className = `notice ${type}`; el.hidden = !message;
  }
  function renderList() {
    const root = $('account-list'); $('account-list-count').textContent = String(state.accounts.length);
    if (!state.accounts.length) {
      root.innerHTML = '<div class="list-empty">최근 30일 내 인증된 MCP 도구 요청 기록이 없습니다.<br>배포 후 요청이 들어오면 계정이 표시됩니다.</div>';
      $('detail-panel').innerHTML = '<div class="empty-detail"><span class="empty-icon" aria-hidden="true">✓</span><h2>아직 표시할 활동이 없습니다</h2><p>과거 요청은 수집되지 않았으며 복구할 수 없습니다.</p></div>';
      return;
    }
    root.innerHTML = state.accounts.map((a) => {
      const id = idOf(a), email = a.email || '이메일 미수집';
      return `<button type="button" class="account-row" data-id="${esc(id)}" aria-current="${id === state.selectedId}"><span class="avatar" aria-hidden="true">${esc((email[0] || '?').toUpperCase())}</span><span class="account-main"><span class="account-email">${esc(email)}</span><span class="account-meta"><span class="status-dot ${active(a) ? 'active' : ''}"></span>${active(a) ? '최근 15분 내 도구 요청' : '최근 활동 없음'} · ${esc(date(a.lastActivityAt))}</span></span><span class="chevron" aria-hidden="true">›</span></button>`;
    }).join('');
    root.querySelectorAll('.account-row').forEach((button) => button.addEventListener('click', () => {
      state.selectedId = button.dataset.id; renderList(); loadActivity(state.accounts.find((a) => idOf(a) === state.selectedId));
    }));
  }
  function redactForDisplay(value) {
    const secret = /(token|secret|password|authorization|cookie|api.?key|credential|private.?key)/i;
    if (Array.isArray(value)) return value.map(redactForDisplay);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, secret.test(k) ? '[화면에서 숨김]' : redactForDisplay(v)]));
    if (typeof value === 'string' && value.length > 5000) return `${value.slice(0, 5000)}… [화면에서 생략]`;
    return value;
  }
  function renderDetail(account, events) {
    const root = $('detail-panel'); if (!account) return;
    const rows = events.map((event) => {
      const request = JSON.stringify(redactForDisplay(event.request), null, 2) ?? '요청 인수가 수집되지 않았습니다.';
      const flags = `${event.authType ? `<span class="activity-flag">인증: ${esc(event.authType === 'api_key' ? 'API 키' : 'OAuth')}</span>` : ''}${event.redactedFields ? `<span class="activity-flag redacted">민감값 ${esc(event.redactedFields)}개 마스킹</span>` : ''}${event.truncated ? '<span class="activity-flag redacted">긴 요청 일부 생략</span>' : ''}`;
      return `<li class="activity-item"><div class="activity-time">${esc(date(event.at))}</div><div class="activity-title">${esc(event.toolName || 'MCP 도구 요청')}</div>${event.clientName ? `<div class="activity-description">클라이언트: ${esc(event.clientName)}</div>` : ''}<div class="activity-flags">${flags}</div><details class="request-box"><summary>마스킹된 요청 인수 보기</summary><pre>${esc(request)}</pre></details></li>`;
    }).join('');
    const timeline = rows ? `<ol class="activity-list">${rows}</ol>` : '<div class="empty-activity">최근 30일의 상세 요청 기록이 없습니다.<br>배포 이후 요청부터 수집하며 이전 기록은 복구할 수 없습니다.</div>';
    root.innerHTML = `<div class="detail-header"><div><h2>${esc(account.email || '이메일 미수집')}</h2><p class="detail-subtitle">계정 ID: ${esc(account.userId)}</p></div><span class="status-badge ${active(account) ? 'active' : ''}">${active(account) ? '활성 · 최근 15분 내 인증된 도구 요청' : '비활성'}</span></div><div class="detail-stats"><div class="detail-stat"><span>최근 MCP 요청</span><strong>${esc(date(account.lastActivityAt))}</strong></div><div class="detail-stat"><span>최근 30일 요청</span><strong>${esc(account.activityCount ?? events.length)}건</strong></div><div class="detail-stat"><span>현재 연결 정의</span><strong>최근 15분 내 요청</strong></div></div><h3 class="section-title">최근 도구 요청과 전달 정보 · 최대 50건 표시</h3>${timeline}`;
  }
  async function loadActivity(account) {
    if (!account) return;
    const selected = idOf(account), panel = $('detail-panel');
    panel.innerHTML = '<div class="loading-state"><span class="spinner" aria-hidden="true"></span>요청 내용을 불러오는 중입니다.</div>';
    try {
      const r = await fetch(`/api/admin/accounts/${encodeURIComponent(selected)}/activity?limit=50`, { credentials: 'include', cache: 'no-store', headers: { accept: 'application/json' } });
      if (r.status === 401 || r.status === 403) throw new Error('Cloudflare Access 관리자 인증이 필요합니다. 지정된 관리자 계정으로 로그인한 뒤 새로고침해 주세요.');
      if (!r.ok) throw new Error(`계정 활동 조회 실패 (${r.status})`);
      const data = await r.json(); if (state.selectedId !== selected) return;
      renderDetail(account, Array.isArray(data.activities) ? data.activities : []);
    } catch (e) {
      if (state.selectedId === selected) panel.innerHTML = `<div class="empty-detail"><h2>활동을 불러오지 못했습니다</h2><p>${esc(e.message || '다시 시도해 주세요.')}</p></div>`;
    }
  }
  async function load() {
    if (state.loading) return;
    state.loading = true; $('refresh-button').disabled = true; notice('');
    $('account-list').innerHTML = '<div class="loading-state"><span class="spinner" aria-hidden="true"></span>계정을 불러오는 중입니다.</div>';
    try {
      const r = await fetch('/api/admin/overview', { credentials: 'include', cache: 'no-store', headers: { accept: 'application/json' } });
      if (r.status === 401 || r.status === 403) throw new Error('Cloudflare Access 관리자 인증이 필요합니다. 지정된 관리자 계정으로 로그인한 뒤 새로고침해 주세요.');
      if (!r.ok) throw new Error(`관리 정보를 불러오지 못했습니다. (${r.status})`);
      const data = await r.json(); state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
      $('active-count').textContent = String(data.activeMcpAccounts ?? 0);
      $('total-count').textContent = String(data.totalMcpAccounts ?? 0);
      $('updated-at').textContent = `마지막 갱신 ${date(data.generatedAt)}`;
      if (data.accountsTruncated) notice(`표시 가능한 계정 목록이 ${data.accountListLimit ?? 500}개로 제한되었습니다. 상단 계정 수 집계는 전체 보관 기록 기준입니다.`, 'info');
      if (!state.accounts.some((a) => idOf(a) === state.selectedId)) state.selectedId = state.accounts[0] ? idOf(state.accounts[0]) : null;
      renderList(); loadActivity(state.accounts.find((a) => idOf(a) === state.selectedId));
    } catch (e) { state.accounts = []; renderList(); notice(e.message || '관리 정보를 불러오지 못했습니다.'); $('updated-at').textContent = '갱신 실패'; }
    finally { state.loading = false; $('refresh-button').disabled = false; }
  }
  $('refresh-button').addEventListener('click', load);
  $('logout-button').addEventListener('click', () => location.assign('/cdn-cgi/access/logout'));
  load();
})();
