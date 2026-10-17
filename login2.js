/* دخول المعلم من جدول المعلمين السحابي */
const SESSION_KEY = "rana_session";
const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 15;
const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const secretInput = document.getElementById("secretNumber");
const rememberChk = document.getElementById("rememberMe");
const errorBox = document.getElementById("formError");
const loginBtn = document.getElementById("loginBtn");
const toggleBtn = document.getElementById("toggleSecret");
let attempts = 0;
let busy = false;
let lockTimer = null;
if (getSession()) { location.replace("dashboard.html"); }
function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}
function showError(msg, shake) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
    if (shake) { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); }
}
function clearError() { errorBox.textContent = ""; errorBox.classList.remove("show"); }
function startLock() {
    let left = LOCK_SECONDS;
    loginBtn.disabled = true;
    showError("تم تجاوز عدد المحاولات حاول بعد " + left + " ثانية");
    lockTimer = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(lockTimer); lockTimer = null; loginBtn.disabled = false; clearError(); }
        else { showError("تم تجاوز عدد المحاولات حاول بعد " + left + " ثانية"); }
    }, 1000);
}
function loadLocalTeachers() {
    try {
        const v = JSON.parse(localStorage.getItem("rana_teachers") || "[]");
        return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
}
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy || lockTimer) return;
    const username = usernameInput.value.trim();
    const secret = secretInput.value.trim();
    if (!username) { showError("ادخل اسم المستخدم", true); usernameInput.focus(); return; }
    if (!secret) { showError("ادخل الرقم السري", true); secretInput.focus(); return; }
    clearError(); busy = true; loginBtn.disabled = true; loginBtn.textContent = "جاري التحقق";
    const done = (user) => {
        busy = false;
        if (!user) {
            attempts++; loginBtn.disabled = false; loginBtn.textContent = "دخول";
            if (attempts >= MAX_ATTEMPTS) { attempts = 0; startLock(); }
            else { showError("اسم المستخدم او الرقم السري غير صحيح", true); secretInput.select(); }
            return;
        }
        const session = { username: user.username, name: user.name, role: "teacher", at: Date.now(), page: "login2.html" };
        const store = rememberChk.checked ? localStorage : sessionStorage;
        store.setItem(SESSION_KEY, JSON.stringify(session));
        clearError(); loginBtn.textContent = "تم تسجيل الدخول"; loginBtn.classList.add("success");
        if (window.DB && DB.ready) DB.pullAll();
        setTimeout(() => { location.href = "dashboard.html"; }, 600);
    };
    if (window.DB && DB.ready) {
        let finished = false;
        const to = setTimeout(() => { if (!finished) { finished = true; done(loadLocalTeachers().find(u => u.username === username && u.secret === secret)); } }, 4000);
        DB.sb.from("teachers").select("*").eq("username", username).then(({ data }) => {
            if (finished) return; finished = true; clearTimeout(to);
            const rows = data || [];
            try { localStorage.setItem("rana_teachers", JSON.stringify(rows)); } catch (x) {}
            done(rows.find(u => u.secret === secret));
        }).catch(() => { if (!finished) { finished = true; clearTimeout(to); done(loadLocalTeachers().find(u => u.username === username && u.secret === secret)); } });
    } else {
        setTimeout(() => done(loadLocalTeachers().find(u => u.username === username && u.secret === secret)), 600);
    }
});
toggleBtn.addEventListener("click", () => {
    const hidden = secretInput.type === "password";
    secretInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "اخفاء" : "اظهار";
    secretInput.focus();
});
[usernameInput, secretInput].forEach((el) => el.addEventListener("input", clearError));
