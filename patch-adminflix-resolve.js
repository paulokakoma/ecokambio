const fs = require('fs');
const file = '/Users/av/Documents/Projetos/ecokambio-main/ecoflix/backend/public/adminflix.html';
let content = fs.readFileSync(file, 'utf8');

// Add the modal HTML before the profileModal
const modalHtml = `
    <!-- MODAL RESOLVER PROBLEMA -->
    <div id="resolveIssueModal" class="fixed inset-0 modal-overlay hidden z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-95 opacity-0" id="resolveIssueModalContent">
            <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-lg font-bold text-gray-900">Resolver Problema</h3>
                <button onclick="closeResolveModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-6 space-y-4">
                <input type="hidden" id="resolveIssueId">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Mensagem para o Cliente (Opcional)</label>
                    <textarea id="resolveIssueMessage" rows="3" class="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-red-500 focus:border-red-500" placeholder="A sua nova senha é..."></textarea>
                    <p class="text-xs text-gray-500 mt-1">Se deixar em branco, o cliente receberá uma mensagem padrão informando que o problema foi resolvido.</p>
                </div>
            </div>
            <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button onclick="closeResolveModal()" class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition">Cancelar</button>
                <button onclick="submitResolveIssue()" id="resolveSubmitBtn" class="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition">Marcar como Resolvido</button>
            </div>
        </div>
    </div>
`;

content = content.replace('<!-- MODAL DE EDIÇÃO DE PERFIL -->', modalHtml + '\n    <!-- MODAL DE EDIÇÃO DE PERFIL -->');

// Replace the markIssueResolved function
const newFunction = `
        function markIssueResolved(id) {
            document.getElementById('resolveIssueId').value = id;
            document.getElementById('resolveIssueMessage').value = '';
            
            const modal = document.getElementById('resolveIssueModal');
            const content = document.getElementById('resolveIssueModalContent');
            modal.classList.remove('hidden');
            setTimeout(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function closeResolveModal() {
            const modal = document.getElementById('resolveIssueModal');
            const content = document.getElementById('resolveIssueModalContent');
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 200);
        }

        async function submitResolveIssue() {
            const id = document.getElementById('resolveIssueId').value;
            const message = document.getElementById('resolveIssueMessage').value;
            const btn = document.getElementById('resolveSubmitBtn');
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const { success } = await apiCall(\`/admin/issues/\${id}/resolve\`, 'POST', { message });
                if (success) {
                    showToast('Problema marcado como resolvido e SMS enviado!', 'success');
                    closeResolveModal();
                    loadIssues();
                } else {
                    showToast('Erro ao resolver problema', 'error');
                }
            } catch (e) {
                showToast('Erro ao resolver problema', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Marcar como Resolvido';
            }
        }
`;

// we need to replace the old markIssueResolved function
// Let's use regex
content = content.replace(/async function markIssueResolved\(id\) \{[\s\S]*?catch \(e\) \{[\s\S]*?\}[\s\S]*?\}/, newFunction);

fs.writeFileSync(file, content);
console.log('Frontend patched successfully');
