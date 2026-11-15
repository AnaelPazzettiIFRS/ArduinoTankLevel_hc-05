package com.chocotank.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int PERMISSION_REQUEST_CODE = 101;

    private WebView webView;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket bluetoothSocket;
    private Thread readThread;
    private volatile boolean isConnected = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        // Carrega o painel ChocoTank local
        webView.loadUrl("file:///android_asset/index.html");
    }

    private boolean checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                        Manifest.permission.BLUETOOTH_CONNECT,
                        Manifest.permission.BLUETOOTH_SCAN
                }, PERMISSION_REQUEST_CODE);
                return false;
            }
        }
        return true;
    }

    private void showDevicePicker() {
        if (bluetoothAdapter == null) {
            Toast.makeText(this, "Dispositivo não possui Bluetooth!", Toast.LENGTH_LONG).show();
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            Toast.makeText(this, "Por favor, ative o Bluetooth do celular primeiro!", Toast.LENGTH_LONG).show();
            return;
        }

        if (!checkPermissions()) {
            return;
        }

        Set<BluetoothDevice> pairedDevices;
        try {
            pairedDevices = bluetoothAdapter.getBondedDevices();
        } catch (SecurityException e) {
            Toast.makeText(this, "Permissão Bluetooth negada!", Toast.LENGTH_SHORT).show();
            return;
        }

        if (pairedDevices == null || pairedDevices.isEmpty()) {
            new AlertDialog.Builder(this)
                    .setTitle("Nenhum Dispositivo Pareado")
                    .setMessage("Você precisa parear o HC-05 nas configurações de Bluetooth do Android antes de conectar (PIN padrão: 1234).")
                    .setPositiveButton("OK", null)
                    .show();
            return;
        }

        final List<BluetoothDevice> deviceList = new ArrayList<>(pairedDevices);
        String[] deviceNames = new String[deviceList.size()];
        int defaultSelection = 0;

        for (int i = 0; i < deviceList.size(); i++) {
            BluetoothDevice dev = deviceList.get(i);
            String name = "Desconhecido";
            try {
                name = dev.getName();
            } catch (SecurityException ignored) {}
            if (name == null || name.isEmpty()) name = "Dispositivo sem nome";
            deviceNames[i] = name + "\n" + dev.getAddress();

            if (name.toUpperCase().contains("HC-05") || name.toUpperCase().contains("HC-06")) {
                defaultSelection = i;
            }
        }

        new AlertDialog.Builder(this)
                .setTitle("Selecione o Módulo Bluetooth (HC-05)")
                .setSingleChoiceItems(deviceNames, defaultSelection, null)
                .setPositiveButton("Conectar", (dialog, which) -> {
                    int selectedPos = ((AlertDialog) dialog).getListView().getCheckedItemPosition();
                    if (selectedPos >= 0 && selectedPos < deviceList.size()) {
                        connectToDevice(deviceList.get(selectedPos));
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void connectToDevice(BluetoothDevice device) {
        disconnectBluetooth();

        Toast.makeText(this, "Conectando ao " + device.getName() + "...", Toast.LENGTH_SHORT).show();

        new Thread(() -> {
            try {
                try {
                    bluetoothAdapter.cancelDiscovery();
                } catch (SecurityException ignored) {}

                bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                bluetoothSocket.connect();
                isConnected = true;

                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Conectado com sucesso!", Toast.LENGTH_SHORT).show();
                    webView.evaluateJavascript("window.handleAndroidBluetoothStatus(true);", null);
                });

                startReading();

            } catch (Exception e) {
                disconnectBluetooth();
                final String err = e.getMessage();
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Falha na conexão: " + err, Toast.LENGTH_LONG).show();
                    webView.evaluateJavascript("window.handleAndroidBluetoothStatus(false, 'Falha ao conectar: " + err + "');", null);
                });
            }
        }).start();
    }

    private void startReading() {
        readThread = new Thread(() -> {
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(bluetoothSocket.getInputStream()));
                while (isConnected && bluetoothSocket != null && bluetoothSocket.isConnected()) {
                    String line = reader.readLine();
                    if (line != null) {
                        final String clean = line.trim();
                        if (!clean.isEmpty()) {
                            runOnUiThread(() -> webView.evaluateJavascript("window.handleAndroidBluetoothData('" + clean + "');", null));
                        }
                    }
                }
            } catch (Exception e) {
                if (isConnected) {
                    disconnectBluetooth();
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Conexão perdida com o sensor!", Toast.LENGTH_SHORT).show();
                        webView.evaluateJavascript("window.handleAndroidBluetoothStatus(false, 'Conexão Bluetooth perdida.');", null);
                    });
                }
            }
        });
        readThread.start();
    }

    private void disconnectBluetooth() {
        isConnected = false;
        try {
            if (readThread != null) {
                readThread.interrupt();
                readThread = null;
            }
            if (bluetoothSocket != null) {
                bluetoothSocket.close();
                bluetoothSocket = null;
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        disconnectBluetooth();
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void connect() {
            runOnUiThread(() -> showDevicePicker());
        }

        @JavascriptInterface
        public void disconnect() {
            disconnectBluetooth();
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Silo desconectado.", Toast.LENGTH_SHORT).show();
                webView.evaluateJavascript("window.handleAndroidBluetoothStatus(false);", null);
            });
        }

        @JavascriptInterface
        public boolean isAndroidApp() {
            return true;
        }
    }
}
