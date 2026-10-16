package br.puxabrasil.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

/** Ponte nativa exposta às páginas do app como window.PuxaNativo (só páginas em 127.0.0.1/localhost). */
public class PuxaBridge {
    /** Verdadeiro enquanto a tela do jogo está aberta em Modo Live (o botão Voltar pede confirmação). */
    static volatile boolean emLive = false;

    private final Activity atividade;

    PuxaBridge(Activity atividade) {
        this.atividade = atividade;
    }

    @JavascriptInterface
    public String info() {
        try {
            JSONObject o = new JSONObject();
            o.put("fabricante", Build.MANUFACTURER);
            o.put("modelo", Build.MODEL);
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("servico", PuxaService.rodando ? "ativo" : "parado");
            Context c = atividade.getApplicationContext();
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            o.put("notificacoes", nm == null || nm.areNotificationsEnabled());
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            o.put("ignorandoBateria", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
            if (Build.VERSION.SDK_INT >= 26) {
                android.content.pm.PackageInfo wv = WebView.getCurrentWebViewPackage();
                o.put("webview", wv == null ? "desconhecido" : wv.packageName + " " + wv.versionName);
            }
            return o.toString();
        } catch (Exception e) {
            return "{\"erro\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
        }
    }

    /** Abre a tela do Android para tirar o app da otimização de bateria (sem permissão extra). */
    @JavascriptInterface
    public void abrirAjusteBateria() {
        Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            atividade.startActivity(i);
        } catch (Exception e) {
            Intent geral = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + atividade.getPackageName()));
            geral.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            atividade.startActivity(geral);
        }
    }

    /** Liga/desliga o Modo Live: tela cheia imersiva, tela sempre acesa e fundo também sob o recorte (notch). */
    @JavascriptInterface
    public void modoLive(final boolean ligar) {
        emLive = ligar;
        atividade.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                aplicarModoLive(atividade, ligar);
            }
        });
    }

    /** Também chamado pela MainActivity quando a janela volta a ter foco (o Android pode reexibir as barras). */
    static void aplicarModoLive(Activity a, boolean ligar) {
        try {
            Window w = a.getWindow();
            if (ligar) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

            if (Build.VERSION.SDK_INT >= 28) {
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.layoutInDisplayCutoutMode = ligar
                        ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                        : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
                w.setAttributes(lp);
            }
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController c = w.getInsetsController();
                if (c != null) {
                    if (ligar) {
                        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        c.hide(WindowInsets.Type.systemBars());
                    } else {
                        c.show(WindowInsets.Type.systemBars());
                    }
                }
            } else {
                View d = w.getDecorView();
                if (ligar) {
                    d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                } else {
                    d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                }
            }
        } catch (Exception ignorado) {
            // o jogo continua funcionando mesmo que o aparelho recuse algum ajuste de tela
        }
    }
}
