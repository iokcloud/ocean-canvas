const AuditEngine = {
  rules: [],
  results: [],
  memory: null,

  init(memorySystem) {
    this.memory = memorySystem;
    this.rules = [
      { id: 'R001', name: 'CSS变量使用', check: this.checkCSSVariables.bind(this), severity: 'error' },
      { id: 'R002', name: 'IIFE模块封装', check: this.checkIIFEWrapper.bind(this), severity: 'error' },
      { id: 'R003', name: 'Canvas坐标转换', check: this.checkCanvasCoords.bind(this), severity: 'warning' },
      { id: 'R004', name: 'Feature Flag覆盖', check: this.checkFeatureFlagCoverage.bind(this), severity: 'warning' },
      { id: 'R005', name: '内存泄漏风险', check: this.checkMemoryLeaks.bind(this), severity: 'error' },
      { id: 'R006', name: '移动端触控', check: this.checkTouchHandling.bind(this), severity: 'warning' },
      { id: 'R007', name: '错误处理', check: this.checkErrorHandling.bind(this), severity: 'error' },
      { id: 'R008', name: '性能模式', check: this.checkPerformancePatterns.bind(this), severity: 'warning' },
    ];
  },

  async audit(files) {
    this.results = [];
    const startTime = performance.now();

    for (const rule of this.rules) {
      try {
        const violations = await rule.check(files);
        violations.forEach(v => {
          this.results.push({
            rule: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            ...v,
            timestamp: Date.now()
          });
        });
      } catch (err) {
        this.results.push({
          rule: rule.id,
          ruleName: rule.name,
          severity: 'error',
          file: 'audit-engine',
            message: `Rule execution failed: ${err.message}`,
          timestamp: Date.now()
        });
      }
    }

    const duration = Math.round(performance.now() - startTime);
    const summary = this.generateSummary(duration);

    if (this.memory) {
      this.memory.record('audit_run', {
        duration,
        totalIssues: this.results.length,
        errors: summary.errors,
        warnings: summary.warnings,
        timestamp: Date.now()
      });
    }

    return summary;
  },

  generateSummary(duration) {
    const errors = this.results.filter(r => r.severity === 'error');
    const warnings = this.results.filter(r => r.severity === 'warning');
    return {
      status: errors.length > 0 ? 'FAIL' : 'PASS',
      duration,
      total: this.results.length,
      errors: errors.length,
      warnings: warnings.length,
      results: this.results,
      score: Math.max(0, 100 - errors.length * 15 - warnings.length * 5),
    };
  },

  checkCSSVariables(files) {
    const violations = [];
    const css = files['src/css/style.css'] || '';
    const jsFiles = Object.keys(files).filter(f => f.endsWith('.js') && !f.includes('autoflow'));
    const colorPattern = /#[0-9a-fA-F]{3,8}(?!["\s])/g;

    for (const fname of jsFiles) {
      const content = files[fname];
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const matches = line.match(colorPattern);
        if (matches && !line.includes('data:image') && !line.includes('radialGradient') && !line.includes('createRadialGradient')) {
          violations.push({
            file: fname,
            line: i + 1,
            message: `Hardcoded color(s): ${matches.join(', ')}. Use CSS variables instead.`
          });
        }
      });
    }
    return violations;
  },

  checkIIFEWrapper(files) {
    const violations = [];
    const jsFiles = Object.keys(files).filter(f => f.endsWith('.js') && !f.includes('autoflow'));
    for (const fname of jsFiles) {
      const content = files[fname].trim();
      if (!content.startsWith('(function') && !content.startsWith('const ') && !content.startsWith('export ')) {
        violations.push({
          file: fname,
          message: 'JS file should use IIFE pattern: (function() { ... })();'
        });
      }
    }
    return violations;
  },

  checkCanvasCoords(files) {
    const violations = [];
    const content = files['src/js/draw.js'] || '';
    if (content.includes('e.offsetX') || content.includes('e.offsetY')) {
      violations.push({
        file: 'src/js/draw.js',
        message: 'Direct offsetX/offsetY used. Should use getCanvasPos() for scaling support.'
      });
    }
    return violations;
  },

  checkFeatureFlagCoverage(files) {
    const violations = [];
    const aiFiles = ['src/js/draw.js'];
    for (const fname of aiFiles) {
      const content = files[fname] || '';
      if (content.includes('/api/classify') && !content.includes('FEATURES.aiClassification')) {
        violations.push({
          file: fname,
          message: 'AI API call without Feature Flag check. Add FEATURES.aiClassification guard.'
        });
      }
    }
    return violations;
  },

  checkMemoryLeaks(files) {
    const violations = [];
    for (const [fname, content] of Object.entries(files)) {
      if (!fname.endsWith('.js') || fname.includes('autoflow')) continue;
      if (content.includes('setInterval') && !content.includes('clearInterval')) {
        violations.push({
          file: fname,
          message: 'setInterval without clearInterval. Potential memory leak.'
        });
      }
      if (content.includes('addEventListener') && !content.includes('removeEventListener') && fname.includes('ocean')) {
        violations.push({
          file: fname,
          message: 'addEventListener in long-lived page without removeEventListener. Consider cleanup.'
        });
      }
    }
    return violations;
  },

  checkTouchHandling(files) {
    const violations = [];
    const content = files['src/js/draw.js'] || '';
    if (content.includes('mousedown') && !content.includes('touchstart')) {
      violations.push({
        file: 'src/js/draw.js',
        message: 'Mouse events without corresponding touch events. Mobile will not work.'
      });
    }
    if (content.includes('touchstart') && !content.includes('passive: false')) {
      violations.push({
        file: 'src/js/draw.js',
        message: 'touchstart without {passive: false}. May cause scroll jank on mobile.'
      });
    }
    return violations;
  },

  checkErrorHandling(files) {
    const violations = [];
    for (const [fname, content] of Object.entries(files)) {
      if (!fname.endsWith('.js') || fname.includes('autoflow')) continue;
      if (content.includes('fetch(') && !content.includes('catch') && !content.includes('.catch')) {
        violations.push({
          file: fname,
          message: 'fetch() without error handling. Add try/catch or .catch().'
        });
      }
    }
    return violations;
  },

  checkPerformancePatterns(files) {
    const violations = [];
    const content = files['src/js/ocean.js'] || '';
    if (content.includes('requestAnimationFrame') && !content.includes('cancelAnimationFrame')) {
      violations.push({
        file: 'src/js/ocean.js',
        message: 'Animation loop without cancelAnimationFrame. Cannot stop rendering when page hidden.',
        suggestion: 'Add document.visibilitychange handler to pause/resume animation.'
      });
    }
    return violations;
  },
};

if (typeof module !== 'undefined') module.exports = AuditEngine;
