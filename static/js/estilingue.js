//Dinamica de projeteis eh uma bosta, e o cara que inventou isso devia ser preso.

// Dynamically import the module after the current module is loaded
let resetLastAngle;
(async () => {
    resetLastAngle = (await import("./webhooks-estilingue.js")).resetLastAngle;
})();
  
import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/js/bootstrap.bundle.min.js';
  // Get the canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');


let level = 0;


let anchors = [
    { x: 150, y: 800 },
    { x: 300, y: 800 },
    { x: 450, y: 800 }
];


// Game variables
let ball = {
    x: anchors[level].x,
    y:anchors[level].y,
    radius: 20,
    vx: 0,
    vy: 0,
    isDragging: false,
    isLaunched: false,
    visible: true
};


let distances = [100,125,50]; // Set distance away from the anchors at a 45 degree angle
const angle = Math.PI/4

let objectives = anchors.map((anchor, index) => ({
    x: anchor.x - distances[index] * Math.cos(Math.PI / 4),
    y: anchor.y + distances[index] * Math.sin(Math.PI / 4)
}));



let obj_marker = {
    x: objectives[level].x,
    y: objectives[level].y,
    radius: 10
}



let anchor = anchors[level];
let isLaunched = false;

let max_dist = distances[level] + 100; //buffer to solidfy reaching the objective
let max_distx = max_dist * Math.cos(Math.PI / 4);
let max_disty = max_dist * Math.sin(Math.PI / 4);

export function dragBall(x ) {
    let dist_x = Math.abs(ball.x) - anchor.x;
    let dist_y = Math.abs(ball.y) - anchor.y;
    let dist = Math.sqrt(dist_x ** 2 + dist_y ** 2)
    if (!ball.isLaunched && dist <= max_dist) {
        ball.x += -x * max_distx
        ball.y += Math.tan(angle) * x * max_disty
    }
    if (dist <= 1) window.isinanchor = true;
    else window.isinanchor = false;
}

let parabola = null;
let anchorpath = null;
let anchorlaunchtime = 0;
let parabolalaunchtime = 0;
function releaseBall(e) {
    if (!ball.isLaunched) {
        ball.isDragging = false;
        isLaunched = true;
        ball.isLaunched = true;
        // Calculate launch velocity based on pull-back distance
        anchorpath = calculateBallToAnchorPath(ball.x, ball.y, anchor.x, anchor.y)
        anchorlaunchtime = performance.now()

    }
}

function calculateParabolicArc(startX, startY, endX, endY) {
    // Calculate the midpoint between the start and end points
    let midX = (startX + endX) / 2;
    // Set the midY (vertex) above the start and end Y positions
    let midY = Math.min(startY, endY) - 100;  // You can adjust the 100 to control the height of the arc

    return function(t) {
        let x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
        let y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;

        return { x, y };
    };
}



function calculateBallToAnchorPath(startX, startY, anchorX, anchorY) {

    // Now we need to ensure the path passes through the start and anchor points
    return function(t) {
        // t is between 0 and 1
        let x = (1 - t) * startX + t * anchorX;
        let y = (1 - t) * startY + t * anchorY;
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
                const rect = canvas.getBoundingClientRect(); //margins were interfering, need to get the clientrect()
                const x = rect.left + this.x + this.width / 2;
                const y = rect.top + this.y + this.height / 2;
                obstacles.pop(ball)
                console.log(this.x + " " + this.y)
                playCollisionGif(x, y);
            }
        }
    }
}

