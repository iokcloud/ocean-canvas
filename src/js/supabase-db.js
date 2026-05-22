const SupabaseDB = {
  client: null,
  enabled: false,

  init() {
    const url = this.getConfig('url');
    const key = this.getConfig('anonKey');

    if (!url || !key) {
      console.info('[SupabaseDB] No config found, using localStorage mode');
      this.enabled = false;
      return;
    }

    if (typeof supabase !== 'undefined') {
      this.client = supabase.createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      this.enabled = true;
      console.info('[SupabaseDB] Connected to', url);
    } else {
      console.warn('[SupabaseDB] Supabase JS not loaded');
      this.enabled = false;
    }
  },

  getConfig(key) {
    if (typeof OC_SUPABASE_URL !== 'undefined' && key === 'url') return OC_SUPABASE_URL;
    if (typeof OC_SUPABASE_ANON_KEY !== 'undefined' && key === 'anonKey') return OC_SUPABASE_ANON_KEY;
    return localStorage.getItem('oc_supabase_' + key) || null;
  },

  setConfig(url, anonKey) {
    localStorage.setItem('oc_supabase_url', url);
    localStorage.setItem('oc_supabase_anonKey', anonKey);
    this.init();
  },

  async ensureAuth() {
    if (!this.enabled || !this.client) return null;

    const { data: { session } } = await this.client.auth.getSession();
    if (session) return session.user;

    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) {
      console.warn('[SupabaseDB] Anonymous auth failed:', error.message);
      return null;
    }
    return data.user;
  },

  async addCreature(imageData, type, aiData = {}) {
    if (!this.enabled) return null;

    const user = await this.ensureAuth();
    if (!user) return null;

    let imagePath = null;

    if (this.client.storage) {
      try {
        const filename = `${user.id}/${Date.now()}-${type}.png`;
        const blob = await fetch(imageData).then(r => r.blob());
        const { error: uploadError } = await this.client.storage
          .from('creature-images')
          .upload(filename, blob, { contentType: 'image/png', upsert: false });

        if (!uploadError) {
          imagePath = filename;
        }
      } catch (err) {
        console.warn('[SupabaseDB] Image upload failed:', err.message);
      }
    }

    const { data, error } = await this.client
      .from('creatures')
      .insert({
        user_id: user.id,
        type,
        image_path: imagePath,
        image_data: imageData.length < 500000 ? imageData : null,
        emoji: CREATURE_TYPES[type]?.emoji || '🐟',
        ai_similarity: aiData.similarity || 0,
        ai_creativity: aiData.creativity || 0,
        status: aiData.isMatch !== false ? 'active' : 'pending',
      })
      .select()
      .single();

    if (error) {
      console.warn('[SupabaseDB] Insert failed:', error.message);
      return null;
    }

    if (user) {
      await this.client.rpc('increment_profile_field', {
        user_id: user.id,
        field: 'creatures_count',
        amount: 1,
      }).catch(() => {});
    }

    return data;
  },

  async getCreatures(sort = 'recent', limit = 50) {
    if (!this.enabled) return null;

    let query = this.client
      .from('creatures')
      .select('id, type, image_path, image_data, emoji, ai_similarity, ai_creativity, score, votes, created_at')
      .eq('status', 'active')
      .limit(limit);

    switch (sort) {
      case 'popular':
      case 'score':
        query = query.order('score', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'hot':
        query = query.order('score', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[SupabaseDB] Fetch failed:', error.message);
      return null;
    }

    if (!data || data.length === 0) return [];

    return data
      .map(c => ({
        ...c,
        imageData: c.image_data || (c.image_path ? this.getPublicUrl(c.image_path) : null),
      }))
      .filter(c => c.imageData);
  },

  async voteCreature(creatureId, delta) {
    if (!this.enabled) return null;

    const user = await this.ensureAuth();
    if (!user) return null;

    const { error: deleteError } = await this.client
      .from('votes')
      .delete()
      .eq('creature_id', creatureId)
      .eq('user_id', user.id);

    const { data, error } = await this.client
      .from('votes')
      .insert({
        creature_id: creatureId,
        user_id: user.id,
        delta,
      })
      .select()
      .single();

    if (error) {
      console.warn('[SupabaseDB] Vote failed:', error.message);
      return null;
    }

    const { data: creature } = await this.client
      .from('creatures')
      .select('score, votes')
      .eq('id', creatureId)
      .single();

    return creature;
  },

  async reportCreature(creatureId, reason = '') {
    if (!this.enabled) return false;

    const user = await this.ensureAuth();
    if (!user) return false;

    const { error } = await this.client
      .from('reports')
      .insert({
        creature_id: creatureId,
        reporter_id: user.id,
        reason,
      });

    if (!error) {
      await this.client
        .from('creatures')
        .update({ status: 'flagged' })
        .eq('id', creatureId);
    }

    return !error;
  },

  getPublicUrl(path) {
    if (!this.enabled || !path) return null;
    const { data } = this.client.storage.from('creature-images').getPublicUrl(path);
    return data?.publicUrl || null;
  },

  async getProfile() {
    if (!this.enabled) return null;

    const { data: { session } } = await this.client.auth.getSession();
    if (!session) return null;

    const { data } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return data;
  },

  async signInWithEmail(email, password) {
    if (!this.enabled) return null;
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return error ? null : data;
  },

  async signUp(email, password, displayName) {
    if (!this.enabled) return null;
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return error ? null : data;
  },

  async signOut() {
    if (!this.enabled) return;
    await this.client.auth.signOut();
  },

  getSession() {
    if (!this.enabled) return null;
    return this.client.auth.getSession();
  },
};

if (typeof module !== 'undefined') module.exports = SupabaseDB;
