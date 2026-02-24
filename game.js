// Cape Town Taxi Runner - Game Engine
// Authentic South African minibus taxi endless runner

class CapeTownTaxiRunner {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('scoreDisplay');
        
        // Game state
        this.gameState = 'menu'; // 'menu', 'playing', 'gameOver'
        this.score = 0;
        this.highScore = localStorage.getItem('cttr-highscore') || 0;
        this.speed = 2;
        this.frameCount = 0;
        
        // Player taxi properties
        this.player = {
            x: 400,
            y: 350,
            width: 60,
            height: 40,
            lane: 1, // 0=left, 1=center, 2=right
            isJumping: false,
            jumpHeight: 0,
            jumpSpeed: 0,
            color: '#FFD700' // Taxi yellow
        };
        
        // Game objects
        this.obstacles = [];
        this.passengers = [];
        this.powerUps = [];
        this.backgroundElements = [];
        
        // Lane positions
        this.lanes = [300, 400, 500];
        
        // South African taxi destinations
        this.destinations = [
            'BELLVILLE', 'WYNBERG', 'KHAYELITSHA', 
            'MITCHELL\'S PLAIN', 'CAPE TOWN', 'PAROW',
            'GOODWOOD', 'ELSIES RIVER', 'LANGA'
        ];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.gameLoop();
        this.spawnBackgroundElements();
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing') {
                switch(e.code) {
                    case 'ArrowLeft':
                        this.movePlayer(-1);
                        break;
                    case 'ArrowRight':
                        this.movePlayer(1);
                        break;
                    case 'Space':
                        e.preventDefault();
                        this.jump();
                        break;
                }
            } else if (this.gameState === 'menu' || this.gameState === 'gameOver') {
                if (e.code === 'Space' || e.code === 'Enter') {
                    this.startGame();
                }
            }
        });
        
        // Touch controls
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
            
            if (this.gameState === 'playing') {
                if (y > this.canvas.height * 0.7) {
                    // Jump area (bottom 30% of screen)
                    this.jump();
                } else if (x < this.canvas.width * 0.4) {
                    // Left side - move left
                    this.movePlayer(-1);
                } else if (x > this.canvas.width * 0.6) {
                    // Right side - move right
                    this.movePlayer(1);
                } else {
                    // Center - jump
                    this.jump();
                }
            } else {
                this.startGame();
            }
        });
        
        // Mouse controls (for desktop)
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            
            if (this.gameState === 'playing') {
                if (x < this.canvas.width * 0.4) {
                    this.movePlayer(-1);
                } else if (x > this.canvas.width * 0.6) {
                    this.movePlayer(1);
                } else {
                    this.jump();
                }
            } else {
                this.startGame();
            }
        });
    }
    
    movePlayer(direction) {
        const newLane = this.player.lane + direction;
        if (newLane >= 0 && newLane <= 2) {
            this.player.lane = newLane;
            this.player.x = this.lanes[newLane];
        }
    }
    
    jump() {
        if (!this.player.isJumping) {
            this.player.isJumping = true;
            this.player.jumpSpeed = -12;
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.speed = 2;
        this.frameCount = 0;
        this.obstacles = [];
        this.passengers = [];
        this.powerUps = [];
        this.player.lane = 1;
        this.player.x = this.lanes[1];
        this.player.y = 350;
        this.player.isJumping = false;
        this.player.jumpHeight = 0;
        this.player.jumpSpeed = 0;
    }
    
    spawnBackgroundElements() {
        // Spawn Table Mountain and Cape Town skyline elements
        for (let i = 0; i < 5; i++) {
            this.backgroundElements.push({
                x: Math.random() * this.canvas.width,
                y: 50 + Math.random() * 100,
                width: 100 + Math.random() * 200,
                height: 50 + Math.random() * 100,
                speed: 0.5,
                type: 'mountain'
            });
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        this.frameCount++;
        
        // Update player jumping
        if (this.player.isJumping) {
            this.player.jumpHeight += this.player.jumpSpeed;
            this.player.jumpSpeed += 0.8; // gravity
            
            if (this.player.jumpHeight >= 0) {
                this.player.jumpHeight = 0;
                this.player.isJumping = false;
                this.player.jumpSpeed = 0;
            }
        }
        
        // Increase speed over time
        if (this.frameCount % 300 === 0) {
            this.speed += 0.2;
        }
        
        // Spawn obstacles
        if (this.frameCount % Math.max(60 - Math.floor(this.speed * 5), 30) === 0) {
            this.spawnObstacle();
        }
        
        // Spawn passengers
        if (this.frameCount % 120 === 0) {
            this.spawnPassenger();
        }
        
        // Spawn power-ups occasionally
        if (this.frameCount % 400 === 0 && Math.random() < 0.7) {
            this.spawnPowerUp();
        }
        
        // Update obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            obstacle.y += this.speed;
            return obstacle.y < this.canvas.height + 50;
        });
        
        // Update passengers
        this.passengers = this.passengers.filter(passenger => {
            passenger.y += this.speed;
            return passenger.y < this.canvas.height + 50;
        });
        
        // Update power-ups
        this.powerUps = this.powerUps.filter(powerUp => {
            powerUp.y += this.speed;
            return powerUp.y < this.canvas.height + 50;
        });
        
        // Update background elements
        this.backgroundElements.forEach(element => {
            element.y += element.speed;
            if (element.y > this.canvas.height + 100) {
                element.y = -100;
                element.x = Math.random() * this.canvas.width;
            }
        });
        
        // Check collisions
        this.checkCollisions();
        
        // Update score
        this.score += Math.floor(this.speed);
        this.scoreElement.textContent = `Score: ${this.score}`;
    }
    
    spawnObstacle() {
        const lane = Math.floor(Math.random() * 3);
        const obstacleTypes = ['pothole', 'roadwork', 'traffic'];
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        
        this.obstacles.push({
            x: this.lanes[lane],
            y: -50,
            width: 50,
            height: 30,
            lane: lane,
            type: type,
            color: type === 'pothole' ? '#8B4513' : 
                   type === 'roadwork' ? '#FF4500' : '#FF0000'
        });
    }
    
    spawnPassenger() {
        const lane = Math.floor(Math.random() * 3);
        this.passengers.push({
            x: this.lanes[lane],
            y: -30,
            width: 25,
            height: 30,
            lane: lane,
            color: '#4169E1'
        });
    }
    
    spawnPowerUp() {
        const lane = Math.floor(Math.random() * 3);
        const types = ['fuel', 'magnet', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.powerUps.push({
            x: this.lanes[lane],
            y: -40,
            width: 35,
            height: 35,
            lane: lane,
            type: type,
            color: type === 'fuel' ? '#00FF00' : 
                   type === 'magnet' ? '#FFD700' : '#9370DB'
        });
    }
    
    checkCollisions() {
        const playerRect = {
            x: this.player.x - this.player.width/2,
            y: this.player.y - this.player.jumpHeight - this.player.height/2,
            width: this.player.width,
            height: this.player.height
        };
        
        // Check obstacle collisions
        for (let obstacle of this.obstacles) {
            if (this.player.lane === obstacle.lane && 
                this.isColliding(playerRect, obstacle)) {
                if (!this.player.isJumping || this.player.jumpHeight > -30) {
                    this.gameOver();
                    return;
                }
            }
        }
        
        // Check passenger collection
        this.passengers = this.passengers.filter(passenger => {
            if (this.player.lane === passenger.lane && 
                this.isColliding(playerRect, passenger)) {
                this.score += 100;
                return false; // Remove collected passenger
            }
            return true;
        });
        
        // Check power-up collection
        this.powerUps = this.powerUps.filter(powerUp => {
            if (this.player.lane === powerUp.lane && 
                this.isColliding(playerRect, powerUp)) {
                this.score += 50;
                // Apply power-up effects here
                return false; // Remove collected power-up
            }
            return true;
        });
    }
    
    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cttr-highscore', this.highScore);
        }
    }
    
    draw() {
        // Clear canvas with Cape Town sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#90EE90');
        gradient.addColorStop(1, '#228B22');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Table Mountain silhouette
        this.drawMountains();
        
        // Draw road
        this.drawRoad();
        
        if (this.gameState === 'menu') {
            this.drawMenu();
        } else if (this.gameState === 'playing') {
            this.drawGame();
        } else if (this.gameState === 'gameOver') {
            this.drawGameOver();
        }
    }
    
    drawMountains() {
        this.ctx.fillStyle = 'rgba(105, 105, 105, 0.6)';
        this.backgroundElements.forEach(element => {
            if (element.type === 'mountain') {
                // Draw simplified Table Mountain shape
                this.ctx.fillRect(element.x, element.y, element.width, element.height);
            }
        });
    }
    
    drawRoad() {
        // Draw road lanes
        this.ctx.fillStyle = '#404040';
        this.ctx.fillRect(250, 0, 300, this.canvas.height);
        
        // Draw lane dividers
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([20, 10]);
        
        // Moving dashed lines effect
        this.ctx.save();
        this.ctx.translate(0, (this.frameCount * this.speed) % 30);
        
        // Left lane divider
        this.ctx.beginPath();
        this.ctx.moveTo(350, -30);
        this.ctx.lineTo(350, this.canvas.height + 30);
        this.ctx.stroke();
        
        // Right lane divider
        this.ctx.beginPath();
        this.ctx.moveTo(450, -30);
        this.ctx.lineTo(450, this.canvas.height + 30);
        this.ctx.stroke();
        
        this.ctx.restore();
        this.ctx.setLineDash([]);
    }
    
    drawMenu() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 48px Ubuntu, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🚐 TAXI RUNNER', this.canvas.width/2, 150);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '24px Ubuntu, sans-serif';
        this.ctx.fillText('Navigate Cape Town Traffic!', this.canvas.width/2, 200);
        
        this.ctx.font = '20px Ubuntu, sans-serif';
        this.ctx.fillText('Collect passengers 👥 • Avoid obstacles 🕳️', this.canvas.width/2, 260);
        
        this.ctx.fillStyle = '#90EE90';
        this.ctx.font = 'bold 28px Ubuntu, sans-serif';
        this.ctx.fillText('Click or Press SPACE to Start!', this.canvas.width/2, 350);
        
        if (this.highScore > 0) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = '18px Ubuntu, sans-serif';
            this.ctx.fillText(`High Score: ${this.highScore}`, this.canvas.width/2, 400);
        }
    }
    
    drawGame() {
        // Draw player taxi
        this.drawPlayerTaxi();
        
        // Draw obstacles
        this.obstacles.forEach(obstacle => this.drawObstacle(obstacle));
        
        // Draw passengers
        this.passengers.forEach(passenger => this.drawPassenger(passenger));
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => this.drawPowerUp(powerUp));
    }
    
    drawPlayerTaxi() {
        const x = this.player.x;
        const y = this.player.y - this.player.jumpHeight;
        
        // Draw taxi body
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(x - 30, y - 20, 60, 40);
        
        // Draw taxi windscreen with destination
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(x - 25, y - 15, 50, 15);
        
        // Draw destination text
        const destination = this.destinations[Math.floor(this.frameCount / 120) % this.destinations.length];
        this.ctx.fillStyle = '#000';
        this.ctx.font = '8px Ubuntu, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(destination, x, y - 7);
        
        // Draw wheels
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(x - 15, y + 15, 8, 0, Math.PI * 2);
        this.ctx.arc(x + 15, y + 15, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw taxi stripes
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(x - 30, y - 10, 60, 5);
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(x - 30, y, 60, 5);
    }
    
    drawObstacle(obstacle) {
        this.ctx.fillStyle = obstacle.color;
        
        if (obstacle.type === 'pothole') {
            // Draw pothole
            this.ctx.beginPath();
            this.ctx.ellipse(obstacle.x, obstacle.y + 15, 25, 15, 0, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (obstacle.type === 'roadwork') {
            // Draw roadwork cone
            this.ctx.fillRect(obstacle.x - 15, obstacle.y, 30, 30);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(obstacle.x - 10, obstacle.y + 10, 20, 5);
        } else {
            // Draw traffic (car)
            this.ctx.fillRect(obstacle.x - 25, obstacle.y, 50, 30);
        }
    }
    
    drawPassenger(passenger) {
        // Draw passenger waiting
        this.ctx.fillStyle = passenger.color;
        this.ctx.fillRect(passenger.x - 12, passenger.y, 25, 30);
        
        // Draw passenger emoji
        this.ctx.font = '16px Arial';
        this.ctx.fillText('👥', passenger.x - 8, passenger.y + 20);
    }
    
    drawPowerUp(powerUp) {
        this.ctx.fillStyle = powerUp.color;
        this.ctx.fillRect(powerUp.x - 17, powerUp.y, 35, 35);
        
        // Draw power-up icon
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        const icon = powerUp.type === 'fuel' ? '⛽' : 
                    powerUp.type === 'magnet' ? '🧲' : '🛡️';
        this.ctx.fillText(icon, powerUp.x, powerUp.y + 25);
    }
    
    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#FF4500';
        this.ctx.font = 'bold 42px Ubuntu, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TAXI CRASHED!', this.canvas.width/2, 180);
        
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = '24px Ubuntu, sans-serif';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width/2, 230);
        
        if (this.score === this.highScore && this.highScore > 0) {
            this.ctx.fillStyle = '#00FF00';
            this.ctx.fillText('NEW HIGH SCORE! 🏆', this.canvas.width/2, 270);
        } else if (this.highScore > 0) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillText(`High Score: ${this.highScore}`, this.canvas.width/2, 270);
        }
        
        this.ctx.fillStyle = '#90EE90';
        this.ctx.font = 'bold 20px Ubuntu, sans-serif';
        this.ctx.fillText('Click or Press SPACE to Play Again!', this.canvas.width/2, 350);
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new CapeTownTaxiRunner();
});