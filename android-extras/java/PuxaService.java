package br.puxabrasil.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Serviço em primeiro plano: notificação fixa "Puxa Brasil rodando".
 * Mantém o processo do app (e o Node embutido, que roda dentro dele) vivo com o app em segundo plano.
 * Tipo declarado: specialUse (não tem limite de tempo no Android 15, ao contrário de dataSync).
 */
public class PuxaService extends Service {
    static final String CANAL = "puxa_servico";
    static final int ID_NOTIFICACAO = 4001;
    static final long TRAVA_MAX_MS = 6L * 60 * 60 * 1000; // renovada a cada partida do serviço

    static volatile boolean rodando = false;
    private PowerManager.WakeLock trava;

    @Override
    public void onCreate() {
        super.onCreate();
        criarCanal();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = montarNotificacao();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(ID_NOTIFICACAO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(ID_NOTIFICACAO, n);
        }
        rodando = true;
        pegarTrava();
        return START_STICKY;
    }

    private void pegarTrava() {
        try {
            if (trava == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                trava = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PuxaBrasil::servico");
                trava.setReferenceCounted(false);
            }
            trava.acquire(TRAVA_MAX_MS);
        } catch (Exception ignorado) {
            // sem trava o app continua funcionando; o diagnóstico mostra o resto
        }
    }

    private void criarCanal() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel canal = new NotificationChannel(CANAL, "Puxa Brasil rodando", NotificationManager.IMPORTANCE_LOW);
            canal.setDescription("Mantém o jogo funcionando enquanto você usa outros apps.");
            canal.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(canal);
        }
    }

    private Notification montarNotificacao() {
        Intent abrir = new Intent(this, MainActivity.class);
        abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CANAL)
                : new Notification.Builder(this);
        return b.setContentTitle("Puxa Brasil rodando")
                .setContentText("Toque para abrir o app.")
                .setSmallIcon(R.drawable.ic_notificacao)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    @Override
    public void onDestroy() {
        rodando = false;
        try {
            if (trava != null && trava.isHeld()) trava.release();
        } catch (Exception ignorado) { }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
