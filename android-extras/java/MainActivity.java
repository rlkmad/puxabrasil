package br.puxabrasil.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.app.AlertDialog;
import android.content.DialogInterface;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PEDIDO_NOTIFICACAO = 4242;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Só páginas locais (127.0.0.1 / localhost) abrem dentro da WebView; o Capacitor manda o resto para o navegador.
        getBridge().getWebView().addJavascriptInterface(new PuxaBridge(this), "PuxaNativo");
        pedirPermissaoDeNotificacao();
        iniciarServico();

        // No Modo Live o botão Voltar nunca sai direto: pede confirmação. Fora dele, segue o comportamento normal.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (PuxaBridge.emLive) {
                    confirmarSaidaDoModoLive();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    private void confirmarSaidaDoModoLive() {
        new AlertDialog.Builder(this)
                .setTitle("Sair do Modo Live?")
                .setMessage("A transmissão mostra esta tela. Sair agora esconde o jogo da live.")
                .setNegativeButton("Continuar no jogo", null)
                .setPositiveButton("Sair", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        PuxaBridge.emLive = false;
                        PuxaBridge.aplicarModoLive(MainActivity.this, false);
                        getBridge().getWebView().evaluateJavascript("location.href='/painel'", null);
                    }
                })
                .show();
    }

    @Override
    public void onWindowFocusChanged(boolean temFoco) {
        super.onWindowFocusChanged(temFoco);
        if (temFoco && PuxaBridge.emLive) PuxaBridge.aplicarModoLive(this, true);
    }

    private void pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PEDIDO_NOTIFICACAO);
        }
    }

    private void iniciarServico() {
        Intent i = new Intent(this, PuxaService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
        else startService(i);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PEDIDO_NOTIFICACAO) iniciarServico(); // reposta a notificação já com a permissão
    }
}
