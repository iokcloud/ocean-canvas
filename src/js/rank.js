(function() {
  let currentSort = 'hot';

  function t(key, fallback) {
    return typeof I18n !== 'undefined' ? I18n.t(key) : fallback;
  }

  function recordVote() {
    const n = parseInt(localStorage.getItem('oc_vote_count') || '0', 10) + 1;
    localStorage.setItem('oc_vote_count', String(n));
  }

  function handleVote(btn, delta) {
    btn.disabled = true;
    voteCreature(btn.dataset.id, delta).then((c) => {
      btn.disabled = false;
      if (c) {
        recordVote();
        const card = btn.closest('.creature-card');
        card.querySelector('.card-score').textContent = '⭐ ' + c.score;
        card.querySelector('.vote-controls span').textContent = c.score;
        btn.style.color = delta > 0 ? 'var(--neon-green)' : 'var(--neon-magenta)';
        setTimeout(() => { btn.style.color = ''; }, 500);
        if (typeof showToast === 'function') showToast(t('toast_vote_ok', 'Vote counted 👍'));
      } else if (typeof showToast === 'function') {
        showToast(t('toast_vote_fail', 'Vote failed, try again'));
      }
    });
  }

  function renderGrid(creatures) {
    const grid = document.getElementById('creature-grid');
    const loading = document.getElementById('loading');
    grid.innerHTML = '';

    if (creatures.length === 0) {
      grid.style.display = 'block';
      loading.style.display = 'none';
      grid.innerHTML = `<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:40px">${t('rank_empty', 'The deep sea is empty... go draw your first creature!')}</p>`;
      return;
    }

    creatures.forEach(c => {
      const sim = c.aiSimilarity ? Math.round(c.aiSimilarity * 100) : null;
      const cre = c.aiCreativity || 0;
      const card = document.createElement('div');
      card.className = 'creature-card';
      card.innerHTML = `
        <div class="card-type">${c.emoji || '🐟'} ${typeof getCreatureLabel === 'function' ? getCreatureLabel(c.type) : (CREATURE_TYPES[c.type]?.name || c.type)}</div>
        <img src="${c.imageData}" alt="" loading="lazy" onerror="this.style.opacity='0.3'">
        <div class="card-meta">
          ${sim != null ? `<span class="card-ai">🤖 ${sim}%</span>` : ''}
          ${cre ? `<span class="card-ai">🎨 ${cre}</span>` : ''}
        </div>
        <div class="card-score">⭐ ${c.score}</div>
        <div class="vote-controls">
          <button class="vote-btn upvote" data-id="${c.id}" aria-label="upvote">👍</button>
          <span>${c.score}</span>
          <button class="vote-btn downvote" data-id="${c.id}" aria-label="downvote">👎</button>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.style.display = 'grid';
    loading.style.display = 'none';

    grid.querySelectorAll('.upvote').forEach(btn => {
      btn.addEventListener('click', function() { handleVote(this, 1); });
    });

    grid.querySelectorAll('.downvote').forEach(btn => {
      btn.addEventListener('click', function() { handleVote(this, -1); });
    });
  }

  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentSort = this.dataset.sort;
      const loading = document.getElementById('loading');
      loading.style.display = 'block';
      document.getElementById('creature-grid').style.display = 'none';
      renderGrid(await getSortedCreatures(currentSort));
    });
  });

  getSortedCreatures(currentSort).then(data => renderGrid(data));
})();
