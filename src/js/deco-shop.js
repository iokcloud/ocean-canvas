var DecoShop = {
  owned: [],
  active: null,

  ITEMS: [
    { id: 'frame_glow', price: 0, icon: '✨', name_en: 'Neon Frame', name_zh: '霓虹边框', cat: 'frame', css: 'box-shadow:0 0 20px rgba(0,229,255,0.3),inset 0 0 20px rgba(0,229,255,0.1);border-radius:12px' },
    { id: 'frame_gold', price: 100, icon: '🏆', name_en: 'Gold Frame', name_zh: '金色边框', cat: 'frame', css: 'box-shadow:0 0 20px rgba(255,215,0,0.3),inset 0 0 20px rgba(255,215,0,0.1);border:2px solid rgba(255,215,0,0.5);border-radius:12px' },
    { id: 'frame_fire', price: 200, icon: '🔥', name_en: 'Fire Frame', name_zh: '烈焰边框', cat: 'frame', css: 'box-shadow:0 0 25px rgba(255,100,0,0.4),inset 0 0 15px rgba(255,50,0,0.15);border:2px solid rgba(255,100,0,0.5);border-radius:12px' },
    { id: 'bg_grid', price: 0, icon: '📐', name_en: 'Grid Background', name_zh: '网格背景', cat: 'bg', draw: 'grid' },
    { id: 'bg_dots', price: 50, icon: '⚫', name_en: 'Dot Pattern', name_zh: '点阵背景', cat: 'bg', draw: 'dots' },
    { id: 'fx_sparkle', price: 150, icon: '💫', name_en: 'Sparkle Effect', name_zh: '星光特效', cat: 'fx', draw: 'sparkle' }
  ],

  init() {
    try {
      const data = JSON.parse(localStorage.getItem('oc_deco') || '{}');
      this.owned = data.owned || ['frame_glow', 'bg_grid'];
      this.active = data.active || null;
    } catch (e) {
      this.owned = ['frame_glow', 'bg_grid'];
      this.active = null;
    }
    this.applyActive();
  },

  save() {
    localStorage.setItem('oc_deco', JSON.stringify({ owned: this.owned, active: this.active }));
  },

  buy(itemId) {
    const item = this.ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    if (this.owned.includes(itemId)) {
      this.active = this.active === itemId ? null : itemId;
      this.save();
      this.applyActive();
      return true;
    }
    const xp = typeof AchievementSystem !== 'undefined' ? AchievementSystem.xp : 0;
    if (xp < item.price) {
      const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
      showToast(locale === 'zh' ? `需要 ${item.price} XP` : `Need ${item.price} XP`);
      return false;
    }
    this.owned.push(itemId);
    this.active = itemId;
    this.save();
    this.applyActive();
    return true;
  },

  applyActive() {
    const wrapper = document.querySelector('.draw-canvas-wrapper');
    if (!wrapper) return;
    wrapper.style.cssText = '';
    if (!this.active) return;
    const item = this.ITEMS.find(i => i.id === this.active);
    if (item && item.css) {
      item.css.split(';').filter(Boolean).forEach(s => {
        const [prop, val] = s.split(':').map(x => x.trim());
        if (prop && val) wrapper.style[prop] = val;
      });
    }
  },

  renderShopButton() {
    if (typeof FEATURES !== 'undefined' && !FEATURES.decoration) return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.getElementById('deco-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'deco-btn';
    btn.className = 'tool-btn';
    btn.textContent = '🎨';
    btn.title = 'Decorations';
    btn.onclick = () => this.showShop();
    toolbar.querySelector('.toolbar-group:last-child').appendChild(btn);
  },

  showShop() {
    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    const xp = typeof AchievementSystem !== 'undefined' ? AchievementSystem.xp : 0;

    let modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:2000;backdrop-filter:blur(10px)';

    const items = this.ITEMS.map(item => {
      const owned = this.owned.includes(item.id);
      const isActive = this.active === item.id;
      const name = locale === 'zh' ? item.name_zh : item.name_en;
      const btnText = isActive ? (locale === 'zh' ? '关闭' : 'Off') : owned ? (locale === 'zh' ? '启用' : 'Use') : item.price === 0 ? (locale === 'zh' ? '免费' : 'Free') : `${item.price} XP`;
      const btnStyle = isActive ? 'var(--neon-gold)' : owned ? 'var(--neon-cyan)' : xp >= item.price ? 'var(--neon-green)' : 'var(--text-muted)';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px">
        <span style="font-size:1.3rem">${item.icon}</span>
        <div style="flex:1">
          <div style="font-size:0.82rem;color:var(--text-primary)">${name}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${item.cat}</div>
        </div>
        <button data-deco-id="${item.id}" style="padding:4px 10px;border:1px solid ${btnStyle};border-radius:6px;background:transparent;color:${btnStyle};cursor:pointer;font-size:0.72rem">${btnText}</button>
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 0 50px rgba(0,229,255,0.15);position:relative">
        <div style="font-family:Orbitron,monospace;font-size:0.95rem;color:var(--neon-cyan);margin-bottom:4px">🎨 ${locale === 'zh' ? '装饰商店' : 'Deco Shop'}</div>
        <div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:16px">${locale === 'zh' ? '你的XP' : 'Your XP'}: ${xp}</div>
        ${items}
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.78rem;margin-top:8px">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('[data-deco-id]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.buy(btn.dataset.decoId);
        modal.remove();
        this.showShop();
      };
    });
  }
};
