(function() {
  const canvas = document.getElementById('ocean-canvas');
  const ctx = canvas.getContext('2d');
  let creatures = [];
  let bubbles = [];
  let particles = [];
  let foodPellets = [];
  let showBubbles = true;
  let currentSort = 'recent';
  let animFrameId;
  let W = 0, H = 0;

  function resize() {
    const wrapper = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = wrapper.clientWidth;
    H = wrapper.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', () => { resize(); initBubbles(); });

  const NEW_CREATURE_MS = 120000;

  async function loadCreatures() {
    const sort = document.getElementById('tank-sort')?.value || currentSort;
    const data = await getSortedCreatures(sort);
    const now = Date.now();
    creatures = data.map(c => {
      const img = new Image();
      img.onerror = () => { img._failed = true; };
      img.src = c.imageData;
      const typeInfo = CREATURE_TYPES[c.type] || CREATURE_TYPES.fish;
      const scale = 0.3 + Math.random() * 0.3;
      const isNew = (now - (c.createdAt || 0)) < NEW_CREATURE_MS;
      return {
        ...c,
        img,
        x: Math.random() * W,
        y: 50 + Math.random() * (H - 150),
        vx: (0.3 + Math.random() * 0.7) * typeInfo.speed * (Math.random() > 0.5 ? 1 : -1),
        vy: 0,
        scale,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        wobbleAmp: typeInfo.wobble * (5 + Math.random() * 10),
        targetX: null,
        targetY: null,
        glowColor: getGlowColor(c.type),
        glowIntensity: isNew ? 1 : 0,
        isNew,
      };
    });
    updateCount();
    if (typeof GlobalPool !== 'undefined') {
      GlobalPool.renderStatusBadge(creatures.length);
    }
  }

  function getGlowColor(type) {
    const colors = {
      fish: 'rgba(0, 229, 255, 0.15)',
      jellyfish: 'rgba(255, 0, 255, 0.2)',
      octopus: 'rgba(128, 0, 255, 0.15)',
      turtle: 'rgba(0, 255, 136, 0.12)',
      crab: 'rgba(255, 100, 0, 0.12)',
      whale: 'rgba(100, 150, 255, 0.1)',
      shark: 'rgba(200, 200, 255, 0.08)',
      seahorse: 'rgba(255, 200, 0, 0.15)'
    };
    return colors[type] || colors.fish;
  }

  function updateCount() {
    const el = document.getElementById('creature-count');
    if (el) el.textContent = creatures.length;
  }

  function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 30; i++) {
      bubbles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 2 + Math.random() * 6,
        speed: 0.3 + Math.random() * 0.8,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#020818');
    grad.addColorStop(0.3, '#051530');
    grad.addColorStop(0.6, '#0a2040');
    grad.addColorStop(1, '#0d1830');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 5; i++) {
      const y = H * 0.7 + i * 40;
      ctx.fillStyle = `rgba(0, 229, 255, ${0.01 + i * 0.003})`;
      ctx.fillRect(0, y, W, 2);
    }
  }

  function drawLightRays(time) {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const x = W * 0.15 + i * W * 0.25;
      const sway = Math.sin(time * 0.0003 + i * 1.2) * 30;
      const grad = ctx.createLinearGradient(x + sway, 0, x + sway + 60, H * 0.5);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x + sway - 20, 0);
      ctx.lineTo(x + sway + 40, 0);
      ctx.lineTo(x + sway + 80 + Math.sin(time * 0.001) * 10, H * 0.5);
      ctx.lineTo(x + sway - 40 + Math.sin(time * 0.001) * 10, H * 0.5);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBubbles(time) {
    if (!showBubbles) return;
    bubbles.forEach(b => {
      b.y -= b.speed;
      b.x += Math.sin(time * 0.002 + b.wobble) * 0.3;
      b.wobble += 0.01;

      if (b.y < -20) {
        b.y = H + 10;
        b.x = Math.random() * W;
      }

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 229, 255, ${0.06 + b.r * 0.01})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.1 + b.r * 0.02})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
    });
  }

  function drawSeabed() {
    const y = H - 40;
    ctx.fillStyle = '#0a1520';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.02) * 8 + Math.sin(x * 0.05) * 4);
    }
    ctx.lineTo(W, H);
    ctx.fill();

    for (let i = 0; i < 8; i++) {
      const sx = 50 + i * (W / 8) + Math.sin(i) * 30;
      const sy = y + Math.sin(sx * 0.02) * 8;
      drawSeaweed(sx, sy, time => 0);
    }
  }

  function drawSeaweed(x, y, _time) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 180, 80, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 40; i++) {
      const dy = i * 1.5;
      const dx = Math.sin(i * 0.2 + Date.now() * 0.001) * 6;
      ctx.lineTo(x + dx, y - dy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCreatures(time) {
    creatures.forEach(c => {
      const imgFailed = c.img._failed;
      if (!imgFailed && (!c.img.complete || c.img.naturalWidth === 0)) return;

      const typeInfo = CREATURE_TYPES[c.type] || CREATURE_TYPES.fish;
      c.wobblePhase += c.wobbleSpeed;
      c.vy = Math.sin(c.wobblePhase) * c.wobbleAmp * 0.02;

      if (c.targetX !== null) {
        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        c.vx += dx * 0.001;
        c.vy += dy * 0.005;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
          c.targetX = null;
          c.targetY = null;
        }
      }

      if (foodPellets.length > 0) {
        const nearest = foodPellets.reduce((best, fp) => {
          const d = Math.hypot(fp.x - c.x, fp.y - c.y);
          return d < best.d ? { d, fp } : best;
        }, { d: Infinity, fp: null });
        if (nearest.d < 300) {
          c.targetX = nearest.fp.x;
          c.targetY = nearest.fp.y;
        }
      }

      c.x += c.vx;
      c.y += c.vy;

      const w = c.img.naturalWidth * c.scale;
      const h = c.img.naturalHeight * c.scale;

      if (c.x > W + w) c.x = -w;
      if (c.x < -w) c.x = W + w;
      if (c.y < 20) c.y = 20;
      if (c.y > H - 80) c.y = H - 80;

      ctx.save();
      ctx.translate(c.x, c.y);

      const facingLeft = c.vx < 0;
      if (facingLeft) {
        ctx.scale(-1, 1);
      }

      if (c.type === 'jellyfish') {
        const pulse = 1 + Math.sin(time * 0.003 + c.wobblePhase) * 0.05;
        ctx.scale(pulse, 1 / pulse);
      }

      const pulse = 0.5 + Math.sin(time * 0.002 + c.wobblePhase) * 0.3;
      c.glowIntensity = c.isNew ? Math.max(pulse, 0.85) : pulse;
      ctx.shadowColor = c.isNew ? 'rgba(0, 229, 255, 0.45)' : c.glowColor;
      ctx.shadowBlur = c.isNew ? 28 * c.glowIntensity : 15 * c.glowIntensity;

      if (imgFailed) {
        const emoji = typeInfo.emoji || '🐟';
        ctx.font = `${Math.max(16, w * 0.5)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 0, 0);
      } else {
        ctx.drawImage(c.img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    });
  }

  function drawFoodPellets(time) {
    foodPellets = foodPellets.filter(fp => {
      fp.y += 0.5;
      fp.life -= 1;
      if (fp.life <= 0) return false;

      ctx.beginPath();
      ctx.arc(fp.x, fp.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.fill();
      ctx.shadowColor = 'rgba(255, 215, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      return true;
    });
  }

  function animate(time) {
    drawBackground();
    drawLightRays(time);
    drawBubbles(time);
    drawSeabed();
    drawCreatures(time);
    drawFoodPellets(time);

    animFrameId = requestAnimationFrame(animate);
  }

  canvas.addEventListener('click', function(e) {
    if (e.shiftKey) {
      dropFood(e);
    }
  });

  canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    dropFood(e);
  });

  function dropFood(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    for (let i = 0; i < 5; i++) {
      foodPellets.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        life: 200 + Math.random() * 100
      });
    }
  }

  document.getElementById('feed-btn')?.addEventListener('click', function() {
    const x = W * 0.3 + Math.random() * W * 0.4;
    for (let i = 0; i < 8; i++) {
      foodPellets.push({
        x: x + (Math.random() - 0.5) * 60,
        y: 30 + Math.random() * 20,
        life: 300 + Math.random() * 100
      });
    }
    showToast(typeof I18n!=='undefined'?I18n.t('toast_food'):'Food dropped into the deep sea!');
  });

  document.getElementById('tank-sort')?.addEventListener('change', function() {
    currentSort = this.value;
    loadCreatures();
  });

  document.getElementById('refresh-tank')?.addEventListener('click', function() {
    loadCreatures();
    showToast(typeof I18n!=='undefined'?I18n.t('toast_refresh'):'Ocean refreshed 🌊');
  });

  document.getElementById('show-bubbles')?.addEventListener('change', function() {
    showBubbles = this.checked;
  });

  let lastTap = 0;
  canvas.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTap < 300) {
      const touch = e.changedTouches[0];
      dropFood({ clientX: touch.clientX, clientY: touch.clientY });
    }
    lastTap = now;
  });

  initBubbles();
  loadCreatures().then(() => animate(0));
})();
