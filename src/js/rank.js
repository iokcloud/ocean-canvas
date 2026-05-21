(function() {
  let currentSort = 'hot';

  function renderGrid(creatures) {
    const grid = document.getElementById('creature-grid');
    const loading = document.getElementById('loading');
    grid.innerHTML = '';

    if (creatures.length === 0) {
      grid.style.display = 'block';
      loading.style.display = 'none';
      grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:40px">深海还是空的...去绘制你的第一个生物吧！</p>';
      return;
    }

    creatures.forEach(c => {
      const card = document.createElement('div');
      card.className = 'creature-card';
      card.innerHTML = `
        <div class="card-type">${c.emoji || '🐟'} ${CREATURE_TYPES[c.type]?.name || c.type}</div>
        <img src="${c.imageData}" alt="深海生物" loading="lazy" onerror="this.style.display='none';this.parentElement.querySelector('.card-type').textContent+='(图片加载失败)'">
        <div class="card-score">⭐ ${c.score}</div>
        <div class="vote-controls">
          <button class="vote-btn upvote" data-id="${c.id}">👍</button>
          <span style="color:var(--text-secondary);font-size:0.8rem">${c.score}</span>
          <button class="vote-btn downvote" data-id="${c.id}">👎</button>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.style.display = 'grid';
    loading.style.display = 'none';

    grid.querySelectorAll('.upvote').forEach(btn => {
      btn.addEventListener('click', function() {
        const c = voteCreature(this.dataset.id, 1);
        if (c) {
          const card = this.closest('.creature-card');
          card.querySelector('.card-score').textContent = '⭐ ' + c.score;
          card.querySelector('.vote-controls span').textContent = c.score;
          this.style.color = 'var(--neon-green)';
          setTimeout(() => this.style.color = '', 500);
        }
      });
    });

    grid.querySelectorAll('.downvote').forEach(btn => {
      btn.addEventListener('click', function() {
        const c = voteCreature(this.dataset.id, -1);
        if (c) {
          const card = this.closest('.creature-card');
          card.querySelector('.card-score').textContent = '⭐ ' + c.score;
          card.querySelector('.vote-controls span').textContent = c.score;
          this.style.color = 'var(--neon-magenta)';
          setTimeout(() => this.style.color = '', 500);
        }
      });
    });
  }

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentSort = this.dataset.sort;
      renderGrid(await getSortedCreatures(currentSort));
    });
  });

  getSortedCreatures(currentSort).then(data => renderGrid(data));
})();
