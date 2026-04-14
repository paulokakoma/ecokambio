const fs = require('fs');
const path = require('path');

const adminHtmlPath = path.join(__dirname, '../private/admin.html');
let content = fs.readFileSync(adminHtmlPath, 'utf8');

const jsCode = `
        // ==========================================
        // PRODUTOS SCRIPTS
        // ==========================================
        let productsData = [];

        async function loadProducts() {
            try {
                const response = await fetch('/api/products');
                if (!response.ok) throw new Error('Falha ao carregar produtos');
                productsData = await response.json();
                renderProductsTable();
            } catch (error) {
                console.error(error);
                document.getElementById('products-table-body').innerHTML = \`<tr><td colspan="6" class="text-center py-8 text-red-500">Erro ao carregar produtos.</td></tr>\`;
            }
        }

        function renderProductsTable() {
            const tbody = document.getElementById('products-table-body');
            if (productsData.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" class="text-center py-8 text-slate-500">Nenhum produto cadastrado.</td></tr>\`;
                return;
            }

            tbody.innerHTML = productsData.map(p => \`
                <tr>
                    <td>
                        <div class="flex items-center gap-3">
                            <img src="\${p.img_url || '/assets/ecokambio-favicon.png'}" class="w-10 h-10 rounded object-contain bg-slate-100" alt="Imagem">
                            <div>
                                <div class="font-bold text-slate-800">\${p.name}</div>
                                <div class="text-xs text-slate-500">\${p.slug}</div>
                            </div>
                        </div>
                    </td>
                    <td>\${p.category}</td>
                    <td class="font-mono text-emerald-600 font-bold">\${p.price}</td>
                    <td class="text-xs text-slate-400 line-through">\${p.old_price || '-'}</td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" onchange="updateProductStatus('\${p.id}', this.checked)" \${p.is_active ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="text-center space-x-2">
                        <button onclick="editProduct('\${p.id}')" class="text-blue-600 hover:text-blue-800 transition-colors" title="Editar">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="confirmDeleteProduct('\${p.id}')" class="text-red-500 hover:text-red-700 transition-colors" title="Eliminar">
                            <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            \`).join('');
        }

        // Abrir modal de novo produto
        document.getElementById('add-product-btn')?.addEventListener('click', () => {
            document.getElementById('product-form').reset();
            document.getElementById('product_id').value = '';
            document.getElementById('product-modal-title').textContent = 'Novo Produto';
            document.getElementById('product_image_preview').classList.add('hidden');
            document.getElementById('product-modal').classList.remove('hidden');
            setTimeout(() => {
                document.querySelector('#product-modal .modal-overlay').classList.add('opacity-100');
                document.querySelector('#product-modal .modal-content').classList.remove('opacity-0', 'translate-y-4', 'sm:scale-95');
            }, 10);
        });

        // Fechar modal de produto
        document.querySelectorAll('.close-product-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('#product-modal .modal-overlay').classList.remove('opacity-100');
                document.querySelector('#product-modal .modal-content').classList.add('opacity-0', 'translate-y-4', 'sm:scale-95');
                setTimeout(() => document.getElementById('product-modal').classList.add('hidden'), 300);
            });
        });

        // Prever imagem do produto ao selecionar
        document.getElementById('product_image')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('product_image_preview');
                    preview.querySelector('img').src = e.target.result;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        // Guardar Produto
        document.getElementById('product-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-product-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<div class="loader !w-5 !h-5 !border-[2px]"></div> Guardando...';
            btn.disabled = true;

            const form = e.target;
            const formData = new FormData(form);
            const id = formData.get('id');
            const url = id ? \`/api/products/\${id}\` : '/api/products';
            const method = id ? 'PUT' : 'POST';

            // Checkbox não envia 'false'
            if (!form.querySelector('#product_is_active').checked) {
                formData.set('is_active', 'false');
            } else {
                formData.set('is_active', 'true');
            }

            try {
                const response = await fetch(url, { method, body: formData });
                const result = await response.json();

                if (!response.ok) throw new Error(result.message || 'Erro ao guardar produto');

                typeof showToast === 'function' ? showToast('Produto guardado com sucesso.', 'success') : alert('Produto guardado com sucesso.');
                document.querySelector('.close-product-modal').click();
                loadProducts();
            } catch (error) {
                console.error(error);
                typeof showToast === 'function' ? showToast(error.message, 'error') : alert('Erro: ' + error.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

        function editProduct(id) {
            const p = productsData.find(prod => prod.id === id);
            if (!p) return;

            document.getElementById('product_id').value = p.id;
            document.getElementById('product_name').value = p.name;
            document.getElementById('product_category').value = p.category;
            document.getElementById('product_price').value = p.price;
            document.getElementById('product_old_price').value = p.old_price || '';
            document.getElementById('product_slug').value = p.slug;
            document.getElementById('product_description').value = p.description || '';
            document.getElementById('product_is_active').checked = p.is_active;

            if (p.img_url) {
                const preview = document.getElementById('product_image_preview');
                preview.querySelector('img').src = p.img_url;
                preview.classList.remove('hidden');
            } else {
                document.getElementById('product_image_preview').classList.add('hidden');
            }

            document.getElementById('product-modal-title').textContent = 'Editar Produto';
            document.getElementById('product-modal').classList.remove('hidden');
            setTimeout(() => {
                document.querySelector('#product-modal .modal-overlay').classList.add('opacity-100');
                document.querySelector('#product-modal .modal-content').classList.remove('opacity-0', 'translate-y-4', 'sm:scale-95');
            }, 10);
        }

        async function updateProductStatus(id, isActive) {
            try {
                const formData = new FormData();
                formData.append('is_active', isActive);
                
                const response = await fetch(\`/api/products/\${id}\`, { method: 'PUT', body: formData });
                if (!response.ok) throw new Error('Erro ao atualizar status');
                typeof showToast === 'function' && showToast('Status do produto atualizado.');
            } catch (error) {
                console.error(error);
                typeof showToast === 'function' ? showToast(error.message, 'error') : alert('Erro: ' + error.message);
                loadProducts(); // revert
            }
        }

        let productToDelete = null;
        function confirmDeleteProduct(id) {
            productToDelete = id;
            if (typeof showDeleteModal === 'function') {
                showDeleteModal('produto', () => {
                    deleteProduct(productToDelete);
                });
            } else {
                if (confirm('Deseja realmente apagar este produto?')) deleteProduct(id);
            }
        }

        async function deleteProduct(id) {
            try {
                const response = await fetch(\`/api/products/\${id}\`, { method: 'DELETE' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Erro ao apagar');
                
                typeof showToast === 'function' ? showToast('Produto apagado com sucesso.', 'success') : alert('Produto apagado com sucesso.');
                loadProducts();
            } catch (error) {
                console.error(error);
                typeof showToast === 'function' ? showToast(error.message, 'error') : alert('Erro: ' + error.message);
            }
        }
`;

if (!content.includes('function loadProducts()')) {
    content = content.replace(/<\/script>\s*<\/html>/, jsCode + '\n    </script>\n</html>');
    fs.writeFileSync(adminHtmlPath, content, 'utf8');
    console.log('Script JS injetado com sucesso.');
} else {
    console.log('Script JS já injetado.');
}
