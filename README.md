# 🍫 ChocoTank™ — Molten Chocolate Silo Monitor

Real-time liquid chocolate tank level telemetry dashboard for confectionery plants, powered by an **Arduino HC-SR04 ultrasonic transducer** and **HC-05 Bluetooth module**. Runs 100% client-side in the browser via the **Web Serial API** — zero backend required.

🔗 **Live Dashboard:** `https://AnaelPazzettiIFRS.github.io/ArduinoTankLevel_hc-05/`

---

## Industrial Architecture

```
┌────────────────────┐     Bluetooth SPP (9600)    ┌────────────┐     Web Serial API     ┌────────────────────────┐
│  Arduino HC-SR04   │ ──────────────────────────► │  HC-05     │ ◄───────────────────── │  ChocoTank™ Dashboard  │
│  Ultrasonic Sensor │   "25 cm\r\n" every 500ms   │  (paired)  │   Virtual COM port     │  (Chrome / Edge)       │
└────────────────────┘                             └────────────┘                        └────────────────────────┘
```

1. **Ultrasonic Transducer**: Mounted at the top of the chocolate silo, sending acoustic pulses down to the molten chocolate surface.
2. **Telemetry Stream**: Arduino computes distance in cm and streams readings over the HC-05 serial link.
3. **Plant Dashboard**: Receives data via Web Serial in Chrome/Edge, converts distance to volume/fill %, visualizes the vat in real time, and triggers alarms if molten chocolate runs low.

---

## Features

- 🍫 **Molten Chocolate Vat Visualization**: Silky wave physics, glossy surface sheen, and color transitions (Rich Milk Chocolate → Amber Warning → Critical Depletion Red).
- 📊 **Confectionery Telemetry**: Real-time distance, chocolate depth (cm), silo fill ratio (%), and batch status.
- 📈 **Caramel Stream History**: High-resolution 2-minute rolling trendline with threshold alerts.
- 🚨 **Plant Supply Alarms**: Configurable Low Supply warning and Critical Depletion emergency alarm.
- 🔊 **Factory Audio & Browser Alerts**: Synthesized industrial tone alerts and desktop notifications.
- ⚙️ **Vat Calibration**: Configurable silo height, sensor offset, and alert thresholds (persisted in `localStorage`).
- 🚀 **Zero Dependencies**: Pure HTML5, CSS3, and JavaScript — ready for GitHub Pages hosting.

---

## Hardware Setup

| Component | Pin | Notes |
|---|---|---|
| HC-SR04 TRIG | D2 | Ultrasonic pulse output |
| HC-SR04 ECHO | D3 | Ultrasonic return input |
| HC-05 RXD | D11 (TX) | Via 1kΩ / 2kΩ voltage divider (protects 3.3V HC-05 RX) |
| HC-05 TXD | D10 (RX) | Optional (Arduino only transmits) |

---

## Connecting from Chrome / Edge

1. **Pair HC-05**: Open Windows Bluetooth settings, pair with `HC-05` (PIN `1234` or `0000`).
2. **Open Dashboard**: Go to the GitHub Pages URL in Chrome or Edge.
3. **Connect Silo**: Click **⚡ Connect Silo** and pick the HC-05 virtual COM port.
4. **Monitor**: Watch your molten chocolate level update live every 500ms!

---

## License

MIT
