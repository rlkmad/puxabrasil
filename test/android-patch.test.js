import test from 'node:test';
import assert from 'node:assert/strict';
import { patchManifest, patchBuildGradle } from '../scripts/lib/android-patch.js';

const MANIFESTO = `<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/AppTheme">

        <activity android:name=".MainActivity" android:exported="true">
        </activity>
    </application>

    <!-- Permissions -->

    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;

test('manifesto: acrescenta permissões, rede e serviço (specialUse)', () => {
  const m = patchManifest(MANIFESTO);
  for (const p of ['ACCESS_NETWORK_STATE', 'FOREGROUND_SERVICE"', 'FOREGROUND_SERVICE_SPECIAL_USE', 'POST_NOTIFICATIONS', 'WAKE_LOCK']) assert.ok(m.includes(p), p);
  assert.ok(m.includes('android:networkSecurityConfig="@xml/network_security_config"'));
  assert.ok(m.includes('android:name=".PuxaService"'));
  assert.ok(m.includes('android:foregroundServiceType="specialUse"'));
  assert.equal(m.match(/permission\.INTERNET/g).length, 1, 'não duplica permissão existente');
});

test('manifesto: rodar duas vezes não duplica nada', () => {
  const uma = patchManifest(MANIFESTO);
  assert.equal(patchManifest(uma), uma);
});

test('manifesto: só as permissões listadas no prompt (sem câmera, microfone, localização)', () => {
  const m = patchManifest(MANIFESTO);
  for (const proibida of ['CAMERA', 'RECORD_AUDIO', 'LOCATION', 'STORAGE', 'REQUEST_IGNORE_BATTERY']) assert.ok(!m.includes(proibida), proibida);
});

test('manifesto sem </application> falha com mensagem clara', () => {
  assert.throws(() => patchManifest('<manifest></manifest>'), /sem <\/application>/);
});

test('build.gradle: aplica assinatura fixa uma vez e ajusta versionCode', () => {
  const g = `android {\n    defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n}\n`;
  const a = patchBuildGradle(g, { versionCode: 7 });
  assert.match(a, /versionCode 7/);
  assert.equal(a.match(/puxa-signing\.gradle/g).length, 1);
  assert.equal(patchBuildGradle(a, { versionCode: 7 }), a);
  assert.match(patchBuildGradle(g.replace('versionCode 1', 'versionCode = 1'), { versionCode: 9 }), /versionCode 9/);
  assert.throws(() => patchBuildGradle('android {}', { versionCode: 1 }), /versionCode/);
});
