(function initGomoku(root) {
  "use strict";

  const BLACK = "black";
  const WHITE = "white";
  const EMPTY = null;
  const WIN_LENGTH = 5;
  const DEFAULT_CONFIG = Object.freeze({ maxUndoCount: Infinity, boardSize: 15 });
  const DIRECTIONS = Object.freeze([
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ]);

  function normalizeConfig(rawConfig) {
    const source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const rawMaxUndoCount = source.maxUndoCount;
    const maxUndoCount = rawMaxUndoCount === Infinity || rawMaxUndoCount === "Infinity" || rawMaxUndoCount === "unlimited"
      ? Infinity
      : Number.isFinite(Number(rawMaxUndoCount))
        ? Math.max(0, Math.floor(Number(rawMaxUndoCount)))
        : DEFAULT_CONFIG.maxUndoCount;
    const boardSize = Number.isFinite(Number(source.boardSize))
      ? Math.max(WIN_LENGTH, Math.floor(Number(source.boardSize)))
      : DEFAULT_CONFIG.boardSize;

    return { maxUndoCount, boardSize };
  }

  function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));
  }

  function isInside(board, row, col) {
    return row >= 0 && row < board.length && col >= 0 && col < board.length;
  }

  function collectLine(board, row, col, player, dRow, dCol) {
    const cells = [{ row, col }];

    let nextRow = row + dRow;
    let nextCol = col + dCol;
    while (isInside(board, nextRow, nextCol) && board[nextRow][nextCol] === player) {
      cells.push({ row: nextRow, col: nextCol });
      nextRow += dRow;
      nextCol += dCol;
    }

    nextRow = row - dRow;
    nextCol = col - dCol;
    while (isInside(board, nextRow, nextCol) && board[nextRow][nextCol] === player) {
      cells.unshift({ row: nextRow, col: nextCol });
      nextRow -= dRow;
      nextCol -= dCol;
    }

    return cells;
  }

  function checkWinnerFromMove(board, row, col) {
    const player = board[row] && board[row][col];
    if (!player) return null;

    for (const [dRow, dCol] of DIRECTIONS) {
      const cells = collectLine(board, row, col, player, dRow, dCol);
      if (cells.length >= WIN_LENGTH) {
        return { player, cells };
      }
    }

    return null;
  }

  function getNextPlayer(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function playerName(player) {
    return player === BLACK ? "黑棋" : "白棋";
  }

  function cellKey(row, col) {
    return `${row}:${col}`;
  }

  function boardPercent(index, size) {
    return size <= 1 ? "0%" : `${(index / (size - 1)) * 100}%`;
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.row === b.row && a.col === b.col);
  }

  function bootDomGame() {
    if (!root.document) return;

    const config = normalizeConfig(root.GOMOKU_CONFIG);
    const boardEl = document.getElementById("board");
    const pointLayer = document.getElementById("pointLayer");
    const stoneLayer = document.getElementById("stoneLayer");
    const turnPill = document.getElementById("turnPill");
    const turnText = document.getElementById("turnText");
    const statusText = document.getElementById("statusText");
    const undoCounter = document.getElementById("undoCounter");
    const undoMessage = document.getElementById("undoMessage");
    const blackUndoCount = document.getElementById("blackUndoCount");
    const whiteUndoCount = document.getElementById("whiteUndoCount");
    const confirmHint = document.getElementById("confirmHint");
    const undoButton = document.getElementById("undoButton");
    const restartButton = document.getElementById("restartButton");

    if (!boardEl || !pointLayer || !stoneLayer || !turnPill || !turnText || !statusText || !undoCounter || !undoMessage || !blackUndoCount || !whiteUndoCount || !confirmHint || !undoButton || !restartButton) {
      return;
    }

    let board;
    let currentPlayer;
    let moveHistory;
    let undoUsed;
    let winner;
    let winningKeys;
    let lastMove;
    let activePress;
    let pendingMove;
    let undoCounts;
    let lastUndoPlayer;

    boardEl.style.setProperty("--board-size", String(config.boardSize));
    boardEl.style.setProperty("--grid-cell", boardPercent(1, config.boardSize));

    function resetGame() {
      board = createEmptyBoard(config.boardSize);
      currentPlayer = BLACK;
      moveHistory = [];
      undoUsed = 0;
      winner = null;
      winningKeys = new Set();
      lastMove = null;
      activePress = null;
      pendingMove = null;
      undoCounts = { [BLACK]: 0, [WHITE]: 0 };
      lastUndoPlayer = null;
      renderAll();
    }

    function setupBoardButtons() {
      pointLayer.textContent = "";

      for (let row = 0; row < config.boardSize; row += 1) {
        for (let col = 0; col < config.boardSize; col += 1) {
          const point = document.createElement("button");
          point.type = "button";
          point.className = "point";
          point.style.setProperty("--x", boardPercent(col, config.boardSize));
          point.style.setProperty("--y", boardPercent(row, config.boardSize));
          point.dataset.row = String(row);
          point.dataset.col = String(col);
          point.setAttribute("role", "gridcell");
          point.setAttribute("aria-label", `${row + 1}行${col + 1}列，空位`);
          point.addEventListener("pointerdown", handlePointerDown);
          point.addEventListener("pointermove", handlePointerMove);
          point.addEventListener("pointerup", handlePointerUp);
          point.addEventListener("pointercancel", clearActivePress);
          point.addEventListener("lostpointercapture", clearActivePress);
          point.addEventListener("keydown", handleKeyboardPlace);
          pointLayer.appendChild(point);
        }
      }
    }

    function getPointFromEvent(event) {
      const point = event.currentTarget;
      return {
        point,
        row: Number(point.dataset.row),
        col: Number(point.dataset.col)
      };
    }

    function canPlace(row, col) {
      return !winner && isInside(board, row, col) && board[row][col] === EMPTY;
    }

    function hasUndoQuota() {
      return config.maxUndoCount === Infinity || undoUsed < config.maxUndoCount;
    }

    function handlePointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      const { point, row, col } = getPointFromEvent(event);
      if (!canPlace(row, col)) return;

      clearActivePress();
      activePress = {
        point,
        row,
        col,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cancelled: false
      };

      point.setPointerCapture?.(event.pointerId);
      point.classList.add("is-pressing", `preview-${currentPlayer}`);
      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (!activePress || activePress.pointerId !== event.pointerId) return;
      const dx = event.clientX - activePress.startX;
      const dy = event.clientY - activePress.startY;
      activePress.cancelled = Math.hypot(dx, dy) > 18;
      activePress.point.classList.toggle("is-cancelled", activePress.cancelled);
    }

    function handlePointerUp(event) {
      if (!activePress || activePress.pointerId !== event.pointerId) return;
      const { row, col, cancelled } = activePress;
      clearActivePress();

      if (!cancelled) {
        handleBoardSelection(row, col);
      }
    }

    function clearActivePress() {
      if (!activePress) return;
      activePress.point.classList.remove("is-pressing", "is-cancelled", "preview-black", "preview-white");
      activePress = null;
    }

    function handleKeyboardPlace(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const { row, col } = getPointFromEvent(event);
      if (!canPlace(row, col)) return;
      event.preventDefault();
      handleBoardSelection(row, col);
    }

    function handleBoardSelection(row, col) {
      if (!canPlace(row, col)) return false;

      const selectedMove = { row, col, player: currentPlayer };
      if (sameCell(pendingMove, selectedMove) && pendingMove.player === currentPlayer) {
        return placeStone(row, col);
      }

      pendingMove = selectedMove;
      renderAll();
      return false;
    }

    function placeStone(row, col) {
      if (!canPlace(row, col)) return false;

      board[row][col] = currentPlayer;
      lastMove = { row, col, player: currentPlayer };
      moveHistory.push(lastMove);
      pendingMove = null;

      const result = checkWinnerFromMove(board, row, col);
      if (result) {
        winner = result.player;
        winningKeys = new Set(result.cells.map((cell) => cellKey(cell.row, cell.col)));
      } else {
        currentPlayer = getNextPlayer(currentPlayer);
      }

      renderAll();
      return true;
    }

    function undoMove() {
      if (moveHistory.length === 0 || !hasUndoQuota()) return false;

      const move = moveHistory.pop();
      board[move.row][move.col] = EMPTY;
      currentPlayer = move.player;
      undoUsed += 1;
      undoCounts[move.player] += 1;
      lastUndoPlayer = move.player;
      winner = null;
      winningKeys = new Set();
      pendingMove = null;
      lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
      renderAll();
      return true;
    }

    function renderAll() {
      renderPoints();
      renderStones();
      renderStatus();
    }

    function renderPoints() {
      for (const point of pointLayer.children) {
        const row = Number(point.dataset.row);
        const col = Number(point.dataset.col);
        const occupied = board[row][col] !== EMPTY;
        const disabled = occupied || Boolean(winner);
        point.disabled = disabled;
        point.classList.remove("preview-black", "preview-white", "is-pressing", "is-cancelled", "is-pending");
        point.classList.add(`preview-${currentPlayer}`);
        if (!disabled && pendingMove && pendingMove.row === row && pendingMove.col === col && pendingMove.player === currentPlayer) {
          point.classList.add("is-pending");
        }
        point.setAttribute(
          "aria-label",
          `${row + 1}行${col + 1}列，${occupied ? playerName(board[row][col]) : winner ? "已锁定" : pendingMove && pendingMove.row === row && pendingMove.col === col ? `已框选，第二次点击确认${playerName(currentPlayer)}落子` : `${playerName(currentPlayer)}可框选`}`
        );
      }
    }

    function renderStones() {
      stoneLayer.textContent = "";
      for (let row = 0; row < config.boardSize; row += 1) {
        for (let col = 0; col < config.boardSize; col += 1) {
          const player = board[row][col];
          if (!player) continue;

          const stone = document.createElement("span");
          stone.className = `stone ${player}`;
          stone.style.setProperty("--x", boardPercent(col, config.boardSize));
          stone.style.setProperty("--y", boardPercent(row, config.boardSize));

          if (lastMove && lastMove.row === row && lastMove.col === col) {
            stone.classList.add("last");
          }
          if (winningKeys.has(cellKey(row, col))) {
            stone.classList.add("winning");
          }

          stoneLayer.appendChild(stone);
        }
      }
    }

    function renderStatus() {
      undoCounter.textContent = config.maxUndoCount === Infinity ? "∞" : String(Math.max(0, config.maxUndoCount - undoUsed));
      undoButton.disabled = moveHistory.length === 0 || !hasUndoQuota();
      blackUndoCount.textContent = String(undoCounts[BLACK]);
      whiteUndoCount.textContent = String(undoCounts[WHITE]);
      undoMessage.textContent = lastUndoPlayer
        ? `${playerName(lastUndoPlayer)}悔棋，撤回了上一手。`
        : "还没有悔棋。";

      turnPill.classList.toggle("winner", Boolean(winner));
      const stone = turnPill.querySelector(".mini-stone");
      if (stone) {
        stone.classList.toggle("black", (winner || currentPlayer) === BLACK);
        stone.classList.toggle("white", (winner || currentPlayer) === WHITE);
      }

      if (winner) {
        turnText.textContent = `${playerName(winner)}获胜`;
        statusText.textContent = "棋局已锁定，可重新开始或悔棋复盘。";
        confirmHint.textContent = "获胜后可继续悔棋复盘。";
      } else if (moveHistory.length === config.boardSize * config.boardSize) {
        turnText.textContent = "平局";
        statusText.textContent = "棋盘已满，可重新开始。";
        confirmHint.textContent = "棋盘已满，可重新开始或悔棋。";
      } else if (pendingMove) {
        turnText.textContent = `${playerName(currentPlayer)}待确认`;
        statusText.textContent = `已框选第 ${pendingMove.row + 1} 行第 ${pendingMove.col + 1} 列，再点同一方框确认落子。`;
        confirmHint.textContent = "点其他交点会移动方框，不会直接落子。";
      } else {
        turnText.textContent = `${playerName(currentPlayer)}回合`;
        statusText.textContent = moveHistory.length === 0
          ? "黑棋先手：先点击交点显示方框，再点同一方框确认。"
          : `第 ${moveHistory.length + 1} 手，轮到${playerName(currentPlayer)}。`;
        confirmHint.textContent = "每手棋都需要二次点击确认。";
      }
    }

    undoButton.addEventListener("pointerdown", () => undoButton.classList.add("is-pressing"));
    undoButton.addEventListener("pointerup", () => undoButton.classList.remove("is-pressing"));
    undoButton.addEventListener("pointercancel", () => undoButton.classList.remove("is-pressing"));
    undoButton.addEventListener("click", undoMove);
    restartButton.addEventListener("click", resetGame);

    setupBoardButtons();
    resetGame();

    root.GomokuApp = {
      getState() {
        return {
          board: board.map((row) => row.slice()),
          currentPlayer,
          moveHistory: moveHistory.slice(),
          undoUsed,
          undoCounts: { ...undoCounts },
          pendingMove: pendingMove ? { ...pendingMove } : null,
          lastUndoPlayer,
          winner,
          remainingUndo: config.maxUndoCount === Infinity ? Infinity : Math.max(0, config.maxUndoCount - undoUsed)
        };
      },
      handleBoardSelection,
      placeStone,
      undoMove,
      resetGame
    };
  }

  root.GomokuRules = {
    BLACK,
    WHITE,
    WIN_LENGTH,
    normalizeConfig,
    createEmptyBoard,
    checkWinnerFromMove,
    getNextPlayer
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GomokuRules;
  }

  bootDomGame();
})(typeof globalThis !== "undefined" ? globalThis : window);


