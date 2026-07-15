const API_BASE = '/api/ecoflix';

// Estado da aplicação
let currentOrder = null;
let selectedPlanType = null;
let selectedPlanPrice = null;
let finalPrice = null;
let appliedCoupon = null;
let userPhone = null;
let pollingInterval = null;
let countdownInterval = null;

// === PERSISTÊNCIA DE SESSÃO (sessionStorage) ===
function saveSession() {
    sessionStorage.setItem('ecoflix_pending_order', JSON.stringify(currentOrder));
    sessionStorage.setItem('ecoflix_user_phone', userPhone || '');
    sessionStorage.setItem('ecoflix_selected_plan', selectedPlanType || '');
    sessionStorage.setItem('ecoflix_selected_price', String(selectedPlanPrice || ''));
}

function restoreSession() {
    const saved = sessionStorage.getItem('ecoflix_pending_order');
    if (!saved) return null;
    try {
        const order = JSON.parse(saved);
        userPhone = sessionStorage.getItem('ecoflix_user_phone') || null;
        selectedPlanType = sessionStorage.getItem('ecoflix_selected_plan') || null;
        selectedPlanPrice = parseFloat(sessionStorage.getItem('ecoflix_selected_price')) || null;
        return order;
    } catch { return null; }
}

function clearSession() {
    sessionStorage.removeItem('ecoflix_pending_order');
    sessionStorage.removeItem('ecoflix_user_phone');
    sessionStorage.removeItem('ecoflix_selected_plan');
    sessionStorage.removeItem('ecoflix_selected_price');
    checkoutPendingMethod = null;
    checkoutPendingCardElement = null;
}

function cancelCheckoutOtp() {
    checkoutPendingMethod = null;
    checkoutPendingCardElement = null;
    showScreen('step-catalog');
}

// === CHANGE DURATION ===
function changeDuration() {
    const duration = parseInt(document.getElementById('duration-select').value) || 1;
    let currentBase = selectedPlanPrice * duration;
    
    document.getElementById('summary-original-price').innerText = formatKz(currentBase);
    
    if (appliedCoupon) {
        applyCoupon(); 
    } else {
        finalPrice = currentBase;
        document.getElementById('summary-total-price').innerText = formatKz(finalPrice);
    }
}

async function resumePendingOrder(order) {
    currentOrder = order;
    const ref = (currentOrder.reference || currentOrder.transaction_id || '').toString().replace(/\s/g, '');
    if (ref) {
        try {
            const resp = await fetch(`${API_BASE}/orders/${ref}/status`);
            const data = await resp.json();
            if (data.success && data.status === 'PAID') {
                clearSession();
                showPaymentSuccess(data.credentials);
                return;
            }
            if (data.success && data.status !== 'PENDING') {
                clearSession();
                showScreen('step-catalog');
                showToast('O pedido anterior expirou ou foi cancelado.', 'info');
                return;
            }
        } catch {}
    }
    const isPush = currentOrder.payment_method === 'EXPRESS' || currentOrder.payment_method === 'MCX_PUSH';
    if (!isPush && currentOrder.reference) {
        const entity = currentOrder.entity || '00024';
        document.getElementById('ref-entity').innerText = /^\d{3,5}$/.test(entity) ? entity : '00024';
        document.getElementById('ref-display').innerText = currentOrder.reference;
        document.getElementById('pay-amount').innerText = formatKz(currentOrder.amount);
        showScreen('step-payment-ref');
        startPaymentPolling(currentOrder.reference);
    } else {
        showScreen('step-waiting-payment');
        startPaymentPolling(currentOrder.transaction_id || currentOrder.reference);
    }
}

// === NOTIFICAÇÕES (TOAST) ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icon}"></i><span class="toast-message">${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// === NAVEGAÇÃO E UX ===
const formatKz = (val) => val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";

function showScreen(screenId) {
    document.querySelectorAll('#app > div').forEach(div => div.classList.add('hidden'));
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');

    target.querySelectorAll('.stagger-card').forEach(card => {
        card.style.animation = 'none';
        void card.offsetWidth;
        card.style.animation = '';
    });

    if (window.innerWidth < 768) {
        target.classList.remove('screen-enter');
        void target.offsetWidth;
        target.classList.add('screen-enter');
    }

    window.scrollTo(0, 0);
    updateMobileHeader(screenId);

    if (screenId === 'step-dashboard') {
        sessionStorage.setItem('ecoflix_last_screen', screenId);
    } else {
        sessionStorage.removeItem('ecoflix_last_screen');
    }
    if (screenId === 'step-waiting-payment') {
        startPayTimer();
    } else {
        stopPayTimer();
    }
}

// === MOBILE HEADER LOGIC ===
const mobileScreenTitles = {
    'step-catalog': '',
    'step-checkout': 'O seu número',
    'step-payment-method': 'Pagamento',
    'step-checkout-otp': 'Verificar SMS',
    'step-waiting-payment': 'A aguardar...',
    'step-payment-ref': 'Referência',
    'step-success': 'Sucesso',
    'step-recover': 'Minha Conta',
    'step-login-otp': 'Verificar SMS',
    'step-dashboard': 'Minha Conta',
};

