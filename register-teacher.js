/* تسجيل معلم جديد في جدول المعلمين السحابي */
const form = document.getElementById("regForm");
// Helper to get element safely
function getElement(id) {
  const el = document.getElementById(id);
  return el;
}
const nameInput = getElement("regName");
const userInput = getElement("regUser");
const secretInput = getElement("regSecret");
const errorBox = getElement("regError");
const regBtn = getElement("regBtn");
const toggleBtn = getElement("regToggle");
let busy = false;
function showError(msg, shake) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
    if (shake) { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); }
}
function clearError() { errorBox.textContent = ""; errorBox.classList.remove("show"); }
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    const name = nameInput.value.trim();
    const username = userInput.value.trim().toLowerCase();
    const secret = secretInput.value.trim();
    if (!name) { showError("ادخل اسم المعلم", true); nameInput.focus(); return; }
    if (!username) { showError("ادخل اسم المستخدم", true); userInput.focus(); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { showError("اسم المستخدم انجليزي وارقام 3-20 حرف بدون مسافات", true); userInput.focus(); return; }
    if (!secret) { showError("ادخل الرقم السري", true); secretInput.focus(); return; }
    if (!/^\d{4,}$/.test(secret)) { showError("الرقم السري 4 ارقام على الاقل", true); secretInput.focus(); return; }
    clearError(); busy = true; regBtn.disabled = true; regBtn.textContent = "جاري التسجيل";
    const finish = (ok, msg) => {
        busy = false; regBtn.disabled = false; regBtn.textContent = "تسجيل";
        if (!ok) { showError(msg, true); return; }
        clearError(); regBtn.textContent = "تم التسجيل بنجاح";
        regBtn.classList.add("success");
        setTimeout(() => { location.href = "login2.html"; }, 800);
    };
    if (window.DB && DB.ready) {
        DB.sb.from("teachers").select("username").eq("username", username).then(({ data }) => {
            if (data && data.length) { finish(false, "اسم المستخدم مسجل بالفعل"); return; }
            DB.sb.from("teachers").insert({ username: username, secret: secret, name: name }).then(({ error }) => {
                if (error) { finish(false, "تعذر التسجيل حاول مرة اخرى"); return; }
                finish(true);
            }).catch(() => finish(false, "تعذر الاتصال حاول مرة اخرى"));
        }).catch(() => finish(false, "تعذر الاتصال حاول مرة اخرى"));
    } else {
        finish(false, "لا يوجد اتصال بالانترنت");
    }
});
toggleBtn.addEventListener("click", () => {
    const hidden = secretInput.type === "password";
    secretInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "اخفاء" : "اظهار";
    secretInput.focus();
});
[nameInput, userInput, secretInput].forEach((el) => el.addEventListener("input", clearError));
