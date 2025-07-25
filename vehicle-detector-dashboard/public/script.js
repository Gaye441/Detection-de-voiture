const socket = io();

socket.on('vehicle-detected', (data) => {
  document.getElementById('count').innerText = data.vehicleCount;
  log(`🚗 Véhicule détecté. Total: ${data.vehicleCount}`);
});

function resetCounter() {
  socket.emit('reset-counter');
  log('🔁 Compteur remis à zéro');
}

function sendNotif() {
  socket.emit('notify');
  log('📣 Notification envoyée à Arduino');
}

function log(message) {
  const logDiv = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  logDiv.innerHTML = `[${time}] ${message}<br>` + logDiv.innerHTML;
}
