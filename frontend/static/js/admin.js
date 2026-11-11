// ---------- Админ-панель ----------
// Страницы #/admin/... для сотрудников (is_staff): создать, изменить, удалить
// категории, предметы, темы, вопросы и экзамены.
// Права проверяет сервер (IsAdminUser). Здесь — только чтобы не показывать
// ссылку «Админка» обычным пользователям.
//
// Этот файл подключается ДО app.js (routes в app.js ссылаются на эти страницы),
// а функции из app.js (esc, tileIcon, router ...) вызываются уже после загрузки.

const ADMIN_SECTIONS = [
    { key: "categories", icon: "layers", tint: "indigo" },
    { key: "subjects", icon: "book-open", tint: "blue" },
    { key: "topics", icon: "list", tint: "emerald" },
    { key: "questions", icon: "help-circle", tint: "amber" },
    { key: "exams", icon: "trophy", tint: "violet" },
];

const ADMIN_DIFFICULTIES = ["easy", "medium", "hard"];

// Фильтры списка вопросов. Храним вне страницы, чтобы после
// редактирования вопроса вернуться к тому же месту списка.
const adminQuestionFilters = {
    category: "",
    subject: "",
    topic: "",
    difficulty: "",
    search: "",
    problem: "",
    page: 1,
};

// ----- Кто вошёл: сотрудник или нет -----

function isStaff() {
    try {
        return localStorage.getItem("is_staff") === "1";
    } catch (error) {
        return false;
    }
}

async function loadMe() {
    try {
        const me = await api("GET", "/me/");
        localStorage.setItem("is_staff", me.is_staff ? "1" : "0");
    } catch (error) {
        // не получилось — ссылку «Админка» просто не покажем
    }
}

function forgetMe() {
    try {
        localStorage.removeItem("is_staff");
    } catch (error) {
        // ничего страшного
    }
}

// Перед каждой страницей админки. Возвращает false и показывает «Нет доступа»
async function ensureStaff() {
    let known = null;
    try {
        known = localStorage.getItem("is_staff");
    } catch (error) {
        // недоступно — спросим сервер
    }
    if (known === null) {
        await loadMe();
        renderNav();
    }
    if (isStaff()) {
        return true;
    }
    app.innerHTML = stateBlock({
        icon: "lock",
        title: t("admin.no_access.title"),
        text: t("admin.no_access.text"),
        actionHtml: `<a href="#/" class="btn btn-primary">${icon("house")}${t("result.home")}</a>`,
    });
    return false;
}

// ----- Общие кусочки страниц -----

function adminSection(key) {
    for (const section of ADMIN_SECTIONS) {
        if (section.key === key) {
            return section;
        }
    }
    return ADMIN_SECTIONS[0];
}

// Заголовок + вкладки разделов
function adminHead(activeKey, title, subtitle, actionHtml) {
    const section = activeKey ? adminSection(activeKey) : { icon: "shield", tint: "indigo" };

    let tabs = `<a href="#/admin" class="section-tab${activeKey ? "" : " active"}">${t("admin.overview")}</a>`;
    for (const item of ADMIN_SECTIONS) {
        const active = item.key === activeKey ? " active" : "";
        tabs += `<a href="#/admin/${item.key}" class="section-tab${active}">${t("admin." + item.key)}</a>`;
    }

    return `
        <div class="section-tabs admin-tabs">${tabs}</div>
        <div class="page-head admin-head">
            ${tileIcon(section.icon, section.tint, "lg")}
            <div class="admin-head-text">
                <h1>${title}</h1>
                ${subtitle ? `<p class="muted">${subtitle}</p>` : ""}
            </div>
            ${actionHtml || ""}
        </div>
    `;
}

function adminAddButton(key) {
    return `<a href="#/admin/${key}/new" class="btn btn-primary admin-add">${icon("plus")}<span class="btn-label">${t("admin.add")}</span></a>`;
}

// Одна строка списка: иконка, название, подробности, кнопки «изменить» и «удалить»
function adminRow(key, item, title, metaHtml) {
    const section = adminSection(key);
    return `
        <div class="card admin-row">
            ${tileIcon(section.icon, section.tint)}
            <a href="#/admin/${key}/${item.id}" class="admin-row-body">
                <span class="admin-row-title">${title}</span>
                <span class="admin-row-meta">${metaHtml}</span>
            </a>
            <div class="admin-row-actions">
                <a href="#/admin/${key}/${item.id}" class="btn btn-icon" title="${t("admin.edit")}">${icon("pencil")}</a>
                <button type="button" class="btn btn-icon btn-icon-danger" data-delete="${item.id}" title="${t("admin.delete")}">
                    ${icon("trash-2")}
                </button>
            </div>
        </div>
    `;
}

function adminEmpty(text) {
    return `<div class="card admin-empty muted">${icon("inbox")}<span>${text}</span></div>`;
}

// Кнопки «удалить» в списке. getText(id) возвращает {name, text} для окна подтверждения
function bindDeleteButtons(container, key, getText) {
    for (const button of container.querySelectorAll("[data-delete]")) {
        button.addEventListener("click", async function () {
            const id = Number(button.dataset.delete);
            const info = getText(id);
            const ok = await showConfirm({
                title: t("admin.delete.title", { name: info.name }),
                text: info.text,
                confirmText: t("admin.delete.yes"),
                cancelText: t("logout.confirm.no"),
                iconName: "trash-2",
                danger: true,
            });
            if (!ok) {
                return;
            }
            try {
                await api("DELETE", "/admin/" + key + "/" + id + "/");
                showToast(t("admin.deleted"), "success");
                router();
            } catch (error) {
                showToast(error.message, "error");
            }
        });
    }
}

function findById(items, id) {
    for (const item of items) {
        if (item.id === id) {
            return item;
        }
    }
    return null;
}

// <option> для select. selected — id, который выбран
function optionsHtml(items, selected, getTitle) {
    let html = "";
    for (const item of items) {
        const isSelected = String(item.id) === String(selected) ? " selected" : "";
        html += `<option value="${item.id}"${isSelected}>${esc(getTitle ? getTitle(item) : item.title)}</option>`;
    }
    return html;
}

// Текст для slug: "Matematika (majburiy)" → "matematika-majburiy", "Знаки" → "znaki"
const TRANSLIT = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

