var AchievementSystem = {
  xp: 0,
  level: 1,
  badges: [],

  LEVEL_XP: [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000],
  LEVEL_NAMES_EN: ['Newcomer', 'Explorer', 'Diver', 'Deep Diver', 'Navigator', 'Biologist', 'Oceanographer', 'Abyssal', 'Legendary', 'Mythic', 'Poseidon'],
  LEVEL_NAMES_ZH: ['新手', '探险者', '潜水员', '深潜者', '领航员', '生物学家', '海洋学家', '深渊级', '传说级', '神话级', '海神'],

  BADGES: [
    { id: 'first_draw', icon: '🎨', name_en: 'First Creation', name_zh: '初次创作', desc_en: 'Draw your first creature', desc_zh: '绘制第一个生物', condition: (s) => s.totalDraws >= 1 },
    { id: 'five_draws', icon: '🖌️', name_en: 'Artist', name_zh: '画家', desc_en: 'Draw 5 creatures', desc_zh: '绘制5个生物', condition: (s) => s.totalDraws >= 5 },
    { id: 'ten_draws', icon: '🎭', name_en: 'Master Artist', name_zh: '大师', desc_en: 'Draw 10 creatures', desc_zh: '绘制10个生物', condition: (s) => s.totalDraws >= 10 },
    { id: 'all_types', icon: '🐙', name_en: 'Biologist', name_zh: '生物学家', desc_en: 'Draw all 8 creature types', desc_zh: '绘制全部8种生物', condition: (s) => s.uniqueTypes >= 8 },
    { id: 'high_score', icon: '⭐', name_en: 'Star Creator', name_zh: '之星', desc_en: 'Get a similarity score above 80%', desc_zh: '获得80%以上相似度', condition: (s) => s.maxSimilarity >= 0.8 },
    { id: 'creative', icon: '💡', name_en: 'Creative Mind', name_zh: '创意大师', desc_en: 'Get creativity score above 70', desc_zh: '获得70以上创意分', condition: (s) => s.maxCreativity >= 70 },
    { id: 'voter', icon: '👍', name_en: 'Critic', name_zh: '评论家', desc_en: 'Vote 10 times', desc_zh: '投票10次', condition: (s) => s.totalVotes >= 10 },
    { id: 'level5', icon: '🌊', name_en: 'Navigator', name_zh: '领航员', desc_en: 'Reach level 5', desc_zh: '达到5级', condition: (s) => s.level >= 5 }
  ],

  init() {
    this.load();
    this.renderBadge();
  },

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('oc_achievements') || '{}');
      this.xp = data.xp || 0;
      this.level = data.level || 1;
      this.badges = data.badges || [];
    } catch (e) {
      this.xp = 0;
      this.level = 1;
      this.badges = [];
    }
  },

  save() {
    localStorage.setItem('oc_achievements', JSON.stringify({
      xp: this.xp,
      level: this.level,
      badges: this.badges
    }));
  },

  addXP(amount) {
    const bonus = typeof DailyChallenge !== 'undefined' ? DailyChallenge.getBonus() : 1;
    this.xp += Math.round(amount * bonus);
    while (this.level < this.LEVEL_XP.length - 1 && this.xp >= this.LEVEL_XP[this.level + 1]) {
      this.level++;
    }
    this.save();
    this.renderBadge();
  },

  checkBadges(stats) {
    const newBadges = [];
    this.BADGES.forEach(b => {
      if (!this.badges.includes(b.id) && b.condition(stats)) {
        this.badges.push(b.id);
        newBadges.push(b);
      }
    });
    if (newBadges.length > 0) {
      this.save();
      this.renderBadge();
      newBadges.forEach(b => {
        const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
        const name = locale === 'zh' ? b.name_zh : b.name_en;
        showToast(`${b.icon} Badge: ${name}`);
      });
    }
  },

  getStats() {
    const creatures = typeof getCreatures === 'function' ? getCreatures() : [];
    const types = new Set(creatures.map(c => c.type));
    return {
      totalDraws: creatures.length,
      uniqueTypes: types.size,
      maxSimilarity: creatures.reduce((m, c) => Math.max(m, c.aiSimilarity || 0), 0),
      maxCreativity: creatures.reduce((m, c) => Math.max(m, c.aiCreativity || 0), 0),
      totalVotes: parseInt(localStorage.getItem('oc_vote_count') || '0'),
      level: this.level
    };
  },

  renderBadge() {
    let badge = document.getElementById('level-badge');
    if (!badge) {
      const actions = document.getElementById('nav-actions');
      if (!actions) return;
      badge = document.createElement('button');
      badge.id = 'level-badge';
      badge.type = 'button';
      badge.className = 'level-badge';
      actions.insertBefore(badge, actions.firstChild);
      badge.onclick = () => this.showProfile();
    }

    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    const names = locale === 'zh' ? this.LEVEL_NAMES_ZH : this.LEVEL_NAMES_EN;
    badge.innerHTML = `⭐ Lv${this.level} ${names[this.level] || 'Explorer'}`;
  },

  showProfile() {
    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    const names = locale === 'zh' ? this.LEVEL_NAMES_ZH : this.LEVEL_NAMES_EN;
    const nextXP = this.LEVEL_XP[this.level + 1] || '∞';
    const progress = this.level < this.LEVEL_XP.length - 1
      ? Math.round(((this.xp - this.LEVEL_XP[this.level]) / (this.LEVEL_XP[this.level + 1] - this.LEVEL_XP[this.level])) * 100)
      : 100;

    let modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:2000;backdrop-filter:blur(10px)';

    const badgeList = this.BADGES.map(b => {
      const earned = this.badges.includes(b.id);
      const name = locale === 'zh' ? b.name_zh : b.name_en;
      const desc = locale === 'zh' ? b.desc_zh : b.desc_en;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px;opacity:${earned?1:0.35}">
        <span style="font-size:1.2rem">${b.icon}</span>
        <div>
          <div style="font-size:0.8rem;color:${earned?'var(--neon-cyan)':'var(--text-muted)'}">${name}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${desc}</div>
        </div>
        ${earned ? '<span style="margin-left:auto;color:var(--neon-green);font-size:0.7rem">✓</span>' : ''}
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:24px;max-width:380px;width:90%;text-align:center;box-shadow:0 0 50px rgba(0,229,255,0.15);position:relative">
        <div style="font-size:2rem;margin-bottom:4px">⭐</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-gold);margin-bottom:4px">Lv${this.level} ${names[this.level]}</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:16px">${this.xp} / ${nextXP} XP</div>
        <div style="background:var(--bg-elevated);border-radius:8px;height:8px;margin-bottom:20px;overflow:hidden">
          <div style="background:linear-gradient(90deg,var(--neon-cyan),var(--neon-gold));height:100%;width:${progress}%;border-radius:8px"></div>
        </div>
        <div style="text-align:left;max-height:240px;overflow-y:auto;margin-bottom:16px">${badgeList}</div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="padding:8px 24px;border:1px solid var(--border-subtle);border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.78rem">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }
};
