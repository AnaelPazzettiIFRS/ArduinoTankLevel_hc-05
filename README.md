# 💧 Water Tank Monitor

Real-time water tank level monitoring dashboard powered by an **Arduino HC-SR04 ultrasonic sensor** and **HC-05 Bluetooth module**. Runs entirely in the browser — no server, no database — using the **Web Serial API**.

🔗 **Live Dashboard:** `https://<your-username>.github.io/ArduinoUltrassonics/`

---

## How It Works

```
┌─────────────┐     Bluetooth (SPP)     ┌────────────┐     Web Serial API     ┌──────────────┐
│  Arduino     │ ──────────────────────► │  HC-05     │ ◄───────────────────── │  Browser     │
│  HC-SR04     │  "25 cm\r\n" @ 9600    │  (paired)  │   virtual COM port     │  Dashboard   │
└─────────────┘                          └────────────┘                        └──────────────┘
```

1. The Arduino reads distance from the **HC-SR04** every 500 ms and sends `<distance> cm` over the **HC-05** Bluetooth serial link.
2. Your PC pairs with the HC-05 via **Windows Bluetooth Settings**, which creates a virtual COM port.
3. The web dashboard connects to that COM port through the **Web Serial API** (Chrome / Edge) and displays the water level in real-time.

---

## Features

- 🌊 **Animated tank visualization** with real-time water level
- 📊 **Live stats** — distance, water level (cm), fill percentage, status
- 📈 **History chart** — last ~2 minutes of readings (canvas, no libraries)
- 🚨 **Low-level alerts** — configurable low & critical thresholds
- 🔔 **Browser notifications** — system-level alerts when level drops
- 🔊 **Sound alerts** — audible warning via Web Audio API
- ⚙️ **Configurable settings** — tank height, sensor offset, thresholds (saved in localStorage)
- 📱 **Responsive** — works on desktop and tablet screens
- 🚀 **Zero dependencies** — vanilla HTML / CSS / JS, ready for GitHub Pages

---

## Setup

### 1. Hardware (Arduino)

| Component | Pin |
|-----------|-----|
| HC-SR04 TRIG | D2 |
| HC-SR04 ECHO | D3 |
| HC-05 RXD (via 1kΩ/2kΩ voltage divider) | D11 (TX) |
| HC-05 TXD | D10 (RX, unused) |

Upload the Arduino sketch to your board (see `arduino_sketch/` or the code below).

### 2. Pair HC-05 with Windows

1. **Settings → Bluetooth & devices → Add device → Bluetooth**
2. Select **HC-05** (default PIN: `1234` or `0000`)
3. Windows will create a virtual COM port (e.g., `COM5`)

### 3. Open the Dashboard

1. Open the live GitHub Pages URL in **Google Chrome** or **Microsoft Edge**
2. Click **⚡ Connect**
3. In the serial port picker, select the HC-05 COM port
4. Data will stream in real-time!

### 4. Configure

Adjust these settings in the dashboard sidebar:

| Setting | Description | Default |
|---------|-------------|---------|
| Tank Height | Internal height of your tank in cm | 100 |
| Sensor Offset | Distance from sensor to water when tank is full | 5 |
| Low Level Alert | Percentage to trigger a warning | 20% |
| Critical Level | Percentage to trigger a critical alarm | 10% |

---

## Browser Compatibility

| Browser | Supported |
|---------|-----------|
| Google Chrome (desktop) | ✅ |
| Microsoft Edge (desktop) | ✅ |
| Firefox | ❌ (no Web Serial API) |
| Safari | ❌ (no Web Serial API) |
| Mobile browsers | ❌ (no Web Serial API) |

---

## Deploy to GitHub Pages

1. Create a GitHub repository
2. Push all files (`index.html`, `style.css`, `app.js`)
3. Go to **Settings → Pages → Source → Deploy from a branch → `main` / `root`**
4. Your dashboard will be live at `https://<username>.github.io/<repo>/`

---

## Arduino Sketch

```cpp
#include <SoftwareSerial.h>

const int btRxPin = 10;
const int btTxPin = 11;
SoftwareSerial BTSerial(btRxPin, btTxPin);

const int trigPin = 2;
const int echoPin = 3;

void setup() {
  Serial.begin(9600);
  BTSerial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);
  long cm = duration / 29 / 2;

  Serial.print(cm);
  Serial.println(" cm");

  BTSerial.print(cm);
  BTSerial.println(" cm");

  delay(500);
}
```

---

## License

MIT
