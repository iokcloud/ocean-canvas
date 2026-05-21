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

  function initCanvas() {
    const wrapper = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayW = Math.min(480, wrapper.clientWidth - 4);
    const displayH = Math.round(displayW * 280 / 480);
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, displayW, displayH);
    history = [];
    saveState();
  }

  initCanvas();
  window.addEventListener('resize', () => { initCanvas(); });

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
    const w = canvas.width, h = canvas.height;
    const step = Math.max(1, Math.floor(Math.sqrt(w * h) / 60));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i] !== 13 || data[i+1] !== 17 || data[i+2] !== 23) return false;
      }
    }
    return true;
  }

  function prepareForAI() {
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tCtx = temp.getContext('2d');

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, temp.width, temp.height);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
      const isBg = (Math.abs(r - 13) < 8 && Math.abs(g - 17) < 8 && Math.abs(b - 23) < 8);
      if (!isBg && a > 16) {
        imgData.data[i] = r;
        imgData.data[i+1] = g;
        imgData.data[i+2] = b;
        imgData.data[i+3] = 255;
      } else {
        imgData.data[i] = 255;
        imgData.data[i+1] = 255;
        imgData.data[i+2] = 255;
        imgData.data[i+3] = 255;
      }
    }
    tCtx.putImageData(imgData, 0, 0);

    const cropped = cropCanvasToContent(tCtx, temp.width, temp.height);
    return cropped || temp;
  }

  function cropCanvasToContent(tCtx, w, h) {
    const step = Math.max(1, Math.floor(Math.sqrt(w * h) / 80));
    const data = tCtx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i] < 240 || data[i+1] < 240 || data[i+2] < 240) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (!found) return null;
    minX = Math.max(0, minX - step);
    minY = Math.max(0, minY - step);
    maxX = Math.min(w - 1, maxX + step);
    maxY = Math.min(h - 1, maxY + step);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const result = document.createElement('canvas');
    result.width = Math.max(cw, 1);
    result.height = Math.max(ch, 1);
    result.getContext('2d').drawImage(
      tCtx.canvas, minX, minY, cw, ch, 0, 0, result.width, result.height
    );
    return result;
  }

  async function checkWithAI() {
    if (!FEATURES.aiClassification) {
      aiScore = { similarity: 0.75, isMatch: true, creativity: 50, feedback: 'AI识别已关闭' };
      updateScoreDisplay();
      return aiScore;
    }
    if (isCanvasBlank() || isCheckingAI) return null;

    isCheckingAI = true;
    try {
      const aiCanvas = prepareForAI();
      const blob = await new Promise(resolve => aiCanvas.toBlob(resolve, 'image/png'));
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

  document.getElementById('swim-btn').addEventListener('click', async function() {
    const btn = this;
    if (btn.disabled) return;
    if (isCanvasBlank()) {
      showToast('画布还是空的，先画点什么吧 ✏️');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'AI识别中...';

    const spinner = document.getElementById('ai-spinner');
    if (spinner) spinner.style.display = 'inline-block';

    const result = await checkWithAI();
    const similarity = result ? result.similarity : 0.7;
    const isMatch = result ? result.isMatch : true;
    const creativity = result ? result.creativity : 50;

    if (spinner) spinner.style.display = 'none';
    btn.disabled = false;
    btn.textContent = '放入深海 🌊';

    showResultModal(similarity, isMatch, creativity, result?.feedback || '', result?.suggestedType);
  });

  function showResultModal(similarity, isMatch, creativity, feedback, suggestedType) {
    const sim = Math.round(similarity * 100);
    const typeInfo = CREATURE_TYPES[currentType] || CREATURE_TYPES.fish;

    let modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(10px)';

    let statusSection = '';
    if (isMatch) {
      statusSection = `
        <div style="font-size:2.5rem;margin-bottom:8px">🎉</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-green);margin-bottom:12px">通过识别！</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px">
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">相似度</div>
            <div style="color:var(--neon-green);font-size:1.6rem;font-weight:700">${sim}%</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">创意分</div>
            <div style="color:var(--neon-cyan);font-size:1.6rem;font-weight:700">${creativity}</div>
          </div>
        </div>
        ${feedback ? `<div style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:18px;padding:0 10px">${feedback}</div>` : ''}
        <button id="modal-submit" style="width:100%;padding:12px;border:1px solid var(--neon-cyan);border-radius:10px;background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,229,255,0.05));color:var(--neon-cyan);cursor:pointer;font-family:Orbitron,monospace;font-size:0.9rem;letter-spacing:1px;margin-bottom:10px">放入深海 🌊</button>
      `;
    } else if (similarity >= 0.3) {
      statusSection = `
        <div style="font-size:2.5rem;margin-bottom:8px">🤔</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-gold);margin-bottom:12px">相似度偏低</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px">
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">相似度</div>
            <div style="color:var(--neon-gold);font-size:1.6rem;font-weight:700">${sim}%</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">创意分</div>
            <div style="color:var(--neon-cyan);font-size:1.6rem;font-weight:700">${creativity}</div>
          </div>
        </div>
        ${feedback ? `<div style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:12px;padding:0 10px">${feedback}</div>` : ''}
        ${suggestedType && suggestedType !== currentType ? `<div style="color:var(--neon-magenta);font-size:0.8rem;margin-bottom:14px">💡 AI认为这更像一只${CREATURE_TYPES[suggestedType]?.name || suggestedType}？</div>` : ''}
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button id="modal-retry" style="flex:1;padding:10px;border:1px solid var(--neon-cyan);border-radius:8px;background:transparent;color:var(--neon-cyan);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.8rem">继续画</button>
          <button id="modal-submit" style="flex:1;padding:10px;border:1px solid var(--neon-gold);border-radius:8px;background:transparent;color:var(--neon-gold);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.8rem">仍然放入</button>
        </div>
      `;
    } else {
      statusSection = `
        <div style="font-size:2.5rem;margin-bottom:8px">❌</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-magenta);margin-bottom:12px">AI无法识别</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:16px">
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">相似度</div>
            <div style="color:var(--neon-magenta);font-size:1.6rem;font-weight:700">${sim}%</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">创意分</div>
            <div style="color:var(--neon-cyan);font-size:1.6rem;font-weight:700">${creativity}</div>
          </div>
        </div>
        ${feedback ? `<div style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:12px;padding:0 10px">${feedback}</div>` : ''}
        <div style="color:var(--text-muted);font-size:0.78rem;margin-bottom:14px">💡 试试：画更明显的轮廓、加眼睛/鳍等特征</div>
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <button id="modal-retry" style="flex:2;padding:10px;border:1px solid var(--neon-cyan);border-radius:8px;background:transparent;color:var(--neon-cyan);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.8rem">继续画</button>
          <button id="modal-force" style="flex:1;padding:10px;border:1px solid var(--neon-magenta);border-radius:8px;background:transparent;color:var(--neon-magenta);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.8rem">强制放入</button>
        </div>
      `;
    }

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:28px;max-width:400px;text-align:center;box-shadow:0 0 50px rgba(0,229,255,0.15)">
        <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:6px">AI识别结果</div>
        <div style="color:var(--text-primary);font-size:1rem;margin-bottom:16px">${typeInfo.emoji} ${typeInfo.name}</div>
        ${statusSection}
        <button id="modal-close" style="width:100%;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:transparent;color:var(--text-muted);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.75rem">关闭</button>
      </div>
    `;

    document.body.appendChild(modal);

    const submitBtn = modal.querySelector('#modal-submit');
    const retryBtn = modal.querySelector('#modal-retry');
    const forceBtn = modal.querySelector('#modal-force');
    const closeBtn = modal.querySelector('#modal-close');

    if (submitBtn) {
      submitBtn.onclick = () => {
        modal.remove();
        doSubmitCreature(similarity, isMatch, creativity);
      };
    }
    if (retryBtn) {
      retryBtn.onclick = () => modal.remove();
    }
    if (forceBtn) {
      forceBtn.onclick = () => {
        modal.remove();
        doSubmitCreature(similarity, false, creativity);
      };
    }
    if (closeBtn) {
      closeBtn.onclick = () => modal.remove();
    }
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  function doSubmitCreature(similarity, isMatch, creativity) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

    const imageData = tempCanvas.toDataURL('image/png');
    const creature = addCreature(imageData, currentType, { similarity, creativity, isMatch });

    if (isMatch) {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 已放入深海！`);
    } else {
      showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 已提交（待审核）`);
    }

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history = [];
    saveState();
    aiScore = null;
    updateScoreDisplay();

    showShareModal(tempCanvas, { type: currentType, similarity, creativity, isMatch });
  }

  function showShareModal(creatureCanvas, data) {
    const sim = Math.round((data.similarity || 0.7) * 100);
    const cre = data.creativity || 50;
    const typeInfo = CREATURE_TYPES[data.type] || CREATURE_TYPES.fish;
    const passedText = data.isMatch ? '✅ 通过识别' : '⚠️ 待审核';

    let modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(10px)';

    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border-glow);border-radius:16px;padding:28px;max-width:420px;text-align:center;box-shadow:0 0 50px rgba(0,229,255,0.15)">
        <div style="font-size:2.5rem;margin-bottom:8px">${typeInfo.emoji}</div>
        <div style="font-family:Orbitron,monospace;font-size:1.1rem;color:var(--neon-cyan);margin-bottom:16px">你的${typeInfo.name}已入深海！</div>
        <div style="display:flex;justify-content:center;gap:20px;margin-bottom:20px">
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">相似度</div>
            <div style="color:${sim>=60?'var(--neon-green)':'var(--neon-gold)'};font-size:1.4rem;font-weight:700">${sim}%</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">创意分</div>
            <div style="color:var(--neon-cyan);font-size:1.4rem;font-weight:700">${cre}</div>
          </div>
          <div style="width:1px;background:var(--border-subtle)"></div>
          <div>
            <div style="color:var(--text-muted);font-size:0.7rem;margin-bottom:4px">状态</div>
            <div style="font-size:0.85rem">${passedText}</div>
          </div>
        </div>
        <div style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:18px">分享你的作品，让更多人来深海 🌊</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <button id="share-native" style="padding:10px;border:1px solid var(--neon-cyan);border-radius:10px;background:linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,229,255,0.05));color:var(--neon-cyan);cursor:pointer;font-family:Orbitron,monospace;font-size:0.85rem;letter-spacing:1px">📤 分享作品</button>
          <div style="display:flex;gap:8px">
            <button id="share-twitter" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">𝕏 Twitter</button>
            <button id="share-reddit" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">Reddit</button>
            <button id="share-download" style="flex:1;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;font-size:0.78rem">💾 保存</button>
          </div>
        </div>
        <a href="ocean.html" style="display:block;color:var(--text-muted);font-size:0.78rem;text-decoration:none;padding:6px;border:1px solid transparent;border-radius:6px;transition:all 0.2s;position:relative;z-index:10">进入深海观赏 →</a>
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
          a.href = url; a.download = `ocean-canvas-${data.type}.png`; a.click();
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
