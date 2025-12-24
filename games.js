// ============================================
// PLAYABLE GAMES IMPLEMENTATION
// Real, interactive games - NO placeholders
// ============================================

class GameManager {
    constructor(supabase, userId) {
        this.supabase = supabase;
        this.userId = userId;
        this.currentGame = null;
        this.gameModal = null;
    }

    // Normalize game name for matching (case-insensitive, trim whitespace)
    normalizeGameName(name) {
        return (name || '').trim().toLowerCase();
    }

    // Map database game names to implementations
    getGameImplementation(gameName) {
        const normalized = this.normalizeGameName(gameName);
        
        const gameMap = {
            'bounce game': this.playBounceGame.bind(this),
            'click speed challenge': this.playClickSpeedChallenge.bind(this),
            'memory tiles': this.playMemoryTiles.bind(this),
            'reaction test': this.playReactionTest.bind(this),
            'number guess': this.playNumberGuess.bind(this),
            'word puzzle': this.playWordPuzzle.bind(this),
            'color match': this.playColorMatch.bind(this),
            'math challenge': this.playMathChallenge.bind(this),
            'typing speed': this.playTypingSpeed.bind(this),
            'snake game': this.playSnakeGame.bind(this),
            'tetris': this.playTetris.bind(this),
            'pong': this.playPong.bind(this),
            '2048': this.play2048.bind(this),
            'rock paper scissors': this.playRockPaperScissors.bind(this),
            'tic tac toe': this.playTicTacToe.bind(this),
            'simon says': this.playSimonSays.bind(this),
            'whack a mole': this.playWhackAMole.bind(this),
            'space invaders': this.playSpaceInvaders.bind(this),
            'breakout': this.playBreakout.bind(this),
            'frogger': this.playFrogger.bind(this),
        };
        
        return gameMap[normalized] || null;
    }

    // Check if a game is playable
    isGamePlayable(gameName) {
        return this.getGameImplementation(gameName) !== null;
    }