function updateMobileHeader(screenId) {
    const backBtn = document.getElementById('mobile-back-btn');
    const accountBtn = document.getElementById('mobile-account-btn');

    if (screenId === 'step-catalog') {
        backBtn.classList.remove('hidden');
        accountBtn.classList.remove('hidden');
        accountBtn.classList.add('flex');
    } else {
        backBtn.classList.remove('hidden');
        accountBtn.classList.add('hidden');
        accountBtn.classList.remove('flex');
        backBtn.style.visibility = (screenId === 'step-success' || screenId === 'step-recover' || screenId === 'step-dashboard') ? 'hidden' : 'visible';
    }
}

function toggleCouponSection(btn) {
    const body = btn.nextElementSibling;
    const icon = btn.querySelector('.coupon-icon');
    const isHidden = body.classList.contains('hidden');

    if (isHidden) {
        body.classList.remove('hidden');
        body.style.maxHeight = '0';
        body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
            body.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.opacity = '1';
        });
        icon.style.transform = 'rotate(45deg)';
    } else {
        body.style.maxHeight = '0';
        body.style.opacity = '0';
        setTimeout(() => body.classList.add('hidden'), 300);
        icon.style.transform = 'rotate(0deg)';
    }
}

function mobileBack() {
    const screens = document.querySelectorAll('#app > div:not(.hidden)');
    let currentId = '';
    screens.forEach(s => { if (!s.classList.contains('hidden')) currentId = s.id; });

    if (currentId === 'step-catalog') {
        window.location.href = '/';
    } else if (currentId === 'step-checkout' || currentId === 'step-recover' || currentId === 'step-login-otp' || currentId === 'step-dashboard') {
        goHome();
    } else if (currentId === 'step-payment-method') {
        showScreen('step-checkout');
    } else if (currentId === 'step-checkout-otp') {
        cancelCheckoutOtp();
    } else if (currentId === 'step-waiting-payment' || currentId === 'step-payment-ref') {
        cancelOrder();
    } else {
        goHome();
    }
}

window.addEventListener('resize', () => {
    const screens = document.querySelectorAll('#app > div:not(.hidden)');
    screens.forEach(s => { if (!s.classList.contains('hidden')) updateMobileHeader(s.id); });
});

let _payTimerInterval = null;

function startPayTimer() {
    stopPayTimer();
    const loadingState = document.getElementById('pay-loading-state');
    const successState = document.getElementById('pay-success-state');
    const bgGlow = document.getElementById('pay-bg-glow');
    if (loadingState) { loadingState.classList.remove('pay-fade-out'); loadingState.style.display = ''; }
    if (successState) { successState.classList.remove('pay-fade-in'); successState.classList.add('pay-hidden'); }
    if (bgGlow) bgGlow.style.background = '';

    let timeLeft = 300;
    const timerEl = document.getElementById('pay-timer');
    if (!timerEl) return;
    timerEl.innerText = '05:00';
    timerEl.className = 'text-sm font-bold text-red-500 tabular-nums';

    _payTimerInterval = setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
        if (timeLeft <= 60) timerEl.classList.add('animate-pulse');
        if (timeLeft <= 0) {
            stopPayTimer();
            timerEl.innerText = 'Expirado';
            cancelOrder();
        }
    }, 1000);
}

function stopPayTimer() {
    if (_payTimerInterval) { clearInterval(_payTimerInterval); _payTimerInterval = null; }
}

let planPrices = { ECONOMICO: 4500, ULTRA: 6500, FAMILIA: 18000 };

async function fetchPlanPrices() {
    try {
        const res = await fetch('/api/ecoflix/public/plans');
        const data = await res.json();
        if (data && data.success && data.data) {
            const fetchedPlans = data.data;
            planPrices = {
                ECONOMICO: fetchedPlans.ECONOMICO?.price || fetchedPlans.ECONOMICO || 4500,
                ULTRA: fetchedPlans.ULTRA?.price || fetchedPlans.ULTRA || 6500,
                FAMILIA: fetchedPlans.FAMILIA?.price || fetchedPlans.FAMILIA || 18000
            };
            
            document.getElementById('display-price-economico').innerText = formatKz(planPrices.ECONOMICO);
            document.getElementById('display-price-ultra').innerText = formatKz(planPrices.ULTRA);
            document.getElementById('display-price-familia').innerText = formatKz(planPrices.FAMILIA);

            const mEco = document.getElementById('mobile-price-economico');
            const mUlt = document.getElementById('mobile-price-ultra');
            const mFam = document.getElementById('mobile-price-familia');
            if (mEco) mEco.innerText = formatKz(planPrices.ECONOMICO);
            if (mUlt) mUlt.innerText = formatKz(planPrices.ULTRA);
            if (mFam) mFam.innerText = formatKz(planPrices.FAMILIA);
            
            document.getElementById('btn-economico').setAttribute('onclick', `selectPlan('ECONOMICO', ${planPrices.ECONOMICO})`);
            document.getElementById('btn-ultra').setAttribute('onclick', `selectPlan('ULTRA', ${planPrices.ULTRA})`);
            document.getElementById('btn-familia').setAttribute('onclick', `selectPlan('FAMILIA', ${planPrices.FAMILIA})`);
        }
    } catch (e) { console.error('Erro a carregar planos dinâmicos', e); }
}

