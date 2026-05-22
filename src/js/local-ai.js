var LocalAI = {
  analyze(canvas, ctx, creatureType) {
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const stats = this._extractFeatures(data, w, h);
    const cap = typeof AI_CONFIG !== 'undefined' ? AI_CONFIG.localDraftCap : 0.35;
    const isScribble = this._isLikelyScribble(stats);
    let similarity = this._scoreDraft(stats, creatureType);
    if (isScribble) similarity = Math.min(similarity, 0.18);
    similarity = Math.min(cap, similarity);

    return {
      similarity,
      creativity: isScribble ? Math.min(30, 12 + stats.colorCount * 2) : this._scoreCreativity(stats),
      isMatch: false,
      isScribble,
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
          if (Math.abs(r - data[li]) + Math.abs(g - data[li + 1]) + Math.abs(b - data[li + 2]) > 60
            || Math.abs(r - data[pi]) + Math.abs(g - data[pi + 1]) + Math.abs(b - data[pi + 2]) > 60) {
            edgeCount++;
          }
        }
      }
    }

    const boundingArea = Math.max(1, (boundingBox.maxX - boundingBox.minX) * (boundingBox.maxY - boundingBox.minY));
    return {
      drawnPixels,
      colorCount: colorSet.size,
      edgeCount,
      edgeDensity: edgeCount / (w * h),
      fillRatio: drawnPixels / boundingArea,
      coverageRatio: drawnPixels / (w * h),
      aspect: (boundingBox.maxX - boundingBox.minX) / Math.max(1, boundingBox.maxY - boundingBox.minY),
      edgePerInk: drawnPixels > 0 ? edgeCount / drawnPixels : 0,
    };
  },

  _isLikelyScribble(stats) {
    if (stats.drawnPixels < 80) return false;
    if (stats.edgePerInk > 0.32 && stats.fillRatio < 0.35) return true;
    if (stats.edgeDensity > 0.016 && stats.fillRatio < 0.28) return true;
    return false;
  },

  _scoreDraft(stats, creatureType) {
    if (stats.drawnPixels < 50) return 0;
    let score = 0;
    if (stats.coverageRatio >= 0.04) score += 0.1;
    if (stats.coverageRatio >= 0.1) score += 0.08;
    if (stats.fillRatio > 0.2 && stats.fillRatio < 0.75) score += 0.08;
    const shapes = {
      fish: [0.9, 3.2], jellyfish: [0.5, 1.6], octopus: [0.6, 1.7],
      turtle: [0.7, 2], crab: [0.8, 2.3], whale: [1.1, 3.5],
      shark: [1.1, 3.5], seahorse: [0.35, 1.1],
    };
    const range = shapes[creatureType] || [0.4, 3];
    if (stats.aspect >= range[0] && stats.aspect <= range[1]) score += 0.06;
    if (stats.colorCount >= 2) score += 0.04;
    return score;
  },

  _scoreCreativity(stats) {
    if (stats.drawnPixels < 50) return 0;
    let s = 12;
    if (stats.colorCount >= 2) s += 8;
    if (stats.colorCount >= 4) s += 10;
    if (stats.fillRatio > 0.22 && stats.fillRatio < 0.65) s += 8;
    return Math.min(50, s);
  },
};