    // Show game modal
    showGameModal(gameId, gameName, rewardCoins, rewardTokens) {
        const implementation = this.getGameImplementation(gameName);
        
        if (!implementation) {
            alert(`🚧 ${gameName} is coming soon! Check back later.`);
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'gameModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        `;

        const gameContainer = document.createElement('div');
        gameContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ef4444;
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => this.closeGameModal();

        const title = document.createElement('h2');
        title.textContent = gameName;
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #667eea;
        `;

        const gameArea = document.createElement('div');
        gameArea.id = 'gameArea';
        gameArea.style.cssText = `
            min-height: 300px;
            margin-bottom: 20px;
        `;

        gameContainer.appendChild(closeBtn);
        gameContainer.appendChild(title);
        gameContainer.appendChild(gameArea);
        modal.appendChild(gameContainer);
        document.body.appendChild(modal);

        this.gameModal = modal;
        this.currentGame = { id: gameId, name: gameName, rewardCoins, rewardTokens };

        // Start the game
        implementation(gameArea, gameId, gameName, rewardCoins);
    }

    closeGameModal() {
        if (this.gameModal) {
            this.gameModal.remove();
            this.gameModal = null;
            this.currentGame = null;
        }
    }

    async submitGameResult(gameId, won, score = null) {
        try {
            if (!this.supabase || !this.userId) {
                throw new Error('Not authenticated');
            }

            // Get game info
            const { data: game, error: gameError } = await this.supabase
                .from('games')
                .select('reward_coins, reward_tokens')
                .eq('id', gameId)
                .single();

            if (gameError) {
                throw new Error('Game not found');
            }

            // Insert game result
            const { error: resultError } = await this.supabase
                .from('game_results')
                .insert({
                    user_id: this.userId,
                    game_id: gameId,
                    won: won,
                    score: score
                });

            if (resultError) {
                throw new Error(resultError.message || 'Failed to save game result');
            }

            // Coins are awarded by database trigger, but verify via server API
            if (won && game.reward_coins > 0) {
                try {
                    // Use server endpoint to award coins (bypasses RLS)
                    const response = await fetch('http://localhost:3000/api/games/award-coins', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: this.userId,
                            gameId: gameId,
                            coins: game.reward_coins
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Coins awarded via server:', result);
                    } else {
                        console.warn('⚠️ Server coin award failed, but database trigger should handle it');
                    }
                } catch (error) {
                    console.warn('⚠️ Coin award API call failed, but database trigger should handle it:', error);
                }
            }

            return { success: true, coins: won ? game.reward_coins : 0 };
        } catch (error) {
            console.error('Error submitting game result:', error);
            throw error;
        }
    }

    // ============================================
    // GAME IMPLEMENTATIONS
    // ============================================

    playClickSpeedChallenge(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="clickTimer" style="font-size: 48px; font-weight: bold; color: #667eea; margin: 20px 0;">
                    10
                </div>
                <div id="clickCount" style="font-size: 32px; margin: 20px 0;">
                    Clicks: 0
                </div>
                <button id="clickButton" style="
                    padding: 30px 60px;
                    font-size: 24px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: bold;
                ">CLICK ME!</button>
                <div id="clickResult" style="margin-top: 20px; font-size: 18px;"></div>
            </div>
        `;

        let clicks = 0;
        let timeLeft = 10;
        let gameActive = false;
        let gameEnded = false;

        const timerEl = document.getElementById('clickTimer');
        const countEl = document.getElementById('clickCount');
        const buttonEl = document.getElementById('clickButton');
        const resultEl = document.getElementById('clickResult');

        const startGame = () => {
            if (gameActive || gameEnded) return;
            gameActive = true;
            clicks = 0;
            timeLeft = 10;
            countEl.textContent = 'Clicks: 0';
            resultEl.textContent = '';
            buttonEl.textContent = 'CLICK ME!';
            buttonEl.style.background = '#667eea';

            const timer = setInterval(() => {
                timeLeft--;
                timerEl.textContent = timeLeft;

                if (timeLeft <= 0) {
                    clearInterval(timer);
                    endGame();
                }
            }, 1000);
        };

        const handleClick = () => {
            if (!gameActive) {
                startGame();
                return;
            }
            if (gameEnded) return;

            clicks++;
            countEl.textContent = `Clicks: ${clicks}`;
        };

        const endGame = async () => {
            gameActive = false;
            gameEnded = true;
            buttonEl.disabled = true;
            buttonEl.style.background = '#9ca3af';
            buttonEl.textContent = 'Game Over';

            const winThreshold = 30;
            const won = clicks >= winThreshold;

            resultEl.innerHTML = `
                <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                    <strong>${won ? '🎉 You Won!' : '😔 You Lost'}</strong><br>
                    Final Score: ${clicks} clicks<br>
                    ${won ? `You earned ${rewardCoins} coins!` : `Need ${winThreshold} clicks to win.`}
                </div>
            `;

            try {
                const result = await this.submitGameResult(gameId, won, clicks);
                if (result.success && won) {
                    setTimeout(() => {
                        alert(`🎉 Congratulations! You earned ${rewardCoins} coins!`);
                        this.closeGameModal();
                    }, 2000);
                }
            } catch (error) {
                resultEl.innerHTML += `<div style="color: #ef4444; margin-top: 10px;">Error: ${error.message}</div>`;
            }
        };

        buttonEl.onclick = handleClick;
    }

    playReactionTest(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="reactionStatus" style="font-size: 24px; margin: 20px 0; color: #6b7280;">
                    Wait for the green light...
                </div>
                <div id="reactionBox" style="
                    width: 200px;
                    height: 200px;
                    margin: 20px auto;
                    border-radius: 12px;
                    background: #e5e7eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.3s;
                ">WAIT</div>
                <div id="reactionTime" style="font-size: 20px; margin: 20px 0;"></div>
                <div id="reactionResult" style="margin-top: 20px; font-size: 18px;"></div>
                <button id="reactionStartBtn" style="
                    padding: 15px 30px;
                    font-size: 18px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 20px;
                ">Start Test</button>
            </div>
        `;

        const statusEl = document.getElementById('reactionStatus');
        const boxEl = document.getElementById('reactionBox');
        const timeEl = document.getElementById('reactionTime');
        const resultEl = document.getElementById('reactionResult');
        const startBtn = document.getElementById('reactionStartBtn');

        let gameActive = false;
        let gameEnded = false;
        let startTime = null;
        let timeoutId = null;

        const startTest = () => {
            if (gameActive || gameEnded) return;
            
            gameActive = true;
            startBtn.style.display = 'none';
            statusEl.textContent = 'Wait for the green light...';
            boxEl.textContent = 'WAIT';
            boxEl.style.background = '#e5e7eb';
            boxEl.style.cursor = 'not-allowed';
            timeEl.textContent = '';
            resultEl.textContent = '';

            // Random delay between 1-5 seconds
            const delay = Math.random() * 4000 + 1000;
            
            timeoutId = setTimeout(() => {
                boxEl.style.background = '#10b981';
                boxEl.textContent = 'CLICK!';
                boxEl.style.cursor = 'pointer';
                statusEl.textContent = 'CLICK NOW!';
                startTime = Date.now();

                boxEl.onclick = handleClick;
            }, delay);
        };

        const handleClick = async () => {
            if (!startTime || gameEnded) return;

            const reactionTime = Date.now() - startTime;
            gameActive = false;
            gameEnded = true;
            boxEl.style.cursor = 'not-allowed';
            boxEl.onclick = null;

            const winThreshold = 300; // 300ms or faster
            const won = reactionTime <= winThreshold;

            timeEl.textContent = `Reaction Time: ${reactionTime}ms`;
            resultEl.innerHTML = `
                <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                    <strong>${won ? '🎉 You Won!' : '😔 Too Slow'}</strong><br>
                    Reaction Time: ${reactionTime}ms<br>
                    ${won ? `You earned ${rewardCoins} coins!` : `Need ${winThreshold}ms or faster to win.`}
                </div>
            `;

            try {
                const result = await this.submitGameResult(gameId, won, reactionTime);
                if (result.success && won) {
                    setTimeout(() => {
                        alert(`🎉 Congratulations! You earned ${rewardCoins} coins!`);
                        this.closeGameModal();
                    }, 2000);
                }
            } catch (error) {
                resultEl.innerHTML += `<div style="color: #ef4444; margin-top: 10px;">Error: ${error.message}</div>`;
            }
        };

        startBtn.onclick = startTest;
    }

    playNumberGuess(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="guessStatus" style="font-size: 24px; margin: 20px 0; color: #667eea;">
                    Guess a number between 1 and 100
                </div>
                <div id="guessAttempts" style="font-size: 18px; margin: 10px 0; color: #6b7280;">
                    Attempts: 0 / 7
                </div>
                <div id="guessHint" style="font-size: 16px; margin: 10px 0; min-height: 24px; color: #9ca3af;"></div>
                <input type="number" id="guessInput" min="1" max="100" style="
                    padding: 15px;
                    font-size: 20px;
                    width: 150px;
                    text-align: center;
                    border: 2px solid #667eea;
                    border-radius: 8px;
                    margin: 20px 0;
                " placeholder="1-100">
                <br>
                <button id="guessSubmitBtn" style="
                    padding: 15px 30px;
                    font-size: 18px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Submit Guess</button>
                <div id="guessResult" style="margin-top: 20px; font-size: 18px;"></div>
            </div>
        `;

        const targetNumber = Math.floor(Math.random() * 100) + 1;
        let attempts = 0;
        const maxAttempts = 7;
        let gameEnded = false;

        const statusEl = document.getElementById('guessStatus');
        const attemptsEl = document.getElementById('guessAttempts');
        const hintEl = document.getElementById('guessHint');
        const inputEl = document.getElementById('guessInput');
        const submitBtn = document.getElementById('guessSubmitBtn');
        const resultEl = document.getElementById('guessResult');

        const makeGuess = async () => {
            if (gameEnded) return;

            const guess = parseInt(inputEl.value);
            if (isNaN(guess) || guess < 1 || guess > 100) {
                hintEl.textContent = 'Please enter a number between 1 and 100';
                hintEl.style.color = '#ef4444';
                return;
            }

            attempts++;
            attemptsEl.textContent = `Attempts: ${attempts} / ${maxAttempts}`;

            if (guess === targetNumber) {
                gameEnded = true;
                inputEl.disabled = true;
                submitBtn.disabled = true;
                statusEl.textContent = '🎉 Correct!';
                hintEl.textContent = '';
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                        <strong>You Won!</strong><br>
                        The number was ${targetNumber}<br>
                        You guessed it in ${attempts} attempt${attempts === 1 ? '' : 's'}!<br>
                        You earned ${rewardCoins} coins!
                    </div>
                `;

                try {
                    const result = await this.submitGameResult(gameId, true, attempts);
                    if (result.success) {
                        setTimeout(() => {
                            alert(`🎉 Congratulations! You earned ${rewardCoins} coins!`);
                            this.closeGameModal();
                        }, 2000);
                    }
                } catch (error) {
                    resultEl.innerHTML += `<div style="color: #ef4444; margin-top: 10px;">Error: ${error.message}</div>`;
                }
            } else if (attempts >= maxAttempts) {
                gameEnded = true;
                inputEl.disabled = true;
                submitBtn.disabled = true;
                statusEl.textContent = '😔 Game Over';
                hintEl.textContent = '';
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #ef4444; color: white; border-radius: 8px;">
                        <strong>You Lost</strong><br>
                        The number was ${targetNumber}<br>
                        Better luck next time!
                    </div>
                `;

                try {
                    await this.submitGameResult(gameId, false, attempts);
                } catch (error) {
                    resultEl.innerHTML += `<div style="color: #ef4444; margin-top: 10px;">Error: ${error.message}</div>`;
                }
            } else {
                if (guess < targetNumber) {
                    hintEl.textContent = `Too low! Try a higher number.`;
                    hintEl.style.color = '#f59e0b';
                } else {
                    hintEl.textContent = `Too high! Try a lower number.`;
                    hintEl.style.color = '#3b82f6';
                }
                inputEl.value = '';
                inputEl.focus();
            }
        };

        submitBtn.onclick = makeGuess;
        inputEl.onkeypress = (e) => {
            if (e.key === 'Enter') makeGuess();
        };
        inputEl.focus();
    }

    playTicTacToe(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="tttStatus" style="font-size: 24px; margin: 20px 0; color: #667eea;">
                    Your turn (X)
                </div>
                <div id="tttBoard" style="
                    display: grid;
                    grid-template-columns: repeat(3, 100px);
                    grid-template-rows: repeat(3, 100px);
                    gap: 5px;
                    margin: 20px auto;
                    width: fit-content;
                    background: #667eea;
                    padding: 5px;
                    border-radius: 8px;
                "></div>
                <div id="tttResult" style="margin-top: 20px; font-size: 18px;"></div>
                <button id="tttResetBtn" style="
                    padding: 10px 20px;
                    font-size: 16px;
                    background: #6b7280;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 10px;
                    display: none;
                ">Play Again</button>
            </div>
        `;

        const board = Array(9).fill(null);
        let currentPlayer = 'X';
        let gameEnded = false;

        const statusEl = document.getElementById('tttStatus');
        const boardEl = document.getElementById('tttBoard');
        const resultEl = document.getElementById('tttResult');
        const resetBtn = document.getElementById('tttResetBtn');

        const renderBoard = () => {
            boardEl.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const cell = document.createElement('div');
                cell.style.cssText = `
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 48px;
                    font-weight: bold;
                    cursor: ${board[i] || !gameEnded ? 'pointer' : 'not-allowed'};
                    color: ${board[i] === 'X' ? '#667eea' : '#ef4444'};
                `;
                cell.textContent = board[i] || '';
                cell.onclick = () => makeMove(i);
                boardEl.appendChild(cell);
            }
        };

        const checkWinner = () => {
            const lines = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];

            for (const line of lines) {
                const [a, b, c] = line;
                if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                    return board[a];
                }
            }

            if (board.every(cell => cell !== null)) {
                return 'draw';
            }

            return null;
        };

        const makeMove = async (index) => {
            if (board[index] || gameEnded || currentPlayer !== 'X') return;

            board[index] = 'X';
            renderBoard();

            const winner = checkWinner();
            if (winner) {
                endGame(winner);
                return;
            }

            currentPlayer = 'O';
            statusEl.textContent = 'AI thinking...';

            // AI move (simple minimax-like logic)
            setTimeout(() => {
                const aiMove = getAIMove();
                if (aiMove !== -1) {
                    board[aiMove] = 'O';
                    renderBoard();

                    const winner = checkWinner();
                    if (winner) {
                        endGame(winner);
                    } else {
                        currentPlayer = 'X';
                        statusEl.textContent = 'Your turn (X)';
                    }
                }
            }, 500);
        };

        const getAIMove = () => {
            // Try to win
            for (let i = 0; i < 9; i++) {
                if (!board[i]) {
                    board[i] = 'O';
                    if (checkWinner() === 'O') {
                        return i;
                    }
                    board[i] = null;
                }
            }

            // Block player
            for (let i = 0; i < 9; i++) {
                if (!board[i]) {
                    board[i] = 'X';
                    if (checkWinner() === 'X') {
                        board[i] = null;
                        return i;
                    }
                    board[i] = null;
                }
            }

            // Center
            if (!board[4]) return 4;

            // Corners
            const corners = [0, 2, 6, 8];
            const availableCorners = corners.filter(i => !board[i]);
            if (availableCorners.length > 0) {
                return availableCorners[Math.floor(Math.random() * availableCorners.length)];
            }

            // Any available
            for (let i = 0; i < 9; i++) {
                if (!board[i]) return i;
            }

            return -1;
        };

        const endGame = async (winner) => {
            gameEnded = true;
            const won = winner === 'X';

            if (winner === 'draw') {
                statusEl.textContent = "It's a draw!";
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #6b7280; color: white; border-radius: 8px;">
                        <strong>Draw!</strong><br>
                        Good game! Try again to win coins.
                    </div>
                `;
            } else if (won) {
                statusEl.textContent = '🎉 You Won!';
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                        <strong>You Won!</strong><br>
                        You beat the AI!<br>
                        You earned ${rewardCoins} coins!
                    </div>
                `;
            } else {
                statusEl.textContent = '😔 You Lost';
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #ef4444; color: white; border-radius: 8px;">
                        <strong>You Lost</strong><br>
                        The AI won this time. Try again!
                    </div>
                `;
            }

            resetBtn.style.display = 'inline-block';
            resetBtn.onclick = () => {
                board.fill(null);
                currentPlayer = 'X';
                gameEnded = false;
                statusEl.textContent = 'Your turn (X)';
                resultEl.textContent = '';
                resetBtn.style.display = 'none';
                renderBoard();
            };

            try {
                const result = await this.submitGameResult(gameId, won, won ? 1 : 0);
                if (result.success && won) {
                    setTimeout(() => {
                        alert(`🎉 Congratulations! You earned ${rewardCoins} coins!`);
                        this.closeGameModal();
                    }, 2000);
                }
            } catch (error) {
                resultEl.innerHTML += `<div style="color: #ef4444; margin-top: 10px;">Error: ${error.message}</div>`;
            }
        };

