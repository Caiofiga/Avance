function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }
  

function StartConfetti(){
    confetti({
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        particleCount: randomInRange(50, 100),
        origin: { y: 0.6 },
        zIndex: 9999
    });
}
let fireworks;
function startFireworks(container){
    if (fireworks) {
        fireworks.stop();
        fireworks = null;
    }
    fireworks = new Fireworks.default(container, { zIndex: 9999 });
    fireworks.start();
    setTimeout(() => {
        fireworks.stop();
        fireworks = null;
    }, 10000);
}