// Работа с сервером: токены и запросы к API.

const API_URL = "/api";

function getAccessToken() {
    return localStorage.getItem("access");
}

function getRefreshToken() {
    return localStorage.getItem("refresh");
}

function saveTokens(access, refresh) {
    localStorage.setItem("access", access);
    if (refresh) {
        localStorage.setItem("refresh", refresh);
    }
}

function clearTokens() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
}

function isLoggedIn() {
    return getRefreshToken() !== null;
}

// Получаем новый access-токен по refresh-токену.
// Возвращает true, если получилось.
async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) {
        return false;
    }

    const response = await fetch(API_URL + "/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refresh }),
    });

    if (!response.ok) {
        clearTokens();
        return false;
    }

    const data = await response.json();
    saveTokens(data.access, data.refresh);
    return true;
}

// Ошибка, которую возвращает сервер (400, 404 и т.д.)
class ApiError extends Error {
    constructor(status, data) {
        super(errorText(data));
        this.status = status;
        this.data = data;
    }
}

// Превращаем ответ сервера с ошибкой в понятный текст.
// DRF возвращает ошибки так: {"detail": "..."} или {"поле": ["..."]}
function errorText(data) {
    if (!data) {
        return "Ошибка сервера";
    }
    if (typeof data === "string") {
        return data;
    }
    if (data.detail) {
        return data.detail;
    }

    const lines = [];
    for (const key in data) {
        let value = data[key];
        if (Array.isArray(value)) {
            value = value.join(" ");
        }
        if (key === "non_field_errors") {
            lines.push(value);
        } else {
            lines.push(key + ": " + value);
        }
    }
    return lines.join("\n");
}

// Главная функция для запросов.
// Если access-токен истёк (401), один раз обновляем его и повторяем запрос.
async function api(method, path, body, isRetry) {
    // FormData — это загрузка файлов (картинки в админке).
    // Для неё Content-Type браузер ставит сам, JSON не нужен.
    const isFormData = body instanceof FormData;

    const headers = {};
    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }
    const access = getAccessToken();
    if (access) {
        headers["Authorization"] = "Bearer " + access;
    }

    const options = { method: method, headers: headers };
    if (body !== undefined) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(API_URL + path, options);
    } catch (error) {
        // Нет интернета или сервер недоступен
        throw new ApiError(0, { detail: "Нет связи с сервером. Проверьте интернет." });
    }

    if (response.status === 401 && !isRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            return api(method, path, body, true);
        }
        clearTokens();
        location.hash = "#/login";
        throw new ApiError(401, { detail: "Войдите в аккаунт." });
    }

    let data = null;
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            data = { detail: "Ошибка сервера (" + response.status + ")" };
        }
    }

    if (!response.ok) {
        throw new ApiError(response.status, data);
    }
    return data;
}
