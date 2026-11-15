# 🍫 ChocoTank™ — Monitor de Silo de Chocolate Derretido

Painel de telemetria em tempo real para monitoramento do nível de chocolate líquido em tanques de confeitarias industriais, utilizando um **sensor ultrassônico HC-SR04 no Arduino** e um **módulo Bluetooth HC-05**. Funciona 100% no navegador por meio da **Web Serial API** — sem necessidade de backend ou servidor externo.

🔗 **Acesse o Painel Online:** `https://AnaelPazzettiIFRS.github.io/ArduinoTankLevel_hc-05/`  
📱 **Baixar APK para Android (Conexão Direta HC-05):** [ChocoTank.apk](https://raw.githubusercontent.com/AnaelPazzettiIFRS/ArduinoTankLevel_hc-05/main/ChocoTank.apk)

---

## Arquitetura do Sistema

```
┌────────────────────┐     Bluetooth SPP (9600)    ┌────────────┐     Web Serial API     ┌────────────────────────┐
│  Arduino HC-SR04   │ ──────────────────────────► │   HC-05    │ ◄───────────────────── │  Painel ChocoTank™     │
│ Sensor Ultrassônico│   "25 cm\r\n" a cada 500ms  │  (pareado) │   Porta COM Virtual    │  (Chrome / Edge)       │
└────────────────────┘                             └────────────┘                        └────────────────────────┘
```

1. **Sensor Ultrassônico**: Fixado no topo do silo, envia pulsos sonoros em direção à superfície do chocolate derretido.
2. **Transmissão Sem Fio**: O Arduino calcula a distância em cm e envia as medições continuamente via Bluetooth através do HC-05.
3. **Painel de Controle**: O navegador (Chrome ou Edge) lê a porta serial virtual, calcula o nível útil e porcentagem de preenchimento do silo, exibe a animação do chocolate e aciona alarmes caso o nível fique perigosamente baixo.

---

## Funcionalidades

- 🍫 **Visualização Realista do Silo**: Animação de ondas viscosas, brilho superficial de chocolate derretido e mudança dinâmica de cor (Chocolate ao Leite → Caramelo de Alerta → Vermelho de Esgotamento Crítico).
- 📊 **Telemetria Completa**: Distância do sensor, altura do chocolate (cm), porcentagem do silo (%) e status do lote de produção.
- 📈 **Gráfico em Tempo Real**: Histórico contínuo dos últimos ~2 minutos com linhas de tolerância e calibração.
- 🚨 **Alarmes de Produção**: Avisos de nível baixo e alarme sonoro de emergência para evitar cavitação da bomba e entupimento de tubulações.
- 🔊 **Notificações Sonoras e no Navegador**: Alertas via Web Audio API e notificações nativas da área de trabalho.
- ⚙️ **Calibração do Tanque**: Permite configurar altura do silo, folga do sensor e limites percentuais de disparo (salvos no `localStorage`).
- 🚀 **Hospedagem no GitHub Pages**: Desenvolvido em HTML5, CSS3 e JavaScript puro, sem dependências externas.

---

## Ligações no Arduino

| Componente | Pino Arduino | Observações |
|---|---|---|
| HC-SR04 TRIG | D2 | Pulso ultrassônico (saída) |
| HC-SR04 ECHO | D3 | Retorno ultrassônico (entrada) |
| HC-05 RXD | D11 (TX) | Passar pelo divisor de tensão (1kΩ / 2kΩ) para proteger o pino de 3.3V do HC-05 |
| HC-05 TXD | D10 (RX) | Opcional (o Arduino apenas envia dados) |

---

## Como Conectar (Chrome / Edge)

1. **Parear o HC-05**: Acesse as configurações de Bluetooth do Windows e pareie com o **HC-05** (PIN `1234` ou `0000`). O Windows criará uma porta COM virtual.
2. **Abrir o Painel**: Acesse o link do GitHub Pages no Google Chrome ou Microsoft Edge.
3. **Conectar**: Clique no botão **⚡ Conectar Silo** e selecione a porta serial correspondente ao HC-05.
4. **Pronto!**: Os dados do silo serão atualizados na tela a cada 500 ms.

---

## Licença

MIT