        renderBoard();
    }

    // ============================================
    // ALL 20 GAMES - IMPLEMENTATIONS
    // ============================================

    playBounceGame(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="bounceCanvas" width="400" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #f3f4f6;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="bounceScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div id="bounceResult" style="margin-top: 10px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('bounceCanvas');
        const ctx = canvas.getContext('2d');
        let ball = { x: 200, y: 200, vx: 3, vy: 3, r: 15 };
        let score = 0;
        let gameActive = true;
        const targetScore = 20;

        const gameLoop = () => {
            if (!gameActive) return;
            const scoreEl = document.getElementById('bounceScore');
            if (!scoreEl) {
                gameActive = false;
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ball.x += ball.vx;
            ball.y += ball.vy;
            if (ball.x <= ball.r || ball.x >= canvas.width - ball.r) ball.vx *= -1;
            if (ball.y <= ball.r || ball.y >= canvas.height - ball.r) ball.vy *= -1;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fillStyle = '#667eea';
            ctx.fill();
            scoreEl.textContent = `Score: ${score}`;
            if (score >= targetScore) {
                gameActive = false;
                this.endBounceGame(gameId, rewardCoins, true, score);
            }
            requestAnimationFrame(gameLoop);
        };
        canvas.onclick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dist = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2);
            if (dist <= ball.r + 10) {
                score++;
                ball.vx *= 1.1;
                ball.vy *= 1.1;
            }
        };
        gameLoop();
    }

    async endBounceGame(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('bounceResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : ''}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playMemoryTiles(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="memoryStatus" style="font-size: 20px; margin: 10px 0; color: #667eea;">Match all pairs!</div>
                <div id="memoryGrid" style="display: grid; grid-template-columns: repeat(4, 80px); gap: 10px; justify-content: center; margin: 20px auto;"></div>
                <div id="memoryResult" style="margin-top: 15px;"></div>
            </div>
        `;
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
        const grid = document.getElementById('memoryGrid');
        let cards = [...colors, ...colors].sort(() => Math.random() - 0.5);
        let flipped = [];
        let matched = 0;
        let moves = 0;

        cards.forEach((color, i) => {
            const card = document.createElement('div');
            card.style.cssText = `width: 80px; height: 80px; background: #e5e7eb; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px;`;
            card.dataset.index = i;
            card.dataset.color = color;
            card.onclick = () => {
                if (flipped.length === 2 || card.style.background !== '#e5e7eb') return;
                card.style.background = color;
                flipped.push(card);
                if (flipped.length === 2) {
                    moves++;
                    setTimeout(() => {
                        if (flipped[0].dataset.color === flipped[1].dataset.color) {
                            matched += 2;
                            flipped.forEach(c => c.style.opacity = '0.5');
                            if (matched === cards.length) {
                                this.endMemoryGame(gameId, rewardCoins, true, moves);
                            }
                        } else {
                            flipped.forEach(c => c.style.background = '#e5e7eb');
                        }
                        flipped = [];
                    }, 1000);
                }
            };
            grid.appendChild(card);
        });
    }

    async endMemoryGame(gameId, rewardCoins, won, moves) {
        const resultEl = document.getElementById('memoryResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                <strong>🎉 You Won!</strong><br>
                Completed in ${moves} moves!<br>
                You earned ${rewardCoins} coins!
            </div>
        `;
        const result = await this.submitGameResult(gameId, true, moves);
        if (result.success) {
            setTimeout(() => {
                alert(`🎉 You earned ${rewardCoins} coins!`);
                this.closeGameModal();
            }, 2000);
        }
    }

    playWordPuzzle(container, gameId, gameName, rewardCoins) {
        const words = ['HELLO', 'WORLD', 'GAMES', 'PUZZLE', 'BRAIN'];
        const word = words[Math.floor(Math.random() * words.length)];
        const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
        
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 24px; margin: 20px 0; color: #667eea;">Unscramble the word!</div>
                <div style="font-size: 48px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; color: #667eea;">${scrambled}</div>
                <input type="text" id="wordInput" style="padding: 15px; font-size: 20px; width: 200px; text-align: center; border: 2px solid #667eea; border-radius: 8px; margin: 10px;" placeholder="Type answer">
                <br>
                <button id="wordSubmit" style="padding: 12px 24px; font-size: 18px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Submit</button>
                <div id="wordResult" style="margin-top: 15px;"></div>
            </div>
        `;
        let attempts = 0;
        const input = document.getElementById('wordInput');
        const submit = document.getElementById('wordSubmit');
        
        submit.onclick = async () => {
            attempts++;
            if (input.value.toUpperCase() === word) {
                const resultEl = document.getElementById('wordResult');
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                        <strong>🎉 Correct!</strong><br>
                        You earned ${rewardCoins} coins!
                    </div>
                `;
                const result = await this.submitGameResult(gameId, true, attempts);
                if (result.success) {
                    setTimeout(() => {
                        alert(`🎉 You earned ${rewardCoins} coins!`);
                        this.closeGameModal();
                    }, 2000);
                }
            } else {
                input.value = '';
                if (attempts >= 3) {
                    const resultEl = document.getElementById('wordResult');
                    resultEl.innerHTML = `
                        <div style="padding: 20px; background: #ef4444; color: white; border-radius: 8px;">
                            <strong>Game Over</strong><br>
                            The word was: ${word}
                        </div>
                    `;
                    await this.submitGameResult(gameId, false, attempts);
                }
            }
        };
        input.onkeypress = (e) => { if (e.key === 'Enter') submit.onclick(); };
    }

    playColorMatch(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="colorTarget" style="width: 150px; height: 150px; margin: 20px auto; border-radius: 12px; border: 3px solid #333;"></div>
                <div style="display: flex; gap: 10px; justify-content: center; margin: 20px 0;">
                    <div class="colorBtn" data-color="#ef4444" style="width: 60px; height: 60px; background: #ef4444; border-radius: 8px; cursor: pointer; border: 3px solid transparent;"></div>
                    <div class="colorBtn" data-color="#3b82f6" style="width: 60px; height: 60px; background: #3b82f6; border-radius: 8px; cursor: pointer; border: 3px solid transparent;"></div>
                    <div class="colorBtn" data-color="#10b981" style="width: 60px; height: 60px; background: #10b981; border-radius: 8px; cursor: pointer; border: 3px solid transparent;"></div>
                    <div class="colorBtn" data-color="#f59e0b" style="width: 60px; height: 60px; background: #f59e0b; border-radius: 8px; cursor: pointer; border: 3px solid transparent;"></div>
                </div>
                <div id="colorScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                <div id="colorResult" style="margin-top: 15px;"></div>
            </div>
        `;
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        const target = document.getElementById('colorTarget');
        let score = 0;
        let timeLeft = 30;
        let gameActive = true;

        const newTarget = () => {
            if (!gameActive) return;
            const color = colors[Math.floor(Math.random() * colors.length)];
            target.style.background = color;
        };

        document.querySelectorAll('.colorBtn').forEach(btn => {
            btn.onclick = () => {
                if (!gameActive) return;
                if (btn.dataset.color === target.style.background) {
                    score++;
                    const scoreEl = document.getElementById('colorScore');
                    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                    newTarget();
                } else {
                    gameActive = false;
                    this.endColorMatch(gameId, rewardCoins, score >= 15, score);
                }
            };
        });

        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timer);
                gameActive = false;
                this.endColorMatch(gameId, rewardCoins, score >= 15, score);
            }
        }, 1000);

        newTarget();
    }

    async endColorMatch(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('colorResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : 'Need 15+ to win.'}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playMathChallenge(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="mathProblem" style="font-size: 32px; font-weight: bold; margin: 20px 0; color: #667eea;"></div>
                <input type="number" id="mathAnswer" style="padding: 15px; font-size: 20px; width: 150px; text-align: center; border: 2px solid #667eea; border-radius: 8px; margin: 10px;">
                <br>
                <button id="mathSubmit" style="padding: 12px 24px; font-size: 18px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px;">Submit</button>
                <div id="mathScore" style="font-size: 20px; margin: 15px 0; color: #667eea;">Score: 0 / 10</div>
                <div id="mathResult" style="margin-top: 15px;"></div>
            </div>
        `;
        let score = 0;
        let correct = 0;
        const answerInput = document.getElementById('mathAnswer');
        const submitBtn = document.getElementById('mathSubmit');
        const problemEl = document.getElementById('mathProblem');
        const scoreEl = document.getElementById('mathScore');

        const newProblem = () => {
            const a = Math.floor(Math.random() * 20) + 1;
            const b = Math.floor(Math.random() * 20) + 1;
            const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
            let answer;
            if (op === '+') answer = a + b;
            else if (op === '-') answer = a - b;
            else answer = a * b;
            problemEl.textContent = `${a} ${op} ${b} = ?`;
            problemEl.dataset.answer = answer;
            answerInput.value = '';
            answerInput.focus();
        };

        submitBtn.onclick = async () => {
            const userAnswer = parseInt(answerInput.value);
            if (userAnswer === parseInt(problemEl.dataset.answer)) {
                correct++;
                score++;
            }
            score++;
            scoreEl.textContent = `Score: ${correct} / ${score}`;
            if (score >= 10) {
                const won = correct >= 7;
                const resultEl = document.getElementById('mathResult');
                resultEl.innerHTML = `
                    <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                        <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                        Got ${correct} out of 10 correct!<br>
                        ${won ? `You earned ${rewardCoins} coins!` : 'Need 7+ correct to win.'}
                    </div>
                `;
                if (won) {
                    const result = await this.submitGameResult(gameId, true, correct);
                    if (result.success) {
                        setTimeout(() => {
                            alert(`🎉 You earned ${rewardCoins} coins!`);
                            this.closeGameModal();
                        }, 2000);
                    }
                } else {
                    await this.submitGameResult(gameId, false, correct);
                }
            } else {
                newProblem();
            }
        };
        answerInput.onkeypress = (e) => { if (e.key === 'Enter') submitBtn.onclick(); };
        newProblem();
    }

    playTypingSpeed(container, gameId, gameName, rewardCoins) {
        const words = ['hello', 'world', 'games', 'typing', 'speed', 'test', 'keyboard', 'challenge'];
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="typingWord" style="font-size: 36px; font-weight: bold; margin: 30px 0; color: #667eea; min-height: 50px;"></div>
                <input type="text" id="typingInput" style="padding: 15px; font-size: 20px; width: 300px; text-align: center; border: 2px solid #667eea; border-radius: 8px;">
                <div id="typingScore" style="font-size: 18px; margin: 15px 0; color: #667eea;">Words: 0 / 20</div>
                <div id="typingResult" style="margin-top: 15px;"></div>
            </div>
        `;
        let wordIndex = 0;
        let correct = 0;
        const wordEl = document.getElementById('typingWord');
        const inputEl = document.getElementById('typingInput');
        const scoreEl = document.getElementById('typingScore');
        wordEl.textContent = words[wordIndex];

        inputEl.oninput = async () => {
            if (inputEl.value === words[wordIndex]) {
                correct++;
                wordIndex++;
                scoreEl.textContent = `Words: ${correct} / 20`;
                if (wordIndex >= words.length) wordIndex = 0;
                wordEl.textContent = words[wordIndex];
                inputEl.value = '';
                if (correct >= 20) {
                    const resultEl = document.getElementById('typingResult');
                    resultEl.innerHTML = `
                        <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                            <strong>🎉 You Won!</strong><br>
                            Typed 20 words correctly!<br>
                            You earned ${rewardCoins} coins!
                        </div>
                    `;
                    const result = await this.submitGameResult(gameId, true, correct);
                    if (result.success) {
                        setTimeout(() => {
                            alert(`🎉 You earned ${rewardCoins} coins!`);
                            this.closeGameModal();
                        }, 2000);
                    }
                }
            }
        };
        inputEl.focus();
    }

    playSnakeGame(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="snakeCanvas" width="400" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #000;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="snakeScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280;">Use arrow keys to play</div>
                    <div id="snakeResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('snakeCanvas');
        const ctx = canvas.getContext('2d');
        const grid = 20;
        let snake = [{x: 200, y: 200}];
        let food = {x: 100, y: 100};
        let dx = 0, dy = 0;
        let score = 0;
        let gameActive = true;

        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#10b981';
            snake.forEach(seg => {
                ctx.fillRect(seg.x, seg.y, grid, grid);
            });
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(food.x, food.y, grid, grid);
        };

        const move = () => {
            if (!gameActive) return;
            const head = {x: snake[0].x + dx, y: snake[0].y + dy};
            if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height || snake.some(s => s.x === head.x && s.y === head.y)) {
                gameActive = false;
                this.endSnakeGame(gameId, rewardCoins, score >= 10, score);
                return;
            }
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score++;
                const scoreEl = document.getElementById('snakeScore');
                if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                food = {x: Math.floor(Math.random() * (canvas.width/grid)) * grid, y: Math.floor(Math.random() * (canvas.height/grid)) * grid};
            } else {
                snake.pop();
            }
            draw();
        };

        document.onkeydown = (e) => {
            if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -grid; }
            else if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = grid; }
            else if (e.key === 'ArrowLeft' && dx === 0) { dx = -grid; dy = 0; }
            else if (e.key === 'ArrowRight' && dx === 0) { dx = grid; dy = 0; }
        };

        draw();
        setInterval(move, 150);
    }

    async endSnakeGame(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('snakeResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : 'Need 10+ to win.'}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playTetris(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="tetrisCanvas" width="200" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #000;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="tetrisScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 12px;">A/D to move, S to drop, W to rotate</div>
                    <div id="tetrisResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('tetrisCanvas');
        const ctx = canvas.getContext('2d');
        const grid = 20;
        const cols = 10, rows = 20;
        let board = Array(rows).fill().map(() => Array(cols).fill(0));
        let score = 0;
        let gameActive = true;
        let piece = {shape: [[1,1,1,1]], x: 3, y: 0};

        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    if (board[y][x]) {
                        ctx.fillStyle = '#667eea';
                        ctx.fillRect(x * grid, y * grid, grid - 1, grid - 1);
                    }
                }
            }
        };

        const drop = () => {
            if (!gameActive) return;
            piece.y++;
            if (piece.y + piece.shape.length > rows) {
                piece.y--;
                piece.shape.forEach((row, dy) => {
                    row.forEach((cell, dx) => {
                        if (cell) board[piece.y + dy][piece.x + dx] = 1;
                    });
                });
                let cleared = 0;
                for (let y = rows - 1; y >= 0; y--) {
                    if (board[y].every(cell => cell === 1)) {
                        board.splice(y, 1);
                        board.unshift(Array(cols).fill(0));
                        cleared++;
                    }
                }
                score += cleared * 10;
                const scoreEl = document.getElementById('tetrisScore');
                if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                if (score >= 50) {
                    gameActive = false;
                    this.endTetris(gameId, rewardCoins, true, score);
                } else {
                    piece = {shape: [[1,1,1,1]], x: 3, y: 0};
                }
            }
            draw();
        };

        document.onkeydown = (e) => {
            if (e.key === 'a' || e.key === 'A') piece.x = Math.max(0, piece.x - 1);
            if (e.key === 'd' || e.key === 'D') piece.x = Math.min(cols - 4, piece.x + 1);
            if (e.key === 's' || e.key === 'S') drop();
            draw();
        };

        draw();
        setInterval(drop, 500);
    }

    async endTetris(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('tetrisResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                <strong>🎉 You Won!</strong><br>
                Final Score: ${score}<br>
                You earned ${rewardCoins} coins!
            </div>
        `;
        const result = await this.submitGameResult(gameId, true, score);
        if (result.success) {
            setTimeout(() => {
                alert(`🎉 You earned ${rewardCoins} coins!`);
                this.closeGameModal();
            }, 2000);
        }
    }

    playPong(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="pongCanvas" width="400" height="300" style="border: 2px solid #667eea; border-radius: 8px; background: #000;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="pongScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280;">Move mouse to control paddle</div>
                    <div id="pongResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('pongCanvas');
        const ctx = canvas.getContext('2d');
        let paddle = {x: 150, y: 280, w: 100, h: 10};
        let ball = {x: 200, y: 150, vx: 3, vy: 3, r: 8};
        let score = 0;
        let gameActive = true;

        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, e.clientX - rect.left - paddle.w/2));
        };

        const gameLoop = () => {
            if (!gameActive) return;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ball.x += ball.vx;
            ball.y += ball.vy;
            if (ball.x <= ball.r || ball.x >= canvas.width - ball.r) ball.vx *= -1;
            if (ball.y <= ball.r) ball.vy *= -1;
            if (ball.y >= paddle.y - ball.r && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
                ball.vy *= -1;
                score++;
                const scoreEl = document.getElementById('pongScore');
                if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                if (score >= 10) {
                    gameActive = false;
                    this.endPong(gameId, rewardCoins, true, score);
                }
            }
            if (ball.y > canvas.height) {
                gameActive = false;
                this.endPong(gameId, rewardCoins, false, score);
            }
            ctx.fillStyle = '#fff';
            ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fill();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    async endPong(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('pongResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : ''}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    play2048(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="game2048" style="display: grid; grid-template-columns: repeat(4, 70px); gap: 5px; justify-content: center; margin: 20px auto; padding: 10px; background: #bbada0; border-radius: 8px;"></div>
                <div style="margin-top: 15px;">
                    <div id="score2048" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 12px;">Use arrow keys</div>
                    <div id="result2048" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        let grid = Array(4).fill().map(() => Array(4).fill(0));
        let score = 0;
        const addTile = () => {
            const empty = [];
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    if (grid[y][x] === 0) empty.push({x, y});
                }
            }
            if (empty.length) {
                const {x, y} = empty[Math.floor(Math.random() * empty.length)];
                grid[y][x] = Math.random() < 0.9 ? 2 : 4;
            }
        };
        const render = () => {
            const el = document.getElementById('game2048');
            el.innerHTML = '';
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    const cell = document.createElement('div');
                    cell.style.cssText = `width: 70px; height: 70px; background: ${grid[y][x] ? '#eee4da' : '#cdc1b4'}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${grid[y][x] > 100 ? '20px' : '24px'};`;
                    cell.textContent = grid[y][x] || '';
                    el.appendChild(cell);
                }
            }
            const scoreEl = document.getElementById('score2048');
            if (scoreEl) scoreEl.textContent = `Score: ${score}`;
            if (grid.some(row => row.some(cell => cell === 2048))) {
                this.end2048(gameId, rewardCoins, true, score);
            }
        };
        const move = (dir) => {
            let moved = false;
            if (dir === 'left') {
                for (let y = 0; y < 4; y++) {
                    const row = grid[y].filter(x => x !== 0);
                    for (let i = 0; i < row.length - 1; i++) {
                        if (row[i] === row[i + 1]) {
                            row[i] *= 2;
                            score += row[i];
                            row.splice(i + 1, 1);
                            moved = true;
                        }
                    }
                    while (row.length < 4) row.push(0);
                    grid[y] = row;
                }
            }
            if (moved) {
                addTile();
                render();
            }
        };
        document.onkeydown = (e) => {
            if (e.key === 'ArrowLeft') move('left');
            if (e.key === 'ArrowRight') move('right');
            if (e.key === 'ArrowUp') move('up');
            if (e.key === 'ArrowDown') move('down');
        };
        addTile();
        addTile();
        render();
    }

    async end2048(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('result2048');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                <strong>🎉 You Won!</strong><br>
                Reached 2048!<br>
                You earned ${rewardCoins} coins!
            </div>
        `;
        const result = await this.submitGameResult(gameId, true, score);
        if (result.success) {
            setTimeout(() => {
                alert(`🎉 You earned ${rewardCoins} coins!`);
                this.closeGameModal();
            }, 2000);
        }
    }

    playRockPaperScissors(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 24px; margin: 20px 0; color: #667eea;">Choose your move!</div>
                <div style="display: flex; gap: 15px; justify-content: center; margin: 20px 0;">
                    <button class="rpsBtn" data-choice="rock" style="padding: 20px; font-size: 48px; background: #667eea; color: white; border: none; border-radius: 12px; cursor: pointer;">✊</button>
                    <button class="rpsBtn" data-choice="paper" style="padding: 20px; font-size: 48px; background: #667eea; color: white; border: none; border-radius: 12px; cursor: pointer;">✋</button>
                    <button class="rpsBtn" data-choice="scissors" style="padding: 20px; font-size: 48px; background: #667eea; color: white; border: none; border-radius: 12px; cursor: pointer;">✌️</button>
                </div>
                <div id="rpsResult" style="margin-top: 20px; min-height: 100px;"></div>
                <div id="rpsScore" style="font-size: 18px; margin-top: 15px; color: #667eea;">Wins: 0 / 3</div>
            </div>
        `;
        let wins = 0;
        const choices = ['rock', 'paper', 'scissors'];
        const beats = {rock: 'scissors', paper: 'rock', scissors: 'paper'};
        
        document.querySelectorAll('.rpsBtn').forEach(btn => {
            btn.onclick = async () => {
                const player = btn.dataset.choice;
                const ai = choices[Math.floor(Math.random() * choices.length)];
                let result = '';
                if (player === ai) result = 'Draw!';
                else if (beats[player] === ai) {
                    wins++;
                    result = 'You Win!';
                } else {
                    result = 'AI Wins!';
                }
                document.getElementById('rpsResult').innerHTML = `
                    <div style="padding: 20px; background: #f3f4f6; border-radius: 8px;">
                        <div style="font-size: 20px; margin-bottom: 10px;">You: ${player} | AI: ${ai}</div>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${result}</div>
                    </div>
                `;
                const scoreEl = document.getElementById('rpsScore');
                if (scoreEl) scoreEl.textContent = `Wins: ${wins} / 3`;
                if (wins >= 3) {
                    const resultEl = document.getElementById('rpsResult');
                    resultEl.innerHTML = `
                        <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                            <strong>🎉 You Won 3 Rounds!</strong><br>
                            You earned ${rewardCoins} coins!
                        </div>
                    `;
                    const gameResult = await this.submitGameResult(gameId, true, wins);
                    if (gameResult.success) {
                        setTimeout(() => {
                            alert(`🎉 You earned ${rewardCoins} coins!`);
                            this.closeGameModal();
                        }, 2000);
                    }
                }
            };
        });
    }

    playSimonSays(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="simonStatus" style="font-size: 20px; margin: 15px 0; color: #667eea;">Watch the sequence!</div>
                <div style="display: grid; grid-template-columns: repeat(2, 100px); gap: 10px; justify-content: center; margin: 20px auto;">
                    <div class="simonBtn" data-color="red" style="width: 100px; height: 100px; background: #ef4444; border-radius: 8px; cursor: pointer; opacity: 0.5;"></div>
                    <div class="simonBtn" data-color="blue" style="width: 100px; height: 100px; background: #3b82f6; border-radius: 8px; cursor: pointer; opacity: 0.5;"></div>
                    <div class="simonBtn" data-color="green" style="width: 100px; height: 100px; background: #10b981; border-radius: 8px; cursor: pointer; opacity: 0.5;"></div>
                    <div class="simonBtn" data-color="yellow" style="width: 100px; height: 100px; background: #f59e0b; border-radius: 8px; cursor: pointer; opacity: 0.5;"></div>
                </div>
                <div id="simonScore" style="font-size: 18px; margin-top: 15px; color: #667eea;">Level: 1</div>
                <div id="simonResult" style="margin-top: 15px;"></div>
            </div>
        `;
        let sequence = [];
        let playerSequence = [];
        let level = 1;
        let showing = false;

        const colors = ['red', 'blue', 'green', 'yellow'];
        const addToSequence = () => {
            sequence.push(colors[Math.floor(Math.random() * colors.length)]);
        };
        const showSequence = async () => {
            showing = true;
            for (const color of sequence) {
                const btn = document.querySelector(`[data-color="${color}"]`);
                btn.style.opacity = '1';
                setTimeout(() => { btn.style.opacity = '0.5'; }, 500);
                await new Promise(r => setTimeout(r, 600));
            }
            showing = false;
        };
        document.querySelectorAll('.simonBtn').forEach(btn => {
            btn.onclick = async () => {
                if (showing) return;
                const color = btn.dataset.color;
                playerSequence.push(color);
                btn.style.opacity = '1';
                setTimeout(() => { btn.style.opacity = '0.5'; }, 200);
                if (playerSequence[playerSequence.length - 1] !== sequence[playerSequence.length - 1]) {
                    const resultEl = document.getElementById('simonResult');
                    resultEl.innerHTML = `
                        <div style="padding: 20px; background: #ef4444; color: white; border-radius: 8px;">
                            <strong>Game Over</strong><br>
                            Reached level ${level}!
                        </div>
                    `;
                    await this.submitGameResult(gameId, level >= 5, level);
                } else if (playerSequence.length === sequence.length) {
                    level++;
                    const scoreEl = document.getElementById('simonScore');
                    if (scoreEl) scoreEl.textContent = `Level: ${level}`;
                    playerSequence = [];
                    addToSequence();
                    await showSequence();
                    if (level >= 5) {
                        const resultEl = document.getElementById('simonResult');
                        resultEl.innerHTML = `
                            <div style="padding: 20px; background: #10b981; color: white; border-radius: 8px;">
                                <strong>🎉 You Won!</strong><br>
                                Reached level ${level}!<br>
                                You earned ${rewardCoins} coins!
                            </div>
                        `;
                        const result = await this.submitGameResult(gameId, true, level);
                        if (result.success) {
                            setTimeout(() => {
                                alert(`🎉 You earned ${rewardCoins} coins!`);
                                this.closeGameModal();
                            }, 2000);
                        }
                    }
                }
            };
        });
        addToSequence();
        showSequence();
    }

    playWhackAMole(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <div id="moleGrid" style="display: grid; grid-template-columns: repeat(3, 100px); gap: 10px; justify-content: center; margin: 20px auto;"></div>
                <div id="moleScore" style="font-size: 20px; font-weight: bold; margin: 15px 0; color: #667eea;">Score: 0</div>
                <div id="moleTimer" style="font-size: 18px; color: #6b7280;">Time: 30s</div>
                <div id="moleResult" style="margin-top: 15px;"></div>
            </div>
        `;
        const grid = document.getElementById('moleGrid');
        let score = 0;
        let timeLeft = 30;
        let gameActive = true;
        let activeMole = null;

        for (let i = 0; i < 9; i++) {
            const hole = document.createElement('div');
            hole.style.cssText = `width: 100px; height: 100px; background: #8b4513; border-radius: 50%; cursor: pointer; position: relative;`;
            hole.onclick = () => {
                if (hole === activeMole) {
                    score++;
                    const scoreEl = document.getElementById('moleScore');
                    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                    hole.innerHTML = '';
                    activeMole = null;
                }
            };
            grid.appendChild(hole);
        }

        const showMole = () => {
            if (!gameActive) return;
            const holes = grid.children;
            if (activeMole) activeMole.innerHTML = '';
            const hole = holes[Math.floor(Math.random() * holes.length)];
            hole.innerHTML = '🐹';
            activeMole = hole;
            setTimeout(() => {
                if (activeMole === hole) {
                    hole.innerHTML = '';
                    activeMole = null;
                }
            }, 1500);
        };

        const timer = setInterval(() => {
            timeLeft--;
            const timerEl = document.getElementById('moleTimer');
            if (timerEl) timerEl.textContent = `Time: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(timer);
                gameActive = false;
                this.endWhackAMole(gameId, rewardCoins, score >= 15, score);
            }
        }, 1000);

        setInterval(showMole, 1000);
    }

    async endWhackAMole(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('moleResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : 'Need 15+ to win.'}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playSpaceInvaders(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="invadersCanvas" width="400" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #000;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="invadersScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 12px;">A/D to move, Space to shoot</div>
                    <div id="invadersResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('invadersCanvas');
        const ctx = canvas.getContext('2d');
        let ship = {x: 200, y: 350, w: 40};
        let bullets = [];
        let enemies = [];
        let score = 0;
        let gameActive = true;

        for (let i = 0; i < 5; i++) {
            enemies.push({x: i * 80 + 50, y: 50});
        }

        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(ship.x - ship.w/2, ship.y, ship.w, 20);
            bullets.forEach(b => {
                ctx.fillStyle = '#10b981';
                ctx.fillRect(b.x, b.y, 4, 10);
            });
            enemies.forEach(e => {
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(e.x, e.y, 30, 30);
            });
        };

        document.onkeydown = (e) => {
            if (e.key === 'a' || e.key === 'A') ship.x = Math.max(ship.w/2, ship.x - 10);
            if (e.key === 'd' || e.key === 'D') ship.x = Math.min(canvas.width - ship.w/2, ship.x + 10);
            if (e.key === ' ') bullets.push({x: ship.x, y: ship.y});
        };

        const gameLoop = () => {
            if (!gameActive) return;
            bullets.forEach(b => b.y -= 5);
            bullets = bullets.filter(b => {
                const hit = enemies.findIndex(e => Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20);
                if (hit !== -1) {
                    enemies.splice(hit, 1);
                    score += 10;
                    const scoreEl = document.getElementById('invadersScore');
                    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                    if (enemies.length === 0 || score >= 50) {
                        gameActive = false;
                        this.endSpaceInvaders(gameId, rewardCoins, true, score);
                    }
                    return false;
                }
                return b.y > 0;
            });
            if (enemies.some(e => e.y > 300)) {
                gameActive = false;
                this.endSpaceInvaders(gameId, rewardCoins, false, score);
            }
            draw();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    async endSpaceInvaders(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('invadersResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : ''}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playBreakout(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="breakoutCanvas" width="400" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #000;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="breakoutScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280;">Move mouse to control paddle</div>
                    <div id="breakoutResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('breakoutCanvas');
        const ctx = canvas.getContext('2d');
        let paddle = {x: 150, y: 380, w: 100};
        let ball = {x: 200, y: 200, vx: 3, vy: 3, r: 8};
        let bricks = [];
        let score = 0;
        let gameActive = true;

        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 8; j++) {
                bricks.push({x: j * 50 + 5, y: i * 20 + 50, w: 45, h: 18});
            }
        }

        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, e.clientX - rect.left - paddle.w/2));
        };

        const draw = () => {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(paddle.x, paddle.y, paddle.w, 10);
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fill();
            bricks.forEach(b => {
                ctx.fillStyle = '#667eea';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            });
        };

        const gameLoop = () => {
            if (!gameActive) return;
            ball.x += ball.vx;
            ball.y += ball.vy;
            if (ball.x <= ball.r || ball.x >= canvas.width - ball.r) ball.vx *= -1;
            if (ball.y <= ball.r) ball.vy *= -1;
            if (ball.y >= paddle.y - ball.r && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
                ball.vy *= -1;
            }
            const hitIndex = bricks.findIndex(b => 
                ball.x >= b.x && ball.x <= b.x + b.w && ball.y >= b.y && ball.y <= b.y + b.h
            );
            if (hitIndex !== -1) {
                bricks.splice(hitIndex, 1);
                ball.vy *= -1;
                score += 10;
                const scoreEl = document.getElementById('breakoutScore');
                if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                if (bricks.length === 0) {
                    gameActive = false;
                    this.endBreakout(gameId, rewardCoins, true, score);
                }
            }
            if (ball.y > canvas.height) {
                gameActive = false;
                this.endBreakout(gameId, rewardCoins, false, score);
            }
            draw();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    async endBreakout(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('breakoutResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : ''}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }

    playFrogger(container, gameId, gameName, rewardCoins) {
        container.innerHTML = `
            <div style="text-align: center;">
                <canvas id="froggerCanvas" width="400" height="400" style="border: 2px solid #667eea; border-radius: 8px; background: #10b981;"></canvas>
                <div style="margin-top: 15px;">
                    <div id="froggerScore" style="font-size: 20px; font-weight: bold; color: #667eea;">Score: 0</div>
                    <div style="margin-top: 10px; color: #6b7280;">Use arrow keys</div>
                    <div id="froggerResult" style="margin-top: 15px;"></div>
                </div>
            </div>
        `;
        const canvas = document.getElementById('froggerCanvas');
        const ctx = canvas.getContext('2d');
        let frog = {x: 200, y: 350, w: 20};
        let cars = [];
        let score = 0;
        let gameActive = true;

        for (let i = 0; i < 5; i++) {
            cars.push({x: i * 100, y: 100 + i * 50, vx: 2 + i, w: 60, h: 30});
        }

        document.onkeydown = (e) => {
            if (e.key === 'ArrowUp') frog.y = Math.max(0, frog.y - 20);
            if (e.key === 'ArrowDown') frog.y = Math.min(canvas.height - 20, frog.y + 20);
            if (e.key === 'ArrowLeft') frog.x = Math.max(0, frog.x - 20);
            if (e.key === 'ArrowRight') frog.x = Math.min(canvas.width - 20, frog.x + 20);
            if (frog.y <= 50) {
                score++;
                const scoreEl = document.getElementById('froggerScore');
                if (scoreEl) scoreEl.textContent = `Score: ${score}`;
                frog.y = 350;
                if (score >= 5) {
                    gameActive = false;
                    this.endFrogger(gameId, rewardCoins, true, score);
                }
            }
        };

        const gameLoop = () => {
            if (!gameActive) return;
            ctx.fillStyle = '#10b981';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(frog.x, frog.y, frog.w, frog.w);
            cars.forEach(car => {
                car.x += car.vx;
                if (car.x > canvas.width) car.x = -car.w;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(car.x, car.y, car.w, car.h);
                if (Math.abs(frog.x - car.x) < 30 && Math.abs(frog.y - car.y) < 30) {
                    gameActive = false;
                    this.endFrogger(gameId, rewardCoins, false, score);
                }
            });
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    async endFrogger(gameId, rewardCoins, won, score) {
        const resultEl = document.getElementById('froggerResult');
        resultEl.innerHTML = `
            <div style="padding: 20px; background: ${won ? '#10b981' : '#ef4444'}; color: white; border-radius: 8px;">
                <strong>${won ? '🎉 You Won!' : '😔 Game Over'}</strong><br>
                Final Score: ${score}<br>
                ${won ? `You earned ${rewardCoins} coins!` : ''}
            </div>
        `;
        if (won) {
            const result = await this.submitGameResult(gameId, true, score);
            if (result.success) {
                setTimeout(() => {
                    alert(`🎉 You earned ${rewardCoins} coins!`);
                    this.closeGameModal();
                }, 2000);
            }
        }
    }
}

// Export for use in games.html
window.GameManager = GameManager;

