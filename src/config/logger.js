const winston = require('winston');
const config = require('./env');

const { combine, timestamp, printf, colorize, json } = winston.format;

// Formato personalizado para logs no console em desenvolvimento
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
});

const transports = [
    // Em produção, não queremos logs coloridos no console, mas sim JSON estruturado.
    new winston.transports.Console({
        format: config.isDevelopment
            ? combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat)
            : combine(timestamp(), json()),
    }),
];

// Em produção, adicionamos transports para guardar logs em ficheiros.
if (!config.isDevelopment) {
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error', // Apenas erros neste ficheiro
            format: combine(timestamp(), json()),
        }),
        new winxston.transports.File({
            filename: 'logs/combined.log', // Todos os logs a partir do nível 'info'
            format: combine(timestamp(), json()),
        })
    );
}

const logger = winston.createLogger({
    // Define o nível de log. Em dev, mostra tudo. Em prod, apenas 'info' e acima.
    level: config.isDevelopment ? 'debug' : 'info',
    format: combine(
        timestamp(),
        winston.format.errors({ stack: true }), // Garante que a stack trace seja logada
        json()
    ),
    transports,
    exitOnError: false, // Não termina a aplicação em caso de erro de log
});

module.exports = logger;