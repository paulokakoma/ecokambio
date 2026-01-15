const Sentry = require('@sentry/node');

const initSentry = () => {
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: 1.0,
        });
        console.log('Sentry Initialized');
    } else {
        console.log('Sentry Skipped (No DSN)');
    }
};

module.exports = { Sentry, initSentry };