fetchPlanPrices();

function selectPlan(planKey, price) {
    selectedPlanType = planKey;
    selectedPlanPrice = price || planPrices[planKey];

    let planTitle = '';
    if (planKey === 'ECONOMICO') planTitle = 'Pessoal Económico (4K)';
    else if (planKey === 'ULTRA') planTitle = 'Pessoal Ultra (4K)';
    else planTitle = 'Conta Família (4K)';

    document.getElementById('selected-plan-name').innerText = planTitle;
    document.getElementById('selected-plan-price').innerText = formatKz(selectedPlanPrice);
    showScreen('step-checkout');
}

function goBack(screenId) {
    if (pollingInterval) clearInterval(pollingInterval);
    showScreen(screenId);
}

function goHome(toSiteRoot = false) {
    isRenewal = false;
    targetSubscriptionId = null;
    if (toSiteRoot) {
        window.location.href = '/';
        return;
    }
    if (pollingInterval) clearInterval(pollingInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    currentOrder = null;
    userPhone = null;
    clearSession();
    showScreen('step-catalog');
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    if (value.length > 6) value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
    else if (value.length > 3) value = value.slice(0, 3) + ' ' + value.slice(3);
    input.value = value;
}

function copyToClip(text) {
    navigator.clipboard.writeText(text);
    const el = event.currentTarget || event.target;
    el.style.color = '#46d369';
    setTimeout(() => { el.style.color = ''; }, 1000);
}

function copyText(elementId) {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text);
    showToast('Copiado!', 'success');
}

function copyToClipRef() {
    const text = document.getElementById('ref-display').innerText.replace(/\s/g, '');
    copyToClip(text);
}

function toggleFaq(element) {
    const answer = element.lastElementChild;
    const iconContainer = element.querySelector('.w-8.h-8');
    const icon = iconContainer?.querySelector('i');
    
    answer.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-45');
    
    if (iconContainer) {
        iconContainer.classList.toggle('bg-[#E50914]');
        iconContainer.classList.toggle('bg-white/10');
    }
}

// === SUBMETER NÚMERO ===
async function submitPhone() {
    const inputPhone = document.getElementById('phone-input');
    const phoneClean = inputPhone.value.replace(/\D/g, '');

    if (phoneClean.length !== 9) {
        showToast('Por favor, insira um número válido (9 dígitos).', 'error');
        return;
    }

    userPhone = '+244' + phoneClean;

    finalPrice = selectedPlanPrice;
    document.getElementById('summary-plan-name').innerText = document.getElementById('selected-plan-name').innerText;
    document.getElementById('summary-original-price').innerText = formatKz(selectedPlanPrice);
    document.getElementById('summary-total-price').innerText = formatKz(finalPrice);

    showScreen('step-payment-method');
}

let checkoutPendingMethod = null;
let checkoutPendingCardElement = null;

