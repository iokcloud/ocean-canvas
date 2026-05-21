const Scheduler = {
  jobs: [],
  running: false,

  register(name, fn, interval, options = {}) {
    this.jobs.push({
      name,
      fn,
      interval,
      lastRun: 0,
      options,
      failures: 0,
    });
  },

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  },

  stop() {
    this.running = false;
  },

  async tick() {
    if (!this.running) return;
    const now = Date.now();

    for (const job of this.jobs) {
      if (now - job.lastRun >= job.interval) {
        try {
          await job.fn();
          job.lastRun = now;
          job.failures = 0;
        } catch (err) {
          job.failures++;
          if (typeof FEATURES !== 'undefined' && FEATURES.devMode) {
            console.warn(`[Scheduler] ${job.name} failed (${job.failures}):`, err.message);
          }
          if (job.failures >= 3 && job.options.stopOnFailure) {
            this.jobs = this.jobs.filter(j => j.name !== job.name);
          }
        }
      }
    }

    setTimeout(() => this.tick(), 10000);
  },

  getStatus() {
    return this.jobs.map(j => ({
      name: j.name,
      interval: j.interval,
      lastRun: j.lastRun ? new Date(j.lastRun).toISOString() : 'never',
      failures: j.failures,
    }));
  },
};

if (typeof AutoFlow !== 'undefined' && typeof FEATURES !== 'undefined' && FEATURES.devMode) {
  Scheduler.register('audit', () => AutoFlow.runAudit(), 3600000, { stopOnFailure: false });
  Scheduler.register('memory_snapshot', () => {
    if (AutoFlow.memory) {
      AutoFlow.memory.record('heartbeat', { page: location.pathname, uptime: performance.now() });
    }
  }, 300000);
  Scheduler.start();
}

if (typeof module !== 'undefined') module.exports = Scheduler;
