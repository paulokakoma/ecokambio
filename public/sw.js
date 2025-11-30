const CACHE_NAME = 'ecokambio-cache-v2';

// Lista de ficheiros essenciais para a aplicação funcionar offline.
const urlsToCache = [
  '/',
  '/index.html',
  '/about.html',
  '/visa.html',
  '/termos.html',
  '/privacidade.html',
  '/details.html',
  '/css/output.css',
  '/assets/main-logo.svg',
  '/assets/favicon.svg',
  '/assets/visa.png',
  '/assets/error-state.svg',
  '/assets/social-share-banner.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

// Evento 'install': é acionado quando o service worker é instalado.
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  self.skipWaiting(); // Força o novo service worker a tornar-se ativo imediatamente.

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache aberta. Adicionando ficheiros essenciais.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'activate': é acionado quando o service worker é ativado.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativado.');
  // Limpa caches antigas que não correspondem ao CACHE_NAME atual.
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] A limpar cache antiga:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Controla as páginas imediatamente
  );
});

// Evento 'fetch': é acionado para cada pedido de rede feito pela página.
self.addEventListener('fetch', event => {
  // Estratégia "Network First" para navegação (HTML)
  // Garante que o utilizador vê sempre a versão mais recente da página
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Estratégia "Cache First" para recursos estáticos (CSS, JS, Imagens)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});