const STORAGE_KEY = 'ocean_canvas_creatures';

const AI_CONFIG = {
  passSimilarity: 0.6,
};

const FEATURES = {
  aiClassification: localStorage.getItem('oc_ai_off') !== 'true',
  devMode: localStorage.getItem('oc_dev') === 'true',
  decorationShop: localStorage.getItem('oc_deco') !== 'off',
  socialFeatures: localStorage.getItem('oc_social') !== 'off',
  analytics: localStorage.getItem('oc_analytics_off') !== 'true',
  globalPool: typeof OC_SUPABASE_URL !== 'undefined' && typeof OC_SUPABASE_ANON_KEY !== 'undefined',
};

const CREATURE_TYPES = {
  fish: { emoji: '🐟', name: '鱼', speed: 1.5, wobble: 0.8 },
  jellyfish: { emoji: '🪼', name: '水母', speed: 0.4, wobble: 1.2 },
  octopus: { emoji: '🐙', name: '章鱼', speed: 0.8, wobble: 1.0 },
  turtle: { emoji: '🐢', name: '海龟', speed: 0.7, wobble: 0.5 },
  crab: { emoji: '🦀', name: '螃蟹', speed: 0.5, wobble: 0.2 },
  whale: { emoji: '🐋', name: '鲸鱼', speed: 0.6, wobble: 0.3 },
  shark: { emoji: '🦈', name: '鲨鱼', speed: 2.0, wobble: 0.4 },
  seahorse: { emoji: '🌊', name: '海马', speed: 0.5, wobble: 0.9 }
};