// === PAGAMENTO ===
async function selectPaymentMethod(method, cardElement, skipOtp = false) {
    let originalContent = '';
    try {
        if (currentOrder) {
            const resume = confirm('Já existe um pedido pendente. Voltar a ele?');
            if (resume) {
                showToast('A restaurar o pedido anterior...', 'info');
                if (currentOrder.reference) {
                    showScreen('step-payment-ref');
                    startPaymentPolling(currentOrder.reference);
                } else {
                    showScreen('step-waiting-payment');
                    startPaymentPolling(currentOrder.transaction_id);
                }
                return;
            }
            clearSession();
            currentOrder = null;
        }

        if (method === 'EXPRESS') {
            showScreen('step-waiting-payment');
        } else if (cardElement) {
            originalContent = cardElement.innerHTML;
            cardElement.innerHTML = `<div class="flex items-center justify-center h-full w-full py-8 text-white"><i class="fas fa-spinner fa-spin text-4xl mb-2"></i><span class="ml-3 font-bold">A gerar referência...</span></div>`;
            cardElement.style.pointerEvents = 'none';
        } else {
            document.getElementById('global-loader').classList.remove('hidden');
            document.getElementById('global-loader').classList.add('flex');
        }

        const durationSelect = document.getElementById('duration-select');
        const duration = durationSelect ? durationSelect.value : 1;

        const requestData = {
            phone: userPhone,
            plan_type: selectedPlanType,
            payment_method: method,
            is_renewal: isRenewal,
            target_subscription_id: targetSubscriptionId,
            duration: duration
        };

        const hmacHeaders = await window.HMACSign.signRequest(requestData);

        const response = await fetch(`${API_BASE}/orders/quick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...hmacHeaders
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Erro ao criar pedido');

        currentOrder = result.data;
        saveSession();

        if (result.data.message && method !== 'EXPRESS') {
            showToast(result.data.message, 'info');
        }

        const isPush = currentOrder.payment_method === 'EXPRESS' || currentOrder.payment_method === 'MCX_PUSH';

        if (!isPush && currentOrder.reference) {
            const entity = currentOrder.entity || '00024';
            document.getElementById('ref-entity').innerText = /^\d{3,5}$/.test(entity) ? entity : '00024';
            document.getElementById('ref-display').innerText = currentOrder.reference;
            document.getElementById('pay-amount').innerText = formatKz(currentOrder.amount);
            showScreen('step-payment-ref');
            startPaymentPolling(currentOrder.reference);
        } else if (currentOrder.transaction_id || currentOrder.reference) {
            startPaymentPolling(currentOrder.transaction_id || currentOrder.reference);
        } else {
            showToast('Erro: dados do pedido incompletos.', 'error');
            showScreen('step-payment-method');
        }

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
        showScreen('step-payment-method');
    } finally {
        document.getElementById('global-loader').classList.add('hidden');
        document.getElementById('global-loader').classList.remove('flex');
        if (cardElement && originalContent) {
            cardElement.innerHTML = originalContent;
            cardElement.style.pointerEvents = 'auto';
        }
    }
}

// === COUPON LOGIC ===
async function applyCoupon() {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-message');
    const btn = document.getElementById('btn-apply-coupon');
    const code = input.value.trim().toUpperCase();

    if (!code) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    msg.className = 'text-xs mt-2 hidden';

    try {
        const data = { code };
        const hmacHeaders = await window.HMACSign.signRequest(data);

        const response = await fetch(`${API_BASE}/coupons/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...hmacHeaders
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        msg.classList.remove('hidden');
        if (result.success) {
            msg.classList.remove('text-red-500');
            msg.classList.add('text-[#46d369]');
            msg.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${result.data.message}`;

            appliedCoupon = result.data.code;
            input.classList.add('border-[#46d369]');

            if (result.data.discount > 0) {
                const durationSelect = document.getElementById('duration-select');
                const duration = durationSelect ? (parseInt(durationSelect.value) || 1) : 1;
                const currentBase = selectedPlanPrice * duration;

                const discount = parseFloat(result.data.discount);
                finalPrice = Math.max(0, currentBase - discount);
                updateSummary(finalPrice);
            }
        } else {
            msg.classList.remove('text-[#46d369]');
            msg.classList.add('text-red-500');
            msg.innerHTML = `<i class="fas fa-times-circle mr-1"></i> ${result.message}`;

            appliedCoupon = null;
            finalPrice = selectedPlanPrice;
            updateSummary(finalPrice);
            input.classList.remove('border-[#46d369]');
        }
    } catch (error) {
        console.error('Coupon error:', error);
        msg.innerText = 'Código de indicação inválido';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Aplicar';
    }
}

function updateSummary(price) {
    document.getElementById('summary-total-price').innerText = formatKz(price);
    document.getElementById('pay-amount').innerText = formatKz(price);
}

// ============================================================================
// REAL-TIME WEBSOCKETS (User)
// ============================================================================
let wsClient = null;

function initUserWebSocket() {
    if (wsClient && wsClient.readyState !== WebSocket.CLOSED) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?client=user`;
    wsClient = new WebSocket(wsUrl);

    wsClient.onopen = () => {
        const orderId = currentOrder && (currentOrder.order_id || currentOrder.id);
        if (orderId) {
            wsClient.send(JSON.stringify({ type: 'subscribe_order', order_id: orderId }));
        }
    };

    wsClient.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'stock_update') {
                fetchPlanPrices();
            }
            else if (data.type === 'payment_update' && currentOrder) {
                const txId = currentOrder.transaction_id || currentOrder.reference;
                const checkStatus = await fetch(`${API_BASE}/orders/${txId}/status`);
                const statusData = await checkStatus.json();
                
                if (statusData.success) {
                    if (statusData.status === 'PAID') {
                        clearSession();
                        if (statusData.token) {
                            localStorage.setItem('ecoflix_token', statusData.token);
                            loadDashboard();
                            showToast('Pagamento confirmado!', 'success');
                        } else {
                            showPaymentSuccess(statusData.credentials);
                        }
                    } else if (statusData.status === 'STOCK_OUT') {
                        clearSession();
                        showScreen('step-catalog');
                        showToast('Pagamento recebido, mas estamos sem stock!', 'error');
                    } else if (['FAILED', 'CANCELED', 'CANCELLED'].includes(statusData.status)) {
                        clearSession();
                        showScreen('step-catalog');
                        showToast('Pagamento falhou ou foi cancelado.', 'error');
                    }
                }
            }
        } catch (e) {
            console.error('WS Error:', e);
        }
    };

    wsClient.onclose = () => {
        setTimeout(initUserWebSocket, 5000);
    };
}

initUserWebSocket();

