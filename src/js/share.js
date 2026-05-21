const ShareSystem = {
  canvas: null,

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1200;
    this.canvas.height = 630;
  },

  async generateShareImage(creatureCanvas, data) {
    const ctx = this.canvas.getContext('2d');
    const w = this.canvas.width;
    const h = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050510');
    grad.addColorStop(0.4, '#0a0a2e');
    grad.addColorStop(0.7, '#0d1b3e');
    grad.addColorStop(1, '#0a1628');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.drawLightRays(ctx, w, h);
    this.drawBubblesDecor(ctx, w, h);

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 28px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OCEAN CANVAS', 50, 60);

    ctx.fillStyle = '#8892b0';
    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillText('深海画室', 50, 85);

    if (creatureCanvas) {
      const imgW = 400;
      const imgH = 233;
      const imgX = 50;
      const imgY = (h - imgH) / 2 - 20;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 229, 255, 0.3)';
      ctx.shadowBlur = 25;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(imgX - 3, imgY - 3, imgW + 6, imgH + 6);
      ctx.restore();

      ctx.drawImage(creatureCanvas, imgX, imgY, imgW, imgH);
    }

    const infoX = 500;
    const infoY = 180;

    const typeInfo = CREATURE_TYPES[data.type] || CREATURE_TYPES.fish;
    ctx.fillStyle = '#e0e8ff';
    ctx.font = 'bold 48px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${typeInfo.emoji} ${typeInfo.name}`, infoX, infoY);

    if (data.similarity !== undefined) {
      const sim = Math.round(data.similarity * 100);
      ctx.fillStyle = sim >= 60 ? '#00ff88' : sim >= 30 ? '#ffd700' : '#ff00ff';
      ctx.font = 'bold 36px JetBrains Mono, monospace';
      ctx.fillText(`相似度 ${sim}%`, infoX, infoY + 60);

      const barW = 300;
      const barH = 12;
      const barX = infoX;
      const barY = infoY + 75;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = sim >= 60 ? '#00ff88' : sim >= 30 ? '#ffd700' : '#ff00ff';
      ctx.fillRect(barX, barY, barW * (sim / 100), barH);
    }

    if (data.creativity !== undefined) {
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 36px JetBrains Mono, monospace';
      ctx.fillText(`创意分 ${data.creativity}`, infoX, infoY + 130);
    }

    ctx.fillStyle = '#4a5568';
    ctx.font = '18px JetBrains Mono, monospace';
    ctx.fillText(`ocean.gameschats.com`, 50, h - 40);

    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 18px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('#OceanCanvas #深海画室', w - 50, h - 40);

    return this.canvas.toBlob 
      ? await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png', 0.92))
      : null;
  },

  drawLightRays(ctx, w, h) {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const x = w * 0.1 + i * w * 0.2;
      const grad = ctx.createLinearGradient(x, 0, x + 50, h * 0.5);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.02)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - 15, 0);
      ctx.lineTo(x + 35, 0);
      ctx.lineTo(x + 70, h * 0.5);
      ctx.lineTo(x - 30, h * 0.5);
      ctx.fill();
    }
    ctx.restore();
  },

  drawBubblesDecor(ctx, w, h) {
    for (let i = 0; i < 15; i++) {
      const bx = Math.random() * w;
      const by = Math.random() * h;
      const br = 3 + Math.random() * 12;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 229, 255, ${0.03 + Math.random() * 0.06})`;
      ctx.fill();
    }
  },

  async share(creatureCanvas, data) {
    const blob = await this.generateShareImage(creatureCanvas, data);

    const shareData = {
      title: `我在深海画室画了一只${CREATURE_TYPES[data.type]?.name || '生物'}！`,
      text: this.buildShareText(data),
      url: 'https://ocean.gameschats.com',
    };

    if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'ocean-canvas.png', { type: 'image/png' })] })) {
      shareData.files = [new File([blob], 'ocean-canvas.png', { type: 'image/png' })];
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (typeof MemorySystem !== 'undefined') {
          MemorySystem.record('user_behavior', { action: 'share', method: 'native', type: data.type });
        }
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
      }
    }

    return this.fallbackShare(blob, data);
  },

  buildShareText(data) {
    const typeInfo = CREATURE_TYPES[data.type] || CREATURE_TYPES.fish;
    let text = `我在 Ocean Canvas 深海画室画了一只${typeInfo.name}！🌊`;
    if (data.similarity !== undefined) {
      text += `\nAI相似度: ${Math.round(data.similarity * 100)}%`;
    }
    if (data.creativity !== undefined) {
      text += ` | 创意分: ${data.creativity}`;
    }
    text += '\n你也来画一只？→ ocean.gameschats.com';
    return text;
  },

  fallbackShare(blob, data) {
    const text = this.buildShareText(data);

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ocean-canvas-${data.type || 'creature'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (typeof showToast === 'function') {
          showToast('分享文本已复制到剪贴板！');
        }
      });
    }

    if (typeof MemorySystem !== 'undefined') {
      MemorySystem.record('user_behavior', { action: 'share', method: 'fallback', type: data.type });
    }

    return true;
  },

  shareToTwitter(data) {
    const text = encodeURIComponent(this.buildShareText(data));
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
    if (typeof MemorySystem !== 'undefined') {
      MemorySystem.record('user_behavior', { action: 'share', method: 'twitter', type: data.type });
    }
  },

  shareToReddit(data) {
    const typeInfo = CREATURE_TYPES[data.type] || CREATURE_TYPES.fish;
    const title = encodeURIComponent(`我在深海画室画了一只${typeInfo.name}！AI相似度${Math.round((data.similarity || 0.7) * 100)}%`);
    const url = encodeURIComponent('https://ocean.gameschats.com');
    window.open(`https://reddit.com/submit?title=${title}&url=${url}`, '_blank', 'width=800,height=600');
    if (typeof MemorySystem !== 'undefined') {
      MemorySystem.record('user_behavior', { action: 'share', method: 'reddit', type: data.type });
    }
  },
};

ShareSystem.init();

if (typeof module !== 'undefined') module.exports = ShareSystem;