function slugify(text) {
    let result = "";
    for (const char of text.toLowerCase()) {
        result += TRANSLIT[char] !== undefined ? TRANSLIT[char] : char;
    }
    return result
        .replace(/[ʻʼ'`‘’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// Пока пользователь не трогал slug сам — заполняем его из названия
function bindSlug(form, isNew) {
    const title = form.elements.title;
    const slug = form.elements.slug;
    let touched = !isNew;
    slug.addEventListener("input", function () {
        touched = true;
    });
    title.addEventListener("input", function () {
        if (!touched) {
            slug.value = slugify(title.value);
        }
    });
}

// Ошибки сервера → понятный текст. labels: {"title": "Название", ...}
function flattenErrors(value) {
    if (Array.isArray(value)) {
        const parts = [];
        for (const item of value) {
            const text = flattenErrors(item);
            if (text) {
                parts.push(text);
            }
        }
        return parts.join(" ");
    }
    if (value && typeof value === "object") {
        const parts = [];
        for (const key in value) {
            parts.push(flattenErrors(value[key]));
        }
        return parts.join(" ");
    }
    return value ? String(value) : "";
}

function adminErrorHtml(error, labels) {
    let lines = [];
    if (error.data && typeof error.data === "object" && !error.data.detail) {
        for (const key in error.data) {
            const label = labels[key] || "";
            const text = flattenErrors(error.data[key]);
            lines.push(label ? `<b>${esc(label)}:</b> ${esc(text)}` : esc(text));
        }
    } else {
        lines = [esc(error.message)];
    }
    return `<div class="alert alert-error">${icon("alert-circle")}<div>${lines.join("<br>")}</div></div>`;
}

// Пустая строка → null, иначе число
function numberOrNull(value) {
    if (String(value).trim() === "") {
        return null;
    }
    return Number(value);
}

// Форма: обёртка, кнопки «Отмена / Сохранить» и отправка
function adminFormHtml(key, fieldsHtml) {
    return `
        <form id="admin-form" class="card admin-form" novalidate>
            <div id="form-error"></div>
            ${fieldsHtml}
            <div class="admin-form-actions">
                <a href="#/admin/${key}" class="btn">${t("admin.cancel")}</a>
                <button type="submit" class="btn btn-primary">${icon("check")}${t("admin.save")}</button>
            </div>
        </form>
    `;
}

function bindAdminForm(key, labels, save) {
    const form = document.getElementById("admin-form");
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById("form-error");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        button.disabled = true;
        errorBox.innerHTML = "";
        try {
            await save(form);
            showToast(t("admin.saved"), "success");
            location.hash = "#/admin/" + key;
        } catch (error) {
            errorBox.innerHTML = adminErrorHtml(error, labels);
            errorBox.scrollIntoView({ block: "center", behavior: "smooth" });
            button.disabled = false;
        }
    });
    return form;
}

// ---------- Обзор ----------

async function pageAdmin() {
    if (!(await ensureStaff())) {
        return;
    }
    const [categories, problems] = await Promise.all([
        api("GET", "/admin/categories/"),
        api("GET", "/admin/questions/?problem=no_correct"),
    ]);

    const totals = { categories: categories.length, subjects: 0, topics: 0, questions: 0, exams: 0 };
    for (const category of categories) {
        totals.subjects += category.subjects_count;
        totals.topics += category.topics_count;
        totals.questions += category.questions_count;
        totals.exams += category.exams_count;
    }
    // questions_count в категории — только вопросы с правильным ответом
    totals.questions += problems.count;

    let tiles = "";
    for (const section of ADMIN_SECTIONS) {
        tiles += `
            <a href="#/admin/${section.key}" class="card card-link admin-tile">
                ${tileIcon(section.icon, section.tint)}
                <b>${formatNumber(totals[section.key])}</b>
                <span class="muted">${t("admin." + section.key)}</span>
            </a>
        `;
    }

    let warning = "";
    if (problems.count > 0) {
        warning = `
            <a href="#/admin/questions" class="alert alert-warning admin-warning" id="admin-problems">
                ${icon("alert-circle")}
                <span>${t("admin.problems", { count: tn("plural.questions", problems.count) })}</span>
                ${icon("chevron-right")}
            </a>
        `;
    }

    app.innerHTML = `
        ${adminHead("", t("admin.title"), t("admin.subtitle"))}
        ${warning}
        <div class="admin-tiles">${tiles}</div>
    `;

    const problemsLink = document.getElementById("admin-problems");
    if (problemsLink) {
        problemsLink.addEventListener("click", function () {
            resetQuestionFilters();
            adminQuestionFilters.problem = "no_correct";
        });
    }
}

// Список и форма для каждого раздела
async function pageAdminList(key) {
    if (!(await ensureStaff())) {
        return;
    }
    const pages = {
        categories: adminCategories,
        subjects: adminSubjects,
        topics: adminTopics,
        questions: adminQuestions,
        exams: adminExams,
    };
    await pages[key]();
}

async function pageAdminForm(key, id) {
    if (!(await ensureStaff())) {
        return;
    }
    const pages = {
        categories: adminCategoryForm,
        subjects: adminSubjectForm,
        topics: adminTopicForm,
        questions: adminQuestionForm,
        exams: adminExamForm,
    };
    // id === "new" — создаём, иначе меняем объект с этим id
    await pages[key](id === "new" ? null : Number(id));
}

// ---------- Категории ----------

async function adminCategories() {
    const categories = await api("GET", "/admin/categories/");

    let rows = "";
    for (const category of categories) {
        const meta = [
            esc(category.slug),
            tn("plural.subjects", category.subjects_count),
            tn("plural.topics", category.topics_count),
            tn("plural.questions", category.questions_count),
            tn("plural.exams", category.exams_count),
        ].join(" · ");
        rows += adminRow("categories", category, esc(category.title), meta);
    }

    app.innerHTML = `
        ${adminHead("categories", t("admin.categories"), "", adminAddButton("categories"))}
        <div class="admin-list">${rows || adminEmpty(t("admin.empty"))}</div>
    `;

    bindDeleteButtons(app, "categories", function (id) {
        const category = findById(categories, id);
        return {
            name: category.title,
            text: t("admin.delete.category", {
                subjects: category.subjects_count,
                topics: category.topics_count,
                questions: category.questions_count,
                exams: category.exams_count,
            }),
        };
    });
}

async function adminCategoryForm(id) {
    const category = id
        ? await api("GET", "/admin/categories/" + id + "/")
        : { title: "", slug: "", practice_questions_count: 20, practice_time_limit: 30 };

    const fields = `
        <label>${t("admin.field.title")}
            <input name="title" value="${esc(category.title)}" required>
        </label>
        <label>${t("admin.field.slug")}
            <input name="slug" value="${esc(category.slug)}" required>
            <span class="field-hint">${t("admin.hint.slug")}</span>
        </label>
        <div class="row">
            <label>${t("admin.field.practice_count")}
                <input name="practice_questions_count" type="number" min="1" value="${category.practice_questions_count}">
            </label>
            <label>${t("admin.field.practice_time")}
                <input name="practice_time_limit" type="number" min="1" value="${category.practice_time_limit}">
            </label>
        </div>
    `;

    app.innerHTML = `
        ${adminHead("categories", id ? esc(category.title) : t("admin.new.category"))}
        ${adminFormHtml("categories", fields)}
    `;

    const form = bindAdminForm(
        "categories",
        {
            title: t("admin.field.title"),
            slug: t("admin.field.slug"),
            practice_questions_count: t("admin.field.practice_count"),
            practice_time_limit: t("admin.field.practice_time"),
        },
        async function (form) {
            const body = {
                title: form.elements.title.value.trim(),
                slug: form.elements.slug.value.trim(),
                practice_questions_count: numberOrNull(form.elements.practice_questions_count.value),
                practice_time_limit: numberOrNull(form.elements.practice_time_limit.value),
            };
            if (id) {
                await api("PATCH", "/admin/categories/" + id + "/", body);
            } else {
                await api("POST", "/admin/categories/", body);
            }
        }
    );
    bindSlug(form, !id);
}

// ---------- Предметы ----------

async function adminSubjects() {
    const [subjects, categories] = await Promise.all([
        api("GET", "/admin/subjects/"),
        api("GET", "/admin/categories/"),
    ]);

    app.innerHTML = `
        ${adminHead("subjects", t("admin.subjects"), "", adminAddButton("subjects"))}
        <div class="card admin-filters">
            <label>${t("admin.field.category")}
                <select id="filter-category">
                    <option value="">${t("admin.filter.all")}</option>
                    ${optionsHtml(categories, "")}
                </select>
            </label>
        </div>
        <div class="admin-list" id="admin-list"></div>
    `;

    const filter = document.getElementById("filter-category");

    function show() {
        let rows = "";
        for (const subject of subjects) {
            if (filter.value && String(subject.category) !== filter.value) {
                continue;
            }
            const meta = [
                esc(subject.category_title),
                tn("plural.topics", subject.topics_count),
                tn("plural.questions", subject.questions_count),
            ].join(" · ");
            rows += adminRow("subjects", subject, esc(subject.title), meta);
        }
        const list = document.getElementById("admin-list");
        list.innerHTML = rows || adminEmpty(t("admin.empty"));
        bindDeleteButtons(list, "subjects", function (id) {
            const subject = findById(subjects, id);
            return {
                name: subject.title,
                text: t("admin.delete.subject", {
                    topics: subject.topics_count,
                    questions: subject.questions_count,
                }),
            };
        });
    }

    filter.addEventListener("change", show);
    show();
}

async function adminSubjectForm(id) {
    const [subject, categories] = await Promise.all([
        id ? api("GET", "/admin/subjects/" + id + "/") : { title: "", slug: "", category: "" },
        api("GET", "/admin/categories/"),
    ]);

    const fields = `
        <label>${t("admin.field.category")}
            <select name="category" required>
                <option value="">${t("exam.choose_placeholder")}</option>
                ${optionsHtml(categories, subject.category)}
            </select>
        </label>
        <label>${t("admin.field.title")}
            <input name="title" value="${esc(subject.title)}" required>
        </label>
        <label>${t("admin.field.slug")}
            <input name="slug" value="${esc(subject.slug)}" required>
            <span class="field-hint">${t("admin.hint.slug")}</span>
        </label>
    `;

    app.innerHTML = `
        ${adminHead("subjects", id ? esc(subject.title) : t("admin.new.subject"))}
        ${adminFormHtml("subjects", fields)}
    `;

    const form = bindAdminForm(
        "subjects",
        { category: t("admin.field.category"), title: t("admin.field.title"), slug: t("admin.field.slug") },
        async function (form) {
            const body = {
                category: numberOrNull(form.elements.category.value),
                title: form.elements.title.value.trim(),
                slug: form.elements.slug.value.trim(),
            };
            if (id) {
                await api("PATCH", "/admin/subjects/" + id + "/", body);
            } else {
                await api("POST", "/admin/subjects/", body);
            }
        }
    );
    bindSlug(form, !id);
}

// ---------- Темы ----------

async function adminTopics() {
    const [topics, categories, subjects] = await Promise.all([
        api("GET", "/admin/topics/"),
        api("GET", "/admin/categories/"),
        api("GET", "/admin/subjects/"),
    ]);

    app.innerHTML = `
        ${adminHead("topics", t("admin.topics"), "", adminAddButton("topics"))}
        <div class="card admin-filters">
            <label>${t("admin.field.category")}
                <select id="filter-category">
                    <option value="">${t("admin.filter.all")}</option>
                    ${optionsHtml(categories, "")}
                </select>
            </label>
            <label>${t("admin.field.subject")}
                <select id="filter-subject"></select>
            </label>
        </div>
        <div class="admin-list" id="admin-list"></div>
    `;

    const categoryFilter = document.getElementById("filter-category");
    const subjectFilter = document.getElementById("filter-subject");

    function fillSubjects() {
        const list = [];
        for (const subject of subjects) {
            if (!categoryFilter.value || String(subject.category) === categoryFilter.value) {
                list.push(subject);
            }
        }
        subjectFilter.innerHTML = `<option value="">${t("admin.filter.all")}</option>${optionsHtml(list, "")}`;
    }

    function show() {
        let rows = "";
        for (const topic of topics) {
            if (categoryFilter.value && String(topic.category) !== categoryFilter.value) {
                continue;
            }
            if (subjectFilter.value && String(topic.subject) !== subjectFilter.value) {
                continue;
            }
            const meta = [
                esc(topic.category_title),
                topic.subject_title ? esc(topic.subject_title) : t("admin.no_subject"),
                tn("plural.questions", topic.questions_count),
            ].join(" · ");
            rows += adminRow("topics", topic, esc(topic.title), meta);
        }
        const list = document.getElementById("admin-list");
        list.innerHTML = rows || adminEmpty(t("admin.empty"));
        bindDeleteButtons(list, "topics", function (id) {
            const topic = findById(topics, id);
            return {
                name: topic.title,
                text: t("admin.delete.topic", { questions: topic.questions_count }),
            };
        });
    }

    categoryFilter.addEventListener("change", function () {
        fillSubjects();
        show();
    });
    subjectFilter.addEventListener("change", show);
    fillSubjects();
    show();
}

async function adminTopicForm(id) {
    const [topic, categories, subjects] = await Promise.all([
        id ? api("GET", "/admin/topics/" + id + "/") : { title: "", slug: "", category: "", subject: null },
        api("GET", "/admin/categories/"),
        api("GET", "/admin/subjects/"),
    ]);

    const fields = `
        <div class="row">
            <label>${t("admin.field.category")}
                <select name="category" required>
                    <option value="">${t("exam.choose_placeholder")}</option>
                    ${optionsHtml(categories, topic.category)}
                </select>
            </label>
            <label>${t("admin.field.subject")}
                <select name="subject"></select>
            </label>
        </div>
        <label>${t("admin.field.title")}
            <input name="title" value="${esc(topic.title)}" required>
        </label>
        <label>${t("admin.field.slug")}
            <input name="slug" value="${esc(topic.slug)}" required>
            <span class="field-hint">${t("admin.hint.slug")}</span>
        </label>
    `;

    app.innerHTML = `
        ${adminHead("topics", id ? esc(topic.title) : t("admin.new.topic"))}
        ${adminFormHtml("topics", fields)}
    `;

    const form = bindAdminForm(
        "topics",
        {
            category: t("admin.field.category"),
            subject: t("admin.field.subject"),
            title: t("admin.field.title"),
            slug: t("admin.field.slug"),
        },
        async function (form) {
            const body = {
                category: numberOrNull(form.elements.category.value),
                subject: numberOrNull(form.elements.subject.value),
                title: form.elements.title.value.trim(),
                slug: form.elements.slug.value.trim(),
            };
            if (id) {
                await api("PATCH", "/admin/topics/" + id + "/", body);
            } else {
                await api("POST", "/admin/topics/", body);
            }
        }
    );
    bindSlug(form, !id);

    // Предметы — только из выбранной категории. Тема может быть и без предмета (Авто)
    function fillSubjects(selected) {
        const list = [];
        for (const subject of subjects) {
            if (String(subject.category) === form.elements.category.value) {
                list.push(subject);
            }
        }
        form.elements.subject.innerHTML = `<option value="">${t("admin.no_subject")}</option>${optionsHtml(list, selected)}`;
    }
    form.elements.category.addEventListener("change", function () {
        fillSubjects("");
    });
    fillSubjects(topic.subject || "");
}

// ---------- Вопросы ----------

function resetQuestionFilters() {
    adminQuestionFilters.category = "";
    adminQuestionFilters.subject = "";
    adminQuestionFilters.topic = "";
    adminQuestionFilters.difficulty = "";
    adminQuestionFilters.search = "";
    adminQuestionFilters.problem = "";
    adminQuestionFilters.page = 1;
}

function hasCorrectOption(question) {
    for (const option of question.options) {
        if (option.is_correct) {
            return true;
        }
    }
    return false;
}

async function adminQuestions() {
    const [categories, subjects, topics] = await Promise.all([
        api("GET", "/admin/categories/"),
        api("GET", "/admin/subjects/"),
        api("GET", "/admin/topics/"),
    ]);
    const filters = adminQuestionFilters;

    let difficultyOptions = `<option value="">${t("admin.filter.all")}</option>`;
    for (const level of ADMIN_DIFFICULTIES) {
        const selected = filters.difficulty === level ? " selected" : "";
        difficultyOptions += `<option value="${level}"${selected}>${t("practice." + level)}</option>`;
    }

    app.innerHTML = `
        ${adminHead("questions", t("admin.questions"), "", adminAddButton("questions"))}
        <div class="card admin-filters admin-filters-questions">
            <label class="admin-search">${t("admin.search")}
                <span class="input-icon">
                    ${icon("search")}
                    <input type="search" id="filter-search" value="${esc(filters.search)}" placeholder="${t("admin.search.placeholder")}">
                </span>
            </label>
            <label>${t("admin.field.category")}
                <select id="filter-category">
                    <option value="">${t("admin.filter.all")}</option>
                    ${optionsHtml(categories, filters.category)}
                </select>
            </label>
            <label>${t("admin.field.subject")}
                <select id="filter-subject"></select>
            </label>
            <label>${t("admin.field.topic")}
                <select id="filter-topic"></select>
            </label>
            <label>${t("practice.difficulty")}
                <select id="filter-difficulty">${difficultyOptions}</select>
            </label>
            <label class="admin-check">
                <input type="checkbox" id="filter-problem"${filters.problem ? " checked" : ""}>
                <span>${t("admin.filter.no_correct")}</span>
            </label>
        </div>
        <div id="admin-list"></div>
    `;

    const categorySelect = document.getElementById("filter-category");
    const subjectSelect = document.getElementById("filter-subject");
    const topicSelect = document.getElementById("filter-topic");

    function fillSubjects() {
        const list = [];
        for (const subject of subjects) {
            if (!filters.category || String(subject.category) === filters.category) {
                list.push(subject);
            }
        }
        subjectSelect.innerHTML = `<option value="">${t("admin.filter.all")}</option>${optionsHtml(list, filters.subject)}`;
    }

    function fillTopics() {
        const list = [];
        for (const topic of topics) {
            if (filters.category && String(topic.category) !== filters.category) {
                continue;
            }
            if (filters.subject && String(topic.subject) !== filters.subject) {
                continue;
            }
            list.push(topic);
        }
        topicSelect.innerHTML = `<option value="">${t("admin.filter.all")}</option>${optionsHtml(list, filters.topic)}`;
    }

    // Загружаем только список — фильтры не перерисовываем, чтобы не сбить ввод в поиске
    let requestNumber = 0;
    async function loadList() {
        const list = document.getElementById("admin-list");
        const myRequest = ++requestNumber;

        const params = new URLSearchParams();
        for (const name of ["category", "subject", "topic", "difficulty", "search", "problem"]) {
            if (filters[name]) {
                params.set(name, filters[name]);
            }
        }
        params.set("page", filters.page);

        list.classList.add("is-loading");
        let data;
        try {
            data = await api("GET", "/admin/questions/?" + params.toString());
        } catch (error) {
            // Страницы больше нет (например, удалили последний вопрос на ней) — на первую
            if (error.status === 404 && filters.page > 1) {
                filters.page = 1;
                return loadList();
            }
            list.classList.remove("is-loading");
            list.innerHTML = `<div class="alert alert-error">${icon("alert-circle")}${esc(error.message)}</div>`;
            return;
        }
        if (myRequest !== requestNumber) {
            return; // пока ждали, фильтр уже поменяли — этот ответ устарел
        }
        list.classList.remove("is-loading");

        let rows = "";
        for (const question of data.results) {
            const path = [question.category_title, question.subject_title, question.topic_title]
                .filter(Boolean)
                .map(esc)
                .join(" › ");
            let meta = `${path} · <span class="admin-level" data-level="${question.difficulty}">${t("practice." + question.difficulty)}</span>`;
            if (question.image) {
                meta += ` · ${icon("image", "icon-sm")}`;
            }
            if (question.is_multiple) {
                meta += ` · <span class="badge badge-primary">${t("admin.multi")}</span>`;
            }
            if (!hasCorrectOption(question)) {
                meta += ` · <span class="badge badge-warning">${t("admin.no_correct")}</span>`;
            }
            rows += adminRow("questions", question, esc(question.text), meta);
        }

        const pages = Math.max(1, Math.ceil(data.count / 20));
        let pager = "";
        if (pages > 1) {
            pager = `
                <div class="review-nav admin-pager">
                    <button type="button" class="btn" id="page-prev"${filters.page <= 1 ? " disabled" : ""}>
                        ${icon("arrow-left")}<span class="btn-label">${t("result.prev")}</span>
                    </button>
                    <span class="review-position">${t("admin.page", { page: filters.page, pages: pages })}</span>
                    <button type="button" class="btn" id="page-next"${filters.page >= pages ? " disabled" : ""}>
                        <span class="btn-label">${t("result.next")}</span>${icon("arrow-right")}
                    </button>
                </div>
            `;
        }

        list.innerHTML = `
            <p class="muted admin-count">${t("admin.found", { count: tn("plural.questions", data.count) })}</p>
            <div class="admin-list">${rows || adminEmpty(t("admin.empty"))}</div>
            ${pager}
        `;

        bindDeleteButtons(list, "questions", function (id) {
            const question = findById(data.results, id);
            const name = question.text.length > 40 ? question.text.slice(0, 40) + "…" : question.text;
            return { name: name, text: t("admin.delete.question") };
        });

        if (pages > 1) {
            document.getElementById("page-prev").addEventListener("click", function () {
                filters.page -= 1;
                loadList();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
            document.getElementById("page-next").addEventListener("click", function () {
                filters.page += 1;
                loadList();
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }
    }

    function changed() {
        filters.page = 1;
        loadList();
    }

    categorySelect.addEventListener("change", function () {
        filters.category = categorySelect.value;
        filters.subject = "";
        filters.topic = "";
        fillSubjects();
        fillTopics();
        changed();
    });
    subjectSelect.addEventListener("change", function () {
        filters.subject = subjectSelect.value;
        filters.topic = "";
        fillTopics();
        changed();
    });
    topicSelect.addEventListener("change", function () {
        filters.topic = topicSelect.value;
        changed();
    });
    document.getElementById("filter-difficulty").addEventListener("change", function (event) {
        filters.difficulty = event.target.value;
        changed();
    });
    document.getElementById("filter-problem").addEventListener("change", function (event) {
        filters.problem = event.target.checked ? "no_correct" : "";
        changed();
    });

    // Поиск: ждём, пока пользователь перестанет печатать
    let searchTimer = null;
    document.getElementById("filter-search").addEventListener("input", function (event) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            filters.search = event.target.value.trim();
            changed();
        }, 400);
    });

    fillSubjects();
    fillTopics();
    await loadList();
}

// Поле картинки: текущая картинка, выбор новой файла и кнопка «Убрать»
function imageFieldHtml(name, label, url) {
    return `
        <div class="field admin-image" data-image="${name}">
            <span class="field-label">${label}</span>
            <div class="admin-image-preview"${url ? "" : " hidden"}>
                <img src="${esc(url || "")}" alt="">
                <button type="button" class="btn btn-small btn-icon-danger" data-image-remove>${icon("trash-2")}${t("admin.image.remove")}</button>
            </div>
            <label class="btn admin-image-pick">
                ${icon("image")}<span>${t("admin.image.pick")}</span>
                <input type="file" accept="image/*" hidden>
            </label>
        </div>
    `;
}

// Возвращает объект: какой файл выбран и нужно ли удалить старую картинку
function bindImageField(form, name) {
    const box = form.querySelector(`[data-image="${name}"]`);
    const preview = box.querySelector(".admin-image-preview");
    const img = preview.querySelector("img");
    const input = box.querySelector('input[type="file"]');
    const state = { file: null, remove: false };

    input.addEventListener("change", function () {
        if (input.files.length === 0) {
            return;
        }
        state.file = input.files[0];
        state.remove = false;
        img.src = URL.createObjectURL(state.file);
        preview.hidden = false;
    });
    box.querySelector("[data-image-remove]").addEventListener("click", function () {
        state.file = null;
        state.remove = true;
        input.value = "";
        preview.hidden = true;
    });
    return state;
}

async function adminQuestionForm(id) {
    const [question, topics, categories, subjects] = await Promise.all([
        id
            ? api("GET", "/admin/questions/" + id + "/")
            : {
                  topic: adminQuestionFilters.topic,
                  text: "",
                  difficulty: "medium",
                  is_multiple: false,
                  explanation: "",
                  image: null,
                  explanation_image: null,
                  options: [
                      { text: "", is_correct: true },
                      { text: "", is_correct: false },
                      { text: "", is_correct: false },
                      { text: "", is_correct: false },
                  ],
              },
        api("GET", "/admin/topics/"),
        api("GET", "/admin/categories/"),
        api("GET", "/admin/subjects/"),
    ]);

    // С чего начать выбор: тема вопроса, а у нового вопроса — фильтры из списка вопросов
    const startTopic = findById(topics, Number(question.topic));
    let startCategory = adminQuestionFilters.category;
    let startSubject = adminQuestionFilters.subject;
    if (startTopic) {
        startCategory = String(startTopic.category);
        startSubject = startTopic.subject ? String(startTopic.subject) : "none";
    }

    let difficultyHtml = "";
    for (const level of ADMIN_DIFFICULTIES) {
        difficultyHtml += `
            <label class="segment" data-level="${level}">
                <input type="radio" name="difficulty" value="${level}"${question.difficulty === level ? " checked" : ""}>
                <span>${t("practice." + level)}</span>
            </label>
        `;
    }

    const fields = `
        <div class="admin-topic-picker">
            <label>${t("admin.field.category")}
                <select id="pick-category">
                    <option value="">${t("exam.choose_placeholder")}</option>
                    ${optionsHtml(categories, startCategory)}
                </select>
            </label>
            <label id="pick-subject-box">${t("admin.field.subject")}
                <select id="pick-subject"></select>
            </label>
            <label>${t("admin.field.topic")}
                <select name="topic" required></select>
            </label>
        </div>
        <div class="field">
            <span class="field-label">${t("practice.difficulty")}</span>
            <div class="segmented">${difficultyHtml}</div>
        </div>
        <label class="admin-check admin-multi-toggle">
            <input type="checkbox" name="is_multiple"${question.is_multiple ? " checked" : ""}>
            <span>${t("admin.field.is_multiple")}</span>
        </label>
        <label>${t("admin.field.text")}
            <textarea name="text" rows="4" required>${esc(question.text)}</textarea>
        </label>
        ${imageFieldHtml("image", t("admin.field.image"), question.image)}

        <div class="field">
            <span class="field-label">${t("admin.field.options")}</span>
            <p class="field-hint admin-options-hint" id="options-hint"></p>
            <div class="admin-options" id="admin-options"></div>
            <button type="button" class="btn btn-small admin-add-row" id="add-option">${icon("plus")}${t("admin.option.add")}</button>
        </div>

        <label>${t("admin.field.explanation")}
            <textarea name="explanation" rows="4">${esc(question.explanation)}</textarea>
        </label>
        ${imageFieldHtml("explanation_image", t("admin.field.explanation_image"), question.explanation_image)}
    `;

    const title = id ? t("admin.edit.question", { id: id }) : t("admin.new.question");
    app.innerHTML = `
        ${adminHead("questions", title)}
        ${adminFormHtml("questions", fields)}
    `;

    // ----- Выбор темы: категория → предмет → тема -----
    const categorySelect = document.getElementById("pick-category");
    const subjectSelect = document.getElementById("pick-subject");
    const subjectBox = document.getElementById("pick-subject-box");
    const topicSelect = document.querySelector('#admin-form select[name="topic"]');
    const placeholder = `<option value="">${t("exam.choose_placeholder")}</option>`;

    function fillSubjects(selected) {
        const list = [];
        let hasTopicsWithoutSubject = false;
        for (const subject of subjects) {
            if (String(subject.category) === categorySelect.value) {
                list.push(subject);
            }
        }
        for (const topic of topics) {
            if (String(topic.category) === categorySelect.value && !topic.subject) {
                hasTopicsWithoutSubject = true;
            }
        }
        // У категории нет предметов (например, Авто) — поле «Предмет» не нужно
        subjectBox.hidden = categorySelect.value !== "" && list.length === 0;

        let html = placeholder + optionsHtml(list, selected);
        if (hasTopicsWithoutSubject && list.length > 0) {
            html += `<option value="none"${selected === "none" ? " selected" : ""}>${t("admin.no_subject")}</option>`;
        }
        subjectSelect.innerHTML = html;
        subjectSelect.disabled = categorySelect.value === "";
    }

    function fillTopics(selected) {
        const list = [];
        for (const topic of topics) {
            if (String(topic.category) !== categorySelect.value) {
                continue;
            }
            if (!subjectBox.hidden) {
                if (subjectSelect.value === "") {
                    continue; // сначала нужно выбрать предмет
                }
                if (subjectSelect.value === "none" ? topic.subject : String(topic.subject) !== subjectSelect.value) {
                    continue;
                }
            }
            list.push(topic);
        }
        topicSelect.innerHTML = placeholder + optionsHtml(list, selected);
        topicSelect.disabled = list.length === 0;
    }

    categorySelect.addEventListener("change", function () {
        fillSubjects("");
        fillTopics("");
    });
    subjectSelect.addEventListener("change", function () {
        fillTopics("");
    });
    fillSubjects(startSubject);
    fillTopics(question.topic);

    // ----- Варианты ответа -----
    const options = question.options.map(function (option) {
        return { id: option.id, text: option.text, is_correct: option.is_correct };
    });
    const optionsBox = document.getElementById("admin-options");
    const multipleInput = document.querySelector('#admin-form input[name="is_multiple"]');

    // Перед перерисовкой забираем то, что пользователь уже ввёл
    function readOptions() {
        const rows = optionsBox.querySelectorAll(".admin-option");
        for (let i = 0; i < rows.length; i++) {
            options[i].text = rows[i].querySelector('input[type="text"]').value;
            options[i].is_correct = rows[i].querySelector(".admin-option-correct input").checked;
        }
    }

    // Один правильный ответ — переключатели (radio), несколько — галочки (checkbox)
    function showOptions() {
        const multiple = multipleInput.checked;
        const inputType = multiple ? "checkbox" : "radio";
        optionsBox.classList.toggle("admin-options-multi", multiple);
        document.getElementById("options-hint").textContent = multiple
            ? t("admin.hint.options_multi")
            : t("admin.hint.options");

        let html = "";
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            html += `
                <div class="admin-option">
                    <label class="admin-option-correct" title="${t("admin.option.correct")}">
                        <input type="${inputType}" name="correct"${option.is_correct ? " checked" : ""}>
                        <span>${OPTION_LETTERS[i] || i + 1}</span>
                    </label>
                    <input type="text" value="${esc(option.text)}" placeholder="${t("admin.option.placeholder")}">
                    <button type="button" class="btn btn-icon btn-icon-danger" data-remove="${i}"
                        title="${t("admin.delete")}"${options.length <= 2 ? " disabled" : ""}>${icon("x")}</button>
                </div>
            `;
        }
        optionsBox.innerHTML = html;
        for (const button of optionsBox.querySelectorAll("[data-remove]")) {
            button.addEventListener("click", function () {
                readOptions();
                options.splice(Number(button.dataset.remove), 1);
                showOptions();
            });
        }
        document.getElementById("add-option").disabled = options.length >= OPTION_LETTERS.length;
    }

    // Выключили «несколько ответов» — оставляем отмеченным только первый правильный
    multipleInput.addEventListener("change", function () {
        readOptions();
        if (!multipleInput.checked) {
            let found = false;
            for (const option of options) {
                if (option.is_correct && found) {
                    option.is_correct = false;
                }
                if (option.is_correct) {
                    found = true;
                }
            }
        }
        showOptions();
    });

    document.getElementById("add-option").addEventListener("click", function () {
        readOptions();
        options.push({ text: "", is_correct: false });
        showOptions();
        const inputs = optionsBox.querySelectorAll('input[type="text"]');
        inputs[inputs.length - 1].focus();
    });
    showOptions();

    const form = document.getElementById("admin-form");
    const image = bindImageField(form, "image");
    const explanationImage = bindImageField(form, "explanation_image");

    bindAdminForm(
        "questions",
        {
            topic: t("admin.field.topic"),
            text: t("admin.field.text"),
            difficulty: t("practice.difficulty"),
            options: t("admin.field.options"),
            explanation: t("admin.field.explanation"),
            image: t("admin.field.image"),
            explanation_image: t("admin.field.explanation_image"),
        },
        async function (form) {
            readOptions();
            if (!form.elements.topic.value) {
                throw new Error(t("admin.topic.required"));
            }
            // Проверяем сами — сообщение будет понятным и на нужном языке
            for (const option of options) {
                if (option.text.trim() === "") {
                    throw new Error(t("admin.option.empty"));
                }
            }
            const body = {
                topic: numberOrNull(form.elements.topic.value),
                difficulty: form.querySelector('input[name="difficulty"]:checked').value,
                is_multiple: multipleInput.checked,
                text: form.elements.text.value.trim(),
                explanation: form.elements.explanation.value.trim(),
                options: options.map(function (option) {
                    const data = { text: option.text.trim(), is_correct: option.is_correct };
                    if (option.id) {
                        data.id = option.id;
                    }
                    return data;
                }),
            };
            if (image.remove) {
                body.image = null;
            }
            if (explanationImage.remove) {
                body.explanation_image = null;
            }

            // 1) текст и варианты — обычным JSON
            const saved = id
                ? await api("PATCH", "/admin/questions/" + id + "/", body)
                : await api("POST", "/admin/questions/", body);

            // 2) картинки — отдельным запросом, если выбрали новые
            if (image.file || explanationImage.file) {
                const files = new FormData();
                if (image.file) {
                    files.append("image", image.file);
                }
                if (explanationImage.file) {
                    files.append("explanation_image", explanationImage.file);
                }
                await api("PATCH", "/admin/questions/" + saved.id + "/", files);
            }
        }
    );
}

// ---------- Экзамены ----------

async function adminExams() {
    const exams = await api("GET", "/admin/exams/");

    let rows = "";
    for (const exam of exams) {
        const meta = [
            esc(exam.category_title),
            tn("plural.sections", exam.sections.length),
            tn("plural.questions", exam.questions_count),
            t("exam.minutes", { count: exam.time_limit }),
        ];
        if (exam.max_mistakes !== null) {
            meta.push(t("exam.max_mistakes", { times: tn("plural.times", exam.max_mistakes) }));
        }
        rows += adminRow("exams", exam, esc(exam.title), meta.join(" · "));
    }

    app.innerHTML = `
        ${adminHead("exams", t("admin.exams"), "", adminAddButton("exams"))}
        <div class="admin-list">${rows || adminEmpty(t("admin.empty"))}</div>
    `;

    bindDeleteButtons(app, "exams", function (id) {
        return { name: findById(exams, id).title, text: t("admin.delete.exam") };
    });
}

async function adminExamForm(id) {
    const [exam, categories, subjects] = await Promise.all([
        id
            ? api("GET", "/admin/exams/" + id + "/")
            : {
                  category: "",
                  title: "",
                  time_limit: 60,
                  max_mistakes: null,
                  sections: [{ title: "", subject: null, is_choice: false, questions_count: 10, points: "1" }],
                  subject_pairs: [],
              },
        api("GET", "/admin/categories/"),
        api("GET", "/admin/subjects/"),
    ]);

    const fields = `
        <div class="row">
            <label>${t("admin.field.category")}
                <select name="category" required>
                    <option value="">${t("exam.choose_placeholder")}</option>
                    ${optionsHtml(categories, exam.category)}
                </select>
            </label>
            <label>${t("admin.field.title")}
                <input name="title" value="${esc(exam.title)}" required>
            </label>
        </div>
        <div class="row">
            <label>${t("admin.field.time_limit")}
                <input name="time_limit" type="number" min="1" value="${exam.time_limit}">
            </label>
            <label>${t("admin.field.max_mistakes")}
                <input name="max_mistakes" type="number" min="0" value="${exam.max_mistakes === null ? "" : exam.max_mistakes}"
                    placeholder="${t("admin.hint.max_mistakes")}">
            </label>
        </div>

        <div class="field">
            <span class="field-label">${t("admin.field.sections")}</span>
            <div class="admin-sub-list" id="admin-sections"></div>
            <button type="button" class="btn btn-small admin-add-row" id="add-section">${icon("plus")}${t("admin.section.add")}</button>
        </div>

        <div class="field">
            <span class="field-label">${t("admin.field.pairs")}</span>
            <p class="field-hint admin-options-hint">${t("admin.hint.pairs")}</p>
            <div class="admin-sub-list" id="admin-pairs"></div>
            <button type="button" class="btn btn-small admin-add-row" id="add-pair">${icon("plus")}${t("admin.pair.add")}</button>
        </div>
    `;

    app.innerHTML = `
        ${adminHead("exams", id ? esc(exam.title) : t("admin.new.exam"))}
        ${adminFormHtml("exams", fields)}
    `;

    const form = document.getElementById("admin-form");
    const sections = exam.sections.map(function (section) {
        return Object.assign({}, section);
    });
    const pairs = exam.subject_pairs.map(function (pair) {
        return Object.assign({}, pair);
    });
    const sectionsBox = document.getElementById("admin-sections");
    const pairsBox = document.getElementById("admin-pairs");

    function categorySubjects() {
        const list = [];
        for (const subject of subjects) {
            if (String(subject.category) === form.elements.category.value) {
                list.push(subject);
            }
        }
        return list;
    }

    // В разделе «откуда вопросы»: все темы категории / на выбор / конкретный предмет
    function sourceValue(section) {
        if (section.is_choice) {
            return "choice";
        }
        return section.subject ? String(section.subject) : "";
    }

    function readSections() {
        const rows = sectionsBox.querySelectorAll(".admin-sub-row");
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const source = row.querySelector('[data-f="source"]').value;
            sections[i].title = row.querySelector('[data-f="title"]').value;
            sections[i].is_choice = source === "choice";
            sections[i].subject = source && source !== "choice" ? Number(source) : null;
            sections[i].questions_count = row.querySelector('[data-f="questions_count"]').value;
            sections[i].points = row.querySelector('[data-f="points"]').value;
        }
    }

    function readPairs() {
        const rows = pairsBox.querySelectorAll(".admin-sub-row");
        for (let i = 0; i < rows.length; i++) {
            pairs[i].first_subject = numberOrNull(rows[i].querySelector('[data-f="first"]').value);
            pairs[i].second_subject = numberOrNull(rows[i].querySelector('[data-f="second"]').value);
        }
    }

    function showSections() {
        const list = categorySubjects();
        let html = "";
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const source = sourceValue(section);
            html += `
                <div class="admin-sub-row admin-section-row">
                    <span class="admin-sub-num">${i + 1}</span>
                    <label>${t("admin.field.title")}
                        <input data-f="title" value="${esc(section.title)}">
                    </label>
                    <label>${t("admin.section.source")}
                        <select data-f="source">
                            <option value=""${source === "" ? " selected" : ""}>${t("admin.section.any")}</option>
                            <option value="choice"${source === "choice" ? " selected" : ""}>${t("admin.section.choice")}</option>
                            ${optionsHtml(list, source)}
                        </select>
                    </label>
                    <label>${t("practice.count")}
                        <input data-f="questions_count" type="number" min="1" value="${esc(section.questions_count)}">
                    </label>
                    <label>${t("admin.section.points")}
                        <input data-f="points" type="number" min="0" step="0.1" value="${esc(Number(section.points))}">
                    </label>
                    <button type="button" class="btn btn-icon btn-icon-danger" data-remove="${i}"
                        title="${t("admin.delete")}"${sections.length <= 1 ? " disabled" : ""}>${icon("x")}</button>
                </div>
            `;
        }
        sectionsBox.innerHTML = html;
        for (const button of sectionsBox.querySelectorAll("[data-remove]")) {
            button.addEventListener("click", function () {
                readSections();
                sections.splice(Number(button.dataset.remove), 1);
                showSections();
            });
        }
    }

    function showPairs() {
        const list = categorySubjects();
        let html = "";
        for (let i = 0; i < pairs.length; i++) {
            html += `
                <div class="admin-sub-row admin-pair-row">
                    <span class="admin-sub-num">${i + 1}</span>
                    <label>${t("exam.choose_subject", { number: 1 })}
                        <select data-f="first">
                            <option value="">${t("exam.choose_placeholder")}</option>
                            ${optionsHtml(list, pairs[i].first_subject)}
                        </select>
                    </label>
                    <label>${t("exam.choose_subject", { number: 2 })}
                        <select data-f="second">
                            <option value="">${t("exam.choose_placeholder")}</option>
                            ${optionsHtml(list, pairs[i].second_subject)}
                        </select>
                    </label>
                    <button type="button" class="btn btn-icon btn-icon-danger" data-remove="${i}" title="${t("admin.delete")}">${icon("x")}</button>
                </div>
            `;
        }
        pairsBox.innerHTML = html || `<p class="muted admin-sub-empty">${t("admin.pair.none")}</p>`;
        for (const button of pairsBox.querySelectorAll("[data-remove]")) {
            button.addEventListener("click", function () {
                readPairs();
                pairs.splice(Number(button.dataset.remove), 1);
                showPairs();
            });
        }
    }

    document.getElementById("add-section").addEventListener("click", function () {
        readSections();
        sections.push({ title: "", subject: null, is_choice: false, questions_count: 10, points: "1" });
        showSections();
    });
    document.getElementById("add-pair").addEventListener("click", function () {
        readPairs();
        pairs.push({ first_subject: null, second_subject: null });
        showPairs();
    });
    // Сменили категорию — предметы в разделах и парах уже не подходят
    form.elements.category.addEventListener("change", function () {
        readSections();
        readPairs();
        for (const section of sections) {
            section.subject = null;
        }
        for (const pair of pairs) {
            pair.first_subject = null;
            pair.second_subject = null;
        }
        showSections();
        showPairs();
    });
    showSections();
    showPairs();

    bindAdminForm(
        "exams",
        {
            category: t("admin.field.category"),
            title: t("admin.field.title"),
            time_limit: t("admin.field.time_limit"),
            max_mistakes: t("admin.field.max_mistakes"),
            sections: t("admin.field.sections"),
            subject_pairs: t("admin.field.pairs"),
        },
        async function (form) {
            readSections();
            readPairs();
            const body = {
                category: numberOrNull(form.elements.category.value),
                title: form.elements.title.value.trim(),
                time_limit: numberOrNull(form.elements.time_limit.value),
                max_mistakes: numberOrNull(form.elements.max_mistakes.value),
                sections: sections.map(function (section, index) {
                    return {
                        order: index + 1,
                        title: section.title.trim(),
                        subject: section.subject,
                        is_choice: section.is_choice,
                        questions_count: numberOrNull(section.questions_count),
                        points: numberOrNull(section.points),
                    };
                }),
                subject_pairs: pairs,
            };
            if (id) {
                await api("PATCH", "/admin/exams/" + id + "/", body);
            } else {
                await api("POST", "/admin/exams/", body);
            }
        }
    );
}
