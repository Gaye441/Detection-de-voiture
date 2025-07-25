const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SERIAL_PORT = '/dev/ttyUSB0';  // Modifie si besoin
const BAUD_RATE = 115200;

const serial = new SerialPort.SerialPort({
  path: SERIAL_PORT,
  baudRate: BAUD_RATE,
});

const parser = serial.pipe(new Readline.ReadlineParser({ delimiter: '\n' }));

let vehicleCount = 0;
let currentDistance = 0;

// Tableau indexé par demi-minute du jour (0 - 2879)
let vehiclesPerHalfMinute = [];

function updateVehiclesPerHalfMinute() {
  const now = new Date();
  const halfMinuteIndex = now.getHours() * 120 + now.getMinutes() * 2 + (now.getSeconds() < 15 ? 0 : 1);

  if (!vehiclesPerHalfMinute[halfMinuteIndex]) {
    vehiclesPerHalfMinute[halfMinuteIndex] = 0;
  }
  vehiclesPerHalfMinute[halfMinuteIndex]++;
}

parser.on('data', (line) => {
  const data = line.trim();
  console.log('Reçu série:', data);

  if (data.startsWith('DIST:')) {
    currentDistance = parseFloat(data.split(':')[1]);
    io.emit('distance', currentDistance);
  } else if (data === 'CAR_DETECTED') {
    // on attend le COUNT
  } else if (data.startsWith('COUNT:')) {
    vehicleCount = parseInt(data.split(':')[1]);
    io.emit('vehicleCount', vehicleCount);

    updateVehiclesPerHalfMinute();

    // Envoi des 20 dernières demi-minutes (~10 minutes)
    const now = new Date();
    const currentHalf = now.getHours() * 120 + now.getMinutes() * 2 + (now.getSeconds() < 15 ? 0 : 1);
    const last20 = [];

    for (let i = currentHalf - 19; i <= currentHalf; i++) {
      last20.push(vehiclesPerHalfMinute[i] || 0);
    }
    io.emit('graphData', last20);
  } else if (data === 'RESET_DONE') {
    io.emit('resetDone');
    vehiclesPerHalfMinute = [];
  }
});

io.on('connection', (socket) => {
  console.log('Client connecté');

  socket.emit('vehicleCount', vehicleCount);
  socket.emit('distance', currentDistance);

  socket.on('reset', () => {
    console.log('Commande RESET reçue du dashboard');
    serial.write('RESET\n');
  });

  socket.on('notify', () => {
    console.log('Commande NOTIF reçue du dashboard');
    serial.write('NOTIF\n');
  });
});

app.use(express.static('public'));

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
