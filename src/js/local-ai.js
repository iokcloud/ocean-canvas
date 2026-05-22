var LocalAI = {
  analyze(canvas, ctx, creatureType) {
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const totalPixels = w * h;

    const stats = this._extractFeatures(data, w, h);
    const similarity = this._scoreSimilarity(stats, creatureType);
    const creativity = this._scoreCreativity(stats);

    return {
      similarity,
      creativity,
      isMatch: similarity >= 0.6,
      feedback: this._generateFeedback(stats, creatureType, similarity),
      _local: true
    };
  },

  _extractFeatures(data, w, h) {
    let drawnPixels = 0;
    let colorSet = new Set();
    let edgeCount = 0;
    let boundingBox = { minX: w, maxX: 0, minY: h, maxY: 0 };
    let totalR = 0, totalG = 0, totalB = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const isBg = (Math.abs(r - 13) < 8 && Math.abs(g - 17) < 8 && Math.abs(b - 23) < 8);

        if (!isBg) {
          drawnPixels++;
          const colorKey = `${Math.round(r/32)}-${Math.round(g/32)}-${Math.round(b/32)}`;
          colorSet.add(colorKey);
          totalR += r; totalG += g; totalB += b;
          if (x < boundingBox.minX) boundingBox.minX = x;
          if (x > boundingBox.maxX) boundingBox.maxX = x;
          if (y < boundingBox.minY) boundingBox.minY = y;
          if (y > boundingBox.maxY) boundingBox.maxY = y;
        }

        if (x > 0 && y > 0) {
          const pi = ((y-1) * w + x) * 4;
          const li = (y * w + (x-1)) * 4;
          const dx = Math.abs(r - data[li]) + Math.abs(g - data[li+1]) + Math.abs(b - data[li+2]);
          const dy = Math.abs(r - data[pi]) + Math.abs(g - data[pi+1]) + Math.abs(b - data[pi+2]);
          if (dx > 60 || dy > 60) edgeCount++;
        }
      }
    }

    const colorCount = colorSet.size;
    const boundingArea = Math.max(1, (boundingBox.maxX - boundingBox.minX) * (boundingBox.maxY - boundingBox.minY));
    const fillRatio = drawnPixels / boundingArea;
    const edgeDensity = edgeCount / (w * h);
    const coverageRatio = drawnPixels / (w * h);
    const avgR = drawnPixels > 0 ? totalR / drawnPixels : 0;
    const avgG = drawnPixels > 0 ? totalG / drawnPixels : 0;
    const avgB = drawnPixels > 0 ? totalB / drawnPixels : 0;

    return {
      drawnPixels, colorCount, edgeCount, edgeDensity, fillRatio,
      coverageRatio, boundingBox, boundingArea,
      avgColor: { r: avgR, g: avgG, b: avgB }
    };
  },

  _scoreSimilarity(stats, creatureType) {
    if (stats.drawnPixels < 50) return 0;
    if (stats.coverageRatio < 0.005) return 0.05;
    if (stats.coverageRatio < 0.02) return 0.15;

    let score = 0;

    if (stats.coverageRatio >= 0.02 && stats.coverageRatio < 0.05) score = 0.25;
    else if (stats.coverageRatio >= 0.05 && stats.coverageRatio < 0.1) score = 0.35;
    else if (stats.coverageRatio >= 0.1 && stats.coverageRatio < 0.2) score = 0.45;
    else if (stats.coverageRatio >= 0.2) score = 0.5;

    if (stats.edgeDensity > 0.002) score += 0.05;
    if (stats.edgeDensity > 0.005) score += 0.05;
    if (stats.edgeDensity > 0.01) score += 0.05;

    if (stats.fillRatio > 0.15 && stats.fillRatio < 0.85) score += 0.05;

    const bb = stats.boundingBox;
    const aspect = (bb.maxX - bb.minX) / Math.max(1, bb.maxY - bb.minY);
    const typeShapes = {
      fish: [1.2, 2.5], jellyfish: [0.6, 1.4], octopus: [0.7, 1.5],
      turtle: [1.0, 1.8], crab: [1.0, 2.0], whale: [1.5, 3.0],
      shark: [1.5, 3.0], seahorse: [0.4, 0.9]
    };
    const shape = typeShapes[creatureType] || [0.5, 3.0];
    if (aspect >= shape[0] && aspect <= shape[1]) score += 0.1;

    if (stats.colorCount >= 2) score += 0.05;
    if (stats.colorCount >= 4) score += 0.05;

    return Math.min(0.85, Math.max(0, score));
  },

  _scoreCreativity(stats) {
    if (stats.drawnPixels < 50) return 0;

    let score = 20;

    if (stats.colorCount >= 2) score += 10;
    if (stats.colorCount >= 4) score += 15;
    if (stats.colorCount >= 6) score += 10;

    if (stats.edgeDensity > 0.003) score += 5;
    if (stats.edgeDensity > 0.008) score += 10;
    if (stats.edgeDensity > 0.015) score += 10;

    if (stats.fillRatio > 0.2 && stats.fillRatio < 0.7) score += 10;

    if (stats.coverageRatio > 0.1) score += 10;
    if (stats.coverageRatio > 0.2) score += 5;

    return Math.min(100, Math.max(0, score));
  },

  _generateFeedback(stats, creatureType, similarity) {
    const tips = [];

    if (stats.coverageRatio < 0.05) {
      tips.push('Draw larger - fill more of the canvas');
    }
    if (stats.colorCount < 2) {
      tips.push('Try using more colors');
    }
    if (stats.edgeDensity < 0.005) {
      tips.push('Add more details and edges');
    }
    if (similarity >= 0.6) {
      tips.push('Looking good! Click "AI Score" for detailed analysis');
    }

    return tips.length > 0 ? tips[0] : 'Drawing detected. Add more details!';
  }
};