function startPaymentPolling(referenceRaw) {
    const reference = referenceRaw.toString().replace(/\s/g, '');

    const checkOnce = async () => {
        try {
            const response = await fetch(`${API_BASE}/orders/${reference}/status`);
            const data = await response.json();

            if (data.success) {
                if (data.status === 'PAID') {
                    if (pollingInterval) clearInterval(pollingInterval);
                    clearSession();
                    if (data.token) {
                        localStorage.setItem('ecoflix_token', data.token);
                        loadDashboard();
                        showToast('Pagamento confirmado!', 'success');
                    } else {
                        showPaymentSuccess(data.credentials);
                    }
                    return;
                } else if (data.status === 'STOCK_OUT') {
                    if (pollingInterval) clearInterval(pollingInterval);
                    clearSession();
                    showScreen('step-catalog');
                    showToast('Pagamento recebido, mas estamos sem stock!', 'error');
                    return;
                } else if (['FAILED', 'CANCELED', 'CANCELLED'].includes(data.status)) {
                    if (pollingInterval) clearInterval(pollingInterval);
                    clearSession();
                    showScreen('step-catalog');
                    showToast(`Pagamento falhou ou foi cancelado.`, 'error');
                    return;
                }
            }
        } catch (e) {
            console.error('Initial check error:', e);
        }

        const orderId = currentOrder && (currentOrder.order_id || currentOrder.id);
        if (wsClient && wsClient.readyState === WebSocket.OPEN && orderId) {
            wsClient.send(JSON.stringify({ type: 'subscribe_order', order_id: orderId }));
        }
    };

    if (pollingInterval) clearInterval(pollingInterval);
    checkOnce();
    pollingInterval = setInterval(checkOnce, 5000);
}

// === RECUPERAR CREDENCIAIS ===
function showRecover() {
    if (pollingInterval) clearInterval(pollingInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    if (localStorage.getItem('ecoflix_token')) {
        loadDashboard();
        return;
    }

    document.getElementById('recover-phone').value = '';
    showScreen('step-recover');
}

let loginPhoneGlobal = '';

async function submitRecover() {
    const input = document.getElementById('recover-phone');
    const phoneClean = input.value.replace(/\D/g, '');
    if (phoneClean.length !== 9) {
        showToast('Por favor, insira um número válido (9 dígitos).', 'error');
        return;
    }

    const btn = document.getElementById('btn-recover');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A aguardar...';

    loginPhoneGlobal = '+244' + phoneClean;

    try {
        const requestData = { phone: loginPhoneGlobal };
        const hmacHeaders = await window.HMACSign.signRequest(requestData);

        const resp = await fetch(`${API_BASE}/auth/register-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...hmacHeaders
            },
            body: JSON.stringify(requestData)
        });

        const data = await resp.json();
        if (!data.success) throw new Error(data.message);

        document.getElementById('login-phone-display').innerText = loginPhoneGlobal;
        document.getElementById('login-otp-code').value = '';
        showScreen('step-login-otp');
        showToast(data.message, 'success');
    } catch (e) {
        showToast(e.message || 'Erro ao processar', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Avançar</span> <i class="fas fa-arrow-right text-sm"></i>';
    }
}

async function submitLoginOtp() {
    const input = document.getElementById('login-otp-code');
    const code = input.value.trim();
    if (code.length !== 4) {
        showToast('O código deve ter 4 dígitos.', 'error');
        return;
    }

    const btn = document.getElementById('btn-login-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A validar...';

    try {
        const requestData = { phone: loginPhoneGlobal, code };
        const hmacHeaders = await window.HMACSign.signRequest(requestData);

        const resp = await fetch(`${API_BASE}/auth/register-verify`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...hmacHeaders
            },
            body: JSON.stringify(requestData)
        });

        const data = await resp.json();
        if (!data.success) throw new Error(data.message);

        localStorage.setItem('ecoflix_token', data.token);
        loadDashboard();
    } catch (e) {
        showToast(e.message || 'Erro ao processar', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Entrar na Minha Conta</span> <i class="fas fa-sign-in-alt text-sm"></i>';
    }
}

async function submitCheckoutOtp() {
    const input = document.getElementById('checkout-otp-code');
    const code = input.value.trim();
    if (code.length !== 4) {
        showToast('O código deve ter 4 dígitos.', 'error');
        return;
    }

    const btn = document.getElementById('btn-checkout-otp');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A validar...';

    try {
        const requestData = { phone: userPhone, code };
        const hmacHeaders = await window.HMACSign.signRequest(requestData);

        const resp = await fetch(`${API_BASE}/auth/register-verify`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...hmacHeaders
            },
            body: JSON.stringify(requestData)
        });

        const data = await resp.json();
        if (!data.success) throw new Error(data.message);

        const methodToProceed = checkoutPendingMethod;
        const cardElementToProceed = checkoutPendingCardElement;
        
        checkoutPendingMethod = null; 
        checkoutPendingCardElement = null;
        
        document.getElementById('global-loader').classList.remove('hidden');
        document.getElementById('global-loader').classList.add('flex');
        
        await selectPaymentMethod(methodToProceed, cardElementToProceed, true);

    } catch (e) {
        showToast(e.message || 'Erro ao validar código', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Confirmar e Pagar via Express</span> <i class="fas fa-check-circle text-sm"></i>';
    }
}

async function cancelOrder() {
    if (pollingInterval) clearInterval(pollingInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (currentOrder?.order_id && userPhone) {
        try {
            await fetch(`${API_BASE}/orders/${currentOrder.order_id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: userPhone })
            });
        } catch {}
    }
    clearSession();
    currentOrder = null;
    userPhone = null;
    showScreen('step-catalog');
    showToast('Pedido cancelado.', 'info');
}

