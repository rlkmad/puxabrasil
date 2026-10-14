package br.puxabrasil.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

/** Ponte nativa exposta às páginas do app como window.PuxaNativo (só páginas em 127.0.0.1/localhost). */
public class PuxaBridge {
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
}
