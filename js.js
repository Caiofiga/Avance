function slider(value){
   let div = document.getElementById("movable");
    plant1pos = document.getElementById("plant1").getBoundingClientRect();
    plant5pos = document.getElementById("plant5").getBoundingClientRect();
    let x = (plant5pos.right + 40) * value / 100;
    div.style.left = x + "px";
}

function isOverlapping(pos1, pos2){
    return !(pos2.left > pos1.right || 
        pos2.left < pos1.left);
}

let time = 0;
let timeinterval = null;
addEventListener('DOMContentLoaded', () => {

function increaseTime(){
    time += 0.1;
}
timeinterval = setInterval(increaseTime, 100);

});

const plants = document.querySelectorAll('.plant');
const wateringcan = document.getElementById('movable');

function plantinterval(){
plants.forEach((plant) => {
    if (isOverlapping(plant.getBoundingClientRect(), wateringcan.getBoundingClientRect())) {
        const event = new CustomEvent('overlap', {
            detail: {
                plantId: plant.id
            }
        });
        wateringcan.dispatchEvent(event);
    }
});}

setInterval(plantinterval, 100);

wateringcan.addEventListener('overlap', handleOverlap);

    
function handleOverlap(event) {
    const plant = document.getElementById(event.detail.plantId);
    if(plant.dataset.watertime >= parseFloat(0)){
    plant.dataset.watertime = `${parseFloat(plant.dataset.watertime) - 0.1}`;
    if (plant.dataset.watertime <= parseFloat(0)) {
        plant.style.background = "green";
    }
}
let check = 0;
plants.forEach((plant) => {
    if (plant.style.background === "green") {
        check++;
    }});
    console.log(check);
if (check === 5) {
    const myModal = new bootstrap.Modal(document.getElementById('exampleModal'))
    myModal.show();
    clearInterval(timeinterval);
    document.getElementById("modal-text").innerHTML = `Parabéns! Você regou todas as plantas em ${time.toFixed(1)} segundos!`;
    wateringcan.removeEventListener('overlap', handleOverlap);


}}



// Mocking Accelerometer API for testing
if (!('Accelerometer' in window)) {
    console.log("working my ass");
    window.Accelerometer = MockAccelerometer;
}


//accelerometer code
/*

class MockAccelerometer {
    constructor(options) {
        this.name = "Mock"
        this.options = options;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.onreading = null;
        this.onerror = null;
        this.decreasex = false;
        this.decreasey = false;
        this.decreasez = false;
    }
    
    setValue(value, coord) {
        switch (coord) {
            case "x":
                if (!this.decreasex) {
                    value = value + 1;
                    if (value === 100) {
                        this.decreasex = true;
                    }
                    return value;
                } else {
                    value = value - 1;
                    if (value === 0) {
                        this.decreasex = false;
                    }
                    return value;
                }
            case "y":
                if (!this.decreasey) {
                    value = value + 1;
                    if (value === 100) {
                        this.decreasey = true;
                    }
                    return value;
                } else {
                    value = value - 1;
                    if (value === 0) {
                        this.decreasey = false;
                    }
                    return value;
                }
            case "z":
                if (!this.decreasez) {
                    value = value + 1;
                    if (value === 100) {
                        this.decreasez = true;
                    }
                    return value;
                } else {
                    value = value - 1;
                    if (value === 0) {
                        this.decreasez = false;
                    }
                    return value;
                }
        }
    }
    
    start() {
        console.log("Mock Accelerometer started with options:", this.options);
        this.interval = setInterval(() => {
            this.x = this.setValue(this.x, "x");  // Simulate some random movement
            this.y = this.setValue(this.y, "y");
            this.z = this.setValue(this.z, "z");
            if (this.onreading) {
                this.onreading();
            }
        }, 1000);  // Update every second
    }

    stop() {
        clearInterval(this.interval);
    }
}

if ('Accelerometer' in window) {
    window.Accelerometer = MockAccelerometer;

    try {
        let accelSensor = new Accelerometer({ referenceFrame: "device" });


        accelSensor.onreading = () => {
            document.getElementById("progress-bar").style.width = `${accelSensor.x}%`;
            console.log( `${accelSensor.x}%`);
            console.log(accelSensor.x);
        };

        accelSensor.onerror = (event) => {
            console.error(`Accelerometer error: ${event.error.name}`);
            console.error(event.error.message);
        };

        accelSensor.start();
    } catch (error) {
        console.error("Accelerometer initialization failed: " + error);
    }
} else {
    console.log("Accelerometer is not supported by your browser.");
}*/
