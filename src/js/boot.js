var OceanBoot = {
  initPage(options) {
    options = options || {};
    if (typeof SupabaseDB !== 'undefined') SupabaseDB.init();
    if (typeof GlobalPool !== 'undefined') {
      GlobalPool.init();
      if (GlobalPool.isEnabled()) {
        GlobalPool.fetch('recent', { silent: true })
          .then((list) => GlobalPool.renderStatusBadge(list ? list.length : 0))
          .catch(() => GlobalPool.renderStatusBadgeDisconnected());
      } else {
        GlobalPool.renderStatusBadgeDisconnected();
      }
    }
    if (options.auth !== false && typeof OceanAuth !== 'undefined') OceanAuth.init();
    if (options.dailyChallenge && typeof DailyChallenge !== 'undefined') DailyChallenge.init();
    if (options.achievement && typeof AchievementSystem !== 'undefined') AchievementSystem.init();
    if (options.deco && typeof DecoShop !== 'undefined') {
      DecoShop.init();
      DecoShop.renderShopButton();
    }
    if (typeof FEATURES !== 'undefined' && FEATURES.devMode) {
      OceanBoot._loadAutoflow();
    }
  },

  _loadAutoflow() {
    const files = [
      'src/js/autoflow/memory.js',
      'src/js/autoflow/audit-engine.js',
      'src/js/autoflow/core.js',
      'src/js/autoflow/scheduler.js',
    ];
    let i = 0;
    function next() {
      if (i >= files.length) {
        if (typeof AutoFlow !== 'undefined') AutoFlow.init();
        return;
      }
      const s = document.createElement('script');
      s.src = files[i++];
      s.onload = next;
      s.onerror = next;
      document.body.appendChild(s);
    }
    next();
  },
};
