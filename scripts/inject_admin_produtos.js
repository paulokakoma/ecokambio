const fs = require('fs');
const path = require('path');

const adminHtmlPath = path.join(__dirname, '../private/admin.html');
let content = fs.readFileSync(adminHtmlPath, 'utf8');

// 1. Inject Sidebar Link
const sidebarLinkRegex = /<a href="#cartao_visa" class="sidebar-link/;
if (content.match(sidebarLinkRegex) && !content.includes('href="#produtos"')) {
    const linkHTML = `
            <a href="#produtos" class="sidebar-link flex items-center space-x-3 px-4 py-3 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                </svg>
                <span>Produtos</span>
            </a>
`;
    content = content.replace(sidebarLinkRegex, linkHTML + '            <a href="#cartao_visa" class="sidebar-link');
    console.log('Sidebar link injetado.');
}

// 2. Inject Section
const sectionRegex = /<section id="configuracoes"/;
if (content.match(sectionRegex) && !content.includes('id="produtos"')) {
    const listHTML = `
            <!-- Produtos Section -->
            <section id="produtos" class="admin-section hidden">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 class="text-3xl font-bold text-slate-800">Gerir Produtos</h2>
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
                        <button id="add-product-btn" class="btn-primary flex-shrink-0">Adicionar Produto</button>
                    </div>
                </div>
                <div class="admin-table">
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[800px]">
                            <thead>
                                <tr>
                                    <th scope="col" class="text-left">PRODUTO</th>
                                    <th scope="col" class="text-left">CATEGORIA</th>
                                    <th scope="col" class="text-left">PREÇO</th>
                                    <th scope="col" class="text-left">PREÇO ANTIGO</th>
                                    <th scope="col">STATUS</th>
                                    <th scope="col" class="text-center">AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody id="products-table-body">
                                <tr class="h-48">
                                    <td colspan="6" class="text-center">
                                        <div class="loader mx-auto"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
`;
    content = content.replace(sectionRegex, listHTML + '            <section id="configuracoes"');
    console.log('Section de produtos injetada.');
}

// 3. Inject Modal
const modalContainerRegex = /<div id="delete-confirm-modal"/;
if (content.match(modalContainerRegex) && !content.includes('id="product-modal"')) {
    const modalHTML = `
        <!-- Product Modal -->
        <div id="product-modal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="modal-overlay absolute inset-0 bg-slate-900/60 backdrop-blur-sm opacity-0 transition-opacity"></div>
            <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div class="modal-content relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                        <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 class="text-lg font-bold text-slate-900" id="product-modal-title">Novo Produto</h3>
                            <button type="button" class="close-product-modal text-slate-400 hover:text-slate-600 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form id="product-form" class="px-6 py-6 pb-8">
                            <input type="hidden" id="product_id" name="id">
                            <div class="space-y-5">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label for="product_name" class="block text-sm font-semibold text-slate-700 mb-1">Nome do Produto</label>
                                        <input type="text" id="product_name" name="name" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                    </div>
                                    <div>
                                        <label for="product_category" class="block text-sm font-semibold text-slate-700 mb-1">Categoria</label>
                                        <select id="product_category" name="category" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                            <option value="Telemóveis">Telemóveis</option>
                                            <option value="Computadores">Computadores</option>
                                            <option value="Eletrónicos">Eletrónicos</option>
                                            <option value="Televisores">Televisores</option>
                                            <option value="Eletrodomesticos">Eletrodomésticos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label for="product_price" class="block text-sm font-semibold text-slate-700 mb-1">Preço Atual (String formatada)</label>
                                        <input type="text" id="product_price" name="price" placeholder="Ex: 1.150.000,00 Kz" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                    </div>
                                    <div>
                                        <label for="product_old_price" class="block text-sm font-semibold text-slate-700 mb-1">Preço Antigo (String formatada)</label>
                                        <input type="text" id="product_old_price" name="old_price" placeholder="Ex: 1.300.000,00 Kz" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition">
                                    </div>
                                </div>
                                
                                <div>
                                    <label for="product_slug" class="block text-sm font-semibold text-slate-700 mb-1">ID Mnemónica (Slug)</label>
                                    <input type="text" id="product_slug" name="slug" placeholder="galaxy-s24" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm">
                                    <p class="text-xs text-slate-500 mt-1">Usado no URL. Deixe em branco para gerar automaticamente.</p>
                                </div>

                                <div>
                                    <label for="product_description" class="block text-sm font-semibold text-slate-700 mb-1">Descrição</label>
                                    <textarea id="product_description" name="description" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"></textarea>
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-slate-700 mb-1">Imagem do Produto (WebP/PNG/JPG)</label>
                                    <div class="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-500 transition-colors bg-slate-50">
                                        <div class="space-y-1 text-center">
                                            <div id="product_image_preview" class="hidden mb-4 rounded-xl overflow-hidden shadow-sm mx-auto min-h-[150px] bg-slate-100 flex items-center justify-center p-2">
                                                <img src="" alt="Nova Imagem" class="max-h-40 object-contain mix-blend-multiply">
                                            </div>
                                            <svg class="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                            <div class="flex text-sm text-slate-600 justify-center">
                                                <label for="product_image" class="relative cursor-pointer rounded-md font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500">
                                                    <span>Enviar um ficheiro</span>
                                                    <input id="product_image" name="product_image" type="file" class="sr-only" accept="image/*">
                                                </label>
                                                <p class="pl-1">ou arraste e solte</p>
                                            </div>
                                            <p class="text-xs text-slate-500">Imagem com fundo transparente recomendado (Max 5MB)</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="product_is_active" name="is_active" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                    <span class="text-sm font-medium text-slate-700">Produto Ativo (Visível no site)</span>
                                </div>
                            </div>
                            <div class="mt-8 flex justify-end space-x-3">
                                <button type="button" class="close-product-modal px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors">Cancelar</button>
                                <button type="submit" id="save-product-btn" class="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm flex items-center space-x-2">
                                    <span>Guardar Produto</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
`;
    content = content.replace(modalContainerRegex, modalHTML + '        <div id="delete-confirm-modal"');
    console.log('Modal de produtos injetado.');
}

// 4. Inject JS calls
const scriptBlockRegex = /loadDashboardData\(\),\s*loadRecentActivity\(\),/;
if (content.match(scriptBlockRegex) && !content.includes('loadProducts()')) {
    content = content.replace(scriptBlockRegex, 'loadDashboardData(),\n                loadRecentActivity(),\n                loadProducts(),');
    console.log('loadProducts adicionado a loadAllData()');
}

fs.writeFileSync(adminHtmlPath, content, 'utf8');
console.log('Sucesso!');
