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
  let isCheckingAI = false;

  const AI_ENDPOINT = '/api/classify';

  const typeHints = {
    fish: '💡 面向右方绘制效果最佳',
    jellyfish: '💡 从顶部画伞，向下延伸触手',
    octopus: '💡 画圆头和向下延伸的触腕',
    turtle: '💡 画椭圆壳和四肢',
    crab: '💡 正面视角，画壳和两侧蟹钳',
    whale: '💡 大体型，面向右方',
    shark: '💡 流线型，面向右方',
    seahorse: '💡 S形身体，头部朝上'
  };

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();

  function saveState() {
    if (history.length >= MAX_HISTORY) history.shift();
    history.push(canvas.toDataURL());
  }

  function undo() {
    if (history.length <= 1) return;
    history.pop();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[history.length - 1];
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
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
    }
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
    brushSize = parseInt(this.value);
    sizeLabel.textContent = brushSize;
  });

  document.getElementById('undo-btn').addEventListener('click', undo);

  document.getElementById('clear-btn').addEventListener('click', function() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
    aiScore = null;
    updateScoreDisplay();
  });

  document.querySelectorAll('.creature-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.creature-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentType = this.dataset.type;
      const hint = document.getElementById('hint-text');
      hint.textContent = typeHints[currentType] || '';
    });
  });

  function isCanvasBlank() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 13 || data[i+1] !== 17 || data[i+2] !== 23) return false;
    }
    return true;
  }

  async function checkWithAI() {
    if (isCanvasBlank() || isCheckingAI) return null;

    isCheckingAI = true;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const formData = new FormData();
      formData.append('image', blob, 'creature.png');
      formData.append('type', currentType);

      const resp = await fetch(AI_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) throw new Error('AI check failed');
      const result = await resp.json();
      aiScore = result;
      updateScoreDisplay();
      return result;
    } catch (err) {
      console.warn('AI classification unavailable, using fallback:', err);
      aiScore = { similarity: 0.7, isMatch: true, creativity: 50, feedback: 'AI暂不可用，作品已通过' };
      updateScoreDisplay();
      return aiScore;
    } finally {
      isCheckingAI = false;
    }
  }

  function updateScoreDisplay() {
    let display = document.getElementById('ai-score-display');
    if (!display) {
      display = document.createElement('div');
      display.id = 'ai-score-display';
      display.style.cssText = 'text-align:center;margin-top:4px;font-size:0.8rem;min-height:20px;transition:all 0.3s ease';
      const hint = document.getElementById('hint-text');
      hint.parentNode.insertBefore(display, hint.nextSibling);
    }

    if (!aiScore) {
      display.innerHTML = '';
      return;
    }

    const sim = Math.round(aiScore.similarity * 100);
    const cre = aiScore.creativity || 0;
    const isMatch = aiScore.isMatch;
    const simColor = sim >= 60 ? 'var(--neon-green)' : sim >= 30 ? 'var(--neon-gold)' : 'var(--neon-magenta)';
    const matchIcon = isMatch ? '✅' : '⚠️';

    display.innerHTML = `
      <span style="color:${simColor}">${matchIcon} 相似度 ${sim}%</span>
      <span style="margin:0 8px;color:var(--text-muted)">|</span>
      <span style="color:var(--neon-cyan)">🎨 创意分 ${cre}</span>
      ${aiScore.feedback ? `<span style="margin:0 8px;color:var(--text-muted)">|</span><span style="color:var(--text-secondary)">${aiScore.feedback}</span>` : ''}
    `;
  }

  let checkTimeout = null;
  function debouncedAICheck() {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => checkWithAI(), 1500);
  }

  canvas.addEventListener('mouseup', debouncedAICheck);
  canvas.addEventListener('touchend', debouncedAICheck);

  document.getElementById('swim-btn').addEventListener('click', async function() {
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'AI识别中...';

    const result = await checkWithAI();
    const similarity = result ? result.similarity : 0.7;
    const isMatch = result ? result.isMatch : true;
    const creativity = result ? result.creativity : 50;

    if (!isMatch && similarity < 0.3) {
      btn.disabled = false;
      btn.textContent = '放入深海 🌊';
      showLowScoreModal(similarity, creativity);
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    const imageData = tempCanvas.toDataURL('image/png');
    const creature = addCreature(imageData, currentType);
    creature.aiSimilarity = similarity;
    creature.aiCreativity = creativity;

    if (isMatch) {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 通过识别！相似度${Math.round(similarity*100)}%`);
    } else {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 已提交审核（相似度${Math.round(similarity*100)}%）`);
    }

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history = [];
    saveState();
    aiScore = null;
    updateScoreDisplay();

    btn.disabled = false;
    btn.textContent = '放入深海 🌊';

    setTimeout(() => {
      window.location.href = 'ocean.html';
    }, 1200);
  });

  function showLowScoreModal(similarity, creativity) {
    let modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(8px)';

    const sim = Math.round(similarity * 100);
    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--neon-magenta);border-radius:16px;padding:30px;max-width:400px;text-align:center;box-shadow:0 0 40px rgba(255,0,255,0.2)">
        <div style="font-size:2rem;margin-bottom:12px">🤔</div>
        <div style="font-family:Orbitron,monospace;font-size:1.2rem;color:var(--neon-magenta);margin-bottom:12px">相似度较低</div>
        <div style="color:var(--text-secondary);font-size:0.85rem;line-height:1.6;margin-bottom:8px">
          AI识别相似度仅 <strong style="color:var(--neon-magenta)">${sim}%</strong>，低于60%通过线
        </div>
        <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:20px">
          💡 试试：画更明显的轮廓、加上眼睛/鳍等特征
        </div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="modal-retry" style="padding:8px 20px;border:1px solid var(--neon-cyan);border-radius:8px;background:transparent;color:var(--neon-cyan);cursor:pointer;font-family:JetBrains Mono,monospace">继续画</button>
          <button id="modal-force" style="padding:8px 20px;border:1px solid var(--neon-magenta);border-radius:8px;background:transparent;color:var(--neon-magenta);cursor:pointer;font-family:JetBrains Mono,monospace">强制提交</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-retry').onclick = () => modal.remove();
    modal.querySelector('#modal-force').onclick = () => {
      modal.remove();
      forceSubmit();
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  function forceSubmit() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    const imageData = tempCanvas.toDataURL('image/png');
    addCreature(imageData, currentType);
    showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 已强制提交（待审核）`);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history = [];
    saveState();
    aiScore = null;
    updateScoreDisplay();

    setTimeout(() => {
      window.location.href = 'ocean.html';
    }, 1200);
  }

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });
})();