window.addEventListener('beforeunload', function (e) {
    if (currentOrder && currentOrder.order_id) {
        const url = `${API_BASE}/orders/${currentOrder.order_id}/cancel`;
        const headers = new Blob([JSON.stringify({ phone: userPhone })], {type: 'application/json'});
        navigator.sendBeacon(url, headers);
    }
});

function showPaymentSuccess(credentials) {
    stopPayTimer();

    const loadingState = document.getElementById('pay-loading-state');
    const successState = document.getElementById('pay-success-state');
    const bgGlow = document.getElementById('pay-bg-glow');

    if (loadingState && successState) {
        loadingState.classList.add('pay-fade-out');
        if (bgGlow) bgGlow.style.background = 'radial-gradient(circle at 50% 50%, rgba(34,197,94,0.15) 0%, transparent 50%)';

        setTimeout(() => {
            loadingState.style.display = 'none';
            successState.classList.remove('pay-hidden');
            successState.classList.add('pay-fade-in');

            setTimeout(() => {
                _finishSuccess(credentials);
            }, 2000);
        }, 500);
    } else {
        _finishSuccess(credentials);
    }
}

function _finishSuccess(credentials) {
    if (credentials && credentials.email) {
        document.getElementById('succ-email').innerText = credentials.email;
        document.getElementById('succ-password').innerText = credentials.password;
        document.getElementById('succ-profile').innerText = credentials.profile;
        document.getElementById('succ-pin').innerText = credentials.pin || 'Sem PIN';
        document.getElementById('success-credentials').classList.remove('hidden');
        document.getElementById('success-sms-info').classList.add('hidden');
    } else {
        document.getElementById('success-credentials').classList.add('hidden');
        document.getElementById('success-sms-info').classList.remove('hidden');
    }
    showScreen('step-success');
}

// === MODAL DE AJUDA ===
function openHelpModal() {
    document.getElementById('help-modal').classList.remove('hidden');
    document.getElementById('help-modal').classList.add('flex');
}

