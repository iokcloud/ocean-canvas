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

  document.getElementById('swim-btn').addEventListener('click', function() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    const imageData = tempCanvas.toDataURL('image/png');
    const creature = addCreature(imageData, currentType);

    showToast(`${CREATURE_TYPES[currentType]?.emoji || '🐟'} 已放入深海！`);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    history = [];
    saveState();

    setTimeout(() => {
      window.location.href = 'ocean.html';
    }, 1200);
  });

  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });
})();
