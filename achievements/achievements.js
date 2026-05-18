const BASE_URL = 'https://deadbydaylight.sic4riodragon.uk/achievements/achievements.base.json';
const ICONS_URL = 'https://deadbydaylight.sic4riodragon.uk/achievements/achievements.icons.json';
const STATE_URL = './achievements.json';

const SECTION_ORDER = {
  killer: ['adept', 'general', 'extra'],
  survivor: ['adept', 'map', 'general'],
  general: ['general']
};

const els = {
  countUnlocked: document.getElementById('countUnlocked'),
  countLocked: document.getElementById('countLocked'),
  countShown: document.getElementById('countShown'),

  killerSummaryCounts: document.getElementById('killerSummaryCounts'),
  survivorSummaryCounts: document.getElementById('survivorSummaryCounts'),
  generalSummaryCounts: document.getElementById('generalSummaryCounts'),

  killerSummary: document.getElementById('killerSummary'),
  survivorSummary: document.getElementById('survivorSummary'),
  generalSummary: document.getElementById('generalSummary'),

  killerSections: document.getElementById('killerSections'),
  survivorSections: document.getElementById('survivorSections'),
  generalSections: document.getElementById('generalSections'),

  searchInput: document.getElementById('searchInput'),
  filterSelect: document.getElementById('filterSelect'),
  toggleUnlocked: document.getElementById('toggleUnlocked')
};

const view = {
  search: '',
  filter: 'all',
  showUnlocked: false,
  items: [],
  icons: {}
};

async function loadJson(url, fallback = {}) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function flattenState(groupedState) {
  const map = new Map();

  for (const [topKey, topValue] of Object.entries(groupedState || {})) {
    if (!topValue || typeof topValue !== 'object') continue;

    for (const [sectionKey, sectionValue] of Object.entries(topValue)) {
      if (!sectionValue || typeof sectionValue !== 'object') continue;

      for (const [achievementId, rawValue] of Object.entries(sectionValue)) {
        let unlocked = false;
        let progress = null;
        let goal = null;

        if (typeof rawValue === 'boolean') {
          unlocked = rawValue;
        } else if (rawValue && typeof rawValue === 'object') {
          unlocked = !!rawValue.unlocked;
          progress = Number.isFinite(rawValue.progress) ? rawValue.progress : null;
          goal = Number.isFinite(rawValue.goal) ? rawValue.goal : null;
        }

        map.set(achievementId, { unlocked, progress, goal });
      }
    }
  }

  return map;
}

function countUnlocked(items) {
  return items.filter(item => item.unlocked).length;
}

function countLocked(items) {
  return items.filter(item => !item.unlocked).length;
}

function prettySectionName(section) {
  if (section === 'adept') return 'Adept';
  if (section === 'map') return 'Map';
  if (section === 'extra') return 'Extra';
  return 'General';
}

function matchesFilter(item) {
  const filter = view.filter;

  if (!filter || filter === 'all') return true;

  if (filter === 'killer' || filter === 'survivor' || filter === 'general') {
    return item.category === filter;
  }

  if (filter === 'adept' || filter === 'map' || filter === 'extra') {
    return item.section === filter;
  }

  if (filter === 'general-section') {
    return item.section === 'general';
  }

  return true;
}

function matchesSearch(item) {
  if (!view.search) return true;

  const haystack = [
    item.title,
    item.description,
    item.category,
    item.section,
    item.achievement_id
  ].join(' ').toLowerCase();

  return haystack.includes(view.search);
}

function getVisibleItems() {
  return view.items.filter(item => {
    if (!view.showUnlocked && item.unlocked) return false;
    return matchesFilter(item) && matchesSearch(item);
  });
}

function updateCounters(visibleItems) {
  els.countUnlocked.textContent = countUnlocked(view.items);
  els.countLocked.textContent = countLocked(view.items);
  els.countShown.textContent = visibleItems.length;
}

function renderSummary(container, items) {
  const grouped = ['adept', 'map', 'general', 'extra']
    .map(section => ({
      section,
      items: items.filter(item => item.section === section)
    }))
    .filter(group => group.items.length);

  if (!grouped.length) {
    container.innerHTML = '<div class="summary-row"><strong>Nothing here</strong><span>0</span></div>';
    return;
  }

  container.innerHTML = grouped.map(group => `
    <div class="summary-row">
      <strong>${prettySectionName(group.section)}</strong>
      <span>${countLocked(group.items)} locked / ${group.items.length}</span>
    </div>
  `).join('');
}

