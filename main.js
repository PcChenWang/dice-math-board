// ===== 分頁切換 =====
document.addEventListener('DOMContentLoaded', () => {
    // 進站前彈窗
  const overlay = document.getElementById('entry-overlay');
  const confirmBtn = document.getElementById('entry-confirm-btn');
  if (overlay && confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }
  initTabs();
  Game.init();
  Admin.init();
  Explain.init();
});

function initTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(sec => {
        sec.classList.toggle('active', sec.id === tabId);
      });
    });
  });
}

// ===== 棋盤與遊戲核心 =====
const Game = (() => {
  const baseCells = [
    { id: 10, prize: 1000 },
    { id: 17, prize: 400 },
    { id: 12, prize: 1200 },
    { id: 15, prize: 200 },
    { id: 14, prize: 1000 },
    { id: 13, prize: 600 },
    { id: 16, prize: 1200 },
    { id: 11, prize: 200 },
    { id: 18, prize: 1000 },
    { id: 9,  prize: 500 },
    { id: 20, prize: 1400 },
    { id: 7,  prize: 100 },
    { id: 22, prize: 1000 },
    { id: 5,  prize: 400 },
    { id: 24, prize: 1400 },
    { id: 29, prize: 300 },
    { id: 26, prize: 1200 },
    { id: 27, prize: -580 },
    { id: 28, prize: 1600 },
    { id: 25, prize: 300 },
    { id: 30, prize: 6000 },
    { id: 23, prize: 200 },
    { id: 6,  prize: 1400 },
    { id: 21, prize: 300 },
    { id: 8,  prize: 1200 },
    { id: 19, prize: 300 },
  ];

  const baseBaoziPrize = 6000;

  let cells = [];
  let baoziPrize = baseBaoziPrize;

  let idToIndex = {};

  const HISTORY_KEY = 'historyResults';

  let totalGames = 0;
  let totalProfit = 0;
  let historyResults = [];

  let currentDirection = 'cw';

  // 手動總和模式
  let manualRunning = false;
  const MANUAL_INPUT_PER_GAME = 10;

  // 本批（10 局）總盈虧
  let batchNetTotal = 0;

  // 工具：格式成「X 億 X 萬 X元/局」
  function formatYiWan(value, tail) {
    const sign = value < 0 ? '-' : '';
    let v = Math.abs(Math.round(value));

    const yi = Math.floor(v / 100000000);
    v = v % 100000000;
    const wan = Math.floor(v / 10000);
    const ge = v % 10000;

    const parts = [];
    if (yi > 0) parts.push(`${yi} 億`);
    if (wan > 0) parts.push(`${wan} 萬`);
    if (ge > 0 || parts.length === 0) parts.push(`${ge}${tail || ''}`);

    return sign + parts.join(' ');
  }

  function buildIdToIndex() {
    idToIndex = {};
    cells.forEach((cell, idx) => { idToIndex[cell.id] = idx; });
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyResults));
  }

  function getCostPerGame() {
    const input = document.getElementById('cost-input');
    return input ? (Number(input.value) || 100) : 100;
  }

  function getMaxLoss10() {
    const input = document.getElementById('max-loss-10');
    return input ? (Number(input.value) || 100) : 100;
  }

  function applyScale(k) {
    cells = baseCells.map(cell => ({
      id: cell.id,
      prize: Math.round(cell.prize * k)
    }));
    baoziPrize = Math.round(baseBaoziPrize * k);
    buildIdToIndex();
  }

  function initBoardGrid() {
    const board = document.getElementById('board');
    if (!board) return;
    board.innerHTML = '';

    const COLS = 9;
    const ROWS = 6;

    const positions = [];
    for (let c = 0; c < COLS; c++) positions.push({ r: 0, c });
    for (let r = 1; r < ROWS - 1; r++) positions.push({ r, c: COLS - 1 });
    for (let c = COLS - 1; c >= 0; c--) positions.push({ r: ROWS - 1, c });
    for (let r = ROWS - 2; r >= 1; r--) positions.push({ r, c: 0 });

    const total = COLS * ROWS;
    for (let i = 0; i < total; i++) {
      const div = document.createElement('div');
      div.className = 'cell empty-cell';
      board.appendChild(div);
    }

    positions.forEach((pos, idx) => {
      if (idx >= cells.length) return;
      const index = pos.r * COLS + pos.c;
      const cellDiv = board.children[index];

      cellDiv.className = 'cell';
      cellDiv.dataset.index = idx;

      const data = cells[idx];
      const idSpan = document.createElement('div');
      idSpan.className = 'cell-id';
      idSpan.textContent = `#${data.id}`;

      const prizeSpan = document.createElement('div');
      prizeSpan.className = 'cell-prize';
      prizeSpan.textContent = `${data.prize} 元`;

      cellDiv.appendChild(idSpan);
      cellDiv.appendChild(prizeSpan);

      if (data.prize <= 0) cellDiv.classList.add('cell-loss');
      else cellDiv.classList.add('cell-win');
    });
  }

  function refreshBoardPrizes() {
    const board = document.getElementById('board');
    if (!board) return;
    const cellDivs = board.querySelectorAll('.cell');
    cellDivs.forEach(div => {
      const idx = div.dataset.index;
      if (idx === undefined) return;
      const i = Number(idx);
      const prizeDiv = div.querySelector('.cell-prize');
      prizeDiv.textContent = `${cells[i].prize} 元`;
      div.classList.remove('cell-loss', 'cell-win');
      if (cells[i].prize <= 0) div.classList.add('cell-loss');
      else div.classList.add('cell-win');
    });
  }

  function rollDice() {
    const dice = [];
    for (let i = 0; i < 5; i++) {
      dice.push(1 + Math.floor(Math.random() * 6));
    }
    return dice;
  }

  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  function isBaoziSix(dice) {
    return dice.length === 5 && dice.every(x => x === 6);
  }

  function buildPath(S, dir) {
    const N = cells.length;

    let startIndex;
    if (idToIndex.hasOwnProperty(S)) {
      startIndex = idToIndex[S];
    } else {
      startIndex = (S - 1 + N) % N;
    }

    const path = [startIndex];
    let steps = S - 1;
    let offsetSign = dir === 'cw' ? 1 : -1;
    let cur = startIndex;
    for (let i = 0; i < steps; i++) {
      cur = (cur + offsetSign + N) % N;
      path.push(cur);
    }
    return path;
  }

  function highlightCell(index) {
    const board = document.getElementById('board');
    if (!board) return;
    const allCells = board.querySelectorAll('.cell');
    allCells.forEach(c => c.classList.remove('cell-current'));
    if (index === null || index === undefined) return;
    const cellDiv = board.querySelector(`.cell[data-index="${index}"]`);
    if (cellDiv) cellDiv.classList.add('cell-current');
  }

  function animatePath(path, delayMs) {
    const skip = document.getElementById('skip-animation');
    if (skip && skip.checked) {
      highlightCell(path[path.length - 1]);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      let i = 0;
      const timer = setInterval(() => {
        highlightCell(path[i]);
        i += 1;
        if (i >= path.length) {
          clearInterval(timer);
          resolve();
        }
      }, delayMs);
    });
  }

  async function internalPlayOneGame(S, diceDisplay, checkBaozi) {
    const cost = getCostPerGame();

    let prize = 0;
    let finalIndex = null;

    if (checkBaozi && Array.isArray(diceDisplay) && diceDisplay.length === 5 &&
        diceDisplay.every(x => typeof x === 'number') && isBaoziSix(diceDisplay)) {
      prize = baoziPrize;
    } else {
      const path = buildPath(S, currentDirection);
      await animatePath(path, 80);
      finalIndex = path[path.length - 1];
      prize = cells[finalIndex].prize;
    }

    const net = prize - cost;

    totalGames += 1;
    totalProfit += net;
    historyResults.push({ net });
    saveHistory();

    showLastResult(diceDisplay, S, prize, net, finalIndex);
    Admin.refreshAfterGame();
    return net;
  }

  async function playOneGame_auto() {
    const dice = rollDice();
    const S = sum(dice);
    return await internalPlayOneGame(S, dice, true);
  }

  async function playOneGame_manual(S) {
    const display = [`總和=${S}`];
    return await internalPlayOneGame(S, display, false);
  }

  async function playTenGamesAuto() {
    const maxLoss10 = getMaxLoss10();
    let lossThisBatch = 0;
    batchNetTotal = 0;

    for (let i = 0; i < 10; i++) {
      const net = await playOneGame_auto();
      batchNetTotal += net;
      if (net < 0) lossThisBatch += -net;
    }

    updateBatchSummary();

    const riskDiv = document.getElementById('risk-warning');
    if (riskDiv) {
      if (maxLoss10 > 0 && lossThisBatch > maxLoss10) {
        riskDiv.textContent =
          `本次 10 局已虧損 ${lossThisBatch} 元，超過你設定的上限 ${maxLoss10} 元。建議示範到此為止。`;
      } else {
        riskDiv.textContent =
          `本次 10 局總虧損 ${lossThisBatch} 元（未超過上限 ${maxLoss10}）。`;
      }
    }
  }

  // 線下輸入一筆 S：不跳視窗，錯的就忽略
  function askManualSumOnce(idx) {
    return new Promise(resolve => {
      const input = document.getElementById('manual-sum-input');

      const handler = (e) => {
        if (e.type === 'keydown' && e.key !== 'Enter') return;

        let v = Number(input.value);
        if (!Number.isInteger(v) || v < 5 || v > 30) {
          input.value = '';
          return;
        }

        input.removeEventListener('keydown', handler);
        input.removeEventListener('blur', handler);
        input.blur();
        input.value = '';
        resolve(v);
      };

      input.addEventListener('keydown', handler);
      input.addEventListener('blur', handler);

      input.focus();
    });
  }

  async function playManualSumMode() {
    if (manualRunning) return;
    manualRunning = true;

    const counter = document.getElementById('manual-count');
    if (counter) counter.textContent = '0';

    batchNetTotal = 0;

    for (let i = 0; i < MANUAL_INPUT_PER_GAME; i++) {
      const S = await askManualSumOnce(i + 1);
      if (counter) counter.textContent = String(i + 1);
      const net = await playOneGame_manual(S);
      batchNetTotal += net;
    }

    updateBatchSummary();

    if (counter) counter.textContent = '0';
    manualRunning = false;
  }

  function showLastResult(dice, S, prize, net, finalIndex) {
    const div = document.getElementById('last-result');
    if (!div) return;

    let diceText;
    if (Array.isArray(dice) && typeof dice[0] === 'number') {
      diceText = dice.join(', ');
    } else if (Array.isArray(dice)) {
      diceText = dice.join(' ');
    } else {
      diceText = String(dice);
    }

    const cellInfo =
      finalIndex === null
        ? `（直接得獎 ${prize} 元）`
        : `停在 #${cells[finalIndex].id} 格，獎金 ${prize} 元`;

    div.innerHTML = `
      <p>骰子 / 總和資訊：${diceText}，總和 S = ${S}</p>
      <p>${cellInfo}</p>
      <p>本局淨利潤（玩家角度）：${net} 元（正值賺錢，負值虧損）</p>
    `;
  }

  function updateBatchSummary() {
    const div = document.getElementById('batch-summary');
    if (!div) return;

    const history = historyResults;
    const last10 = history.slice(-10);
    const last10Sum = last10.reduce((acc, r) => acc + r.net, 0);

    div.innerHTML = `
      <p>本次 10 局玩家總盈虧：${batchNetTotal} 元</p>
      <p>近 10 局玩家總盈虧：${last10Sum} 元</p>
    `;
  }

  function simulateOneGameForCurrent(cost) {
    const dice = rollDice();
    const S = sum(dice);

    let prize = 0;
    if (isBaoziSix(dice)) {
      prize = baoziPrize;
    } else {
      const dir = Math.random() < 0.5 ? 'cw' : 'ccw';
      const path = buildPath(S, dir);
      const finalIndex = path[path.length - 1];
      prize = cells[finalIndex].prize;
    }
    return prize - cost;
  }

  function simulatePrizeOnlyOneGameBase() {
    const dice = rollDice();
    const S = sum(dice);

    let prize = 0;
    if (isBaoziSix(dice)) {
      prize = baseBaoziPrize;
    } else {
      const dir = Math.random() < 0.5 ? 'cw' : 'ccw';
      const N = baseCells.length;

      const map = {};
      baseCells.forEach((cell, idx) => { map[cell.id] = idx; });

      let startIndex;
      if (map.hasOwnProperty(S)) startIndex = map[S];
      else startIndex = (S - 1 + N) % N;

      let cur = startIndex;
      let steps = S - 1;
      let offsetSign = dir === 'cw' ? 1 : -1;
      for (let i = 0; i < steps; i++) {
        cur = (cur + offsetSign + N) % N;
      }
      prize = baseCells[cur].prize;
    }
    return prize;
  }

  function initControls() {
    // 方向按鈕
    const dirCwBtn = document.getElementById('dir-cw-btn');
    const dirCcwBtn = document.getElementById('dir-ccw-btn');
    if (dirCwBtn && dirCcwBtn) {
      dirCwBtn.addEventListener('click', () => { currentDirection = 'cw'; });
      dirCcwBtn.addEventListener('click', () => { currentDirection = 'ccw'; });
    }

    // 中央分頁：線上 / 線下
    const tabOnline = document.getElementById('tab-online-btn');
    const tabOffline = document.getElementById('tab-offline-btn');
    const autoBlock = document.getElementById('auto-center-block');
    const manualBlock = document.getElementById('manual-center-block');

    if (tabOnline && tabOffline && autoBlock && manualBlock) {
      const switchTab = (mode) => {
        if (mode === 'online') {
          tabOnline.classList.add('active');
          tabOffline.classList.remove('active');
          autoBlock.style.display = 'block';
          manualBlock.style.display = 'none';
        } else {
          tabOnline.classList.remove('active');
          tabOffline.classList.add('active');
          autoBlock.style.display = 'none';
          manualBlock.style.display = 'block';
        }
      };

      tabOnline.addEventListener('click', () => switchTab('online'));
      tabOffline.addEventListener('click', () => switchTab('offline'));
      switchTab('online');
    }

    // 線下模式開始：一次跑 10 次輸入
    const manualStartBtn = document.getElementById('manual-start-btn');
    if (manualStartBtn) {
      manualStartBtn.addEventListener('click', () => {
        playManualSumMode();
      });
    }

    // 線上模式：10 局
    const playTenBtn = document.getElementById('play-ten-btn');
    if (playTenBtn) {
      playTenBtn.addEventListener('click', () => {
        playTenGamesAuto();
      });
    }

    // 若有額外「玩 1 局」按鈕，可在這裡綁定
    const playOneBtn = document.getElementById('play-one-btn');
    if (playOneBtn) {
      playOneBtn.addEventListener('click', async () => {
        await playOneGame_auto();
      });
    }
  }

  function init() {
    historyResults = loadHistory();
    historyResults.forEach(r => {
      totalGames += 1;
      totalProfit += r.net;
    });
    applyScale(1);

    if (document.getElementById('board')) {
      initBoardGrid();
    }
    initControls();
  }

  return {
    init,
    get historyResults() { return historyResults; },
    set historyResults(v) {
      historyResults = v;
      saveHistory();
    },
    get totalGames() { return totalGames; },
    set totalGames(v) { totalGames = v; },
    get totalProfit() { return totalProfit; },
    set totalProfit(v) { totalProfit = v; },
    simulateOneGameForCurrent,
    simulatePrizeOnlyOneGameBase,
    applyScale,
    refreshBoardPrizes,
    getCostPerGame,
    getMaxLoss10,
    formatYiWan,
  };
})();