function saveCreatures(creatures) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creatures));
  } catch (e) {
    console.warn('Storage full, trimming old entries');
    const trimmed = creatures.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

async function addCreature(imageData, type, aiData) {
  if (typeof GlobalPool !== 'undefined' && GlobalPool.isEnabled()) {
    const creature = await GlobalPool.submit(imageData, type, aiData || {});
    if (creature && typeof MemorySystem !== 'undefined') {
      MemorySystem.record('user_behavior', { action: 'creature_saved_global', type, id: creature.id });
    }
    return creature;
  }

  const creatures = getCreatures();
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
  saveCreatures(creatures);
  return creature;
}

async function voteCreature(id, delta) {
  if (typeof GlobalPool !== 'undefined' && GlobalPool.isEnabled()) {
    const result = await GlobalPool.vote(id, delta);
    if (result) return result;
  }

  const creatures = getCreatures();
  const c = creatures.find(x => x.id === id);
  if (c) {
    c.score += delta;
    c.votes += 1;
    saveCreatures(creatures);
  }
  return c;
}

function getCreatures() {
  if (typeof GlobalPool !== 'undefined' && GlobalPool.isEnabled()) {
    const cached = GlobalPool.getCached();
    if (cached.length > 0) return cached;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function getSortedCreatures(sort) {
  if (typeof GlobalPool !== 'undefined') {
    return GlobalPool.fetch(sort || 'recent');
  }

  const creatures = getCreatures();
  if (creatures.length === 0) {
    seedDefaultCreatures();
    return getSortedCreatures(sort);
  }
  switch (sort) {
    case 'popular':
    case 'score':
      return [...creatures].sort((a, b) => b.score - a.score);
    case 'recent':
      return [...creatures].sort((a, b) => b.createdAt - a.createdAt);
    case 'hot':
      return [...creatures].sort((a, b) => {
        const scoreA = a.score / Math.max(1, Math.pow((Date.now() - a.createdAt) / 3600000 + 2, 1.5));
        const scoreB = b.score / Math.max(1, Math.pow((Date.now() - b.createdAt) / 3600000 + 2, 1.5));
        return scoreB - scoreA;
      });
    case 'random':
      return [...creatures].sort(() => Math.random() - 0.5);
    default:
      return creatures;
  }
}

function buildSeedCreatures() {
  const imgs = [
    createDefaultFish('#00e5ff', '#0088aa'),
    createDefaultFish('#ff00ff', '#aa0088'),
    createDefaultFish('#00ff88', '#00aa55'),
    createDefaultJellyfish(),
    createDefaultTurtle(),
    createDefaultFish('#ffd700', '#cc8800'),
    createDefaultJellyfish(),
    createDefaultTurtle(),
  ];
  const types = ['fish', 'fish', 'fish', 'jellyfish', 'turtle', 'fish', 'jellyfish', 'turtle'];
  return imgs.map((imageData, i) => ({
    imageData,
    type: types[i],
  }));
}

function seedDefaultCreatures() {
  const creatures = getCreatures();
  if (creatures.length > 0) return;

  const defaults = [
    createDefaultFish('#00e5ff', '#0088aa'),
    createDefaultFish('#ff00ff', '#aa0088'),
    createDefaultFish('#00ff88', '#00aa55'),
    createDefaultJellyfish(),
    createDefaultTurtle()
  ];

  defaults.forEach((imgData, i) => {
    const types = ['fish', 'fish', 'fish', 'jellyfish', 'turtle'];
    creatures.push({
      id: 'default_' + i,
      imageData: imgData,
      type: types[i],
      score: Math.floor(Math.random() * 20) + 5,
      votes: Math.floor(Math.random() * 10) + 2,
      createdAt: Date.now() - (5 - i) * 86400000,
      emoji: CREATURE_TYPES[types[i]]?.emoji || '🐟'
    });
  });

  saveCreatures(creatures);
}

function createDefaultFish(color1, color2) {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 280;
  const ctx = c.getContext('2d');
  const cx = 240, cy = 140;

  ctx.fillStyle = color1;
  ctx.beginPath();
  ctx.moveTo(cx + 80, cy);
  ctx.quadraticCurveTo(cx + 40, cy - 35, cx - 20, cy - 30);
  ctx.quadraticCurveTo(cx - 60, cy - 20, cx - 70, cy);
  ctx.quadraticCurveTo(cx - 60, cy + 20, cx - 20, cy + 30);
  ctx.quadraticCurveTo(cx + 40, cy + 35, cx + 80, cy);
  ctx.fill();

  ctx.fillStyle = color2;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 25);
  ctx.lineTo(cx - 75, cy - 40);
  ctx.lineTo(cx - 65, cy - 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 25);
  ctx.lineTo(cx - 75, cy + 40);
  ctx.lineTo(cx - 65, cy + 10);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 45, cy - 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cx + 47, cy - 8, 3, 0, Math.PI * 2);
  ctx.fill();

  return c.toDataURL();
}

function createDefaultJellyfish() {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 280;
  const ctx = c.getContext('2d');
  const cx = 240, cy = 100;

  const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 50);
  grad.addColorStop(0, 'rgba(255, 0, 255, 0.8)');
  grad.addColorStop(1, 'rgba(100, 0, 255, 0.2)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 45, Math.PI, 0);
  ctx.quadraticCurveTo(cx + 50, cy + 20, cx, cy + 15);
  ctx.quadraticCurveTo(cx - 50, cy + 20, cx - 45, cy);
  ctx.fill();

  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = `rgba(255, 100, 255, ${0.3 + Math.random() * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + i * 10, cy + 15);
    for (let y = 0; y < 120; y += 5) {
      ctx.lineTo(cx + i * 10 + Math.sin(y * 0.05 + i) * 8, cy + 15 + y);
    }
    ctx.stroke();
  }

  return c.toDataURL();
}

function createDefaultTurtle() {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 280;
  const ctx = c.getContext('2d');
  const cx = 240, cy = 140;

  ctx.fillStyle = '#2d8b57';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 50, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a5c38';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + (i - 3) * 12, cy, 10, 25, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#3da86a';
  ctx.beginPath();
  ctx.ellipse(cx + 55, cy, 18, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + 62, cy - 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cx + 63, cy - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  const flipperPositions = [[-30, -30, -0.8], [-30, 30, 0.8], [30, -25, -0.5], [30, 25, 0.5]];
  ctx.fillStyle = '#3da86a';
  flipperPositions.forEach(([dx, dy, angle]) => {
    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  return c.toDataURL();
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

if (!FEATURES.globalPool) {
  seedDefaultCreatures();
}
