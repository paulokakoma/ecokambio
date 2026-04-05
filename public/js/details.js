        let dbClient;
        function formatCurrency(value, currency = 'AOA') {
            if (typeof value !== 'number') return 'N/A';
            return new Intl.NumberFormat('pt-AO', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 20 }).format(value);
        }

        function renderProductDetails(data) {
            const container = document.getElementById('details-container');
            if (!data || !data.product) {
                container.innerHTML = `<div class="text-center p-8 bg-red-50 text-red-700 rounded-2xl"><h3 class="font-bold text-lg">Erro ao Carregar Produto</h3><p>O produto que procura não foi encontrado ou não está mais disponível.</p><a href="/" class="btn-primary mt-6">Voltar à Página Inicial</a></div>`;
                return;
            }

            const { product, total_cost_aoa } = data;
            const totalCostUSD = (product.price || 0) + (product.shipping_cost_usd || 0);

            document.title = `${product.title} - EcoKambio`;

            container.innerHTML = `
                 <div class="mb-8">
                    <a href="/" class="text-sm text-slate-600 hover:text-emerald-600 font-semibold">‹ Voltar para o Mercado</a>
                </div>
                <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <!-- Grid responsivo: 1 coluna em mobile, 2 em telas médias e maiores. O espaçamento aumenta em telas largas. -->
                    <div class="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 lg:gap-x-12">
                        <!-- Imagem do Produto: padding responsivo -->
                        <div class="p-4 sm:p-6 flex items-center justify-center">
                            <img src="${product.image_url || '/assets/error-state.svg'}" alt="${product.title}" class="w-full h-auto object-contain rounded-xl" onerror="this.onerror=null; this.src='/assets/error-state.svg'; this.classList.add('p-8', 'bg-slate-100');">
                        </div>

                        <!-- Detalhes, Custos e Ação: padding responsivo -->
                        <div class="p-4 sm:p-6 lg:p-8 bg-slate-50 flex flex-col">
                            <h1 class="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4">${product.title}</h1>
                            
                            <div class="space-y-6 my-8">
                                <div class="flex justify-between items-baseline">
                                    <span class="text-slate-500">Custo do Produto:</span>
                                    <span class="font-bold text-lg text-slate-700">${formatCurrency(product.price, 'USD')}</span>
                                </div>
                                <div class="flex justify-between items-baseline">
                                    <span class="text-slate-500">Frete e Importação:</span>
                                    <span class="font-bold text-lg text-slate-700">${formatCurrency(product.shipping_cost_usd, 'USD')}</span>
                                </div>
                                <div class="flex justify-between items-baseline border-t pt-4">
                                    <span class="font-bold text-slate-600">Custo Total (USD):</span>
                                    <span class="font-bold text-2xl text-slate-800">${formatCurrency(totalCostUSD, 'USD')}</span>
                                </div>
                            </div>

                            <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center mt-auto">
                                <p class="font-semibold text-emerald-800">Custo Total Estimado em Kwanzas</p>
                                <p class="text-4xl font-extrabold text-emerald-600 my-2">${formatCurrency(total_cost_aoa, 'AOA')}</p>
                                <p class="text-xs text-emerald-500">Taxa de conversão do mercado informal utilizada.</p>
                            </div>

                            <a href="${product.url}" target="_blank" rel="noopener sponsored" id="buy-button" class="btn-primary w-full mt-8">
                                Comprar Agora
                            </a>
                        </div>
                    </div>
                </div>

                <!-- SECÇÃO PERSUASIVA -->
                <div class="mt-12 bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                    <h2 class="text-2xl font-bold text-slate-800 mb-6">Precisa de Ajuda?</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <!-- Coluna de Vídeos/Tutoriais -->
                        <div class="space-y-4">
                            ${product.tutorial_video_url ? `
                            <a href="${product.tutorial_video_url}" target="_blank" rel="noopener" class="flex items-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                                <svg class="w-8 h-8 text-emerald-600 mr-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <!-- Largura do texto controlada para melhor leitura em telas largas -->
                                <div class="max-w-prose">
                                    <p class="font-semibold text-slate-800">Tem dificuldades em efetuar a compra?</p>
                                    <p class="text-sm text-slate-500">Não se preocupe, veja o nosso vídeo tutorial passo a passo.</p>
                                </div>
                            </a>` : ''}
                            
                            ${product.proof_video_url ? `
                            <a href="${product.proof_video_url}" target="_blank" rel="noopener" class="flex items-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                                <svg class="w-8 h-8 text-emerald-600 mr-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <!-- Largura do texto controlada para melhor leitura em telas largas -->
                                <div class="max-w-prose">
                                    <p class="font-semibold text-slate-800">Tem dúvidas se receberá o produto?</p>
                                    <p class="text-sm text-slate-500">Veja a prova! Nós já compramos e recebemos o nosso.</p>
                                </div>
                            </a>` : ''}
                        </div>

                        <!-- Coluna de Contacto e Redes Sociais -->
                        <div class="space-y-4 flex flex-col justify-center">
                             <h3 class="font-bold text-slate-700 text-lg">Siga-nos ou Fale Connosco</h3>
                             <p class="text-sm text-slate-500 max-w-prose">Estamos aqui para ajudar e partilhar as melhores dicas de compras online.</p>
                            <div class="flex space-x-6 pt-2 items-center" id="social-links-container">
                                <!-- Icons will be rendered here by JS -->
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#buy-button').addEventListener('click', () => {
                const logDetails = { link_id: product.id, product_title: product.title };
                console.log(`[WebSocket] Clique no botão "Comprar Agora". Enviando dados...`, logDetails);
                window.logActivity('buy_now_click', logDetails);
                gtag('event', 'begin_checkout', {
                    currency: "USD",
                    value: totalCostUSD,
                    items: [{ item_id: product.id, item_name: product.title, price: product.price }]
                });
            });

            // Render social media icons
            renderSocialLinks(product);
        }

        function renderSocialLinks(product) {
            const socialContainer = document.getElementById('social-links-container');
            if (!socialContainer) return;

            const socialLinks = product.social_media_links || {};
            const socialIcons = {
                whatsapp: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1024px-WhatsApp.svg.png?20220228223904',
                instagram: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png',
                facebook: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Facebook_f_logo_%282019%29.svg/1024px-Facebook_f_logo_%282019%29.svg.png',
                tiktok: 'https://cdn4.iconfinder.com/data/icons/social-media-flat-7/64/Social-media_Tiktok-1024.png',
                youtube: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1024px-YouTube_full-color_icon_%282017%29.svg.png'
            };

            Object.keys(socialIcons).forEach(key => {
                if (socialLinks[key]) {
                    socialContainer.innerHTML += `<a href="${socialLinks[key]}" target="_blank" class="transition-transform hover:scale-110" title="${key.charAt(0).toUpperCase() + key.slice(1)}"><img src="${socialIcons[key]}" class="w-8 h-8"></a>`;
                }
            });
        }

        async function loadFooterInfo() {
            try {
                const { data, error } = await dbClient // eslint-disable-line
                    .from('site_settings')
                    .select('key, value')
                    .in('key', ['contact_email', 'contact_phone', 'social_media_links']);

                if (error) throw error;

                const settings = data.reduce((acc, { key, value }) => {
                    try {
                        acc[key] = JSON.parse(value);
                    } catch (e) {
                        acc[key] = value;
                    }
                    return acc;
                }, {});

                // Renderiza os ícones de redes sociais globais na seção "Siga-nos"
                const socialContainer = document.getElementById('social-links-container');
                if (socialContainer && settings.social_media_links) {
                    const socialIcons = {
                        whatsapp: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1024px-WhatsApp.svg.png?20220228223904',
                        instagram: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png',
                        facebook: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Facebook_f_logo_%282019%29.svg/1024px-Facebook_f_logo_%282019%29.svg.png',
                        tiktok: 'https://cdn4.iconfinder.com/data/icons/social-media-flat-7/64/Social-media_Tiktok-1024.png',
                        youtube: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1024px-YouTube_full-color_icon_%282017%29.svg.png'
                    };

                    socialContainer.innerHTML = ''; // Limpa ícones anteriores (do produto, se houver)

                    Object.keys(socialIcons).forEach(key => {
                        if (settings.social_media_links[key]) {
                            socialContainer.innerHTML += `<a href="${settings.social_media_links[key]}" target="_blank" class="transition-transform hover:scale-110" title="${key.charAt(0).toUpperCase() + key.slice(1)}"><img src="${socialIcons[key]}" class="w-8 h-8"></a>`;
                        }
                    });
                }


            } catch (error) {
                console.error("Erro ao carregar informações do rodapé:", error);
            }
        }

        async function main() {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id');

            if (!productId) {
                renderProductDetails(null);
                return;
            }

            try {
                const response = await fetch(`/api/affiliate-details/${productId}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Produto não encontrado.' }));
                    throw new Error(errorData.message);
                }
                const rawData = await response.json();
                renderProductDetails(rawData);
            } catch (error) {
                // O erro agora pode conter a mensagem específica do servidor (ex: 503)
                console.error("Erro ao carregar detalhes do produto:", error);
                renderProductDetails(null);
            }
        }



        document.addEventListener('DOMContentLoaded', async () => {
            try {
                const configResponse = await fetch('/api/config');
                if (!configResponse.ok) throw new Error('Falha ao carregar a configuração.');
                const config = await configResponse.json();
                dbClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
                await main();
                loadFooterInfo();

            } catch (error) {
                console.error('Erro ao carregar configuração:', error);
                // Mostra notificação de erro em vez de substituir a página inteira
                const container = document.getElementById('details-container');
                if (container) {
                    const notification = document.createElement('div');
                    notification.className = 'text-center p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl mx-4 my-4';
                    notification.innerHTML = `
                        <p class="font-bold text-sm">Erro de Carregamento</p>
                        <p class="text-xs mt-2">Não foi possível carregar os detalhes. Por favor, tente novamente mais tarde.</p>
                        <a href="/" class="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">
                            Voltar à Página Inicial
                        </a>
                    `;
                    container.innerHTML = '';
                    container.appendChild(notification);
                }
            }
        });
