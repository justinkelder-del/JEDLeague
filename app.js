const cfg = window.LEAGUE_CONFIG;
let allRows = [];
const today = new Date().toISOString().slice(0, 10);
document.querySelector('input[name="date"]').value = today;

async function loadScores() {
  if (!cfg.sheetCsvUrl || cfg.sheetCsvUrl.includes('PASTE_')) {
    document.getElementById('standingsBody').innerHTML = '<tr><td colspan="6">Add your Google Sheet CSV URL in config.js.</td></tr>';
    return;
  }
  const res = await fetch(cfg.sheetCsvUrl + '&cachebust=' + Date.now(), { cache: 'no-store' });
  const text = await res.text();
  allRows = csvToObjects(text);
renderDashboard(allRows);
}

function csvToObjects(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map(line => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() ?? '']));
  }).filter(r => r.Player && r.Game);
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let quote = false;
  for (const ch of line) {
    if (ch === '"') quote = !quote;
    else if (ch === ',' && !quote) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function renderDashboard(rows) {
  const games = [...new Set(rows.map(r => r.Game))];
  const isSingleGame = games.length === 1;
  const lowerWins = isSingleGame && ['Putt.Day'].includes(games[0]);
  const stats = {};
  cfg.players.forEach(p => stats[p] = { player:p, points:0, wins:0, games:0, finishTotal:0, last7:0, scoreTotal:0, bestScore:null, puttWins:0, geoSportsWins:0, geoHistoryWins:0 });
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  rows.forEach(r => {
    const p = r.Player;
    if (!stats[p]) stats[p] = { player:p, points:0, wins:0, games:0, finishTotal:0, last7:0 };
    const pts = Number(r.Points || 0), rank = Number(r.Rank || 0);
    stats[p].points += pts;
    stats[p].games += 1;
    stats[p].finishTotal += rank;
    if (rank === 1) {
  stats[p].wins += 1;
  if (r.Game === 'Putt.Day') stats[p].puttWins += 1;
  if (r.Game === 'GeoSports') stats[p].geoSportsWins += 1;
  if (r.Game === 'GeoHistory') stats[p].geoHistoryWins += 1;
}
if (new Date(r.Date) >= sevenDaysAgo) stats[p].last7 += pts;
const rawScore = Number(r.RawScore);
stats[p].scoreTotal += rawScore;
if (stats[p].bestScore === null) stats[p].bestScore = rawScore;
else if (lowerWins) stats[p].bestScore = Math.min(stats[p].bestScore, rawScore);
else stats[p].bestScore = Math.max(stats[p].bestScore, rawScore);
  });

  const standings = Object.values(stats).sort((a,b) => b.points - a.points || b.wins - a.wins);
  const showScoreColumns = isSingleGame;
document.getElementById('avgScoreHeader').style.display = showScoreColumns ? '' : 'none';
document.getElementById('bestScoreHeader').style.display = showScoreColumns ? '' : 'none';
const showPerGameWins = !isSingleGame;
document.getElementById('puttWinsHeader').style.display = showPerGameWins ? '' : 'none';
document.getElementById('geoSportsWinsHeader').style.display = showPerGameWins ? '' : 'none';
document.getElementById('geoHistoryWinsHeader').style.display = showPerGameWins ? '' : 'none';
document.getElementById('standingsBody').innerHTML = standings.map((s, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${s.player}</td>
      <td>${s.points}</td>
      <td>${s.wins}</td>
      ${showPerGameWins ? `<td>${s.puttWins}</td><td>${s.geoSportsWins}</td><td>${s.geoHistoryWins}</td>` : ''}
      <td>${s.games}</td>
      ${showScoreColumns ? `<td>${s.games ? (s.scoreTotal / s.games).toFixed(1) : '-'}</td><td>${s.bestScore ?? '-'}</td>` : ''}
    </tr>
  `).join('');
  document.getElementById('currentChampion').textContent = standings[0]?.player ?? '-';
  document.getElementById('lastPlace').textContent = standings.at(-1)?.player ?? '-';
  document.getElementById('mostWins').textContent = standings.slice().sort((a,b)=>b.wins-a.wins)[0]?.player ?? '-';
  document.getElementById('hotPlayer').textContent = standings.slice().sort((a,b)=>b.last7-a.last7)[0]?.player ?? '-';
  document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleString();

  document.getElementById('latestResults').innerHTML = rows.slice(-6).reverse().map(r => `
    <div class="result-card"><strong>${r.Date} · ${r.Game}</strong><br>${r.Player}: ${r.RawScore} · Rank ${r.Rank} · ${r.Points} pts</div>
  `).join('');
  const gameNames = [...new Set(allRows.map(r => r.Game))];
  const breakdownSection = document.getElementById('gameBreakdownSection');
  if (isSingleGame) {
    breakdownSection.style.display = 'none';
  } else {
    breakdownSection.style.display = '';
    document.getElementById('gameBreakdown').innerHTML = gameNames.map(game => {
      const gameRows = allRows.filter(r => r.Game === game);
      const isLower = ['Putt.Day'].includes(game);
      const playerBests = cfg.players.map(p => {
        const playerRows = gameRows.filter(r => r.Player === p);
        if (!playerRows.length) return { player: p, best: '-', avg: '-' };
        const scores = playerRows.map(r => Number(r.RawScore));
        const best = isLower ? Math.min(...scores) : Math.max(...scores);
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        return { player: p, best, avg };
      }).sort((a, b) => {
        if (a.best === '-') return 1;
        if (b.best === '-') return -1;
        return isLower ? a.best - b.best : b.best - a.best;
      });

      return `
        <div style="margin-bottom:1.5rem">
          <h3 style="color:var(--accent);margin-bottom:.75rem">${game}</h3>
          <table>
            <thead><tr><th>Player</th><th>Best Score</th><th>Avg Score</th></tr></thead>
            <tbody>
              ${playerBests.map(p => `
                <tr><td>${p.player}</td><td>${p.best}</td><td>${p.avg}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');
  }
}

document.getElementById('scoreForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    date: fd.get('date'),
    game: fd.get('game'),
    lowerWins: fd.get('lowerWins') === 'true',
    scores: Object.fromEntries(cfg.players.map(p => [p, fd.get(p)]).filter(([_,v]) => v !== ''))
  };
  document.getElementById('formStatus').textContent = 'Submitting...';
  try {
    const res = await fetch(cfg.submitUrl, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
    document.getElementById('formStatus').textContent = 'Submitted. Refresh in a few seconds.';
    setTimeout(loadScores, 1500);
  } catch (err) {
    document.getElementById('formStatus').textContent = 'Could not submit. Check Apps Script URL.';
  }
});
document.getElementById('gameFilter').addEventListener('change', () => {
  const filter = document.getElementById('gameFilter').value;
  const filtered = filter === 'all' ? allRows : allRows.filter(r => r.Game === filter);
  renderDashboard(filtered);
});

loadScores();
