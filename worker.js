/**
 * Ponto de Entrada do Worker (Trabalhador em Segundo Plano) do EcoFlix
 * Este ficheiro separa o processamento de filas (jobs assíncronos) do processo principal do Backend (HTTP/API).
 * Isto permite uma melhor escalabilidade, pois o envio de SMS ou provisionamento não bloqueia os pedidos do utilizador.
 */
require('dotenv').config();
const { startSmsWorker } = require('./src/netflix/services/sms_queue.service');
const { startFamilyPlanWorker } = require('./src/netflix/services/queue.service');

console.log('🚀 [Worker] A iniciar os Serviços em Segundo Plano do EcoFlix...');

// Iniciar o Worker que processa o envio de mensagens SMS
try {
    startSmsWorker();
    console.log('✅ [Worker] Trabalhador de Envio de SMS iniciado com sucesso.');
} catch (error) {
    console.error('❌ [Worker] Falha ao iniciar o Trabalhador de SMS:', error.message);
}

// Iniciar o Worker que processa a gestão e aprovação dos Planos Familiares (EcoFlix)
try {
    startFamilyPlanWorker();
    console.log('✅ [Worker] Trabalhador de Plano Familiar (Family Plan) iniciado com sucesso.');
} catch (error) {
    console.error('❌ [Worker] Falha ao iniciar o Trabalhador de Plano Familiar:', error.message);
}

// Encerramento limpo (Graceful shutdown)
// Aguarda ativamente o sinal (SIGTERM) do sistema operativo/Docker para parar processos antes de terminar.
process.on('SIGTERM', () => {
    console.log('🛑 [Worker] Sinal SIGTERM recebido. A encerrar de forma segura...');
    process.exit(0);
});
