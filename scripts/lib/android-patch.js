// Ajustes de texto nos arquivos que o Capacitor gera em android/. Todos são idempotentes
// (rodar duas vezes não duplica nada).

const PERMISSOES = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.WAKE_LOCK',
];

const SERVICO = `        <service
            android:name=".PuxaService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Mantém o servidor local do jogo e a conexão com a live funcionando com o app em segundo plano" />
        </service>
`;

export function patchManifest(xml) {
  let saida = xml;

  // permissões que faltam
  const faltando = PERMISSOES.filter((p) => !saida.includes(`android:name="${p}"`));
  if (faltando.length) {
    const linhas = faltando.map((p) => `    <uses-permission android:name="${p}" />`).join('\n');
    saida = saida.replace('</manifest>', `\n${linhas}\n</manifest>`);
  }

  // configuração de segurança de rede (tráfego sem criptografia só para 127.0.0.1/localhost)
  if (!saida.includes('android:networkSecurityConfig')) {
    saida = saida.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"');
  }

  // serviço em primeiro plano
  if (!saida.includes('.PuxaService')) {
    if (!saida.includes('</application>')) throw new Error('AndroidManifest.xml sem </application>: formato inesperado.');
    saida = saida.replace('</application>', `\n${SERVICO}    </application>`);
  }
  return saida;
}

/** Garante a linha que aplica a assinatura fixa no fim do build.gradle do app. */
export function patchBuildGradle(texto, { versionCode } = {}) {
  let saida = texto;
  if (!saida.includes("apply from: 'puxa-signing.gradle'")) {
    saida = saida.replace(/\s*$/, '\n') + "\napply from: 'puxa-signing.gradle'\n";
  }
  if (versionCode !== undefined) {
    const re = /versionCode\s*=?\s*\d+/;
    if (!re.test(saida)) throw new Error('Não achei versionCode no build.gradle do app.');
    saida = saida.replace(re, `versionCode ${Number(versionCode)}`);
  }
  return saida;
}
