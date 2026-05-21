(function() {
  const container = document.getElementById('bubbles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = 4 + Math.random() * 20;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.animationDuration = (8 + Math.random() * 15) + 's';
    bubble.style.animationDelay = Math.random() * 10 + 's';
    container.appendChild(bubble);
  }
})();
