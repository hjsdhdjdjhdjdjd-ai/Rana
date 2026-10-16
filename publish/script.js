/* ============================================================
   Mrs.Rana — منطق تسجيل الدخول (كود الطالب + الرقم السري)
   البيانات أدناه تجريبية، استبدلها بالربط بقاعدة البيانات
   ============================================================ */

/* الطلاب المسجلون فقط (بدون بيانات تجريبية) */
function loadStudents() {
    return readList(STUDENTS_KEY).filter(s => s && s.code);
}

function loadGuardians() {
    let list = [];
    try {
        list = JSON.parse(localStorage.getItem("rana_guardians") || "[]");
    } catch (e) {
        list = [];
    }
    return Array.isArray(list) ? list : [];
}

const SESSION_KEY = "rana_session";
const STUDENTS_KEY = "rana_students";
const MAX_ATTEMPTS = 3;      // عدد المحاولات قبل قفل مؤقت
const LOCK_SECONDS = 15;     // مدة القفل بالثواني
const FAKE_DELAY = 600;      // محاكاة تأخير الخادم (مللي ثانية)

function readList(k) {
    try {
        const v = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
}

const form = document.getElementById("loginForm");
const codeInput = document.getElementById("studentCode");
const secretInput = document.getElementById("secretNumber");
const rememberChk = document.getElementById("rememberMe");
const errorBox = document.getElementById("formError");
const loginBtn = document.getElementById("loginBtn");
const toggleBtn = document.getElementById("toggleSecret");

let attempts = 0;
let busy = false;
let lockTimer = null;

/* قبل أي تحقق: اسحب أحدث نسخة من السحابة (لو متاحة) ثم تابع الدخول */
function withCloudReady(fn) {
    if (window.DB && DB.ready) {
        Promise.race([
            DB.pullAll(),
            new Promise((res) => setTimeout(() => res(false), 4000))
        ]).then(() => fn()).catch(() => fn());
    } else {
        fn();
    }
}

/* إذا كانت جلسة فعّالة ننتقل مباشرة لصفحتها */
const existingSession = getSession();
if (existingSession) {
    location.replace(existingSession.type === "guardian" ? "guardian.html" : "dashboard.html");
}

function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function showError(msg, shake) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
    if (shake) {
        form.classList.remove("shake");
        void form.offsetWidth; // إعادة تشغيل الأنيميشن
        form.classList.add("shake");
    }
}

function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("show");
}

function findStudent(code, secret) {
    return loadStudents().find(s => s.code === code && s.secret === secret);
}

function startLock() {
    let left = LOCK_SECONDS;
    loginBtn.disabled = true;
    showError("تم تجاوز عدد المحاولات المسموحة، حاول مجددًا بعد " + left + " ثانية");
    lockTimer = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(lockTimer);
            lockTimer = null;
            loginBtn.disabled = false;
            clearError();
        } else {
            showError("تم تجاوز عدد المحاولات المسموحة، حاول مجددًا بعد " + left + " ثانية");
        }
    }, 1000);
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy || lockTimer) return;

    const code = codeInput.value.trim();
    const secret = secretInput.value.trim();

    if (!code && !secret) {
        showError("من فضلك أدخل كود الطالب أو الرقم السري", true);
        codeInput.focus();
        return;
    }
    if (!secret) {
        showError("من فضلك أدخل الرقم السري", true);
        secretInput.focus();
        return;
    }
    if (!/^\d+$/.test(secret)) {
        showError("الرقم السري يجب أن يتكون من أرقام فقط", true);
        secretInput.focus();
        return;
    }

    clearError();
    busy = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "جارٍ التحقق...";

    /* اسحب أحدث نسخة من السحابة أولًا ثم تحقق — الطالب المسجل يلاقي نفسه */
    withCloudReady(() => {
        const candidates = loadGuardians().filter(g => g && g.secret === secret);
        if (code) {
            const hit = candidates.find(g => g.code === code);
            if (hit) { loginAsGuardian(hit); return; }
        } else if (candidates.length === 1) {
            loginAsGuardian(candidates[0]);
            return;
        } else if (candidates.length > 1) {
            busy = false;
            loginBtn.disabled = false;
            loginBtn.textContent = "دخول";
            showError("هذا الرقم السري مسجل لأكثر من طالب، أدخل كود الطالب", true);
            codeInput.focus();
            return;
        }

        /* الطالب: يجب إدخال الكود مع الرقم السري */
        if (!code) {
            busy = false;
            loginBtn.disabled = false;
            loginBtn.textContent = "دخول";
            showError("من فضلك أدخل كود الطالب", true);
            codeInput.focus();
            return;
        }

        const student = findStudent(code, secret);
        busy = false;

        if (!student) {
            attempts++;
            loginBtn.disabled = false;
            loginBtn.textContent = "دخول";

            if (attempts >= MAX_ATTEMPTS) {
                attempts = 0;
                startLock();
            } else {
                showError("كود الطالب أو الرقم السري غير صحيح، حاول مرة أخرى", true);
                secretInput.select();
            }
            return;
        }

        finishStudentLogin(student);
    });
});

function loginAsGuardian(guardian) {
    const gSession = {
        type: "guardian",
        name: guardian.name,
        phone: guardian.phone,
        code: guardian.code,
        studentName: guardian.studentName,
        at: Date.now(),
        page: "index.html"
    };
    const gStore = rememberChk.checked ? localStorage : sessionStorage;
    gStore.setItem(SESSION_KEY, JSON.stringify(gSession));

    clearError();
    loginBtn.textContent = "✓ تم تسجيل الدخول";
    loginBtn.classList.add("success");
    setTimeout(() => { location.href = "guardian.html"; }, FAKE_DELAY);
}

function finishStudentLogin(student) {
    /* نجاح الدخول — نحفظ بيانات الطالب بدون الرقم السري */
    const session = { code: student.code, name: student.name, grade: student.grade, at: Date.now() };
    const store = rememberChk.checked ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(session));

    clearError();
    loginBtn.textContent = "✓ تم تسجيل الدخول";
    loginBtn.classList.add("success");
    setTimeout(() => { location.href = "dashboard.html"; }, FAKE_DELAY);
}

/* إظهار / إخفاء الرقم السري */
toggleBtn.addEventListener("click", () => {
    const hidden = secretInput.type === "password";
    secretInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "🙈" : "👁";
    toggleBtn.setAttribute("aria-label", hidden ? "إخفاء الرقم السري" : "إظهار الرقم السري");
    secretInput.focus();
});

/* إزالة رسالة الخطأ عند الكتابة */
[codeInput, secretInput].forEach((el) => el.addEventListener("input", clearError));
