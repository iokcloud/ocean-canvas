(function() {
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0, lastY = 0;
  let currentTool = 'brush';
  let brushColor = '#00e5ff';
  let brushSize = 4;
  let currentType = 'fish';
  let history = [];
  const MAX_HISTORY = 30;
  let aiScore = null;
  let aiApproved = false;
  let aiCheckTimer = null;
  let aiCheckSeq = 0;
  let serverCheckInFlight = false;

  const passThreshold = (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.passSimilarity) || 0.6;
  const debounceMs = (typeof AI_CONFIG !== 'undefined' && AI_CONFIG.debounceMs) || 1500;
  const aiEnabled = typeof FEATURES === 'undefined' || FEATURES.aiClassification;

  function t(key, fallback) {
    return typeof I18n !== 'undefined' ? I18n.t(key) : fallback;
  }

  function getTypeHint(type) {
    return t('type_hint_' + type, '');
  }

  let drawW = 480, drawH = 280;

  function initCanvas(preserveContent) {
    const wrapper = canvas.parentElement;
    drawW = Math.min(480, wrapper.clientWidth - 4);
    drawH = Math.round(drawW * 280 / 480);

    let savedImage = null;
    if (preserveContent && canvas.width > 0 && canvas.height > 0) {
      try { savedImage = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) {}
    }

    canvas.width = drawW;
    canvas.height = drawH;
    canvas.style.width = drawW + 'px';
    canvas.style.height = drawH + 'px';

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, drawW, drawH);

    if (savedImage) {
      try { ctx.putImageData(savedImage, 0, 0); } catch (e) {}
    }

    if (!preserveContent) {
      history = [];
      saveState();
    }
  }

  initCanvas(false);
  window.addEventListener('resize', () => { initCanvas(true); });

  function saveState() {
    if (history.length >= MAX_HISTORY) history.shift();
    history.push(canvas.toDataURL());
  }

  function undo() {
    if (history.length <= 1) return;
    history.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.drawImage(img, 0, 0);
      scheduleAICheck();
    };
    img.src = history[history.length - 1];
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = drawW / rect.width;
    const scaleY = drawH / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getCanvasPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = currentTool === 'eraser' ? '#0d1117' : brushColor;
    ctx.lineWidth = currentTool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = currentTool === 'eraser' ? 1 : 0.9;
    ctx.stroke();
    ctx.globalAlpha = 1;

    lastX = pos.x;
    lastY = pos.y;
  }

  function endDraw() {
    if (isDrawing) {
      isDrawing = false;
      saveState();
      scheduleAICheck();
    }
  }

  function isCanvasBlank() {
    const w = drawW, h = drawH;
    const step = Math.max(1, Math.floor(Math.sqrt(w * h) / 60));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i] !== 13 || data[i + 1] !== 17 || data[i + 2] !== 23) return false;
      }
    }
    return true;
  }

  function resetAIScore() {
    aiScore = null;
    aiApproved = false;
    updateSwimBtn();
  }

  function scheduleAICheck() {
    if (aiCheckTimer) clearTimeout(aiCheckTimer);
    if (isCanvasBlank()) {
      const display = document.getElementById('ai-score-display');
      if (display) display.innerHTML = '';
      resetAIScore();
      return;
    }

    runLocalPreview();
    aiCheckTimer = setTimeout(() => runServerAICheck(), debounceMs);
  }

  function runLocalPreview() {
    if (typeof LocalAI === 'undefined') return;
    const local = LocalAI.analyze(canvas, ctx, currentType);
    aiScore = {
      draftCompletion: local.draftCompletion,
      similarity: null,
      creativity: local.creativity,
      isMatch: false,
      verified: false,
      feedback: local.feedback,
      isScribble: local.isScribble,
    };
    aiApproved = false;
    updateSwimBtn();
    updateScoreDisplay({ checking: !aiEnabled });
  }

  async function runServerAICheck() {
    if (!aiEnabled) {
      aiApproved = true;
      aiScore = { similarity: 0.7, creativity: 50, isMatch: true, verified: true, draftCompletion: 0.3 };
      updateSwimBtn();
      updateScoreDisplay({});
      return;
    }

    if (isCanvasBlank()) return;

    const seq = ++aiCheckSeq;
    serverCheckInFlight = true;
    updateScoreDisplay({ checking: true });

    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob failed'))), 'image/png');
      });

      const form = new FormData();
      form.append('image', blob, 'creature.png');
      form.append('type', currentType);

      const res = await fetch('/api/classify', { method: 'POST', body: form });
      if (seq !== aiCheckSeq) return;

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.aiUnavailable || data.errorCode === 'AI_BINDING_MISSING') {
        throw new Error('AI_BINDING_MISSING');
      }
      if (data.error) throw new Error(data.error);

      const similarity = typeof data.similarity === 'number' ? data.similarity : 0;
      const creativity = typeof data.creativity === 'number' ? data.creativity : 0;
      const isMatch = similarity >= passThreshold;

      const local = typeof LocalAI !== 'undefined'
        ? LocalAI.analyze(canvas, ctx, currentType)
        : { draftCompletion: 0, isScribble: false };

      aiScore = {
        draftCompletion: local.draftCompletion,
        similarity,
        creativity,
        isMatch,
        verified: true,
        feedback: data.feedback || '',
        suggestedType: data.suggestedType,
        isScribble: local.isScribble,
      };
      aiApproved = isMatch;
      updateSwimBtn();
      updateScoreDisplay({});
    } catch (err) {
      if (seq !== aiCheckSeq) return;
      console.warn('[draw] AI classify failed:', err.message);
      const isBinding = err.message === 'AI_BINDING_MISSING';
      aiScore = Object.assign({}, aiScore || {}, {
        similarity: isBinding ? 0 : null,
        verified: isBinding,
        isMatch: false,
        creativity: isBinding ? 0 : (aiScore?.creativity || 0),
        feedback: isBinding
          ? t('ai_binding_missing', 'AI service not configured on server. Contact admin or try later.')
          : t('ai_error_retry', 'AI unavailable, try again in a moment'),
        aiUnavailable: isBinding,
      });
      aiApproved = false;
      updateSwimBtn();
      updateScoreDisplay({ error: true, bindingMissing: isBinding });
    } finally {
      if (seq === aiCheckSeq) serverCheckInFlight = false;
    }
  }

  function updateScoreDisplay(opts) {
    opts = opts || {};
    let display = document.getElementById('ai-score-display');
    if (!display) {
      display = document.createElement('div');
      display.id = 'ai-score-display';
      display.style.cssText = 'text-align:center;margin-top:4px;font-size:0.8rem;min-height:20px;transition:all 0.3s ease';
      const hint = document.getElementById('hint-text');
      hint.parentNode.insertBefore(display, hint.nextSibling);
    }

    if (opts.checking) {
      display.innerHTML = `<span style="color:var(--text-muted);font-size:0.72rem">${t('ai_checking', 'AI analyzing...')}</span>`;
      return;
    }

    if (opts.error || !aiScore) {
      const color = opts.bindingMissing ? 'var(--neon-gold)' : 'var(--neon-magenta)';
      display.innerHTML = `<span style="color:${color};font-size:0.72rem;line-height:1.4">${aiScore?.feedback || t('ai_error_retry', 'AI check failed')}</span>`;
      return;
    }

    if (aiScore.aiUnavailable) {
      display.innerHTML = `<span style="color:var(--neon-gold);font-size:0.72rem">${aiScore.feedback}</span>`;
      return;
    }

    const draft = Math.round((aiScore.draftCompletion || 0) * 100);
    const parts = [
      `<span style="color:var(--text-muted);font-size:0.65rem">📝</span>`,
      `<span style="color:var(--text-secondary);font-size:0.72rem">${t('score_draft', 'Draft')} ${draft}%</span>`,
    ];

    if (aiScore.similarity != null) {
      const sim = Math.round(aiScore.similarity * 100);
      const cre = aiScore.creativity || 0;
      const simColor = sim >= 60 ? 'var(--neon-green)' : sim >= 35 ? 'var(--neon-gold)' : 'var(--neon-magenta)';
      parts.push(`<span style="margin:0 5px;color:var(--text-muted)">|</span>`);
      parts.push(`<span style="color:var(--neon-cyan);font-size:0.65rem">🤖</span>`);
      parts.push(`<span style="color:${simColor};font-size:0.78rem">${t('score_similarity', 'Similarity')} ${sim}%</span>`);
      parts.push(`<span style="margin:0 5px;color:var(--text-muted)">|</span>`);
      parts.push(`<span style="color:var(--neon-cyan);font-size:0.78rem">${t('creativity', 'Creativity')} ${cre}</span>`);

      if (aiScore.isMatch) {
        parts.push(`<span style="margin:0 5px;color:var(--text-muted)">|</span>`);
        parts.push(`<span style="color:var(--neon-green);font-size:0.65rem">${t('ai_unlocked', '✓ Ready to release')}</span>`);
      } else {
        parts.push(`<span style="margin:0 5px;color:var(--text-muted)">|</span>`);
        const tip = aiScore.feedback || (aiScore.isScribble ? t('ai_feedback_scribble', '') : t('ai_modify', 'Add clearer creature features'));
        parts.push(`<span style="color:var(--neon-magenta);font-size:0.65rem">${tip}</span>`);
      }
    } else {
      parts.push(`<span style="margin:0 5px;color:var(--text-muted)">|</span>`);
      parts.push(`<span style="color:var(--text-muted);font-size:0.65rem">${t('ai_feedback_wait_ai', 'Pause for AI similarity check')}</span>`);
    }

    display.innerHTML = parts.join('');
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw);

  document.getElementById('brush-tool').addEventListener('click', function() {
    currentTool = 'brush';
    this.classList.add('active');
    document.getElementById('eraser-tool').classList.remove('active');
  });

  document.getElementById('eraser-tool').addEventListener('click', function() {
    currentTool = 'eraser';
    this.classList.add('active');
    document.getElementById('brush-tool').classList.remove('active');
  });

  document.getElementById('color-picker').addEventListener('input', function() {
    brushColor = this.value;
  });

  document.querySelectorAll('[data-color]').forEach(btn => {
    btn.addEventListener('click', function() {
      brushColor = this.dataset.color;
      document.getElementById('color-picker').value = brushColor;
    });
  });

  const sizeSlider = document.getElementById('brush-size');
  const sizeLabel = document.getElementById('size-label');
  sizeSlider.addEventListener('input', function() {
    brushSize = parseInt(this.value, 10);
    sizeLabel.textContent = brushSize;
  });

  document.getElementById('undo-btn').addEventListener('click', function() {
    undo();
  });

  document.getElementById('clear-btn').addEventListener('click', function() {
    if (aiCheckTimer) clearTimeout(aiCheckTimer);
    aiCheckSeq++;
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, drawW, drawH);
    saveState();
    const display = document.getElementById('ai-score-display');
    if (display) display.innerHTML = '';
    resetAIScore();
  });

  document.querySelectorAll('.creature-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.creature-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentType = this.dataset.type;
      document.getElementById('hint-text').textContent = getTypeHint(currentType);
      scheduleAICheck();
    });
  });

  const swimBtn = document.getElementById('swim-btn');

  function updateSwimBtn() {
    if (aiApproved) {
      swimBtn.disabled = false;
      swimBtn.style.opacity = '1';
      swimBtn.style.cursor = 'pointer';
    } else {
      swimBtn.disabled = true;
      swimBtn.style.opacity = '0.4';
      swimBtn.style.cursor = 'not-allowed';
    }
  }

  swimBtn.addEventListener('click', async function() {
    if (isCanvasBlank()) {
      showToast(t('toast_blank', 'Canvas is blank'));
      return;
    }

    if (!aiScore || !aiScore.verified) {
      showToast(t('ai_wait_verify', 'Wait for AI check to finish'));
      await runServerAICheck();
      if (!aiApproved) {
        showToast(t('toast_need_score', 'Score too low, add more detail'));
        return;
      }
    }

    if (!aiApproved) {
      showToast(t('toast_need_score', 'Score too low, add more detail'));
      return;
    }

    swimBtn.disabled = true;
    try {
      await doSubmitCreature(aiScore.similarity, aiScore.isMatch, aiScore.creativity);
    } finally {
      updateSwimBtn();
    }
  });

  async function doSubmitCreature(similarity, isMatch, creativity) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawW;
    tempCanvas.height = drawH;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

    const imageData = tempCanvas.toDataURL('image/png');
    const creature = await addCreature(imageData, currentType, { similarity, creativity, isMatch });

    if (typeof DailyChallenge !== 'undefined' && DailyChallenge.checkCompletion(currentType)) {
      showToast(I18n.locale === 'zh' ? '🎉 每日挑战完成！双倍经验！' : '🎉 Daily challenge complete! Bonus XP!');
    }

    if (typeof AchievementSystem !== 'undefined') {
      AchievementSystem.addXP(Math.round(similarity * 50 + creativity));
      setTimeout(() => AchievementSystem.checkBadges(AchievementSystem.getStats()), 500);
    }

    if (creature && creature.source === 'global') {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} ${t('toast_global_released', 'Released to global ocean!')}`);
    } else if (isMatch) {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} ${t('toast_released', 'released!')}`);
    } else {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} ${t('toast_pending', 'submitted (pending)')}`);
    }

    if (aiCheckTimer) clearTimeout(aiCheckTimer);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, drawW, drawH);
    history = [];
    saveState();
    resetAIScore();
    document.getElementById('ai-score-display').innerHTML = '';
    showShareModal(tempCanvas, { type: currentType, similarity, creativity, isMatch });
  }

  function showShareModal(creatureCanvas, data) {
    const sim = Math.round((data.similarity || 0) * 100);
    const cre = data.creativity || 50;
    const typeInfo = CREATURE_TYPES[data.type] || CREATURE_TYPES.fish;
    const passedText = data.isMatch ? '✅ ' + t('ai_score_pass', 'Passed') : '⚠️ ' + t('toast_pending', 'Pending');

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(10px)';

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:28px;max-width:420px;text-align:center;box-shadow:0 0 50px rgba(0,229,255,0.15)">
        <div style="font-size:2.5rem;margin-bottom:8px">${typeInfo.emoji}</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-cyan);margin-bottom:16px">${typeInfo.name}</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:20px">
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">${t('score_similarity', 'Similarity')}</div>
            <div style="color:${sim >= 60 ? 'var(--neon-green)' : 'var(--neon-gold)'};font-size:1.4rem;font-weight:700">${sim}%</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">${t('creativity', 'Creativity')}</div>
            <div style="color:var(--neon-cyan);font-size:1.4rem;font-weight:700">${cre}</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">${t('status', 'Status')}</div>
            <div style="font-size:0.85rem">${passedText}</div>
          </div>
        </div>
        <div style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:18px">${t('share_title', 'Share your artwork')}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <button id="share-native" style="padding:10px;border:1px solid var(--neon-cyan);border-radius:10px;background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,229,255,0.05));color:var(--neon-cyan);cursor:pointer;font-family:Orbitron,monospace;font-size:0.85rem">${t('share_btn', 'Share')}</button>
          <div style="display:flex;gap:8px">
            <button id="share-twitter" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">Twitter</button>
            <button id="share-reddit" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">Reddit</button>
            <button id="share-download" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">${t('share_download', 'Save')}</button>
          </div>
        </div>
        <a href="ocean.html" style="display:block;color:var(--text-muted);font-size:0.78rem;text-decoration:none">${t('share_go_ocean', 'Enter Ocean')}</a>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#share-native').onclick = () => {
      if (typeof ShareSystem !== 'undefined') ShareSystem.share(creatureCanvas, data);
    };
    modal.querySelector('#share-twitter').onclick = () => {
      if (typeof ShareSystem !== 'undefined') ShareSystem.shareToTwitter(data);
    };
    modal.querySelector('#share-reddit').onclick = () => {
      if (typeof ShareSystem !== 'undefined') ShareSystem.shareToReddit(data);
    };
    modal.querySelector('#share-download').onclick = async () => {
      if (typeof ShareSystem !== 'undefined') {
        const blob = await ShareSystem.generateShareImage(creatureCanvas, data);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ocean-canvas-${data.type}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });
})();
