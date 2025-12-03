/**
 * Cookie Consent Manager
 * Handles the display of the cookie banner and conditional loading of analytics.
 */

const CookieConsent = {
    GA_MEASUREMENT_ID: 'G-GL04FWDNFV', // ID do Google Analytics

    init() {
        console.log('CookieConsent: init called');
        this.banner = document.getElementById('terms-banner');
        this.acceptBtn = document.getElementById('accept-terms-btn');
        this.rejectBtn = document.getElementById('reject-terms-btn');

        if (!this.banner || !this.acceptBtn || !this.rejectBtn) {
            console.warn('CookieConsent: Banner elements not found.');
            return;
        }

        this.bindEvents();
        this.checkConsent();
    },

    bindEvents() {
        this.acceptBtn.addEventListener('click', () => this.acceptCookies());
        this.rejectBtn.addEventListener('click', () => this.rejectCookies());
    },

    checkConsent() {
        const accepted = localStorage.getItem('termsAccepted');
        const rejected = localStorage.getItem('termsRejected');
        console.log('CookieConsent: checkConsent', { accepted, rejected });

        if (accepted === 'true') {
            this.loadAnalytics();
        } else if (rejected !== 'true') {
            this.showBanner();
        }
    },

    showBanner() {
        this.banner.classList.remove('hidden');
        // Pequeno delay para permitir a transição CSS
        setTimeout(() => {
            this.banner.classList.remove('translate-y-full');
        }, 100);
    },

    hideBanner() {
        this.banner.classList.add('translate-y-full');
        setTimeout(() => {
            this.banner.classList.add('hidden');
        }, 500);
    },

    acceptCookies() {
        localStorage.setItem('termsAccepted', 'true');
        localStorage.removeItem('termsRejected');
        this.hideBanner();
        this.loadAnalytics();
    },

    rejectCookies() {
        localStorage.setItem('termsRejected', 'true');
        localStorage.removeItem('termsAccepted');
        this.hideBanner();
    },

    loadAnalytics() {
        if (window.gtagLoaded) return;

        console.log('CookieConsent: Loading Google Analytics...');

        // Carrega o script do GTM/GA dinamicamente
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.GA_MEASUREMENT_ID}`;
        script.async = true;
        document.head.appendChild(script);

        // Inicializa o dataLayer
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', this.GA_MEASUREMENT_ID);

        window.gtagLoaded = true;
    }
};

// Expose to window for debugging
window.CookieConsent = CookieConsent;

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('CookieConsent: DOMContentLoaded');
        CookieConsent.init();
    });
} else {
    console.log('CookieConsent: DOM already loaded');
    CookieConsent.init();
}
