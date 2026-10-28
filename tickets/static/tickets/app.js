const API_URL = "/tickets/api";
const csrfInput = document.querySelector("[name=csrfmiddlewaretoken]");
const csrfToken = csrfInput ? csrfInput.value : "";
const categorySelect = document.getElementById("category");
const form = document.getElementById("ticket-form");
const titleInput = document.getElementById("title");
const message = document.getElementById("message");
const list = document.getElementById("tickets-list");
const loading = document.getElementById("loading");
const filter = document.getElementById("status-filter");
const statusLabels = {
    new: "Новая",
    progress: "В работе",
    done: "Выполнена"
};
const nextStatuses = {
    new: ["progress"],
    progress: ["done"],
    done: []
};
function showMessage(text, isError = false) {
    message.textContent = text;
    message.className = isError
        ? "alert alert-danger mb-3"
        : "alert alert-success mb-3";
    message.hidden = false;
}
function getErrorMessage(data, status) {
    if (data === null || data === undefined) {
        return `Ошибка сервера (${status}). Проверьте адрес API и авторизацию.`;
    }

    if (typeof data === "string") {
        return data;
    }

    if (data.detail) {
        return data.detail;
    }

    const errors = [];

    for (const [field, value] of Object.entries(data)) {
        const fieldNames = {
            title: "Название",
            category: "Категория",
            status: "Статус",
            description: "Описание"
        };

        const fieldName = fieldNames[field] || field;
        const text = Array.isArray(value)
            ? value.join(" ")
            : typeof value === "object" && value !== null
                ? JSON.stringify(value)
                : String(value);

        errors.push(`${fieldName}: ${text}`);
    }

    return errors.join(" ") || `Ошибка запроса: ${status}`;
}
async function apiRequest(url, options = {}) {
    const headers = {
        "Accept": "application/json",
        ...(options.headers || {})};
    if (options.body) {
        headers["Content-Type"] = "application/json";}
    if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;}
    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
            credentials: "same-origin"
        });
    } catch (error) {
        throw new Error(
            "Не удалось связаться с сервером. Проверьте соединение.");
    }
    let data = null;
    if (response.status !== 204) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            data = await response.json().catch(() => null);
        } else {data = await response.text().catch(() => null);}
    }
    if (!response.ok) {
        throw new Error(getErrorMessage(data, response.status));}
    return data;}

function extractResults(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.results)) {
        return data.results;
    }

    return [];
}

async function loadCategories() {
    const categories = extractResults(
        await apiRequest(`${API_URL}/categories/`)
    );

    categorySelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = categories.length
        ? "Выберите категорию"
        : "Нет доступных категорий";
    placeholder.disabled = true;
    placeholder.selected = true;

    categorySelect.append(placeholder);

    for (const category of categories) {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.append(option);
    }

    categorySelect.disabled = categories.length === 0;
}

function createStatusBadge(status) {
    const badge = document.createElement("span");

    const classes = {
        new: "badge bg-blue-lt",
        progress: "badge bg-yellow-lt",
        done: "badge bg-green-lt"
    };

    badge.className = classes[status] || "badge";
    badge.textContent = statusLabels[status] || status;

    return badge;
}

function createTicketRow(ticket) {
    const row = document.createElement("div");
    row.className =
        "border-bottom py-3 d-flex flex-column flex-md-row " +
        "justify-content-between align-items-md-center gap-3";

    const information = document.createElement("div");
    information.className = "flex-fill";

    const title = document.createElement("div");
    title.className = "fw-bold";
    title.textContent = ticket.title;

    const category = document.createElement("div");
    category.className = "text-secondary small";
    category.textContent = `Категория: ${ticket.category_name || "Не указана"}`;

    const statusLine = document.createElement("div");
    statusLine.className = "mt-2";
    statusLine.append(createStatusBadge(ticket.status));

    information.append(title, category, statusLine);

    const controls = document.createElement("div");
    controls.className = "d-flex flex-wrap align-items-center gap-2";

    const allowedStatuses = nextStatuses[ticket.status] || [];

    const statusSelect = document.createElement("select");
    statusSelect.className = "form-select";
    statusSelect.setAttribute(
        "aria-label",
        `Новый статус заявки ${ticket.title}`
    );

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = allowedStatuses.length
        ? "Выберите статус"
        : "Завершена";
    placeholder.disabled = true;
    placeholder.selected = true;
    statusSelect.append(placeholder);

    for (const status of allowedStatuses) {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = statusLabels[status];
        statusSelect.append(option);
    }

    const changeButton = document.createElement("button");
    changeButton.type = "button";
    changeButton.className = "btn btn-outline-primary";
    changeButton.textContent = "Изменить статус";
    changeButton.disabled = allowedStatuses.length === 0;

    changeButton.addEventListener("click", async () => {
        if (!statusSelect.value) {
            showMessage("Сначала выберите новый статус.", true);
            return;
        }

        changeButton.disabled = true;

        try {
            await apiRequest(`${API_URL}/tickets/${ticket.id}/`, {
                method: "PATCH",
                body: JSON.stringify({
                    status: statusSelect.value
                })
            });

            showMessage("Статус заявки успешно изменён.");
            await loadTickets();
        } catch (error) {
            showMessage(
                `Не удалось изменить статус: ${error.message}`,
                true
            );
        } finally {
            changeButton.disabled = allowedStatuses.length === 0;
        }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-outline-danger";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", async () => {
        if (!confirm(`Удалить заявку «${ticket.title}»?`)) {
            return;
        }
        deleteButton.disabled = true;
        try {
            await apiRequest(`${API_URL}/tickets/${ticket.id}/`, {
                method: "DELETE"
            });
            showMessage("Заявка успешно удалена.");
            await loadTickets();
        } catch (error) {
            showMessage(
                `Не удалось удалить заявку: ${error.message}`,
                true
            );
            deleteButton.disabled = false;
        }
    });

    controls.append(statusSelect, changeButton, deleteButton);
    row.append(information, controls);

    return row;
}

async function loadTickets() {
    loading.hidden = false;

    const params = new URLSearchParams();

    if (filter.value) {
        params.set("status", filter.value);
    }

    const query = params.toString();
    const url = `${API_URL}/tickets/${query ? `?${query}` : ""}`;

    try {
        const tickets = extractResults(await apiRequest(url));

        list.replaceChildren();

        if (tickets.length === 0) {
            const empty = document.createElement("p");
            empty.className = "text-secondary mb-0";
            empty.textContent = "Заявки не найдены.";
            list.append(empty);
            return;
        }

        for (const ticket of tickets) {
            list.append(createTicketRow(ticket));
        }
    } catch (error) {
        showMessage(
            `Не удалось загрузить заявки: ${error.message}`,
            true
        );
    } finally {
        loading.hidden = true;
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!categorySelect.value) {
        showMessage("Сначала выберите категорию.", true);
        return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;

    try {
        await apiRequest(`${API_URL}/tickets/`, {
            method: "POST",
            body: JSON.stringify({
                title: titleInput.value.trim(),
                category: Number(categorySelect.value)
            })
        });

        titleInput.value = "";
        categorySelect.selectedIndex = 0;

        showMessage("Заявка успешно создана.");
        await loadTickets();
    } catch (error) {
        showMessage(
            `Не удалось создать заявку: ${error.message}`,
            true
        );
    } finally {
        submitButton.disabled = false;
    }
});

filter.addEventListener("change", loadTickets);

async function initialize() {
    try {
        await loadCategories();
        await loadTickets();
    } catch (error) {
        showMessage(
            `Ошибка загрузки данных: ${error.message}`,
            true
        );
    }
}

initialize();