function playCollisionGif(x, y) {
    const gif = document.getElementById('collisionGif');
    ball.visible = false;

    // Reset the src to restart the GIF animation
    gif.src = gif.src;

    // Set the position of the GIF to the collision point
    gif.style.left = `${x - 50}px`;  // Center the gif horizontally on the collision point
    gif.style.top = `${y - 50}px`;   // Center the gif vertically on the collision point
    gif.style.display = 'block';     // Show the gif

    // Hide the gif after 1.5 seconds
    setTimeout(() => {
        gif.style.display = 'none';
        handleGameWin()
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
        isLaunched: false,
        visible: true
    };
    obj_marker = {
        x: objectives[level].x,
        y: objectives[level].y,
        radius: 10
    }
    obj_timer = 3.0;
    
    addObstacle(levelobstacles[level].x, levelobstacles[level].y, levelobstacles[level].w, levelobstacles[level].h)
    parabola = null;
    anchorpath = null;
    anchorlaunchtime = 0;
    anchorflightime = 0;
    parabolalaunchtime = 0;
    parabolaflighttime = 0;
    reachedObstacle = false;
    max_dist = distances[level] + 100;
    max_distx = max_dist * Math.cos(Math.PI / 4);
    max_disty = max_dist * Math.sin(Math.PI / 4);
    


}

function handleGameWin(){
    const myModal = new bootstrap.Modal(document.getElementById('exampleModal'));
    myModal.show();
    myModal._element.addEventListener('hidden.bs.modal', handleNextLevel);
}

export function lockModal(angle) {
    const closemodalbutton = document.getElementById('closemodalbutton');
    const modaltext = document.getElementById('lowerangle');

    // Update the locked state based on the angle
    if (angle > 20) {
        closemodalbutton.disabled = true;
        modaltext.style.visibility = 'inherit';

    } else {
        closemodalbutton.disabled = false;
        modaltext.style.visibility = 'hidden';
    }
}

let obstacles = []

let levelobstacles = [
{x: 1280, y: 500, w: 50, h: 50},
{x: 900, y: 100, w: 50, h: 50},
{x: 800, y: 50, w: 50, h: 50}
];


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
addObstacle(levelobstacles[level].x, levelobstacles[level].y, levelobstacles[level].w, levelobstacles[level].h)

function isBallInObjective(ball, obj_marker) {
    const dx = ball.x - obj_marker.x;
    const dy = ball.y - obj_marker.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= ball.radius + obj_marker.radius;
}

let obj_timer = 3.0;

let lastframetime = performance.now()
let totalframetime = 0;
let anchorflightime = 0
let parabolaflighttime = 0;
let parabolatime = 4000;
let anchortime = 1000;

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
        ctx.strokeStyle = 'brown';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    // Draw the slingshot itself
    let slingshotImage = new Image();
    slingshotImage.src = '../static/img/slingshot.png';

    // Calculate the required scale to fit the anchor
    let slingshotHeight = 987; // Set the original height of the slingshot image
    let distanceToAnchor = Math.abs(anchor.y - canvas.height); // Distance from the anchor to the floor
    let scale = distanceToAnchor / slingshotHeight;


    // Save the context state
    ctx.save();

    // Move to the anchor point and rotate
    ctx.translate(anchor.x, anchor.y);


    // Draw the scaled slingshot image with the base aligned
    let scaledWidth = slingshotImage.width * scale;
    let scaledHeight = slingshotImage.height * scale;

    ctx.drawImage(
        slingshotImage, 
        -scaledWidth / 2, // Center the image horizontally
        -scaledHeight /10,    // Position the base at the anchor point
        scaledWidth, 
        scaledHeight
    );

    // Restore the context state
    ctx.restore();




    // Accumulate frame time and update physics at 60 FPS
    totalframetime += deltaTime;
    while (totalframetime >= (1000 / 60)) { // Update physics if enough time has passed
        updatePhysics();
        totalframetime -= (1000 / 60); // Decrease the accumulated time by the amount needed for the next physics update
    }

    if (ball.visible){ //only draw the ball if it is visible
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
    }

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

let reachedObstacle = false;
//essa funcao soh vai rodar a cada 1/60 segs
function updatePhysics(){

    if (isLaunched && parabola ==  null && !reachedObstacle){ //means the ball is still going to the anchor point
        anchorflightime += (performance.now() - anchorlaunchtime);
        let t = anchorflightime/anchortime;
        ball.x = anchorpath(t).x;
        ball.y = anchorpath(t).y;
        if (t >= 1) 
         {
            parabola = calculateParabolicArc(ball.x, ball.y, obstacles[0].x, obstacles[0].y);
            parabolalaunchtime = performance.now();
         }
    }

    else if (isLaunched && parabola != null && !reachedObstacle) {
        parabolaflighttime += (performance.now() - parabolalaunchtime);
        let t = parabolaflighttime / parabolatime;
        ball.x = parabola(t).x;
        ball.y = parabola(t).y;
        if (t >= 1) reachedObstacle = true;
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