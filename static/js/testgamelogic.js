function moveDiv(value){
    let div = document.getElementById("movable");
     let plant1pos = document.getElementById("plant1").getBoundingClientRect();
     let plant5pos = document.getElementById("plant5").getBoundingClientRect();
     let x =  (plant1pos.left + plant5pos.right)/2 + (plant5pos.right + 40) * value / 100;
     div.style.left = x + "px";
 }
 
 // This function will be triggered by the WebSocket logic
 function handleMovement(deltaX) {
     moveDiv(deltaX);  // Move the div by deltaX
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
         }
     });
     
     if (check === 5) {
         const myModal = new bootstrap.Modal(document.getElementById('exampleModal'));
         myModal.show();
         clearInterval(timeinterval);
         document.getElementById("modal-text").innerHTML = `Parabéns! Você regou todas as plantas em ${time.toFixed(1)} segundos!`;
         wateringcan.removeEventListener('overlap', handleOverlap);
     }
 }
 