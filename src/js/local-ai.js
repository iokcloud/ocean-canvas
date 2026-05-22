var LocalAI = {
  analyze(canvas, ctx, creatureType) {
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const stats = this._extractFeatures(data, w, h);
    const draftCompletion = this._scoreDraftCompletion(stats, creatureType);
    const creativity = this._scoreCreativity(stats);
    const isScribble = this._isLikelyScribble(stats);

    return {
      draftCompletion,
      creativity: isScribble ? Math.min(creativity, 35) : creativity,
      isScribble,
      feedback: this._generateFeedback(stats, draftCompletion, isScribble),
      _local: true,
    };
  },

  _extractFeatures(data, w, h) {
    let drawnPixels = 0;
    let colorSet = new Set();
    let edgeCount = 0;
    let boundingBox = { minX: w, maxX: 0, minY: h, maxY: 0 };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const isBg = (Math.abs(r - 13) < 8 && Math.abs(g - 17) < 8 && Math.abs(b - 23) < 8);

        if (!isBg) {
          drawnPixels++;
          colorSet.add(`${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`);
          if (x < boundingBox.minX) boundingBox.minX = x;
          if (x > boundingBox.maxX) boundingBox.maxX = x;
          if (y < boundingBox.minY) boundingBox.minY = y;
          if (y > boundingBox.maxY) boundingBox.maxY = y;
        }

        if (x > 0 && y > 0) {
          const pi = ((y - 1) * w + x) * 4;
          const li = (y * w + (x - 1)) * 4;
          const dx = Math.abs(r - data[li]) + Math.abs(g - data[li + 1]) + Math.abs(b - data[li + 2]);
          const dy = Math.abs(r - data[pi]) + Math.abs(g - data[pi + 1]) + Math.abs(b - data[pi + 2]);
          if (dx > 60 || dy > 60) edgeCount++;
        }
      }
    }

    const boundingArea = Math.max(1, (boundingBox.maxX - boundingBox.minX) * (boundingBox.maxY - boundingBox.minY));
    const fillRatio = drawnPixels / boundingArea;
    const edgeDensity = edgeCount / (w * h);
    const coverageRatio = drawnPixels / (w * h);
    const aspect = (boundingBox.maxX - boundingBox.minX) / Math.max(1, boundingBox.maxY - boundingBox.minY);
    const edgePerInk = drawnPixels > 0 ? edgeCount / drawnPixels : 0;

    return {
      drawnPixels, colorCount: colorSet.size, edgeCount, edgeDensity, fillRatio,
      coverageRatio, boundingBox, boundingArea, aspect, edgePerInk,
    };
  },

  _isLikelyScribble(stats) {
    if (stats.drawnPixels < 80) return false;
    if (stats.edgePerInk > 0.35 && stats.fillRatio < 0.35) return true;
    if (stats.edgeDensity > 0.018 && stats.fillRatio < 0.28) return true;
    if (stats.coverageRatio > 0.12 && stats.fillRatio < 0.2) return true;
    return false;
  },

  _scoreDraftCompletion(stats, creatureType) {
    const cap = typeof AI_CONFIG !== 'undefined' ? AI_CONFIG.localDraftCap : 0.35;
    if (stats.drawnPixels < 50) return 0;
    if (this._isLikelyScribble(stats)) return Math.min(0.2, cap);

    let score = 0;
    if (stats.coverageRatio >= 0.03) score += 0.08;
    if (stats.coverageRatio >= 0.08) score += 0.07;
    if (stats.fillRatio > 0.2 && stats.fillRatio < 0.75) score += 0.08;

    const typeShapes = {
      fish: [1.0, 3.0], jellyfish: [0.5, 1.5], octopus: [0.6, 1.6],
      turtle: [0.8, 1.8], crab: [0.8, 2.2], whale: [1.2, 3.5],
      shark: [1.2, 3.5], seahorse: [0.3, 1.0],
    };
    const shape = typeShapes[creatureType] || [0.4, 3.0];
    if (stats.aspect >= shape[0] && stats.aspect <= shape[1]) score += 0.06;

    if (stats.colorCount >= 2) score += 0.04;
    if (stats.edgeDensity > 0.004 && stats.edgeDensity < 0.012) score += 0.04;

    return Math.min(cap, Math.max(0, score));
  },

  _scoreCreativity(stats) {
    if (stats.drawnPixels < 50) return 0;
    if (this._isLikelyScribble(stats)) return Math.min(25, 10 + stats.colorCount * 3);

    let score = 15;
    if (stats.colorCount >= 2) score += 8;
    if (stats.colorCount >= 4) score += 10;
    if (stats.fillRatio > 0.25 && stats.fillRatio < 0.65) score += 8;
    if (stats.coverageRatio > 0.06 && stats.coverageRatio < 0.25) score += 8;
    return Math.min(55, score);
  },

  _generateFeedback(stats, draftCompletion, isScribble) {
    if (isScribble) {
      return typeof I18n !== 'undefined' ? I18n.t('ai_feedback_scribble') : 'Try a clearer creature shape instead of random loops';
    }
    if (stats.coverageRatio < 0.04) {
      return typeof I18n !== 'undefined' ? I18n.t('ai_feedback_small') : 'Draw larger on the canvas';
    }
    if (draftCompletion >= 0.25) {
      return typeof I18n !== 'undefined' ? I18n.t('ai_feedback_wait_ai') : 'Pause to let AI check similarity';
    }
    return typeof I18n !== 'undefined' ? I18n.t('ai_feedback_draw_more') : 'Add body, tail or fins';
  },
};
