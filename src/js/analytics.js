(function() {
  if (typeof FEATURES !== 'undefined' && !FEATURES.analytics) return;

  const metrics = {
    page: location.pathname,
    loadTime: performance.now(),
    timestamp: Date.now(),
  };

  function send(metric) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', JSON.stringify(metric));
    }
  }

  window.addEventListener('load', function() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      metrics.ttfb = Math.round(nav.responseStart - nav.requestStart);
      metrics.fcp = Math.round(nav.loadEventEnd - nav.startTime);
      metrics.domReady = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
    }

    if (typeof FEATURES !== 'undefined' && FEATURES.devMode) {
      console.log('[Ocean Canvas] Performance:', metrics);
    }
  });

  window.addEventListener('error', function(e) {
    send({
      type: 'error',
      message: e.message,
      file: e.filename,
      line: e.lineno,
      page: location.pathname,
      timestamp: Date.now(),
    });
  });

  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsRunning = true;

  function measureFPS() {
    if (!fpsRunning) return;
    frameCount++;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      if (typeof FEATURES !== 'undefined' && FEATURES.devMode) {
        console.log('[Ocean Canvas] FPS:', frameCount);
      }
      frameCount = 0;
      lastFrameTime = now;
    }
    requestAnimationFrame(measureFPS);
  }

  if (location.pathname.includes('ocean')) {
    requestAnimationFrame(measureFPS);
  }

  window.__oc_metrics = metrics;
})();
