var GlobalPool = {
  CACHE_KEY: 'oc_global_pool_cache',
  META_KEY: 'oc_global_pool_meta',
  CACHE_TTL_MS: 45000,
  POLL_MS: 60000,
  DEFAULT_LIMIT: 100,
  _pollTimer: null,
  _seeding: false,

  isEnabled() {
    return typeof SupabaseDB !== 'undefined' && SupabaseDB.enabled;
  },

  init() {
    if (!this.isEnabled()) return;
    SupabaseDB.ensureAuth().catch(() => {});
    this._startPolling();
  },

  _startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.fetch('recent', { silent: true });
      }
    }, this.POLL_MS);
  },

  _isUuid(id) {
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  },

  normalize(row) {
    if (!row) return null;
    const imageData = row.imageData || row.image_data
      || (row.image_path && SupabaseDB.getPublicUrl(row.image_path))
      || null;
    if (!imageData) return null;

    return {
      id: row.id,
      imageData,
      type: row.type || 'fish',
      score: row.score || 0,
      votes: row.votes || 0,
      createdAt: row.createdAt || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      emoji: row.emoji || CREATURE_TYPES[row.type]?.emoji || '🐟',
      aiSimilarity: row.aiSimilarity ?? row.ai_similarity ?? 0,
      aiCreativity: row.aiCreativity ?? row.ai_creativity ?? 0,
      source: 'global',
    };
  },

  getMeta() {
    try {
      return JSON.parse(localStorage.getItem(this.META_KEY) || '{}');
    } catch {
      return {};
    }
  },

  setMeta(meta) {
    localStorage.setItem(this.META_KEY, JSON.stringify(meta));
  },

  getCached() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.map(c => this.normalize(c)).filter(Boolean) : [];
    } catch {
      return [];
    }
  },

  setCache(creatures) {
    const trimmed = creatures.slice(0, 150);
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(trimmed));
      this.setMeta({
        updatedAt: Date.now(),
        count: trimmed.length,
        source: 'global',
      });
    } catch (e) {
      console.warn('[GlobalPool] Cache write failed', e.message);
    }
  },

  getStatus() {
    const meta = this.getMeta();
    return {
      enabled: this.isEnabled(),
      connected: this.isEnabled(),
      count: meta.count || this.getCached().length,
      updatedAt: meta.updatedAt || 0,
      source: this.isEnabled() ? (meta.source || 'global') : 'local',
    };
  },

  _sortCreatures(list, sort) {
    const arr = [...list];
    switch (sort) {
      case 'popular':
      case 'score':
        return arr.sort((a, b) => b.score - a.score);
      case 'hot':
        return arr.sort((a, b) => {
          const scoreA = a.score / Math.max(1, Math.pow((Date.now() - a.createdAt) / 3600000 + 2, 1.5));
          const scoreB = b.score / Math.max(1, Math.pow((Date.now() - b.createdAt) / 3600000 + 2, 1.5));
          return scoreB - scoreA;
        });
      case 'random':
        return arr.sort(() => Math.random() - 0.5);
      case 'recent':
      default:
        return arr.sort((a, b) => b.createdAt - a.createdAt);
    }
  },

  async fetch(sort = 'recent', options = {}) {
    if (!this.isEnabled()) {
      return this._localFallback(sort);
    }

    const silent = options.silent === true;
    const limit = options.limit || this.DEFAULT_LIMIT;
    const meta = this.getMeta();
    const cacheStale = !meta.updatedAt || (Date.now() - meta.updatedAt > this.CACHE_TTL_MS);

    try {
      const remote = await SupabaseDB.getCreatures(sort, limit);
      if (remote && remote.length > 0) {
        const mapped = remote.map(c => this.normalize(c)).filter(Boolean);
        const sorted = this._sortCreatures(mapped, sort);
        this.setCache(sorted);
        if (!silent) this.renderStatusBadge(sorted.length);
        if (mapped.length < 8 && !this._seeding) {
          this.seedIfEmpty();
        }
        return sorted;
      }

      if (remote && remote.length === 0 && !this._seeding) {
        await this.seedIfEmpty();
        const again = await SupabaseDB.getCreatures(sort, limit);
        if (again && again.length > 0) {
          const mapped = again.map(c => this.normalize(c)).filter(Boolean);
          const sorted = this._sortCreatures(mapped, sort);
          this.setCache(sorted);
          return sorted;
        }
      }
    } catch (e) {
      console.warn('[GlobalPool] Fetch error:', e.message);
    }

    const cached = this.getCached();
    if (cached.length > 0 && (!cacheStale || silent)) {
      return this._sortCreatures(cached, sort);
    }

    if (!silent && typeof showToast === 'function') {
      const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
      showToast(locale === 'zh' ? '全球池暂不可用，显示缓存' : 'Global pool unavailable, showing cache');
    }

    if (cached.length > 0) return this._sortCreatures(cached, sort);
    return this._localFallback(sort);
  },

  async submit(imageData, type, aiData = {}) {
    if (!this.isEnabled()) {
      return this._addLocal(imageData, type, aiData);
    }

    try {
      const row = await SupabaseDB.addCreature(imageData, type, aiData);
      if (row) {
        const creature = this.normalize(row);
        if (creature) {
          const cached = this.getCached();
          cached.unshift(creature);
          this.setCache(cached);
          this.renderStatusBadge(cached.length);
          return creature;
        }
      }
    } catch (e) {
      console.warn('[GlobalPool] Submit failed:', e.message);
    }

    if (typeof showToast === 'function') {
      showToast(typeof I18n !== 'undefined' ? I18n.t('toast_local_saved') : 'Global submit failed, saved locally');
    }
    return this._addLocal(imageData, type, aiData);
  },

  async vote(id, delta) {
    if (this.isEnabled() && this._isUuid(id)) {
      try {
        const result = await SupabaseDB.voteCreature(id, delta);
        if (result) {
          const cached = this.getCached();
          const c = cached.find(x => x.id === id);
          if (c) {
            c.score = result.score;
            c.votes = result.votes;
            this.setCache(cached);
          }
          return { id, score: result.score, votes: result.votes };
        }
      } catch (e) {
        console.warn('[GlobalPool] Vote failed:', e.message);
      }
      return null;
    }
    return this._voteLocal(id, delta);
  },

  async seedIfEmpty() {
    if (!this.isEnabled() || this._seeding) return;
    if (typeof buildSeedCreatures !== 'function') return;

    this._seeding = true;
    try {
      const existing = await SupabaseDB.getCreatures('recent', 5);
      if (existing && existing.length > 0) return;

      const user = await SupabaseDB.ensureAuth();
      if (!user) return;

      const seeds = buildSeedCreatures();
      for (const seed of seeds) {
        await SupabaseDB.addCreature(seed.imageData, seed.type, {
          similarity: 0.85,
          creativity: 70,
          isMatch: true,
        });
      }
      console.info('[GlobalPool] Seeded', seeds.length, 'creatures');
    } catch (e) {
      console.warn('[GlobalPool] Seed failed:', e.message);
    } finally {
      this._seeding = false;
    }
  },

  renderStatusBadge(count) {
    const el = document.getElementById('global-pool-status');
    if (!el) return;
    const n = count != null ? count : this.getStatus().count;
    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    const label = locale === 'zh' ? '全球深海' : 'Global Ocean';
    el.textContent = `${label} · ${n}`;
    el.dataset.state = 'connected';
  },

  renderStatusBadgeDisconnected() {
    const el = document.getElementById('global-pool-status');
    if (!el) return;
    const locale = typeof I18n !== 'undefined' ? I18n.locale : 'en';
    el.textContent = locale === 'zh' ? '本机鱼缸' : 'Local tank';
    el.dataset.state = 'local';
  },

  _addLocal(imageData, type, aiData) {
    const creatures = GlobalPool._readLocalStore();
    const creature = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      imageData,
      type,
      score: 0,
      votes: 0,
      createdAt: Date.now(),
      emoji: CREATURE_TYPES[type]?.emoji || '🐟',
      aiSimilarity: aiData?.similarity || 0,
      aiCreativity: aiData?.creativity || 0,
      source: 'local',
    };
    creatures.push(creature);
    GlobalPool._writeLocalStore(creatures);
    return creature;
  },

  _voteLocal(id, delta) {
    const creatures = GlobalPool._readLocalStore();
    const c = creatures.find(x => x.id === id);
    if (!c) return null;
    c.score += delta;
    c.votes += 1;
    GlobalPool._writeLocalStore(creatures);
    return c;
  },

  _readLocalStore() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  _writeLocalStore(creatures) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(creatures));
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(creatures.slice(-80)));
    }
  },

  async _localFallback(sort) {
    const creatures = GlobalPool._readLocalStore();
    if (creatures.length === 0 && typeof seedDefaultCreatures === 'function') {
      seedDefaultCreatures();
      return GlobalPool._sortCreatures(GlobalPool._readLocalStore(), sort);
    }
    this.renderStatusBadgeDisconnected();
    return this._sortCreatures(creatures.map(c => ({ ...c, source: 'local' })), sort);
  },
};
