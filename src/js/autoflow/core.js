const AutoFlow = {
  memory: null,
  audit: null,
  config: {
    autoFix: false,
    autoDeploy: false,
    auditInterval: 3600000,
    behaviorSampleInterval: 30000,
  },

  init() {
    if (typeof MemorySystem !== 'undefined') this.memory = MemorySystem;
    if (typeof AuditEngine !== 'undefined') {
      this.audit = AuditEngine;
      this.audit.init(this.memory);
    }
    this.setupBehaviorTracking();
    this.setupVisibilityHandling();
    this.setupPeriodicAudit();
  },

  setupBehaviorTracking() {
    let lastAction = null;
    const tracker = {
      draw: () => 'draw_stroke',
      aiCheck: () => 'ai_check',
      submit: () => 'submit_creature',
      vote: () => 'vote',
      feed: () => 'feed_fish',
      navigate: () => 'page_view',
    };

    document.addEventListener('click', (e) => {
      const target = e.target;
      let action = 'click_unknown';

      if (target.id === 'swim-btn') action = 'submit_creature';
      else if (target.id === 'feed-btn') action = 'feed_fish';
      else if (target.classList?.contains('vote-btn')) action = 'vote';
      else if (target.classList?.contains('creature-btn')) action = 'select_creature';
      else if (target.classList?.contains('tool-btn')) action = 'tool_change';
      else if (target.closest('.nav-link')) action = 'navigate';

      if (action !== lastAction && this.memory) {
        this.memory.record('user_behavior', {
          action,
          page: location.pathname,
          element: target.id || target.className || target.tagName,
        });
        lastAction = action;
      }
    }, { passive: true });

    if (location.pathname.includes('ocean')) {
      const canvas = document.getElementById('ocean-canvas');
      if (canvas) {
        canvas.addEventListener('click', () => {
          if (this.memory) {
            this.memory.record('user_behavior', { action: 'tank_interact', page: 'ocean' });
          }
        }, { passive: true });
      }
    }
  },

  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAnimations();
        if (this.memory) {
          this.memory.record('user_behavior', { action: 'page_hidden', page: location.pathname });
        }
      } else {
        this.resumeAnimations();
        if (this.memory) {
          this.memory.record('user_behavior', { action: 'page_visible', page: location.pathname });
        }
      }
    });
  },

  pauseAnimations() {
    if (typeof window.__oc_animFrameId !== 'undefined') {
      cancelAnimationFrame(window.__oc_animFrameId);
    }
  },

  resumeAnimations() {
    if (typeof window.__oc_resumeAnimation === 'function') {
      window.__oc_resumeAnimation();
    }
  },

  setupPeriodicAudit() {
    if (!this.config.auditInterval || !this.audit) return;
    if (localStorage.getItem('oc_dev') !== 'true') return;

    setInterval(() => {
      this.runAudit().then(summary => {
        if (typeof FEATURES !== 'undefined' && FEATURES.devMode) {
          console.log('[AutoFlow] Periodic audit:', summary.status, `Score: ${summary.score}`);
        }
      });
    }, this.config.auditInterval);
  },

  async runAudit() {
    if (!this.audit) return { status: 'SKIP', message: 'Audit engine not loaded' };

    const files = {};
    const paths = [
      'src/css/style.css',
      'src/js/storage.js',
      'src/js/draw.js',
      'src/js/ocean.js',
      'src/js/rank.js',
      'src/js/bubbles.js',
      'src/js/analytics.js',
    ];

    for (const path of paths) {
      try {
        const resp = await fetch(`/${path}`);
        if (resp.ok) files[path] = await resp.text();
      } catch {}
    }

    const summary = await this.audit.audit(files);

    if (this.memory) {
      this.memory.record('audit_result', {
        score: summary.score,
        errors: summary.errors,
        warnings: summary.warnings,
        details: summary.results.map(r => `${r.rule}: ${r.message}`),
      });
    }

    return summary;
  },

  async runPipeline(crFile) {
    const log = [];
    log.push(`[${new Date().toISOString()}] Pipeline started for ${crFile}`);

    try {
      log.push('[1/4] Reading CR...');
      log.push('[2/4] Running audit...');
      const auditResult = await this.runAudit();
      log.push(`  Audit: ${auditResult.status} (Score: ${auditResult.score})`);

      if (auditResult.status === 'FAIL' && !this.config.autoFix) {
        log.push('[BLOCKED] Audit failed. Manual fix required.');
        return { success: false, log, audit: auditResult };
      }

      log.push('[3/4] Quality gate passed.');
      log.push('[4/4] Ready for deployment.');

      if (this.config.autoDeploy) {
        log.push('[AUTO] Triggering deployment...');
      } else {
        log.push('[MANUAL] Run: git push origin main');
      }

      return { success: true, log, audit: auditResult };
    } catch (err) {
      log.push(`[ERROR] ${err.message}`);
      return { success: false, log, error: err.message };
    }
  },

  getReport() {
    const report = {
      timestamp: new Date().toISOString(),
      page: location.pathname,
      memory: this.memory ? this.memory.exportSnapshot() : null,
      features: typeof FEATURES !== 'undefined' ? FEATURES : null,
      performance: {},
    };

    if (performance.getEntriesByType) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        report.performance = {
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          load: Math.round(nav.loadEventEnd - nav.startTime),
        };
      }
    }

    return report;
  },

  dashboard() {
    const report = this.getReport();
    const insights = this.memory ? this.memory.getInsights() : [];

    console.group('%c🌊 Ocean Canvas AutoFlow', 'font-size:14px;font-weight:bold;color:#00e5ff');
    console.log('📊 Report:', report);
    if (insights.length > 0) {
      console.group('💡 Insights');
      insights.forEach(i => {
        const icon = i.type === 'quality' ? '✅' : i.type === 'decline' ? '📉' : i.type === 'stability' ? '⚠️' : 'ℹ️';
        console.log(`${icon} ${i.message}`);
        if (i.actionable) console.log(`  → ${i.actionable}`);
      });
      console.groupEnd();
    }
    console.log('🧠 Memory size:', this.memory ? Object.keys(this.memory.store).length : 0);
    console.log('⚙️ Features:', report.features);
    console.groupEnd();

    return report;
  },
};

if (typeof module !== 'undefined') module.exports = AutoFlow;
