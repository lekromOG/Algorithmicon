"use strict";
const THEME_KEY = "algorithmicon-theme";
function savedTheme() {
    try {
        const value = window.localStorage.getItem(THEME_KEY);
        return value === "light" || value === "dark" ? value : null;
    }
    catch {
        return null;
    }
}
function saveTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        window.localStorage.setItem(THEME_KEY, theme);
    }
    catch {
    }
}
function currentTheme() {
    const forced = document.documentElement.dataset.theme;
    if (forced === "light" || forced === "dark")
        return forced;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
(() => {
    const saved = savedTheme();
    if (saved)
        document.documentElement.dataset.theme = saved;
})();
