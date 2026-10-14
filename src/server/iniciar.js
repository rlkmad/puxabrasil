// Inicia o servidor. Usado pelo app (via main.js) e por "npm run dev".
import './polifills.js'; // tem de ser o primeiro import (cria o crypto global no Node 18)
import { iniciarServidor } from './index.js';
import { erro } from './log.js';

iniciarServidor().catch((e) => {
  erro('Servidor não conseguiu iniciar:', e);
  process.exitCode = 1;
});
