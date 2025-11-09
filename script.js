/* ---------- Game state & constants ---------- */
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restart');
const modeSelect = document.getElementById('mode');
const playerSymbolSelect = document.getElementById('playerSymbol');
const firstLabel = document.getElementById('firstLabel');

const winSvg = document.getElementById('winSvg');
const winLine = document.getElementById('winLine');

const confettiCanvas = document.getElementById('confetti');
const ctx = confettiCanvas.getContext('2d');

let board = Array(9).fill(null);
let currentPlayer = 'X';
let gameOver = false;
let scores = { X:0, O:0, T:0 };

// Winning lines (indices)
const WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

function isVsComputer(){ return modeSelect.value === 'pvc'; }
function humanSymbol(){ return playerSymbolSelect.value; }
function computerSymbol(){ return humanSymbol() === 'X' ? 'O' : 'X'; }

/* ---------- Responsive canvas ---------- */
function resizeCanvas(){
  confettiCanvas.width = confettiCanvas.clientWidth;
  confettiCanvas.height = confettiCanvas.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

/* ---------- UI creation ---------- */
function createBoardUI(){
  boardEl.innerHTML = '';
  for(let i=0;i<9;i++){
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.setAttribute('data-index', i);
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Cell ${i+1}`);
    cell.innerHTML = `
      <div class="cell-inner">
        <div class="cell-face face-front"></div>
        <div class="cell-face face-back"><span class="marker"></span></div>
      </div>
    `;
    cell.addEventListener('click', onCellClick);
    boardEl.appendChild(cell);
  }
}
createBoardUI();
resizeCanvas();

/* ---------- Render ---------- */
function render(){
  for(let i=0;i<9;i++){
    const cell = boardEl.children[i];
    const val = board[i];
    cell.classList.toggle('x', val === 'X');
    cell.classList.toggle('o', val === 'O');
    cell.classList.toggle('disabled', !!val || gameOver);

    // set marker svg if placed
    const markerWrap = cell.querySelector('.marker');
    markerWrap.innerHTML = ''; // clear

    if(val){
      if(val === 'X'){
        markerWrap.innerHTML = xSVG();
      } else {
        markerWrap.innerHTML = oSVG();
      }
      // flip and animate
      cell.classList.add('played');
      // small delay for pop effect after flip completes
      setTimeout(()=> {
        markerWrap.querySelector('svg')?.classList.add('placed-pop');
      }, 300);
    } else {
      cell.classList.remove('played');
    }
  }

  const result = checkWinner(board);
  if(result === 'X' || result === 'O'){
    statusEl.textContent = `Player ${result} wins!`;
    gameOver = true;
    scores[result] += 1;
    updateScores();
    revealWinLine(board, result);
    startConfetti();
  } else if (result === 'tie'){
    statusEl.textContent = `It's a draw.`;
    gameOver = true;
    scores.T += 1;
    updateScores();
  } else {
    statusEl.textContent = `${currentPlayer}'s turn ${isVsComputer() && currentPlayer === computerSymbol() ? '(Computer thinking...)' : ''}`;
  }
}

/* ---------- Marker SVGs (animated stroke) ---------- */
function xSVG(){
  return `
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true">
    <path d="M20 20 L80 80" stroke-linecap="round" stroke-width="10"></path>
    <path d="M80 20 L20 80" stroke-linecap="round" stroke-width="10"></path>
  </svg>`;
}
function oSVG(){
  return `
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden="true">
    <circle cx="50" cy="50" r="30" stroke-width="10"></circle>
  </svg>`;
}

/* ---------- Click handling ---------- */
function onCellClick(e){
  const idx = +e.currentTarget.dataset.index;
  if(gameOver || board[idx]) return;

  makeMove(idx, currentPlayer);

  render();

  if(gameOver) return;

  // if vs computer and it's computer's turn, let it play after short delay
  if(isVsComputer() && currentPlayer === computerSymbol()){
    statusEl.textContent = `${currentPlayer} (Computer) is thinking...`;
    setTimeout(()=> {
      const best = computeBestMove(board, computerSymbol());
      makeMove(best, computerSymbol());
      render();
    }, 320);
  }
}

function makeMove(index, player){
  if(board[index] || gameOver) return false;
  board[index] = player;
  const res = checkWinner(board);
  if(!res){
    currentPlayer = player === 'X' ? 'O' : 'X';
  }
  return true;
}

/* ---------- Winner detection (returns 'X','O','tie', or null) ---------- */
function checkWinner(b){
  for(const line of WIN_LINES){
    const [a,c,d] = line;
    if(b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  if(b.every(cell => cell !== null)) return 'tie';
  return null;
}

/* ---------- Restart & controls ---------- */
function restart(){
  board = Array(9).fill(null);
  gameOver = false;
  clearWinLine();
  stopConfetti();
  if(isVsComputer()){
    // if human is O, computer (X) starts immediately
    if(humanSymbol() === 'O'){
      currentPlayer = 'X';
      render();
      setTimeout(()=> {
        const best = computeBestMove(board, computerSymbol());
        makeMove(best, computerSymbol());
        render();
      }, 250);
      return;
    }
  }
  currentPlayer = 'X';
  render();
}

restartBtn.addEventListener('click', restart);
modeSelect.addEventListener('change', () => {
  firstLabel.style.display = isVsComputer() ? 'inline-block' : 'none';
  restart();
});
playerSymbolSelect.addEventListener('change', restart);

/* ---------- Minimax AI (optimal) ---------- */
function computeBestMove(b, player){
  // quick center preference
  if(b.every(c => c === null)) return 4;

  const opponent = player === 'X' ? 'O' : 'X';

  function minimax(boardState, turn){
    const winner = checkWinner(boardState);
    if(winner === player) return {score: 1};
    if(winner === opponent) return {score: -1};
    if(winner === 'tie') return {score: 0};

    const moves = [];
    for(let i=0;i<9;i++){
      if(boardState[i] === null){
        boardState[i] = turn;
        const res = minimax(boardState, turn === player ? opponent : player);
        moves.push({index:i, score: res.score});
        boardState[i] = null;
      }
    }

    if(turn === player){
      // maximize
      let best = moves[0];
      for(const m of moves) if(m.score > best.score) best = m;
      return best;
    } else {
      // minimize
      let best = moves[0];
      for(const m of moves) if(m.score < best.score) best = m;
      return best;
    }
  }

  const bestMove = minimax(b.slice(), player);
  return bestMove.index;
}

/* ---------- Animated win line ---------- */
function revealWinLine(boardArr, winner){
  const line = WIN_LINES.find(l => {
    const [a,b,c] = l;
    return boardArr[a] && boardArr[a] === boardArr[b] && boardArr[a] === boardArr[c];
  });
  if(!line) return;
  function centerForIndex(idx){
    const col = idx % 3;
    const row = Math.floor(idx/3);
    const step = 360/3; // 120
    const cx = step*(col + 0.5);
    const cy = step*(row + 0.5);
    return {x: cx, y: cy};
  }
  const p1 = centerForIndex(line[0]);
  const p3 = centerForIndex(line[2]);

  winLine.setAttribute('x1', p1.x);
  winLine.setAttribute('y1', p1.y);
  winLine.setAttribute('x2', p3.x);
  winLine.setAttribute('y2', p3.y);

  winLine.style.stroke = winner === 'X' ? 'rgba(255,122,24,0.95)' : 'rgba(79,176,255,0.95)';
  void winLine.offsetWidth;
  winLine.classList.add('reveal');

  // highlight winning cells
  line.forEach(i => {
    const c = boardEl.children[i];
    c.style.boxShadow = `0 18px 40px ${winner === 'X' ? 'rgba(255,122,24,0.12)' : 'rgba(79,176,255,0.12)'}, inset 0 0 14px rgba(255,255,255,0.02)`;
  });
}

function clearWinLine(){
  winLine.classList.remove('reveal');
  winLine.setAttribute('x1', 0); winLine.setAttribute('y1',0);
  winLine.setAttribute('x2', 0); winLine.setAttribute('y2',0);
  for(let i=0;i<9;i++){
    const c = boardEl.children[i];
    if(c) c.style.boxShadow = '';
  }
}

/* ---------- Scoreboard ---------- */
function updateScores(){
  document.getElementById('scoreX').textContent = scores.X;
  document.getElementById('scoreO').textContent = scores.O;
  document.getElementById('scoreT').textContent = scores.T;
}

/* ---------- Confetti (lightweight) ---------- */
let confettiPieces = [];
let confettiAnimating = false;
function startConfetti(){
  if(confettiAnimating) return;
  confettiAnimating = true;
  confettiPieces = [];
  const W = confettiCanvas.width, H = confettiCanvas.height;
  for(let i=0;i<80;i++){
    confettiPieces.push({
      x: Math.random()*W,
      y: Math.random()*H - H,
      vx: (Math.random()-0.5)*3,
      vy: 2 + Math.random()*4,
      size: 6 + Math.random()*8,
      rot: Math.random()*360,
      vr: (Math.random()-0.5)*8,
      color: i%2===0 ? (Math.random()>0.5 ? '#ff7a18' : '#ffd2b3') : (Math.random()>0.5 ? '#59aefb' : '#bfe7ff')
    });
  }
  let t0 = null;
  function frame(ts){
    if(!t0) t0 = ts;
    // clear
    ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    // draw pieces
    confettiPieces.forEach(p=>{
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      ctx.restore();
    });
    // remove if off-screen
    confettiPieces = confettiPieces.filter(p=>p.y < confettiCanvas.height + 60);
    if(confettiPieces.length > 0 && confettiAnimating){
      requestAnimationFrame(frame);
    } else {
      confettiAnimating = false;
      ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    }
  }
  requestAnimationFrame(frame);
  // stop after around 2.6s by disabling spawn (pieces fade naturally)
  setTimeout(()=> { confettiPieces = []; }, 2600);
}
function stopConfetti(){
  confettiAnimating = false;
  confettiPieces = [];
  ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
}

/* ---------- Initialize & first render ---------- */
render();

/* ---------- Helpers: animate existing stroke drawings after DOM changes ---------- */
function tickAnimationHack(){
  document.querySelectorAll('.marker svg').forEach(svg=>{
    svg.querySelectorAll('path, circle, line').forEach(el=>{
      try {
        const len = el.getTotalLength ? el.getTotalLength() : 200;
        el.style.strokeDasharray = Math.max(len, 200);
        el.style.strokeDashoffset = el.style.strokeDashoffset === '' ? el.style.strokeDashoffset : el.style.strokeDashoffset;
      } catch (e){}
      void el.getBoundingClientRect();
    });
  });
}
setTimeout(tickAnimationHack, 50);
setTimeout(()=>{ tickAnimationHack(); }, 400);

/* ---------- On first open: small intro bounce ---------- */
function introDemo(){
  const cells = Array.from(boardEl.children);
  cells.forEach((c,i)=>{
    setTimeout(()=> {
      c.animate([{transform:'translateY(12px)'},{transform:'translateY(0)'}], {duration:420, easing:'cubic-bezier(.2,.9,.25,1)'});
    }, i*30 + 150);
  });
}
introDemo();

/* ---------- Ensure canvas sized and redraw on open ---------- */
resizeCanvas();
window.addEventListener('load', resizeCanvas);

/* ---------- Prevent accidental text selects on double-tap mobile ---------- */
document.addEventListener('touchmove', function(e){ if(e.scale && e.scale !== 1) e.preventDefault(); }, {passive:false});