function renderAchievementCard(item) {
  const icon = view.icons[item.achievement_id] || '';
  const safeIcon = icon ? escapeHtml(icon) : 'https://deadbydaylight.sic4riodragon.uk/assets/img/deadbydaylight_icon.png';

  let meta = '';

  if (item.unlocked) {
    meta = `<span class="achievement-state achievement-state-done">Done</span>`;
  } else if (Number.isFinite(item.progress) && Number.isFinite(item.goal) && item.goal > 1) {
    const percent = Math.max(0, Math.min(100, (item.progress / item.goal) * 100));
    meta = `
      <div class="progress-text">${item.progress} / ${item.goal}</div>
      <div class="progressbar">
        <div class="progressbar-inner" style="width:${percent}%"></div>
      </div>
    `;
  } else {
    meta = `<span class="achievement-state achievement-state-locked">Locked</span>`;
  }

  return `
    <article class="achievement ${item.unlocked ? 'unlocked' : 'locked'}">
      <img src="${safeIcon}" alt="">
      <div>
        <h3 class="achievement-title">${escapeHtml(item.title || item.achievement_id)}</h3>
        <p class="achievement-desc">${escapeHtml(item.description || '')}</p>
      </div>
      <div class="achievement-meta">${meta}</div>
    </article>
  `;
}

function renderSections(container, items, category) {
  const order = SECTION_ORDER[category] || ['general'];

  const groups = order
    .map(section => ({
      section,
      items: items.filter(item => item.section === section)
    }))
    .filter(group => group.items.length);

  if (!groups.length) {
    container.innerHTML = '<div class="empty">No achievements match the current filters.</div>';
    return;
  }

  container.innerHTML = groups.map(group => `
    <details class="subsection" open>
      <summary class="subsection-head">
        <h3>${prettySectionName(group.section)}</h3>
        <span>${countLocked(group.items)} locked / ${group.items.length}</span>
      </summary>
      <div class="achievement-list">
        ${group.items.map(renderAchievementCard).join('')}
      </div>
    </details>
  `).join('');
}

function render() {
  const visible = getVisibleItems();

  const killerItems = visible.filter(item => item.category === 'killer');
  const survivorItems = visible.filter(item => item.category === 'survivor');
  const generalItems = visible.filter(item => item.category === 'general');

  const allKillerItems = view.items.filter(item => item.category === 'killer');
  const allSurvivorItems = view.items.filter(item => item.category === 'survivor');
  const allGeneralItems = view.items.filter(item => item.category === 'general');

  updateCounters(visible);

  els.killerSummaryCounts.textContent = `${countLocked(allKillerItems)} locked`;
  els.survivorSummaryCounts.textContent = `${countLocked(allSurvivorItems)} locked`;
  els.generalSummaryCounts.textContent = `${countLocked(allGeneralItems)} locked`;

  renderSummary(els.killerSummary, allKillerItems);
  renderSummary(els.survivorSummary, allSurvivorItems);
  renderSummary(els.generalSummary, allGeneralItems);

  renderSections(els.killerSections, killerItems, 'killer');
  renderSections(els.survivorSections, survivorItems, 'survivor');
  renderSections(els.generalSections, generalItems, 'general');
}

async function init() {
  const [base, groupedState, icons] = await Promise.all([
    loadJson(BASE_URL, []),
    loadJson(STATE_URL, {}),
    loadJson(ICONS_URL, {})
  ]);

  const stateMap = flattenState(groupedState);
  view.icons = icons || {};

  view.items = (Array.isArray(base) ? base : []).map(item => {
    const saved = stateMap.get(item.achievement_id) || {};

    return {
      ...item,
      unlocked: !!saved.unlocked,
      progress: Number.isFinite(saved.progress) ? saved.progress : null,
      goal: Number.isFinite(saved.goal) ? saved.goal : null
    };
  });

  els.searchInput.addEventListener('input', () => {
    view.search = normalizeText(els.searchInput.value);
    render();
  });

  els.filterSelect.addEventListener('change', () => {
    view.filter = els.filterSelect.value;
    render();
  });

  els.toggleUnlocked.addEventListener('change', () => {
    view.showUnlocked = !!els.toggleUnlocked.checked;
    render();
  });

  render();
}

init().catch(error => {
  console.error(error);

  const msg = '<div class="empty">Failed to load achievements data.</div>';
  els.killerSections.innerHTML = msg;
  els.survivorSections.innerHTML = msg;
  els.generalSections.innerHTML = msg;
});