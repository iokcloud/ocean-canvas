const MemorySystem = {
  store: {},
  MAX_ENTRIES: 200,

  init() {
    try {
      const saved = localStorage.getItem('oc_memory');
      this.store = saved ? JSON.parse(saved) : {};
    } catch {
      this.store = {};
    }
  },

  save() {
    try {
      localStorage.setItem('oc_memory', JSON.stringify(this.store));
    } catch {
      const keys = Object.keys(this.store);
      if (keys.length > this.MAX_ENTRIES) {
        keys.slice(0, keys.length - this.MAX_ENTRIES).forEach(k => delete this.store[k]);
        localStorage.setItem('oc_memory', JSON.stringify(this.store));
      }
    }
  },

  record(category, data) {
    const key = `${category}_${Date.now()}`;
    this.store[key] = {
      category,
      data,
      timestamp: Date.now(),
    };
    this.save();
    return key;
  },

  query(category, options = {}) {
    const entries = Object.entries(this.store)
      .filter(([k, v]) => v.category === category)
      .map(([k, v]) => v);

    if (options.since) {
      const since = typeof options.since === 'number' ? options.since : Date.now() - options.since;
      return entries.filter(e => e.timestamp >= since);
    }

    if (options.limit) {
      return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, options.limit);
    }

    return entries;
  },

  getPatterns(category) {
    const entries = this.query(category);
    if (entries.length === 0) return null;

    if (category === 'audit_run') {
      const scores = entries.map(e => e.data.score || 0).filter(s => s > 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const recentTrend = scores.slice(-5);
      const trend = recentTrend.length >= 2
        ? recentTrend[recentTrend.length - 1] - recentTrend[0]
        : 0;
      const totalRuns = entries.length;
      const avgDuration = entries.map(e => e.data.duration || 0).reduce((a, b) => a + b, 0) / totalRuns;
      const errorRate = entries.filter(e => (e.data.errors || 0) > 0).length / totalRuns;

      return {
        avgScore,
        trend,
        totalRuns,
        avgDuration: Math.round(avgDuration),
        errorRate: Math.round(errorRate * 100),
        lastRun: entries[entries.length - 1]?.timestamp,
        qualityLevel: avgScore >= 90 ? 'excellent' : avgScore >= 70 ? 'good' : avgScore >= 50 ? 'fair' : 'poor',
      };
    }

    if (category === 'user_behavior') {
      const actions = {};
      entries.forEach(e => {
        const action = e.data.action;
        actions[action] = (actions[action] || 0) + 1;
      });
      return { totalEvents: entries.length, actions, lastEvent: entries[entries.length - 1]?.timestamp };
    }

    return { count: entries.length, lastEntry: entries[entries.length - 1]?.timestamp };
  },

  learn(category, input, output, quality) {
    const key = `learned_${category}_${Date.now()}`;
    this.store[key] = {
      category: `learned_${category}`,
      data: { input, output, quality },
      timestamp: Date.now(),
    };
    this.save();
    return key;
  },

  recall(category, input) {
    const entries = Object.entries(this.store)
      .filter(([k, v]) => v.category === `learned_${category}`)
      .map(([k, v]) => v);

    if (entries.length === 0) return null;

    const scored = entries.map(e => ({
      ...e,
      relevance: this.computeRelevance(input, e.data.input),
    }));

    scored.sort((a, b) => (b.relevance + b.data.quality * 0.3) - (a.relevance + a.data.quality * 0.3));

    return scored[0]?.data.output || null;
  },

  computeRelevance(input, storedInput) {
    if (typeof input !== typeof storedInput) return 0;
    if (typeof input === 'string') {
      const a = input.toLowerCase().split(/\s+/);
      const b = storedInput.toLowerCase().split(/\s+/);
      const common = a.filter(w => b.includes(w));
      return common.length / Math.max(a.length, b.length);
    }
    return input === storedInput ? 1 : 0;
  },

  getInsights() {
    const auditPatterns = this.getPatterns('audit_run');
    const behaviorPatterns = this.getPatterns('user_behavior');

    const insights = [];

    if (auditPatterns) {
      insights.push({
        type: 'quality',
        message: `代码质量: ${auditPatterns.qualityLevel} (平均${auditPatterns.avgScore}分)`,
        actionable: auditPatterns.avgScore < 70 ? '需要修复审查中发现的问题' : null,
      });

      if (auditPatterns.trend < -5) {
        insights.push({
          type: 'decline',
          message: `质量趋势下降${Math.abs(auditPatterns.trend)}分`,
          actionable: '检查最近变更是否引入了新问题',
        });
      }

      if (auditPatterns.errorRate > 20) {
        insights.push({
          type: 'stability',
          message: `审查错误率${auditPatterns.errorRate}%`,
          actionable: '审查错误率过高，需要系统性修复',
        });
      }
    }

    return insights;
  },

  exportSnapshot() {
    return {
      timestamp: Date.now(),
      size: Object.keys(this.store).length,
      categories: [...new Set(Object.values(this.store).map(v => v.category))],
      patterns: {
        audit: this.getPatterns('audit_run'),
        behavior: this.getPatterns('user_behavior'),
      },
      insights: this.getInsights(),
    };
  },
};

MemorySystem.init();

if (typeof module !== 'undefined') module.exports = MemorySystem;