function closeHelpModal() {
    document.getElementById('help-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.remove('flex');
}

function scrollToFaq() {
    closeHelpModal();
    document.querySelector('.mt-16').scrollIntoView({ behavior: 'smooth' });
}

let isRenewal = false;
let targetSubscriptionId = null;

// === DASHBOARD LOGIC ===
async function loadDashboard() {
    showScreen('step-dashboard');
    document.getElementById('dashboard-loading').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    document.getElementById('dashboard-empty').classList.add('hidden');

    try {
        const token = localStorage.getItem('ecoflix_token');
        const response = await fetch(`${API_BASE}/subscription/credentials`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        document.getElementById('dashboard-loading').classList.add('hidden');

        if (data.success && data.data && data.data.length > 0) {
            if (data.phone) {
                userPhone = data.phone;
                sessionStorage.setItem('ecoflix_user_phone', userPhone);
            }
            window.currentSubscriptions = data.data;
            
            const container = document.getElementById('dashboard-content');
            container.innerHTML = '';
            
            data.data.forEach((sub, index) => {
                const daysLeft = Math.ceil((new Date(sub.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                const statusColor = daysLeft >= 0 ? 'text-[#46d369]' : 'text-red-500';
                const statusText = daysLeft >= 0 ? 'Ativo' : 'Expirado';
                const daysLeftText = daysLeft > 0 ? `${daysLeft} Dias` : 'Expirado';
                const daysLeftClass = daysLeft > 5 ? 'text-xl font-bold text-white' : 'text-xl font-bold text-red-500';
                const planName = sub.plan === 'FAMILIA' ? 'Conta Família' : `Pessoal ${sub.plan}`;
                const isManual = sub.is_manual ? '<span class="ml-2 text-[10px] bg-brand text-white px-2 py-0.5 rounded">Adicionada Manualmente</span>' : '';
                
                let planPrice = 4500;
                if (sub.plan === 'ULTRA') planPrice = 6500;
                else if (sub.plan === 'FAMILIA') planPrice = 18000;

                const html = `
                    <div class="mb-10 pb-10 border-b border-gray-800 last:border-b-0 last:pb-0">
                        <div class="netflix-card p-6 rounded-md shadow-lg border-l-4 border-l-brand relative overflow-hidden mb-6">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="text-xs text-muted uppercase font-bold mb-1">PLANO ATUAL ${isManual}</div>
                                    <h3 class="text-2xl font-bold mb-1">${planName}</h3>
                                    <p class="text-sm ${statusColor} font-bold flex items-center gap-1">
                                        <i class="fas fa-check-circle"></i> <span>${statusText}</span>
                                    </p>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-muted uppercase font-bold mb-1">EXPIRA EM</div>
                                    <div class="${daysLeftClass}">${daysLeftText}</div>
                                    <div class="text-xs text-muted">${new Date(sub.expires_at).toLocaleDateString('pt-PT')}</div>
                                </div>
                            </div>
                        </div>

                        <div class="netflix-card p-6 rounded-md shadow-lg mb-4">
                            <div class="flex justify-between items-center mb-6">
                                <h3 class="text-xl font-bold flex items-center gap-2">
                                    <i class="fas fa-key text-brand"></i> Credenciais de Acesso
                                </h3>
                                <button onclick="toggleCredentials(${index})" id="btn-toggle-creds-${index}"
                                    class="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition">
                                    <i class="fas fa-eye"></i> Revelar
                                </button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                <div id="creds-blur-${index}"
                                    class="absolute inset-0 bg-gray-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded transition-opacity duration-300">
                                    <i class="fas fa-lock text-3xl text-gray-500 mb-2"></i>
                                    <p class="text-sm text-gray-400">Clique em "Revelar" para ver</p>
                                </div>

                                <div class="bg-black/40 p-3 rounded border border-gray-700">
                                    <label class="text-xs text-muted uppercase font-bold block mb-1">Email Netflix</label>
                                    <div class="flex justify-between items-center">
                                        <span class="font-mono text-white select-all" id="dash-email-${index}">${sub.email}</span>
                                        <i onclick="copyText('dash-email-${index}')"
                                            class="far fa-copy text-muted hover:text-white cursor-pointer"></i>
                                    </div>
                                </div>

                                <div class="bg-black/40 p-3 rounded border border-gray-700">
                                    <label class="text-xs text-muted uppercase font-bold block mb-1">Palavra-passe</label>
                                    <div class="flex justify-between items-center">
                                        <span class="font-mono text-white select-all" id="dash-password-${index}">${sub.password}</span>
                                        <i onclick="copyText('dash-password-${index}')"
                                            class="far fa-copy text-muted hover:text-white cursor-pointer"></i>
                                    </div>
                                </div>

                                ${sub.pin === 'N/A' || sub.plan === 'FAMILIA' ? `
                                <div class="bg-black/40 p-3 rounded border border-gray-700 border-l-4 border-l-purple-500 col-span-1 md:col-span-2">
                                    <label class="text-xs text-muted uppercase font-bold block mb-1">Tipo de Acesso</label>
                                    <div class="font-bold text-lg text-white">Conta Mãe Exclusiva (Todos os Perfis)</div>
                                </div>
                                ` : `
                                <div class="bg-black/40 p-3 rounded border border-gray-700 border-l-4 border-l-blue-500">
                                    <label class="text-xs text-muted uppercase font-bold block mb-1">Seu Perfil</label>
                                    <div class="font-bold text-lg text-white" id="dash-profile-${index}">${sub.profile_name}</div>
                                </div>

                                <div class="bg-black/40 p-3 rounded border border-gray-700 border-l-4 border-l-blue-500">
                                    <label class="text-xs text-muted uppercase font-bold block mb-1">PIN do Perfil</label>
                                    <div class="font-mono text-xl text-white font-bold tracking-widest" id="dash-pin-${index}">${sub.pin}</div>
                                </div>
                                `}
                            </div>

                            ${sub.pin === 'N/A' || sub.plan === 'FAMILIA' ? `
                            <div class="mt-6 bg-purple-900/20 border border-purple-900/30 p-3 rounded text-xs text-purple-200 flex gap-2 items-start">
                                <i class="fas fa-info-circle mt-0.5"></i>
                                <div>
                                    <strong>Dica:</strong> Pode alterar a senha principal e criar ou modificar os perfis como desejar.
                                </div>
                            </div>
                            ` : `
                            <div class="mt-6 bg-red-900/20 border border-red-900/30 p-3 rounded text-xs text-red-200 flex gap-2 items-start">
                                <i class="fas fa-exclamation-triangle mt-0.5"></i>
                                <div>
                                    <strong>Importante:</strong> Não altere a palavra-passe ou o nome do perfil.
                                    O sistema deteta alterações e pode bloquear o acesso.
                                </div>
                            </div>
                            `}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button onclick="startRenewal(${index})"
                                class="netflix-card p-4 rounded hover:bg-gray-800 transition flex items-center justify-center gap-3 border border-gray-700 hover:border-brand">
                                <i class="fas fa-sync-alt text-brand"></i>
                                <span class="font-bold">Renovar / Estender (+30 Dias)</span>
                            </button>

                            <a href="https://wa.me/${data.support_whatsapp || '244927862935'}?text=${encodeURIComponent('Olá, estou com problemas na minha subscrição #')}${sub.id.split('-')[0]}" target="_blank"
                                class="netflix-card p-4 rounded hover:bg-gray-800 transition flex items-center justify-center gap-3 border border-gray-700 hover:border-gray-500">
                                <i class="fab fa-whatsapp text-[#25D366] text-xl"></i>
                                <span class="font-bold text-muted">Reportar Problema</span>
                            </a>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });

            document.getElementById('dashboard-content').classList.remove('hidden');
        } else {
            document.getElementById('dashboard-empty').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Dash error:', error);
        document.getElementById('dashboard-loading').classList.add('hidden');
        document.getElementById('dashboard-empty').classList.remove('hidden');
    }
}

function toggleCredentials(index) {
    const blur = document.getElementById(`creds-blur-${index}`);
    const btn = document.getElementById(`btn-toggle-creds-${index}`);

    if (blur.classList.contains('hidden')) {
        blur.classList.remove('hidden');
        btn.innerHTML = '<i class="fas fa-eye"></i> Revelar';
    } else {
        blur.classList.add('hidden');
        btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar';
    }
}

function logout() {
    localStorage.removeItem('ecoflix_token');
    goHome();
}

function startRenewal(index) {
    const sub = window.currentSubscriptions[index];
    selectedPlanType = sub.plan;
    
    if (sub.plan === 'ECONOMICO') selectedPlanPrice = 4500;
    else if (sub.plan === 'ULTRA') selectedPlanPrice = 6500;
    else selectedPlanPrice = 18000;

    isRenewal = true;
    targetSubscriptionId = sub.id;

    document.getElementById('summary-plan-name').innerText = 'Renovação ' + selectedPlanType;
    document.getElementById('summary-original-price').innerText = formatKz(selectedPlanPrice);
    document.getElementById('summary-total-price').innerText = formatKz(selectedPlanPrice);

    showScreen('step-payment-method');
    showToast('Selecione o método de pagamento para renovar.', 'info');
}

// === REPORT PROBLEM ===
let currentReportSubId = null;

function reportProblem(index) {
    const sub = window.currentSubscriptions[index];
    if (!sub) {
        return showToast('Erro: Assinatura não carregada.', 'error');
    }

    currentReportSubId = sub.id;
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

async function submitIssue() {
    const type = document.getElementById('issueType').value;
    const desc = document.getElementById('issueDesc').value;

    if (!currentReportSubId) return;

    closeReportModal();

    try {
        const token = localStorage.getItem('ecoflix_token');
        
        const requestData = {
            subscription_id: currentReportSubId,
            issue_type: type,
            description: desc
        };
        const hmacHeaders = await window.HMACSign.signRequest(requestData);

        const response = await fetch('/api/ecoflix/subscription/report', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}`,
                ...hmacHeaders
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();
        if (data.success) {
            showToast(data.message || 'Reporte enviado!', 'success');
        } else {
            showToast('Erro: ' + data.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Erro ao enviar reporte.', 'error');
    }
}

// === MODAL DE TERMOS ===
localStorage.setItem('ecoflix_terms_accepted', 'true');

function checkTermsAcceptance() {
    localStorage.setItem('ecoflix_terms_accepted', 'true');
    return;
}

function acceptTerms() {
    localStorage.setItem('ecoflix_terms_accepted', 'true');
    const modal = document.getElementById('terms-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    showToast('Termos aceitos. Bem-vindo ao EcoFlix!', 'success');
}

function declineTerms() {
    if (confirm('Você precisa aceitar os Termos para continuar. Deseja sair?')) {
        window.location.href = 'about:blank';
    }
}

// === INIT ===
document.addEventListener('DOMContentLoaded', async function () {
    const checkbox = document.getElementById('terms-checkbox');
    const acceptBtn = document.getElementById('accept-terms-btn');
    const declineBtn = document.getElementById('decline-terms-btn');

    if (checkbox && acceptBtn) {
        checkbox.addEventListener('change', function (e) {
            if (e.target.checked) {
                acceptBtn.disabled = false;
                acceptBtn.style.cursor = 'pointer';
                acceptBtn.style.opacity = '1';
            } else {
                acceptBtn.disabled = true;
                acceptBtn.style.cursor = 'not-allowed';
                acceptBtn.style.opacity = '0.4';
            }
        });
    }

    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptTerms);
    }
    if (declineBtn) {
        declineBtn.addEventListener('click', declineTerms);
    }

    localStorage.setItem('ecoflix_terms_accepted', 'true');

    const order = restoreSession();
    if (order) {
        await resumePendingOrder(order);
    }

    const lastScreen = sessionStorage.getItem('ecoflix_last_screen');
    const token = localStorage.getItem('ecoflix_token');
    if (lastScreen === 'step-dashboard' && token) {
        loadDashboard();
    }
});

// === SWIPER INIT ===
function initPlansSwiper() {
    if (window.innerWidth >= 1024) return;
    const el = document.querySelector('.myPlansSwiper');
    if (!el || el.dataset.swiperInit) return;
    el.dataset.swiperInit = '1';
    new Swiper('.myPlansSwiper', {
        slidesPerView: 'auto',
        centeredSlides: true,
        spaceBetween: 16,
        initialSlide: 0,
        grabCursor: true,
        speed: 400,
        resistanceRatio: 0.65,
        observer: true,
        observeParents: true,
        pagination: { el: '.plans-swiper .swiper-pagination', clickable: true },
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlansSwiper);
} else {
    initPlansSwiper();
}
window.addEventListener('resize', initPlansSwiper);