// ===== 後台模組 =====
const Admin = (() => {
  let profitChart = null;

  function init() {
    const loginBtn = document.getElementById('admin-login-btn');
    const msg = document.getElementById('admin-login-msg');
    const panel = document.getElementById('admin-panel');

    if (!loginBtn) return;

    loginBtn.addEventListener('click', () => {
      const pwd = document.getElementById('admin-password-input').value;
      if (pwd === '1234') {
        panel.style.display = 'block';
        msg.textContent = '登入成功';
        msg.style.color = 'green';
        initPanelAfterLogin();
      } else {
        msg.textContent = '密碼錯誤';
        msg.style.color = 'red';
      }
    });
  }

  function initPanelAfterLogin() {
    refreshAfterGame();
    document.getElementById('apply-scale-btn').addEventListener('click', () => {
      autoScaleByRisk();
    });
    document.getElementById('simulate-btn').addEventListener('click', () => {
      runSimulationAdmin();
    });
    document.getElementById('clear-history-btn').addEventListener('click', () => {
      clearHistoryAdmin();
    });
  }

  function refreshAfterGame() {
    updatePlayerStats();
    updateHistoryTables();
    updateTotalTable();
    drawProfitChart();
  }

  function updatePlayerStats() {
    const games = Game.totalGames;
    const profit = Game.totalProfit;
    const avg = games > 0 ? (profit / games).toFixed(2) : 0;

    const tg = document.getElementById('total-games');
    const tp = document.getElementById('total-profit');
    const ta = document.getElementById('avg-profit');

    if (tg) tg.textContent = `${games} 局（約 ${Game.formatYiWan(games, '')}）`;
    if (tp) tp.textContent = `${profit} 元（約 ${Game.formatYiWan(profit, ' 元')}）`;
    if (ta) ta.textContent = avg;
  }

  function updateHistoryTables() {
    const history = Game.historyResults;
    const last10 = history.slice(-10);
    const last100 = history.slice(-100);

    fillHistoryTable('recent-10-table', history, last10);
    fillHistoryTable('recent-100-table', history, last100);
  }

  function fillHistoryTable(tableId, all, subset) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    subset.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const tdIndex = document.createElement('td');
      const tdNet = document.createElement('td');
      tdIndex.textContent = String(all.length - subset.length + idx + 1);
      tdNet.textContent = item.net;
      tr.appendChild(tdIndex);
      tr.appendChild(tdNet);
      tbody.appendChild(tr);
    });
  }

  function updateTotalTable() {
    const games = Game.totalGames;
    const profit = Game.totalProfit;
    const avg = games > 0 ? (profit / games).toFixed(2) : 0;

    const g = document.getElementById('total-table-games');
    const p = document.getElementById('total-table-profit');
    const a = document.getElementById('total-table-avg');

    if (g) g.textContent = `${games} 局（約 ${Game.formatYiWan(games, '')}）`;
    if (p) p.textContent = `${profit} 元（約 ${Game.formatYiWan(profit, ' 元')}）`;
    if (a) a.textContent = avg;
  }

  function drawProfitChart() {
    const history = Game.historyResults;
    const canvas = document.getElementById('profit-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = history.map((_, i) => i + 1);

    // 累計總盈虧
    const cumulativeTotal = [];
    let running = 0;
    history.forEach(r => {
      running += r.net;
      cumulativeTotal.push(running);
    });

    // 近 10 場累計盈虧
    const cumulative10 = history.map((_, idx) => {
      const start = Math.max(0, idx - 9);
      const slice = history.slice(start, idx + 1);
      return slice.reduce((acc, r) => acc + r.net, 0);
    });

    // 近 100 場累計盈虧
    const cumulative100 = history.map((_, idx) => {
      const start = Math.max(0, idx - 99);
      const slice = history.slice(start, idx + 1);
      return slice.reduce((acc, r) => acc + r.net, 0);
    });

    if (profitChart) profitChart.destroy();

    profitChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '總累計盈虧',
            data: cumulativeTotal,
            borderColor: 'rgba(52, 152, 219, 1)',
            backgroundColor: 'rgba(52, 152, 219, 0.05)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: '近 10 場累計盈虧',
            data: cumulative10,
            borderColor: 'rgba(39, 174, 96, 1)',
            backgroundColor: 'rgba(39, 174, 96, 0.05)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: '近 100 場累計盈虧',
            data: cumulative100,
            borderColor: 'rgba(231, 76, 60, 1)',
            backgroundColor: 'rgba(231, 76, 60, 0.05)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { zeroLineColor: '#000' }
        }
      }
    });
  }

  function autoScaleByRisk() {
    const cost = Game.getCostPerGame();
    const maxLoss10 = Game.getMaxLoss10();
    const targetMu = -maxLoss10 / 10;

    const simN = 200000;
    let sumPrize = 0;
    for (let i = 0; i < simN; i++) {
      sumPrize += Game.simulatePrizeOnlyOneGameBase();
    }
    const expectedPrize = sumPrize / simN;

    let k = (cost - maxLoss10 / 10) / expectedPrize;
    let note = '';
    if (k <= 0 || !Number.isFinite(k)) {
      k = 0.1;
      note = '（原始期望獎金不適合直接套公式，已改用保守倍率 0.1）';
    }

    Game.applyScale(k);
    Game.refreshBoardPrizes();

    const info = document.getElementById('scale-info');
    info.textContent =
      `已套用倍率 k ≈ ${k.toFixed(3)}，理論上每局期望淨利潤約為 ${(-targetMu).toFixed(2)} 元（玩家角度）。${note}`;
  }

  function runSimulationAdmin() {
    const countInput = document.getElementById('sim-count');
    const nRaw = Number(countInput.value) || 100000;
    const cost = Game.getCostPerGame();

    let total = 0;
    for (let i = 0; i < nRaw; i++) {
      total += Game.simulateOneGameForCurrent(cost);
    }
    const avg = total / nRaw;

    // 金額：支援「億、萬、元」
    const formatYiWanYuan = (value) => Game.formatYiWan(value, ' 元');

    // 局數：支援「億、萬、局」
    const formatYiWanJu = (value) => Game.formatYiWan(value, '') + ' 局';

    const prettyTotal = formatYiWanYuan(total);
    const prettyN = formatYiWanJu(nRaw);

    const div = document.getElementById('simulate-result');
    div.textContent =
      `模擬 ${nRaw} 局（約 ${prettyN}）總盈虧：${total.toFixed(2)} 元（約 ${prettyTotal}），平均每局約為 ${avg.toFixed(2)} 元（正值玩家賺錢，負值玩家虧損）。`;
  }

  function clearHistoryAdmin() {
    Game.historyResults = [];
    Game.totalGames = 0;
    Game.totalProfit = 0;
    refreshAfterGame();
  }

  return { init, refreshAfterGame };
})();

// ===== 數學解釋登入 =====
const Explain = (() => {
  function init() {
    const btn = document.getElementById('explain-login-btn');
    if (!btn) return;
    const msg = document.getElementById('explain-login-msg');
    const content = document.getElementById('explain-content');

    btn.addEventListener('click', () => {
      const pwd = document.getElementById('explain-password-input').value;
      if (pwd === '1234') {
        content.style.display = 'block';
        msg.textContent = '登入成功';
        msg.style.color = 'green';
      } else {
        msg.textContent = '密碼錯誤';
        msg.style.color = 'red';
      }
    });
  }
  return { init };
})();
