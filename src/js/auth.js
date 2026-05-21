var OceanAuth = {
  user: null,
  isAnonymous: true,

  init() {
    this.renderNavButton();
    this.checkSession();
    this.listenAuthChange();
  },

  renderNavButton() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;
    const existing = document.getElementById('auth-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'auth-btn';
    btn.style.cssText = 'background:transparent;border:1px solid var(--border-subtle);border-radius:8px;padding:4px 10px;color:var(--text-secondary);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.75rem;margin-left:8px;transition:all 0.2s';
    btn.textContent = '登录';
    btn.onclick = () => this.showLoginModal();
    nav.appendChild(btn);
  },

  _isAnonUser(user) {
    if (!user) return true;
    if (user.is_anonymous === true) return true;
    if (user.identities && user.identities.length === 0) return true;
    return false;
  },

  async checkSession() {
    if (typeof SupabaseDB === 'undefined' || !SupabaseDB.enabled) {
      this.updateUI(null);
      return;
    }
    try {
      const { data: { session } } = await SupabaseDB.client.auth.getSession();
      if (session && session.user) {
        this.user = session.user;
        this.isAnonymous = this._isAnonUser(session.user);
        this.updateUI(session.user);
      } else {
        this.updateUI(null);
      }
    } catch (e) {
      console.warn('[OceanAuth] checkSession error:', e);
      this.updateUI(null);
    }
  },

  async ensureAnonymous() {
    if (!SupabaseDB.enabled) return;
    try {
      const { data, error } = await SupabaseDB.client.auth.signInAnonymously();
      if (error) {
        console.warn('[OceanAuth] Anonymous login not available:', error.message);
        return;
      }
      if (data.user) {
        this.user = data.user;
        this.isAnonymous = true;
        this.updateUI(data.user);
      }
    } catch (e) {
      console.warn('[OceanAuth] ensureAnonymous error:', e);
    }
  },

  listenAuthChange() {
    if (typeof SupabaseDB === 'undefined' || !SupabaseDB.enabled) return;
    SupabaseDB.client.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        this.user = session.user;
        this.isAnonymous = this._isAnonUser(session.user);
        this.updateUI(session.user);
      } else {
        this.user = null;
        this.isAnonymous = true;
        this.updateUI(null);
      }
    });
  },

  updateUI(user) {
    const btn = document.getElementById('auth-btn');
    if (!btn) return;

    if (user && !this._isAnonUser(user)) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '用户';
      const avatar = user.user_metadata?.avatar_url;
      btn.innerHTML = avatar
        ? `<img src="${avatar}" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">${name}`
        : name;
      btn.onclick = () => this.showUserMenu();
    } else {
      btn.textContent = '登录';
      btn.onclick = () => this.showLoginModal();
    }
  },

  showLoginModal() {
    let modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:2000;backdrop-filter:blur(10px)';

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:32px;max-width:360px;width:90%;text-align:center;box-shadow:0 0 60px rgba(0,229,255,0.15);position:relative">
        <div style="font-size:1.8rem;margin-bottom:4px">🌊</div>
        <div style="font-family:Orbitron,monospace;font-size:1rem;color:var(--neon-cyan);margin-bottom:4px">登录 Ocean Canvas</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-bottom:24px">登录后跨设备同步你的深海作品</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
          <button id="login-google" style="padding:10px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--bg-elevated);color:var(--text-primary);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.24c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.33v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.11z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.99 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.01 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google 登录
          </button>
          <button id="login-github" style="padding:10px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--bg-elevated);color:var(--text-primary);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.245.54.915 1.455 1.305 2.4 1.005-.075-.42-.42-.825-.795-1.05-2.34-.6-3.765-2.94-3.765-5.34 0-1.2.435-2.31 1.17-3.135-.12-.285-.51-1.485.12-3.075 0 0 .96-.3 3.15 1.17.915-.255 1.89-.39 2.865-.39s1.95.135 2.865.39c2.19-1.485 3.15-1.17 3.15-1.17.63 1.59.24 2.79.12 3.075.735.825 1.17 1.935 1.17 3.135 0 2.43-1.455 4.815-3.765 5.34.6.495 1.17 1.455 1.17 2.94 0 2.13-.015 3.84-.015 4.365 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub 登录
          </button>
        </div>
        <div style="border-top:1px solid var(--border-subtle);padding-top:16px;margin-top:8px">
          <div style="display:flex;flex-direction:column;gap:8px">
            <input id="login-email" type="email" placeholder="邮箱" style="width:100%;padding:8px 12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);font-size:0.82rem;box-sizing:border-box">
            <input id="login-password" type="password" placeholder="密码" style="width:100%;padding:8px 12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);font-size:0.82rem;box-sizing:border-box">
            <button id="login-email-btn" style="padding:8px;border:1px solid var(--neon-cyan);border-radius:8px;background:linear-gradient(135deg,rgba(0,229,255,0.1),rgba(0,229,255,0.05));color:var(--neon-cyan);cursor:pointer;font-size:0.8rem">邮箱登录/注册</button>
          </div>
        </div>
        <div style="color:var(--text-muted);font-size:0.65rem;margin-top:12px">匿名用户可正常画画，登录后数据跨设备同步</div>
        <button id="auth-close" style="position:absolute;top:12px;right:16px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem">✕</button>
        <div id="auth-error" style="color:var(--neon-magenta);font-size:0.75rem;margin-top:8px;display:none"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#auth-close').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#login-google').onclick = () => this.loginWithOAuth('google');
    modal.querySelector('#login-github').onclick = () => this.loginWithOAuth('github');
    modal.querySelector('#login-email-btn').onclick = () => this.loginWithEmail();
  },

  async loginWithOAuth(provider) {
    if (!SupabaseDB.enabled) {
      showToast('Supabase未配置，无法登录');
      return;
    }
    const { error } = await SupabaseDB.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/' }
    });
    if (error) {
      const errEl = document.getElementById('auth-error');
      if (errEl) { errEl.textContent = error.message; errEl.style.display = 'block'; }
    }
  },

  async loginWithEmail() {
    if (!SupabaseDB.enabled) return;
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    const errEl = document.getElementById('auth-error');

    if (!email || !password) {
      if (errEl) { errEl.textContent = '请输入邮箱和密码'; errEl.style.display = 'block'; }
      return;
    }

    const { data, error } = await SupabaseDB.client.auth.signInWithPassword({ email, password });
    if (error) {
      const { data: signUpData, error: signUpError } = await SupabaseDB.client.auth.signUp({ email, password });
      if (signUpError) {
        if (errEl) { errEl.textContent = signUpError.message; errEl.style.display = 'block'; }
      } else {
        showToast('注册成功！请查收验证邮件');
        const modal = document.getElementById('auth-modal');
        if (modal) modal.remove();
      }
    } else {
      showToast('登录成功 🎉');
      const modal = document.getElementById('auth-modal');
      if (modal) modal.remove();
    }
  },

  showUserMenu() {
    if (!this.user) return;
    const name = this.user.user_metadata?.full_name || this.user.user_metadata?.name || this.user.email?.split('@')[0] || '用户';

    let menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.style.cssText = 'position:fixed;top:50px;right:16px;background:var(--bg-card);border:1px solid var(--border-glow);border-radius:12px;padding:16px;min-width:200px;z-index:2001;box-shadow:0 0 30px rgba(0,229,255,0.1)';

    menu.innerHTML = `
      <div style="font-family:Orbitron,monospace;font-size:0.85rem;color:var(--neon-cyan);margin-bottom:8px">${name}</div>
      <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:12px">${this.user.email || '匿名用户'}</div>
      <button id="logout-btn" style="width:100%;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;font-size:0.78rem">退出登录</button>
    `;

    document.body.appendChild(menu);

    menu.querySelector('#logout-btn').onclick = async () => {
      if (SupabaseDB.enabled) await SupabaseDB.client.auth.signOut();
      this.user = null;
      this.isAnonymous = true;
      this.updateUI(null);
      menu.remove();
      showToast('已退出登录');
    };

    const close = (e) => {
      if (!menu.contains(e.target) && e.target.id !== 'auth-btn') {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 100);
  },

  isLoggedIn() {
    return this.user && !this._isAnonUser(this.user);
  }
};
