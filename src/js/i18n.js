var I18n = {
  locale: 'en',
  messages: { en: {}, zh: {} },

  async init() {
    const saved = localStorage.getItem('oc_locale');
    const browserLang = navigator.language?.startsWith('zh') ? 'zh' : 'en';
    this.locale = saved || browserLang;

    try {
      const [enRes, zhRes] = await Promise.all([
        fetch('src/i18n/en.json'),
        fetch('src/i18n/zh.json')
      ]);
      this.messages.en = await enRes.json();
      this.messages.zh = await zhRes.json();
    } catch (e) {
      console.warn('[I18n] Failed to load translations:', e);
    }

    this.apply();
    this.renderSwitcher();
  },

  t(key, vars) {
    let text = this.messages[this.locale]?.[key] || this.messages.en?.[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), vars[k]);
      });
    }
    return text;
  },

  setLocale(locale) {
    this.locale = locale;
    localStorage.setItem('oc_locale', locale);
    this.apply();
    this.renderSwitcher();
  },

  apply() {
    document.documentElement.lang = this.locale === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });
  },

  renderSwitcher() {
    let btn = document.getElementById('lang-switch');
    if (!btn) {
      const nav = document.querySelector('.nav-links');
      if (!nav) return;
      btn = document.createElement('button');
      btn.id = 'lang-switch';
      btn.style.cssText = 'background:transparent;border:1px solid var(--border-subtle);border-radius:8px;padding:4px 8px;color:var(--text-muted);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.7rem;margin-left:6px;transition:all 0.2s';
      nav.appendChild(btn);
    }
    btn.textContent = this.locale === 'en' ? '中文' : 'EN';
    btn.onclick = () => this.setLocale(this.locale === 'en' ? 'zh' : 'en');
  }
};
