document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('transaction-form');
    const tableBody = document.getElementById('transactions-body');
    const searchInput = document.getElementById('search-input');
    const typeFilter = document.getElementById('filter-type');
    const resetButton = document.getElementById('reset-filters');
    const message = document.getElementById('form-message');
    const categorySelect = document.getElementById('category-select');
    const transactionType = document.getElementById('transaction-type');

    function getCookie(name) {
        const cookie = document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='));

        return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
    }

    async function request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                ...(options.headers || {}),
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Произошла ошибка.');
        }

        return data;
    }

    async function loadTransactions() {
        const params = new URLSearchParams({
            search: searchInput.value.trim(),
            type: typeFilter.value,
        });

        try {
            const data = await request(
                `/transactions/api/?${params.toString()}`
            );

            tableBody.innerHTML = data.html;
        } catch (error) {
            message.textContent = error.message;
            message.className = 'mt-3 text-danger';
        }
    }

    function updateCategories() {
        const selectedType = transactionType.value;
        let selectedOptionExists = false;

        Array.from(categorySelect.options).forEach(option => {
            const matches = option.dataset.type === selectedType;
            option.hidden = !matches;
            option.disabled = !matches;

            if (matches && !selectedOptionExists) {
                selectedOptionExists = true;
            }
        });

        const currentOption = categorySelect.selectedOptions[0];

        if (!currentOption || currentOption.disabled) {
            const firstAvailable = Array.from(categorySelect.options)
                .find(option => !option.disabled);

            categorySelect.value = firstAvailable ? firstAvailable.value : '';
        }
    }

    let searchTimeout;

    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadTransactions, 250);
    });

    typeFilter.addEventListener('change', loadTransactions);

    resetButton.addEventListener('click', function () {
        searchInput.value = '';
        typeFilter.value = '';
        loadTransactions();
    });

    transactionType.addEventListener('change', updateCategories);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        message.textContent = '';

        const formData = new FormData(form);

        try {
            const data = await request('/transactions/create/', {
                method: 'POST',
                body: new URLSearchParams(formData),
            });

            message.textContent = data.message;
            message.className = 'mt-3 text-success';

            form.reset();
            form.elements.date.value = new Date().toLocaleDateString('en-CA');
            updateCategories();

            await loadTransactions();
        } catch (error) {
            message.textContent = error.message;
            message.className = 'mt-3 text-danger';
        }
    });

    tableBody.addEventListener('click', async function (event) {
        const button = event.target.closest('.delete-transaction');

        if (!button) return;

        if (!confirm('Удалить эту операцию?')) return;

        button.disabled = true;

        try {
            await request(
                `/transactions/${button.dataset.id}/delete/`,
                { method: 'POST' }
            );

            await loadTransactions();
        } catch (error) {
            message.textContent = error.message;
            message.className = 'mt-3 text-danger';
            button.disabled = false;
        }
    });

    updateCategories();
    loadTransactions();
});
