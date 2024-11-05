// Get the canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let ball = {
    x: 150,
    y: 450,
    radius: 20,
    vx: 0,
    vy: 0,
    isDragging: false,
    isLaunched: false
};

let anchor = {
    x: 150,
    y: 450
};

let isLaunched = false;
let gravity = 0.5;
let friction = 0.99;

// Event listeners for mouse interaction
canvas.addEventListener('mousedown', releaseBall);
//canvas.addEventListener('mousemove', dragBall)
//canvas.addEventListener('mouseup', releaseBall)


const angle = Math.PI/4
const max_distx = 100
const max_disty = Math.tan(angle) * max_distx
const max_dist = Math.sqrt(max_distx ** 2 + max_disty ** 2)

export function dragBall(x ) {
    let dist_x = Math.abs(ball.x) - anchor.x;
    let dist_y = Math.abs(ball.y) - anchor.y;
    let dist = Math.sqrt(dist_x ** 2 + dist_y ** 2)
    if (!ball.isLaunched && dist <= max_dist) {
        ball.x += -x * max_distx
        ball.y += Math.tan(angle) * x * max_disty
    }
}


function releaseBall(e) {
    if (!ball.isLaunched) {
        ball.isDragging = false;
        isLaunched = true;
        ball.isLaunched = true;
        // Calculate launch velocity based on pull-back distance
        ball.vx = (anchor.x - ball.x) * 0.1;
        ball.vy = (anchor.y - ball.y) * 0.1;
    }
}


class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    drawctx() {
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    broadPhaseCheck(ball) {
        const distanceThreshold = 100;
        const dx = ball.x - (this.x + this.width / 2);
        const dy = ball.y - (this.y + this.height / 2);
        return Math.sqrt(dx * dx + dy * dy) < distanceThreshold;
    }

    checkcollision(ball) {
        if (this.broadPhaseCheck(ball)) {
            if (
                ball.x + ball.radius > this.x && 
                ball.x - ball.radius < this.x + this.width && 
                ball.y + ball.radius > this.y && 
                ball.y - ball.radius < this.y + this.height
            ) {
                // Simple collision response
                ball.vx *= -1;
                ball.vy *= -1;

                // Determine the side of the obstacle where the collision occurred
                let collisionX, collisionY;

                if (ball.x < this.x) {
                    // Collision on the left side
                    collisionX = this.x;
                    collisionY = ball.y;
                } else if (ball.x > this.x + this.width) {
                    // Collision on the right side
                    collisionX = this.x + this.width;
                    collisionY = ball.y;
                } else if (ball.y < this.y) {
                    // Collision on the top side
                    collisionX = ball.x;
                    collisionY = this.y;
                } else if (ball.y > this.y + this.height) {
                    // Collision on the bottom side
                    collisionX = ball.x;
                    collisionY = this.y + this.height;
                }

                // Play the collision GIF at the exact collision point
                obstacles.pop(ball)
                
                playCollisionGif(this.x +this.width/2, this.y + this.height/2);
            }
        }
    }
}

function playCollisionGif(x, y) {
    const gif = document.getElementById('collisionGif');

    // Reset the src to restart the GIF animation
    gif.src = gif.src;

    // Set the position of the GIF to the collision point
    gif.style.left = `${x - 50}px`;  // Center the gif horizontally on the collision point
    gif.style.top = `${y - 50}px`;   // Center the gif vertically on the collision point
    gif.style.display = 'block';     // Show the gif

    // Hide the gif after 1.5 seconds
    setTimeout(() => {
        gif.style.display = 'none';
    }, 1500);
}

// Rest of the game logic...


let obstacles = [];

function drawObstacles() {
    for (let obstacle of obstacles) {
        obstacle.drawctx();
        obstacle.checkcollision(ball);  // Check collision during each frame
    }
}

function addObstacle() {
    let obstacle = new Obstacle(600, canvas.height - 50, 50, 50);
    obstacles.push(obstacle);
}
addObstacle()

// Utility functions
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function isInsideBall(pos, ball) {
    const dx = pos.x - ball.x;
    const dy = pos.y - ball.y;
    return Math.sqrt(dx * dx + dy * dy) < ball.radius;
}

// Main animation loop
function animate() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw slingshot band
    if (ball.isDragging || !isLaunched) {
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(ball.x, ball.y);
        ctx.strokeStyle = 'gray';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Update ball position if launched
    if (isLaunched && !ball.isDragging) {
        ball.vy += gravity; // Apply gravity
        ball.vx *= friction; // Apply friction
        ball.vy *= friction;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Collision detection with ground
        if (ball.y + ball.radius > canvas.height) {
            ball.y = canvas.height - ball.radius;
            ball.vy *= -1; // Reverse velocity (bounce)
        }

        // Collision detection with walls
        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
            ball.vx *= -1; // Reverse velocity
        }
    }

    let ballImage = new Image()
    ballImage.src = '../static/img/ball.png'
    // Draw the ball
    ctx.drawImage(ballImage, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);

    // Draw obstacles (for collision detection)
    drawObstacles();

    // Request the next frame
    requestAnimationFrame(animate);
}


// Start the animation
animate();
