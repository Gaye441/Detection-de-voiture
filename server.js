const express = require('express');
const http = require('http');
const fs = require('fs');
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
let history = [];
let vehiclesPerHalfMinute = [];

// Charger historique sauvegardé s'il existe
const FILE_PATH = './vehicules.json';
if (fs.existsSync(FILE_PATH)) {
  try {
    history = JSON.parse(fs.readFileSync(FILE_PATH));
    vehicleCount = history.length;
    // Reconstruire vehiclesPerHalfMinute à partir de l'historique
    history.forEach(entry => {
      const d = new Date(entry.timestamp);
      const halfIndex = d.getHours() * 120 + d.getMinutes() * 2 + (d.getSeconds() < 30 ? 0 : 1);
      vehiclesPerHalfMinute[halfIndex] = (vehiclesPerHalfMinute[halfIndex] || 0) + 1;
    });
  } catch(e) {
    console.error('Erreur lecture fichier JSON', e);
  }
}

function updateVehiclesPerHalfMinute() {
  const now = new Date();
  const halfMinuteIndex = now.getHours() * 120 + now.getMinutes() * 2 + (now.getSeconds() < 30 ? 0 : 1);

  if (!vehiclesPerHalfMinute[halfMinuteIndex]) {
    vehiclesPerHalfMinute[halfMinuteIndex] = 0;
  }
  vehiclesPerHalfMinute[halfMinuteIndex]++;
}

parser.on('data', (line) => {
  const data = line.trim();
  console.log('Reçu série:', data);

  if (data === 'CAR_DETECTED') {
    // À la détection on ne fait rien ici, on attend le COUNT pour incrémenter
  } else if (data.startsWith('COUNT:')) {
    vehicleCount = parseInt(data.split(':')[1]);

    // Ajouter à l'historique complet
    const now = new Date();
    history.push({ timestamp: now.toISOString() });
    // Sauvegarde dans JSON à chaque détection
    fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));

    io.emit('vehicleCount', vehicleCount);

    updateVehiclesPerHalfMinute();

    // Envoi des 20 dernières demi-minutes (~10 minutes)
    const currentHalf = now.getHours() * 120 + now.getMinutes() * 2 + (now.getSeconds() < 30 ? 0 : 1);
    const last20 = [];

    for (let i = currentHalf - 19; i <= currentHalf; i++) {
      last20.push(vehiclesPerHalfMinute[i] || 0);
    }
    io.emit('graphData', last20);

    // Envoi de l'historique complet au client
    io.emit('history', history);
  } else if (data === 'RESET_DONE') {
    io.emit('resetDone');
    vehiclesPerHalfMinute = [];
    history = [];
    vehicleCount = 0;
    fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));
  }
});

io.on('connection', (socket) => {
  console.log('Client connecté');

  socket.emit('vehicleCount', vehicleCount);

  // Envoyer historique complet à la connexion
  socket.emit('history', history);

  // Envoyer dernier graphique
  const now = new Date();
  const currentHalf = now.getHours() * 120 + now.getMinutes() * 2 + (now.getSeconds() < 30 ? 0 : 1);
  const last20 = [];
  for (let i = currentHalf - 19; i <= currentHalf; i++) {
    last20.push(vehiclesPerHalfMinute[i] || 0);
  }
  socket.emit('graphData', last20);

  socket.on('reset', () => {
    console.log('Commande RESET reçue du dashboard');
    serial.write('RESET\n');
  });

  socket.on('notify', () => {
    console.log('Commande NOTIF reçue du dashboard');
    serial.write('NOTIF\n');
  });
});

// Route pour sauvegarde manuelle
app.post('/save', (req, res) => {
  fs.writeFile(FILE_PATH, JSON.stringify(history, null, 2), (err) => {
    if (err) {
      console.error('Erreur sauvegarde', err);
      return res.status(500).send('Erreur sauvegarde');
    }
    res.send('Historique sauvegardé');
  });
});

app.use(express.static('public'));

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
