document.addEventListener('DOMContentLoaded', () => {
    const API = {
        categories: '/api/categories/',
        transactions: '/api/transactions/'
    };

    const message = document.getElementById('api-message');
    const table = document.getElementById('transactions-table');
    const form = document.getElementById('transaction-form');
    const modalElement = document.getElementById('transaction-modal');

    const modal = window.bootstrap && modalElement
        ? window.bootstrap.Modal.getOrCreateInstance(modalElement)
        : null;

    const searchInput = document.getElementById('filter-search');
    const filterCategory = document.getElementById('filter-category');
    const filterType = document.getElementById('filter-type');
    const filterDate = document.getElementById('filter-date');
    const filterOrder = document.getElementById('filter-order');

    const categorySelect = document.getElementById('transaction-category');
    const typeSelect = document.getElementById('transaction-type');

    let categories = [];
    let currentTransactions = [];

    function showMessage(text, type = 'info') {
        message.className = `alert alert-${type}`;
        message.textContent = text;
        message.classList.remove('d-none');
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    }

    function getCSRFToken() {
        return document.querySelector(
            '[name=csrfmiddlewaretoken]'
        )?.value || '';
    }

    function formatError(data, status) {
        if (status === 401 || status === 403) {
            return 'Недостаточно прав. Проверьте авторизацию.';
        }

        if (status === 404) {
            return 'Запись не найдена. Возможно, её уже удалили.';
        }

        if (status >= 500) {
            return 'Ошибка сервера. Попробуйте позже.';
        }

        if (data && typeof data === 'object') {
            const errors = [];

            for (const [field, value] of Object.entries(data)) {
                const errorText = Array.isArray(value)
                    ? value.join(' ')
                    : typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value);

                errors.push(
                    `${field === 'detail' ? '' : field + ': '}${errorText}`
                );
            }

            if (errors.length) {
                return errors.join('\n');
            }
        }

        return `Не удалось выполнить запрос (HTTP ${status}).`;
    }

    async function apiRequest(url, options = {}) {
        const headers = {
            'Accept': 'application/json',
            ...options.headers
        };

        if (options.body) {
            headers['Content-Type'] = 'application/json';
        }

        if (options.method && options.method !== 'GET') {
            headers['X-CSRFToken'] = getCSRFToken();
        }

        let response;

        try {
            response = await fetch(url, {
                ...options,
                headers,
                credentials: 'same-origin'
            });
        } catch {
            throw new Error(
                'Не удалось связаться с сервером. Проверьте подключение.'
            );
        }

        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (response.status !== 204) {
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                await response.text();
            }
        }

        if (!response.ok) {
            throw new Error(formatError(data, response.status));
        }

        return data;
    }

    function fillCategorySelect(select, selectedValue = '') {
        const type = select === categorySelect
            ? typeSelect.value
            : filterType.value;

        const available = select === filterCategory
            ? categories
            : categories.filter(category =>
                category.category_type === type
            );

        const firstOption = select === filterCategory
            ? '<option value="">Все категории</option>'
            : '<option value="">Выберите категорию</option>';

        select.innerHTML = firstOption + available.map(category => `
            <option value="${category.id}">
                ${escapeHTML(category.name)}
            </option>
        `).join('');

        if (selectedValue !== '') {
            select.value = String(selectedValue);
        }
    }

    async function loadCategories() {
        const data = await apiRequest(API.categories);

        categories = Array.isArray(data) ? data : data.results || [];

        fillCategorySelect(filterCategory);
        fillCategorySelect(categorySelect);
    }

    function renderTransactions(transactions) {
        currentTransactions = transactions;

        if (!transactions.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-secondary">
                        Операции не найдены.
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = transactions.map(transaction => `
            <tr>
                <td>${escapeHTML(transaction.title)}</td>
                <td>
                    ${transaction.transaction_type === 'income'
                        ? 'Доход'
                        : 'Расход'}
                </td>
                <td>${escapeHTML(transaction.category_name)}</td>
                <td>${escapeHTML(transaction.amount)} ₽</td>
                <td>${escapeHTML(transaction.date)}</td>
                <td>
                    <div class="btn-list flex-nowrap">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            data-action="edit"
                            data-id="${transaction.id}">
                            Изменить
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            data-action="delete"
                            data-id="${transaction.id}">
                            Удалить
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function loadTransactions() {
        const params = new URLSearchParams();

        if (searchInput.value.trim()) {
            params.set('search', searchInput.value.trim());
        }

        if (filterCategory.value) {
            params.set('category', filterCategory.value);
        }

        if (filterType.value) {
            params.set('type', filterType.value);
        }

        if (filterDate.value) {
            params.set('date', filterDate.value);
        }

        if (filterOrder.value) {
            params.set('ordering', filterOrder.value);
        }

        const query = params.toString();
        const url = query
            ? `${API.transactions}?${query}`
            : API.transactions;

        try {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="text-secondary">
                        Загрузка данных...
                    </td>
                </tr>
            `;

            const data = await apiRequest(url);
            const transactions = Array.isArray(data)
                ? data
                : data.results || [];

            renderTransactions(transactions);

            showMessage(
                `Данные загружены с сервера. Операций: ${transactions.length}.`,
                'success'
            );
        } catch (error) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="text-danger">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;

            showMessage(error.message, 'danger');
        }
    }

    function resetForm() {
        form.reset();

        document.getElementById('transaction-id').value = '';
        document.getElementById('modal-title').textContent = 'Новая операция';

        typeSelect.value = 'expense';
        fillCategorySelect(categorySelect);
    }

    function openTransactionModal() {
        if (!modal) {
            showMessage(
                'Форма не открылась: Bootstrap JavaScript не загружен. Проверьте templates/base.html.',
                'danger'
            );
            console.error('Bootstrap Modal не загружен.');
            return;
        }

        modal.show();
    }

    document.getElementById('add-transaction').addEventListener('click', () => {
        resetForm();
        openTransactionModal();
    });

    typeSelect.addEventListener('change', () => {
        fillCategorySelect(categorySelect);
    });

    filterType.addEventListener('change', () => {
        fillCategorySelect(filterCategory);
        loadTransactions();
    });

    filterCategory.addEventListener('change', loadTransactions);
    filterDate.addEventListener('change', loadTransactions);
    filterOrder.addEventListener('change', loadTransactions);

    let searchTimer;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadTransactions, 300);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const id = document.getElementById('transaction-id').value;

        const payload = {
            title: document.getElementById('transaction-title').value.trim(),
            transaction_type: typeSelect.value,
            category: Number(categorySelect.value),
            amount: document.getElementById('transaction-amount').value,
            date: document.getElementById('transaction-date').value
        };

        if (!payload.title || !payload.date || !payload.category) {
            showMessage(
                'Заполните все поля и выберите категорию.',
                'warning'
            );
            return;
        }

        try {
            await apiRequest(
                id ? `${API.transactions}${id}/` : API.transactions,
                {
                    method: id ? 'PATCH' : 'POST',
                    body: JSON.stringify(payload)
                }
            );

            if (modal) {
                modal.hide();
            }

            showMessage(
                id
                    ? 'Операция успешно изменена.'
                    : 'Операция успешно добавлена.',
                'success'
            );

            await loadTransactions();
        } catch (error) {
            showMessage(error.message, 'danger');
        }
    });

    table.addEventListener('click', async event => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
            return;
        }

        const id = button.dataset.id;
        const action = button.dataset.action;

        if (action === 'edit') {
            const transaction = currentTransactions.find(
                item => String(item.id) === id
            );

            if (!transaction) {
                showMessage(
                    'Операция не найдена. Обновите список.',
                    'warning'
                );
                return;
            }

            resetForm();

            document.getElementById('transaction-id').value = transaction.id;
            document.getElementById('modal-title').textContent =
                'Редактирование операции';
            document.getElementById('transaction-title').value =
                transaction.title;

            typeSelect.value = transaction.transaction_type;

            fillCategorySelect(categorySelect, transaction.category);

            document.getElementById('transaction-amount').value =
                transaction.amount;
            document.getElementById('transaction-date').value =
                transaction.date;

            openTransactionModal();
        }

        if (action === 'delete') {
            const transaction = currentTransactions.find(
                item => String(item.id) === id
            );

            if (!transaction) {
                showMessage(
                    'Операция не найдена. Обновите список.',
                    'warning'
                );
                return;
            }

            const confirmed = window.confirm(
                `Вы действительно хотите удалить операцию «${transaction.title}»?`
            );

            if (!confirmed) {
                return;
            }

            try {
                await apiRequest(
                    `${API.transactions}${id}/`,
                    { method: 'DELETE' }
                );

                showMessage('Операция успешно удалена.', 'success');
                await loadTransactions();
            } catch (error) {
                showMessage(error.message, 'danger');
            }
        }
    });

    async function init() {
        try {
            await loadCategories();
            await loadTransactions();
        } catch (error) {
            showMessage(
                `Не удалось загрузить данные: ${error.message}`,
                'danger'
            );
        }
    }

    init();
});
