var DailyChallenge = {
  challenge: null,

  challenges: [
    { type: 'jellyfish', bonus: 2, label_en: 'Bioluminescent Jellyfish', label_zh: '荧光水母', desc_en: 'Draw a glowing jellyfish — double XP today!', desc_zh: '画一只发光的水母 — 今日双倍经验！' },
    { type: 'octopus', bonus: 2, label_en: 'Camouflage Octopus', label_zh: '变色章鱼', desc_en: 'Draw an octopus changing color — double XP!', desc_zh: '画一只变色的章鱼 — 双倍经验！' },
    { type: 'shark', bonus: 2, label_en: 'Deep Sea Shark', label_zh: '深海鲨鱼', desc_en: 'Draw a fearsome shark — double XP today!', desc_zh: '画一条凶猛的鲨鱼 — 今日双倍经验！' },
    { type: 'turtle', bonus: 1.5, label_en: 'Ancient Sea Turtle', label_zh: '远古海龟', desc_en: 'Draw a wise old turtle — 1.5x XP today!', desc_zh: '画一只智慧的老海龟 — 今日1.5倍经验！' },
    { type: 'whale', bonus: 2, label_en: 'Singing Whale', label_zh: '歌唱的鲸鱼', desc_en: 'Draw a whale singing in the deep — double XP!', desc_zh: '画一头深海歌唱的鲸鱼 — 双倍经验！' },
    { type: 'seahorse', bonus: 1.5, label_en: 'Dancing Seahorse', label_zh: '跳舞的海马', desc_en: 'Draw a dancing seahorse — 1.5x XP today!', desc_zh: '画一只跳舞的海马 — 今日1.5倍经验！' },
    { type: 'crab', bonus: 1.5, label_en: 'Treasure Crab', label_zh: '寻宝螃蟹', desc_en: 'Draw a crab with treasure — 1.5x XP today!', desc_zh: '画一只带宝物的螃蟹 — 今日1.5倍经验！' },
    { type: 'fish', bonus: 1.5, label_en: 'Neon Fish', label_zh: '霓虹鱼', desc_en: 'Draw a neon-glowing fish — 1.5x XP today!', desc_zh: '画一条霓虹发光的鱼 — 今日1.5倍经验！' }
  ],

  init() {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem('oc_daily_challenge');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          this.challenge = parsed;
          this.renderBanner();
          return;
        }
      } catch (e) {}
    }
    const dayIndex = this._hashDate(today) % this.challenges.length;
    const c = this.challenges[dayIndex];
    this.challenge = { ...c, date: today, completed: false };
    localStorage.setItem('oc_daily_challenge', JSON.stringify(this.challenge));
    this.renderBanner();
  },

  _hashDate(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  },

  getBonus() {
    if (!this.challenge || this.challenge.completed) return 1;
    return this.challenge.bonus;
  },

  checkCompletion(type) {
    if (!this.challenge || this.challenge.completed) return false;
    if (type === this.challenge.type) {
      this.challenge.completed = true;
      localStorage.setItem('oc_daily_challenge', JSON.stringify(this.challenge));
      this.renderBanner();
      return true;
    }
    return false;
  },

  renderBanner() {
    let banner = document.getElementById('challenge-banner');
    if (!banner) {
      const main = document.querySelector('.main-content');
      if (!main) return;
      banner = document.createElement('div');
      banner.id = 'challenge-banner';
      main.insertBefore(banner, main.firstChild);
    }

    if (!this.challenge) { banner.style.display = 'none'; return; }

    const c = this.challenge;
    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    const label = locale === 'zh' ? c.label_zh : c.label_en;
    const desc = locale === 'zh' ? c.desc_zh : c.desc_en;
    const emoji = (typeof CREATURE_TYPES !== 'undefined' && CREATURE_TYPES[c.type]) ? CREATURE_TYPES[c.type].emoji : '🐟';

    if (c.completed) {
      banner.style.cssText = 'background:linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,229,255,0.04));border:1px solid rgba(0,255,136,0.3);border-radius:10px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:0.82rem';
      banner.innerHTML = `
        <span style="font-size:1.2rem">${emoji}</span>
        <span style="color:var(--neon-green);font-weight:600">${label}</span>
        <span style="color:var(--text-muted)">✅ ${locale === 'zh' ? '挑战完成！' : 'Challenge Complete!'}</span>
      `;
    } else {
      banner.style.cssText = 'background:linear-gradient(135deg,rgba(255,215,0,0.08),rgba(0,229,255,0.04));border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:0.82rem;cursor:pointer';
      banner.innerHTML = `
        <span style="font-size:1.2rem">${emoji}</span>
        <span style="color:var(--neon-gold);font-weight:600">${label}</span>
        <span style="color:var(--text-secondary)">${desc}</span>
        <span style="color:var(--neon-gold);font-size:0.7rem;margin-left:auto">⭐ ${c.bonus}x</span>
      `;
      banner.onclick = () => {
        const btn = document.querySelector(`.creature-btn[data-type="${c.type}"]`);
        if (btn) btn.click();
      };
    }
  }
};
