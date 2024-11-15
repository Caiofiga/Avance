//Dinamica de projeteis eh uma bosta, e o cara que inventou isso devia ser preso.

// Dynamically import the module after the current module is loaded
let resetLastAngle;
(async () => {
    resetLastAngle = (await import("./webhooks-estilingue.js")).resetLastAngle;
})();
  
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

let anchors = [
    { x: 150, y: 450 },
    { x: 300, y: 450 },
    { x: 450, y: 450 }
];

let distances = [100,125,50]; // Set distance away from the anchors at a 45 degree angle
const angle = Math.PI/4

let objectives = anchors.map((anchor, index) => ({
    x: anchor.x - distances[index] * Math.cos(Math.PI / 4),
    y: anchor.y + distances[index] * Math.sin(Math.PI / 4)
}));


let level = 0;

let obj_marker = {
    x: objectives[level].x,
    y: objectives[level].y,
    radius: 10
}



let anchor = anchors[level];
let isLaunched = false;

const max_distx = 100
const max_disty = Math.tan(angle) * max_distx
const max_dist = Math.sqrt(max_distx ** 2 + max_disty ** 2)

export function dragBall(x ) {
     if (x < 0){
        console.warn("Warning: x is negative, getting the absolute value");
        x = Math.abs(x);
     }
    let dist_x = Math.abs(ball.x) - anchor.x;
    let dist_y = Math.abs(ball.y) - anchor.y;
    let dist = Math.sqrt(dist_x ** 2 + dist_y ** 2)
    if (!ball.isLaunched && dist <= max_dist) {
        ball.x += -x * max_distx
        ball.y += Math.tan(angle) * x * max_disty
    }
}

let parabola = null;
let launchtime = 0;
function releaseBall(e) {
    if (!ball.isLaunched) {
        ball.isDragging = false;
        isLaunched = true;
        ball.isLaunched = true;
        // Calculate launch velocity based on pull-back distance
        parabola = calculateParabolicArc(ball.x, ball.y, anchor.x, anchor.y, obstacles[0].x, obstacles[0].y);
        launchtime = performance.now();
    }
}

// Function to calculate the parabolic path
function calculateParabolicArc(startX, startY, anchorX, anchorY, endX, endY) {
    // Calculate the midpoint between the start, anchor, and end points
    let midX = anchorX;
    let midY = anchorY; // Make sure the anchor point is the vertex of the parabola

    // Now we need to ensure the parabola passes through the start, anchor, and end points
    return function(t) {
        // t is between 0 and 1
        let x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
        let y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;
        return { x, y };
    };
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
        handleNextLevel();
    }, 1500);
}

function handleNextLevel(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    level ++;
    isLaunched = false;
    if (level >= anchors.length) {
        level = 0;
    }
    anchor = anchors[level];
    ball = {
        x: anchor.x,
        y: anchor.y,
        radius: 20,
        vx: 0,
        vy: 0,
        isDragging: false,
        isLaunched: false
    };
    obj_marker = {
        x: objectives[level].x,
        y: objectives[level].y,
        radius: 10
    }
    obj_timer = 3.0;
    
    addObstacle(700,300,50,50);
    parabola = null;
    launchtime = null;
    flighttime = 0;

}


let obstacles = [];

function drawObstacles() {
    for (let obstacle of obstacles) {
        obstacle.drawctx();
        obstacle.checkcollision(ball);  // Check collision during each frame
    }
}

function addObstacle(x,y,w,h) {
    let obstacle = new Obstacle(x, canvas.height - y, w, h);
    obstacles.push(obstacle);
}
addObstacle(600,50,50,50)

function isBallInObjective(ball, obj_marker) {
    const dx = ball.x - obj_marker.x;
    const dy = ball.y - obj_marker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= ball.radius + obj_marker.radius;
}

let obj_timer = 3.0;

let lastframetime = performance.now()
let totalframetime = 0;
let flighttime = 0
let parabolatime = 4000;
//preciso somar os frametimes ate dar 1/60, ai eu rodo a fisica
function animate() {
    let deltaTime = performance.now() - lastframetime;
    lastframetime = performance.now(); // Update the last frame time

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

    // Accumulate frame time and update physics at 60 FPS
    totalframetime += deltaTime;
    while (totalframetime >= (1000 / 60)) { // Update physics if enough time has passed
        updatePhysics();
        totalframetime -= (1000 / 60); // Decrease the accumulated time by the amount needed for the next physics update
    }


    let ballImage = new Image();
    ballImage.src = '../static/img/ball.png';
    // Draw the ball
    ctx.drawImage(ballImage, ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2);
    // Draw the objective marker
    ctx.beginPath();
    ctx.arc(obj_marker.x, obj_marker.y, obj_marker.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw obstacles (for collision detection)
    drawObstacles();

    if (isBallInObjective(ball, obj_marker)) {
        obj_timer -= 0.01
        console.log("counting Down!")
        if (obj_timer <= 0) {
            resetLastAngle();
            releaseBall();
        }
    }
    // Request the next frame
    requestAnimationFrame(animate);
}

//essa funcao soh vai rodar a cada 1/60 segs
function updatePhysics(){

    if (isLaunched && parabola != null){
        flighttime += (performance.now() - launchtime)
        let t = flighttime/parabolatime;
        ball.x = parabola(t).x
        ball.y = parabola(t).y
    }

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

// Start the animation
animate();