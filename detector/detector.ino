#include <Servo.h>

// Définition des broches
#define TRIG_PIN D5
#define ECHO_PIN D6
#define SERVO_PIN D4
#define BUZZER_PIN D7

Servo barrier;
int vehicleCount = 0;

void setup() {
  Serial.begin(115200);           // Communication série
  pinMode(TRIG_PIN, OUTPUT);      // Broche trigger du capteur à ultrasons
  pinMode(ECHO_PIN, INPUT);       // Broche echo du capteur à ultrasons
  pinMode(BUZZER_PIN, OUTPUT);    // Buzzer
  digitalWrite(BUZZER_PIN, LOW);  // Buzzer éteint au début

  barrier.attach(SERVO_PIN);      // Attache du servomoteur
  barrier.write(0);               // Position initiale : barrière fermée

  Serial.println("READY");        // Signal que le système est prêt
}

void loop() {
  // 🔄 Vérifie les commandes venant du dashboard
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "RESET") {
      vehicleCount = 0;
      Serial.println("RESET_DONE");
    } else if (cmd == "NOTIF") {
      Serial.println("🔔 NOTIF reçue du dashboard !");
      digitalWrite(BUZZER_PIN, HIGH);
      delay(300);
      digitalWrite(BUZZER_PIN, LOW);
    }
  }

  // 🔍 Mesure de distance avec le capteur à ultrasons
  long duration;
  float distance;

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  duration = pulseIn(ECHO_PIN, HIGH);
  distance = duration * 0.034 / 2;

  Serial.print("DIST:");
  Serial.println(distance);

  // 🚗 Si un véhicule est détecté
  if (distance < 20) {
    vehicleCount++;
    Serial.println("CAR_DETECTED");
    Serial.print("COUNT:");
    Serial.println(vehicleCount);

    // 🔊 Avertir avec le buzzer
    digitalWrite(BUZZER_PIN, HIGH);
    delay(500);
    digitalWrite(BUZZER_PIN, LOW);

    // 🟢 Ouvrir la barrière
    barrier.write(90);
    delay(3000);
    barrier.write(0);
  }

  delay(500);
}
