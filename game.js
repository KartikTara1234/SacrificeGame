document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const healthValueEl = document.getElementById("health-value");
  const scoreValueEl = document.getElementById("score-value");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const restartButton = document.getElementById("restart-button");
  const abilityKillAllBtn = document.getElementById("ability-killall");
  const abilityShieldBtn = document.getElementById("ability-shield");
  const abilitySpeedBtn = document.getElementById("ability-speed");

  // --- Game Configuration ---
  canvas.width = 600;
  canvas.height = 500;
  let gameLoop;
  let isGameRunning = false;

  // --- Game State Variables ---
  let score = 0;
  let health = 100;
  let enemies = [];
  let bullets = [];
  let lastEnemySpawnTime = 0;
  let gameStartTime = Date.now();

  // --- Dynamic Difficulty ---
  let baseSpawnInterval = 1000; // ms
  let baseEnemySpeed = 1;
  const difficultyScale = 0.9995; // Multiplier applied to interval and speed over time

  // --- Player / Shooter Config ---
  const player = {
    x: canvas.width / 2,
    y: canvas.height - 30,
    width: 10,
    height: 10,
    color: "#f39c12", // Orange
  };
  let fireRate = 300; // ms between shots
  let lastShotTime = 0;

  // --- Ability State ---
  let isShieldActive = false;
  let shieldDuration = 5000; // 5 seconds
  let shieldTimer;
  let speedBoostActive = false;
  let speedBoostDuration = 5000; // 5 seconds
  let speedBoostTimer;
  let originalFireRate = fireRate;

  // --- Main Game Functions ---

  function initGame() {
    score = 0;
    health = 100;
    enemies = [];
    bullets = [];
    lastEnemySpawnTime = 0;
    gameStartTime = Date.now();
    fireRate = originalFireRate;
    baseSpawnInterval = 1000;
    baseEnemySpeed = 1;
    isShieldActive = false;
    speedBoostActive = false;

    gameOverScreen.classList.add("hidden");
    canvas.style.cursor = "crosshair";
    isGameRunning = true;
    updateUI();

    if (gameLoop) cancelAnimationFrame(gameLoop);
    gameLoop = requestAnimationFrame(gameUpdate);
  }

  function updateUI() {
    healthValueEl.textContent = Math.max(0, health);
    scoreValueEl.textContent = score;

    // Visual feedback for shield
    canvas.style.boxShadow = isShieldActive
      ? "0 0 20px 5px rgba(52, 152, 219, 1)" // Blue glow
      : "none";

    // Visual feedback for speed boost
    abilitySpeedBtn.style.backgroundColor = speedBoostActive
      ? "#e67e22"
      : "#2980b9";

    // Visual feedback for low health
    healthValueEl.style.color = health < 30 ? "#c0392b" : "#e74c3c";
  }

  function gameOver() {
    isGameRunning = false;
    canvas.style.cursor = "default";
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove("hidden");
    if (gameLoop) cancelAnimationFrame(gameLoop);

    // Clear any active ability timers
    clearTimeout(shieldTimer);
    clearTimeout(speedBoostTimer);
  }

  // --- Entity Management ---

  function createEnemy() {
    const size = Math.random() * 20 + 10; // 10 to 30
    const enemy = {
      x: Math.random() * (canvas.width - size),
      y: -size, // Start above the canvas
      size: size,
      color: "#e74c3c", // Red enemy
      speed: baseEnemySpeed * (Math.random() * 0.5 + 0.75), // Randomize speed slightly
    };
    enemies.push(enemy);
  }

  function createBullet(x, y) {
    const bullet = {
      x: x,
      y: y,
      radius: 3,
      color: "#f1c40f", // Yellow bullet
      speed: 7,
    };
    bullets.push(bullet);
  }

  // --- Drawing Functions ---

  function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(
      player.x - player.width / 2,
      player.y - player.height / 2,
      player.width,
      player.height
    );

    // Draw shield if active
    if (isShieldActive) {
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.width * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEntities() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();

    // Draw bullets
    bullets.forEach((b) => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw enemies
    enemies.forEach((e) => {
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x, e.y, e.size, e.size);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x, e.y, e.size, e.size);
    });
  }

  // --- Update Functions ---

  function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.speed;

      // Enemy reached the bottom
      if (e.y > canvas.height) {
        enemies.splice(i, 1);
        if (!isShieldActive) {
          health -= 10; // Damage for missed enemy
        }
        updateUI();
        continue;
      }

      // Check for collision with player (only if shield is down)
      if (!isShieldActive && checkCollision(player, e)) {
        health = 0; // Instant death for collision
        gameOver();
        return;
      }
    }
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= b.speed;

      // Bullet out of bounds
      if (b.y < 0) {
        bullets.splice(i, 1);
        continue;
      }

      // Check for bullet-enemy collision
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (checkBulletCollision(b, e)) {
          // Hit!
          enemies.splice(j, 1);
          score += 10;
          hit = true;
          break; // Bullet can only hit one enemy
        }
      }

      if (hit) {
        bullets.splice(i, 1);
      }
    }
  }

  function checkCollision(obj1, obj2) {
    return (
      obj1.x < obj2.x + obj2.size &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.size &&
      obj1.y + obj1.height > obj2.y
    );
  }

  function checkBulletCollision(bullet, enemy) {
    return (
      bullet.x + bullet.radius > enemy.x &&
      bullet.x - bullet.radius < enemy.x + enemy.size &&
      bullet.y + bullet.radius > enemy.y &&
      bullet.y - bullet.radius < enemy.y + enemy.size
    );
  }

  // --- Difficulty Scaling ---

  function updateDifficulty() {
    const now = Date.now();
    const elapsedTime = now - gameStartTime;

    // Exponential decrease in spawn interval and increase in speed
    baseSpawnInterval *= difficultyScale;
    baseEnemySpeed /= difficultyScale;

    // Keep bounds reasonable
    baseSpawnInterval = Math.max(200, baseSpawnInterval);
    baseEnemySpeed = Math.min(6, baseEnemySpeed);

    // Spawn enemies
    if (now > lastEnemySpawnTime + baseSpawnInterval) {
      createEnemy();
      lastEnemySpawnTime = now;
    }
  }

  // --- Ability Handlers ---

  function activateKillAll() {
    const cost = parseInt(abilityKillAllBtn.dataset.cost);
    if (health > cost && enemies.length > 0) {
      health -= cost;
      score += enemies.length * 5; // Small bonus for killing them
      enemies = []; // Instant wipe
      updateUI();
    }
  }

  function activateShield() {
    const cost = parseInt(abilityShieldBtn.dataset.cost);
    if (health > cost && !isShieldActive) {
      health -= cost;
      isShieldActive = true;
      updateUI();

      clearTimeout(shieldTimer);
      abilityShieldBtn.disabled = true;
      abilityShieldBtn.style.backgroundColor = "#e67e22";

      shieldTimer = setTimeout(() => {
        isShieldActive = false;
        abilityShieldBtn.disabled = false;
        abilityShieldBtn.style.backgroundColor = "#2980b9";
        updateUI();
      }, shieldDuration);
    }
  }

  function activateSpeedBoost() {
    const cost = parseInt(abilitySpeedBtn.dataset.cost);
    if (health > cost && !speedBoostActive) {
      health -= cost;
      speedBoostActive = true;
      fireRate = originalFireRate / 3; // 3x fire rate
      updateUI();

      clearTimeout(speedBoostTimer);
      abilitySpeedBtn.disabled = true;
      abilitySpeedBtn.style.backgroundColor = "#e67e22";

      speedBoostTimer = setTimeout(() => {
        speedBoostActive = false;
        fireRate = originalFireRate; // Restore original rate
        abilitySpeedBtn.disabled = false;
        abilitySpeedBtn.style.backgroundColor = "#2980b9";
        updateUI();
      }, speedBoostDuration);
    }
  }

  // --- Event Listeners ---

  // Player Movement (Controlled by Mouse Position)
  canvas.addEventListener("mousemove", (e) => {
    if (isGameRunning) {
      const rect = canvas.getBoundingClientRect();
      player.x = e.clientX - rect.left;
      // Clamp position to canvas boundaries
      if (player.x < player.width / 2) player.x = player.width / 2;
      if (player.x > canvas.width - player.width / 2)
        player.x = canvas.width - player.width / 2;
    }
  });

  // Shooting (Controlled by Mouse Click)
  canvas.addEventListener("mousedown", () => {
    const now = Date.now();
    if (isGameRunning && now > lastShotTime + fireRate) {
      createBullet(player.x, player.y - 10);
      lastShotTime = now;
    }
  });

  // Ability Button Listeners
  abilityKillAllBtn.addEventListener("click", activateKillAll);
  abilityShieldBtn.addEventListener("click", activateShield);
  abilitySpeedBtn.addEventListener("click", activateSpeedBoost);
  restartButton.addEventListener("click", initGame);

  // --- Game Loop ---

  function gameUpdate() {
    if (!isGameRunning) return;

    updateDifficulty();
    updateBullets();
    updateEnemies();
    drawEntities();
    updateUI();

    if (health <= 0) {
      gameOver();
    }

    gameLoop = requestAnimationFrame(gameUpdate);
  }

  // Start the game on load
  initGame();
});
