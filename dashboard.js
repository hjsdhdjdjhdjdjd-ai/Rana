/* Mrs.Rana — dashboard (teacher + student), localStorage backend */
const SESSION_KEY = "rana_session";
const STUDENTS_KEY = "rana_students";
const GUARDIANS_KEY = "rana_guardians";
const TASKS_KEY = "rana_tasks";
const EVALS_KEY = "rana_evaluations";
const MSG_S_KEY = "rana_messages_student";
const MSG_G_KEY = "rana_messages_guardian";
const MSG_T_KEY = "rana_messages_to_teacher";
const WELCOME_KEY = "rana_welcome";
const PHOTOS_KEY = "rana_student_photos";
const CASCADE_KEYS = [TASKS_KEY, EVALS_KEY, MSG_S_KEY, MSG_G_KEY, GUARDIANS_KEY, MSG_T_KEY, WELCOME_KEY];
const attachState = {};
function logout() {
    // Remove session from storage
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    // Redirect to login page
    location.href = "login2.html";
}
function getSession() { try { const r = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function readList(k) { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveList(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function saveListSafe(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function toast(msg) { let t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.classList.add("show"); clearTimeout(t._x); t._x = setTimeout(function () { t.classList.remove("show"); }, 2200); }
function fmtTime(ts) { try { return new Date(ts).toLocaleString("ar-EG"); } catch (e) { return ""; } }
function loadStudents() { const added = readList(STUDENTS_KEY); return added.filter(function (s) { return s && s.code; }); }
function findStudent(code) { return loadStudents().find(function (s) { return s && s.code === code; }); }
function getPhoto(code) { try { const p = JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); return (code && p[code]) || null; } catch (e) { return null; } }
function setPhoto(code, dataUrl) { try { const p = JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); if (!code) return false; if (dataUrl) p[code] = dataUrl; else delete p[code]; localStorage.setItem(PHOTOS_KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
function fileToDataUrl(file, max) {
    max = max || 800;
    return new Promise(function (resolve, reject) {
        if (!file || (file.type || "").indexOf("image/") !== 0) { reject(new Error("not-image")); return; }
        const img = new Image(); const url = URL.createObjectURL(file);
        img.onload = function () {
            let w = img.width, h = img.height;
            if (w > max) { h = Math.round(h * max / w); w = max; }
            const c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad-image")); };
        img.src = url;
    });
}
function openImage(src) { const o = document.createElement("div"); o.className = "img-overlay"; const im = document.createElement("img"); im.src = src; o.appendChild(im); o.addEventListener("click", function () { o.remove(); }); document.body.appendChild(o); }
document.addEventListener("click", function (e) { const t = e.target && e.target.closest ? e.target.closest(".msg-img") : null; if (t && t.src) openImage(t.src); });
/* رفع فوري للسحابة بعد كل حفظ محلي */
function pushRow(table, row) { try { if (window.DB && DB.ready) DB.push(table, row); } catch (e) {} }
function pushDelete(table, match) { try { if (window.DB && DB.ready) DB.remove(table, match); } catch (e) {} }
/* boot */
const session = getSession();
if (!session) { location.replace("index.html"); }
else if (session.type === "guardian") { location.replace("guardian.html"); }
else {
    const isTeacher = !!session.username;
    $("studentName").textContent = session.name || "—";
    if (isTeacher) {
        $("lblCode").textContent = "User"; $("studentCode").textContent = session.username || "—";
        $("lblGrade").textContent = "Role"; $("studentGrade").textContent = session.role || "—";
        $("avatar").textContent = "T";
    } else {
        $("studentCode").textContent = session.code || "—";
        $("studentGrade").textContent = session.grade || findStudent(session.code)?.grade || "—";
        applyAvatar();
    }
    $("loginTime").textContent = session.at ? fmtTime(session.at) : "—";
    /* زرار الخروج يُضاف قبل أي عملية تهيئة لضمان عمله حتى لو حدث خطأ في اللوحات */
    $("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
        location.href = session.page || (isTeacher ? "login2.html" : "index.html");
    });
    try {
        if (isTeacher) { $("teacherArea").hidden = false; initTeacherPanel(); }
        else { $("studentArea").hidden = false; initStudentArea(); }
    } catch (e) { console.error("لوحةinit خطأ:", e); }
}
function applyAvatar() {
    const av = $("avatar"); if (!av || !session || session.username) return;
    const ph = getPhoto(session.code);
    if (ph) av.innerHTML = '<img src="' + esc(ph) + '" alt="" class="avatar-photo">';
    else av.textContent = "T";
}
/*__PART2__*//* teacher nav + add forms */
let activeCode = null;
function showPanel(id) {
    document.querySelectorAll(".panel").forEach(function (p) { p.hidden = (p.id !== id); });
    if (id) { $("teacherMenu").hidden = true; } else { $("teacherMenu").hidden = false; updateMsgBadge(); }
}
/* سحب أحدث نسخة من السحابة ثم إعادة العرض (أي تحديث يظهر فورًا) */
function refreshFromCloud(after) {
    try {
        if (window.DB && DB.ready) {
            DB.pullAll().then(function () { if (after) after(); }).catch(function () { if (after) after(); });
            return;
        }
    } catch (e) {}
    if (after) after();
}
function initTeacherPanel() {
    document.querySelectorAll(".menu-card").forEach(function (card) {
        card.addEventListener("click", function () {
            const id = card.getAttribute("data-panel");
            if (id === "panelStudents") renderStudents();
            if (id === "panelMsgTeacher") renderTeacherMsgs();
            showPanel(id);
        });
    });
    document.querySelectorAll("[data-back]").forEach(function (b) { b.addEventListener("click", function () { showPanel(null); }); });
    document.querySelectorAll("[data-back-list]").forEach(function (b) { b.addEventListener("click", function () { renderStudents(); showPanel("panelStudents"); }); });
    initStudentForm(); initGuardianForm(); initTaskForm(); initEvalForm();
    initMsgStudentForm(); initMsgGuardianForm(); initEditForm(); initWelcomeForm();
    setupPhotoControl("attachStuPhoto", "imgStuPhoto", "prevStuPhoto", function () { return activeCode; });
    updateMsgBadge();
    refreshFromCloud(function () { renderStudents(); updateMsgBadge(); });
}
function failFn(form, box) { return function (msg, el) { box.textContent = msg; box.classList.add("show"); form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); if (el) el.focus(); }; }
function okFn(form, box) { box.textContent = ""; box.classList.remove("show"); }
function initStudentForm() {
    const form = $("studentForm"); const box = $("studentFormError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const code = $("newStudentCode").value.trim(), name = $("newStudentName").value.trim();
        const secret = $("newStudentSecret").value.trim(), age = $("newStudentAge").value.trim();
        const school = $("newStudentSchool").value.trim(), grade = $("newStudentGrade").value.trim();
        if (!code) return fail("ادخل كود الطالب", $("newStudentCode"));
        if (!name) return fail("ادخل اسم الطالب", $("newStudentName"));
        if (!secret) return fail("ادخل الرقم السري", $("newStudentSecret"));
        if (!/^\d+$/.test(secret)) return fail("الرقم السري ارقام فقط", $("newStudentSecret"));
        if (findStudent(code)) return fail("هذا الكود مسجل بالفعل", $("newStudentCode"));
        const list = readList(STUDENTS_KEY);
        list.unshift({ code: code, secret: secret, name: name, age: age, school: school, grade: grade, at: Date.now() });
        saveList(STUDENTS_KEY, list); pushRow("students", { code: code, secret: secret, name: name, age: age || null, school: school || null, grade: grade || null, at: Date.now() }); okFn(form, box); form.reset();
        toast("تم حفظ الطالب"); renderStudents(); showPanel("panelStudents");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
/*__PART2B__*/
function initGuardianForm() {
    const form = $("guardianForm"); const box = $("guardianFormError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const name = $("guardianName").value.trim(), secret = $("guardianSecret").value.trim();
        const phone = $("guardianPhone").value.trim(), code = $("guardianStudentCode").value.trim();
        if (!name) return fail("ادخل اسم ولي الامر", $("guardianName"));
        if (!secret) return fail("ادخل الرقم السري", $("guardianSecret"));
        if (!/^\d+$/.test(secret)) return fail("الرقم السري ارقام فقط", $("guardianSecret"));
        if (!code) return fail("ادخل كود الطالب المرتبط", $("guardianStudentCode"));
        const st = findStudent(code);
        if (!st) return fail("لا يوجد طالب بهذا الكود", $("guardianStudentCode"));
        const list = readList(GUARDIANS_KEY);
        const rec = { name: name, secret: secret, phone: phone, code: code, studentName: st.name, at: Date.now() };
        const ix = list.findIndex(function (g) { return g && g.code === code; });
        if (ix >= 0) list[ix] = rec; else list.unshift(rec);
        saveList(GUARDIANS_KEY, list); pushRow("guardians", { code: code, name: name, secret: secret, phone: phone || null, student_name: st.name, at: Date.now() }); okFn(form, box); form.reset();
        toast("تم حفظ ولي الامر"); renderStudents(); showPanel("panelStudents");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
function renderStudents() {
    const ul = $("studentList"); if (!ul) return;
    const students = loadStudents();
    $("studentsCount").textContent = students.length;
    if (!students.length) { ul.innerHTML = '<li class="empty">لا يوجد طلاب بعد.</li>'; return; }
    ul.innerHTML = "";
    students.forEach(function (s) {
        const ph = getPhoto(s.code);
        const g = readList(GUARDIANS_KEY).find(function (x) { return x && x.code === s.code; });
        const li = document.createElement("li"); li.className = "student-item"; li.dataset.code = s.code;
        li.innerHTML =
            '<div class="student-head"><span class="stu-name-wrap">' +
            (ph ? '<img class="stu-thumb msg-img" src="' + esc(ph) + '" alt="">' : "") +
            "<b>" + esc(s.name) + "</b></span>" +
            '<span class="chip">' + esc(s.grade || "—") + "</span></div>" +
            '<div class="student-meta"><span>كود: <b>' + esc(s.code) + "</b></span>" +
            (g ? "<span>ولي الامر: <b>" + esc(g.name) + "</b></span>" : "<span>ولي الامر: —</span>") +
            "</div>" +
            '<div class="action-row">' +
            '<button type="button" class="action-btn" data-act="tasks">مهام</button>' +
            '<button type="button" class="action-btn" data-act="eval">تقييم</button>' +
            '<button type="button" class="action-btn" data-act="msg">رسالة للطالب</button>' +
            '<button type="button" class="action-btn" data-act="guard">رسالة لولي الامر</button>' +
            '<button type="button" class="action-btn" data-act="welcome">ترحيب</button>' +
            '<button type="button" class="action-btn" data-act="edit">تعديل</button>' +
            '<button type="button" class="action-btn" data-act="del">حذف</button>' +
            "</div>";
        ul.appendChild(li);
    });
    ul.querySelectorAll(".student-item").forEach(function (li) {
        li.querySelectorAll(".action-btn").forEach(function (btn) {
            btn.addEventListener("click", function () { openStudentAction(li.dataset.code, btn.getAttribute("data-act")); });
        });
    });
}
/*__PART2C__*/
function openStudentAction(code, act) {
    const s = findStudent(code); if (!s) return;
    activeCode = code;
    if (act === "tasks") { $("tasksStudentName").textContent = s.name; renderTasks(); showPanel("panelTasks"); }
    else if (act === "eval") { $("evalStudentName").textContent = s.name; initEvalStars(); renderLastEval(); showPanel("panelEval"); }
    else if (act === "msg") { $("msgStudentName").textContent = s.name; renderMsgHistory(MSG_S_KEY, code, "msgStudentList"); showPanel("panelMsgStudent"); }
    else if (act === "guard") { $("msgGuardianName").textContent = s.name; renderMsgHistory(MSG_G_KEY, code, "msgGuardianList"); showPanel("panelMsgGuardian"); }
    else if (act === "welcome") { $("welcomeStudentName").textContent = s.name; fillWelcome(); showPanel("panelWelcome"); }
    else if (act === "edit") { fillEditForm(s); showPanel("panelEdit"); }
    else if (act === "del") { deleteStudent(code); }
}
function deleteStudent(code) {
    if (!confirm("حذف الطالب وكل بياناته؟")) return;
    saveList(STUDENTS_KEY, readList(STUDENTS_KEY).filter(function (s) { return s && s.code !== code; }));
    CASCADE_KEYS.forEach(function (k) { saveList(k, readList(k).filter(function (r) { return r && r.code !== code; })); });
    ["students", "guardians", "tasks", "evals", "messages", "welcome", "photos"].forEach(function (t) { pushDelete(t, { code: code }); });
    setPhoto(code, null); activeCode = null;
    toast("تم حذف الطالب"); renderStudents();
}
/*__PART3__*//* tasks + eval */
function initTaskForm() {
    const form = $("taskForm"); const box = $("taskFormError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("taskText").value.trim();
        if (!activeCode) return fail("اختر طالبا اولا");
        if (!text) return fail("اكتب المطلوب", $("taskText"));
        const list = readList(TASKS_KEY);
        const rec = { code: activeCode, text: text, done: false, at: Date.now() };
        list.unshift(rec);
        saveList(TASKS_KEY, list); pushRow("tasks", { code: rec.code, text: rec.text, done: false, at: rec.at }); okFn(form, box); form.reset();
        renderTasks(); toast("تمت اضافة المطلوب");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
function renderTasks() {
    const ul = $("taskList"); if (!ul || !activeCode) return;
    const items = readList(TASKS_KEY).filter(function (t) { return t && t.code === activeCode; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد مطلوبات.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (t, i) {
        const li = document.createElement("li");
        li.className = "task-item" + (t.done ? " done" : "");
        li.innerHTML = "<span>" + esc(t.text) + "</span>";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!t.done;
        cb.addEventListener("change", function () {
            const all = readList(TASKS_KEY);
            const one = all.filter(function (x) { return x && x.code === activeCode; })[i];
            if (one) one.done = cb.checked;
            saveList(TASKS_KEY, all); renderTasks();
            if (one && one.id) pushRow("tasks", { id: one.id, code: one.code, text: one.text, done: !!one.done, at: one.at });
        });
        const del = document.createElement("button");
        del.type = "button"; del.className = "task-del"; del.textContent = "🗑";
        del.addEventListener("click", function () {
            const all = readList(TASKS_KEY);
            let n = -1;
            all.forEach(function (x, xi) { if (x && x.code === activeCode) { n++; if (n === i) { if (x.id) pushDelete("tasks", { id: x.id }); all.splice(xi, 1); } } });
            saveList(TASKS_KEY, all); renderTasks();
        });
        li.prepend(cb); li.appendChild(del); ul.appendChild(li);
    });
}
let evalStars = 0;
function initEvalStars() {
    evalStars = 0; paintStars();
    document.querySelectorAll("#starRow .star").forEach(function (st) {
        st.onclick = function () { evalStars = parseInt(st.getAttribute("data-star"), 10); paintStars(); };
    });
}
function paintStars() {
    const labels = ["", "ضعيف", "مقبول", "جيد", "جيد جدا", "ممتاز"];
    document.querySelectorAll("#starRow .star").forEach(function (st, i) {
        st.classList.toggle("on", i < evalStars);
    });
    $("evalLabel").textContent = evalStars ? ("تقييم اليوم: " + labels[evalStars]) : "اختر تقييم اليوم";
}
function renderLastEval() {
    const list = readList(EVALS_KEY).filter(function (e) { return e && e.code === activeCode; });
    $("lastEval").textContent = list.length ? ("اخر تقييم: " + list[0].stars + " نجوم — " + (list[0].note || "")) : "—";
}
function initEvalForm() {
    const form = $("evalForm"); const box = $("evalFormError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!activeCode) return fail("اختر طالبا اولا");
        if (!evalStars) return fail("اختر عدد النجوم اولا");
        const list = readList(EVALS_KEY);
        list.unshift({ code: activeCode, stars: evalStars, note: $("evalNote").value.trim(), at: Date.now() });
        saveList(EVALS_KEY, list); pushRow("evals", { code: activeCode, stars: evalStars, note: $("evalNote").value.trim() || null, at: Date.now() }); okFn(form, box); form.reset();
        evalStars = 0; paintStars(); renderLastEval(); toast("تم حفظ التقييم");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
/*__PART4__*//* attach helper + messages */
function setupAttach(btnId, inputId, prevId, key) {
    const btn = $(btnId), input = $(inputId), prev = $(prevId);
    if (!btn || !input || !prev) return;
    attachState[key] = null;
    btn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
        const f = input.files && input.files[0]; if (!f) return;
        fileToDataUrl(f).then(function (url) {
            attachState[key] = url;
            prev.querySelector("img").src = url; prev.hidden = false;
        }).catch(function () { toast("تعذر ارفاق الصورة"); });
        input.value = "";
    });
    prev.querySelector(".attach-remove").addEventListener("click", function () { clearAttach(key, btnId, prevId); });
}
function clearAttach(key, btnId, prevId) {
    attachState[key] = null;
    const prev = $(prevId); if (prev) { prev.hidden = true; prev.querySelector("img").src = ""; }
}
function renderMsgHistory(key, code, listId) {
    const ul = $(listId); if (!ul) return;
    const items = readList(key).filter(function (m) { return m && m.code === code; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد رسائل.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (m) {
        const li = document.createElement("li"); li.className = "msg-item";
        li.innerHTML = "<p>" + esc(m.text || "") + "</p>" +
            (m.image ? '<img class="msg-img" src="' + esc(m.image) + '" alt="">' : "") +
            "<small>" + fmtTime(m.at) + "</small>";
        ul.appendChild(li);
    });
}
function initMsgStudentForm() {
    setupAttach("attachMsgStudent", "imgMsgStudent", "prevMsgStudent", "msgStudent");
    const form = $("msgStudentForm"); const box = $("msgStudentError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("msgStudentText").value.trim();
        if (!activeCode) return fail("اختر طالبا اولا");
        if (!text && !attachState.msgStudent) return fail("اكتب الرسالة او ارفق صورة", $("msgStudentText"));
        const list = readList(MSG_S_KEY);
        const rec = { code: activeCode, text: text, image: attachState.msgStudent || null, at: Date.now() };
        list.unshift(rec);
        if (!saveListSafe(MSG_S_KEY, list)) return fail("مساحة التخزين ممتلئة");
        okFn(form, box); form.reset(); clearAttach("msgStudent", "attachMsgStudent", "prevMsgStudent");
        pushRow("messages", { kind: "s", code: activeCode, text: text || null, image: rec.image, at: rec.at });
        renderMsgHistory(MSG_S_KEY, activeCode, "msgStudentList"); toast("تم ارسال الرسالة");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
function initMsgGuardianForm() {
    setupAttach("attachMsgGuardian", "imgMsgGuardian", "prevMsgGuardian", "msgGuardian");
    const form = $("msgGuardianForm"); const box = $("msgGuardianError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("msgGuardianText").value.trim();
        if (!activeCode) return fail("اختر طالبا اولا");
        if (!text && !attachState.msgGuardian) return fail("اكتب الرسالة او ارفق صورة", $("msgGuardianText"));
        const list = readList(MSG_G_KEY);
        const grec = { code: activeCode, text: text, image: attachState.msgGuardian || null, at: Date.now() };
        list.unshift(grec);
        if (!saveListSafe(MSG_G_KEY, list)) return fail("مساحة التخزين ممتلئة");
        pushRow("messages", { kind: "g", code: grec.code, text: grec.text || null, image: grec.image, at: grec.at });
        okFn(form, box); form.reset(); clearAttach("msgGuardian", "attachMsgGuardian", "prevMsgGuardian");
        renderMsgHistory(MSG_G_KEY, activeCode, "msgGuardianList"); toast("تم ارسال الرسالة");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
/*__PART5__*//* edit + welcome + photo control */
function fillEditForm(s) {
    $("editCode").value = s.code || ""; $("editName").value = s.name || "";
    $("editSecret").value = s.secret || ""; $("editAge").value = s.age || "";
    $("editSchool").value = s.school || ""; $("editGrade").value = s.grade || "";
    clearAttach("stuPhoto", "attachStuPhoto", "prevStuPhoto");
    const ph = getPhoto(s.code);
    if (ph) { attachState.stuPhoto = ph; $("prevStuPhoto").querySelector("img").src = ph; $("prevStuPhoto").hidden = false; }
    okFn($("editForm"), $("editFormError"));
}
function initEditForm() {
    setupAttach("attachStuPhoto", "imgStuPhoto", "prevStuPhoto", "stuPhoto");
    const form = $("editForm"); const box = $("editFormError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const oldCode = activeCode;
        const code = $("editCode").value.trim(), name = $("editName").value.trim();
        const secret = $("editSecret").value.trim(), age = $("editAge").value.trim();
        const school = $("editSchool").value.trim(), grade = $("editGrade").value.trim();
        if (!code) return fail("ادخل كود الطالب", $("editCode"));
        if (!name) return fail("ادخل اسم الطالب", $("editName"));
        if (!secret) return fail("ادخل الرقم السري", $("editSecret"));
        if (!/^\d+$/.test(secret)) return fail("الرقم السري ارقام فقط", $("editSecret"));
        if (code !== oldCode && findStudent(code)) return fail("هذا الكود مسجل بالفعل", $("editCode"));
        const updated = { code: code, secret: secret, name: name, age: age, school: school, grade: grade, at: Date.now() };
        const added = readList(STUDENTS_KEY);
        const ix = added.findIndex(function (s) { return s && s.code === oldCode; });
        if (ix >= 0) added[ix] = updated; else added.unshift(updated);
        saveList(STUDENTS_KEY, added);
        pushRow("students", { code: code, secret: secret, name: name, age: age || null, school: school || null, grade: grade || null, at: Date.now() });
        if (code !== oldCode) {
            CASCADE_KEYS.forEach(function (k) {
                const list = readList(k); let ch = false;
                list.forEach(function (r) { if (r && r.code === oldCode) { r.code = code; if (k === GUARDIANS_KEY) r.studentName = name; ch = true; } });
                if (ch) saveList(k, list);
            });
            const ph = getPhoto(oldCode);
            if (attachState.stuPhoto) { setPhoto(code, attachState.stuPhoto); pushRow("photos", { code: code, image: attachState.stuPhoto }); }
            else if (ph) { setPhoto(code, ph); pushRow("photos", { code: code, image: ph }); }
            setPhoto(oldCode, null); pushDelete("photos", { code: oldCode });
            if (code !== oldCode) pushDelete("students", { code: oldCode });
            activeCode = code;
        } else {
            if (attachState.stuPhoto) { setPhoto(code, attachState.stuPhoto); pushRow("photos", { code: code, image: attachState.stuPhoto }); }
            else { setPhoto(code, null); pushDelete("photos", { code: code }); }
        }
        okFn(form, box); clearAttach("stuPhoto", "attachStuPhoto", "prevStuPhoto");
        toast("تم حفظ التعديلات"); renderStudents(); showPanel("panelStudents");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
/*__PART5B__*/
function getWelcome(code) { return readList(WELCOME_KEY).find(function (w) { return w && w.code === code; }) || null; }
function fillWelcome() {
    const w = getWelcome(activeCode);
    $("welcomeText").value = w ? w.text : "";
    $("welcomeCurrent").textContent = w ? ("الحالية: " + w.text) : "لا توجد رسالة بعد.";
}
function initWelcomeForm() {
    const form = $("welcomeForm"); const box = $("welcomeError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("welcomeText").value.trim();
        if (!activeCode) return fail("اختر طالبا اولا");
        if (!text) return fail("اكتب نص الرسالة", $("welcomeText"));
        const list = readList(WELCOME_KEY);
        const rec = { code: activeCode, text: text, at: Date.now() };
        const ix = list.findIndex(function (w) { return w && w.code === activeCode; });
        if (ix >= 0) list[ix] = rec; else list.unshift(rec);
        saveList(WELCOME_KEY, list); pushRow("welcome", { code: activeCode, text: text, at: Date.now() }); okFn(form, box);
        fillWelcome(); toast("تم حفظ رسالة الترحيب");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
function setupPhotoControl(btnId, inputId, prevId, getCode) {
    const btn = $(btnId), input = $(inputId), prev = $(prevId);
    if (!btn || !input || !prev) return;
    btn.dataset.label = btn.textContent;
    btn.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
        const f = input.files && input.files[0]; if (!f) return;
        const code = getCode(); if (!code) { toast("اختر طالبا اولا"); return; }
        fileToDataUrl(f, 500).then(function (url) {
            if (!setPhoto(code, url)) { toast("مساحة التخزين ممتلئة"); return; }
            pushRow("photos", { code: code, image: url });
            prev.querySelector("img").src = url; prev.hidden = false;
            btn.textContent = "تغيير الصورة";
            refreshPhotoUI(); toast("تم حفظ الصورة");
        }).catch(function () { toast("تعذر ارفاق الصورة"); });
        input.value = "";
    });
    prev.querySelector(".attach-remove").addEventListener("click", function () {
        const code = getCode(); if (!code) return;
        setPhoto(code, null);
        prev.hidden = true; prev.querySelector("img").src = "";
        btn.textContent = btn.dataset.label || btn.textContent;
        refreshPhotoUI(); toast("تم حذف الصورة");
    });
}
function showPhotoState(prevId, btnId, code) {
    const prev = $(prevId), btn = $(btnId); if (!prev || !btn) return;
    const ph = code ? getPhoto(code) : null;
    if (ph) { prev.querySelector("img").src = ph; prev.hidden = false; btn.textContent = "تغيير الصورة"; }
    else { prev.hidden = true; prev.querySelector("img").src = ""; btn.textContent = btn.dataset.label || btn.textContent; }
}
function refreshPhotoUI() {
    applyAvatar();
    if (!$("studentList")) return;
    const open = !$("panelStudents") || !$("panelStudents").hidden;
    if (open) renderStudents();
}
/*__PART6__*//* teacher inbox + student area */
function updateMsgBadge() {
    const b = $("msgBadge"); if (!b) return;
    const n = readList(MSG_T_KEY).filter(function (m) { return m && !m.read; }).length;
    b.textContent = n; b.hidden = (n === 0);
}
function renderTeacherMsgs() {
    const ul = $("msgTeacherList"); if (!ul) return;
    const items = readList(MSG_T_KEY);
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد رسائل.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (m, i) {
        const st = findStudent(m.code);
        const li = document.createElement("li");
        li.className = "msg-item" + (m.read ? "" : " unread");
        li.innerHTML =
            '<div class="msg-head"><b>' + esc(st ? st.name : "طالب") + "</b>" +
            "<span>" + esc(m.code || "") + "</span>" +
            '<span class="status' + (m.read ? "" : " new") + '">' + (m.read ? "مقروءة" : "جديدة") + "</span></div>" +
            "<p>" + esc(m.text || "") + "</p>" +
            (m.image ? '<img class="msg-img" src="' + esc(m.image) + '" alt="">' : "") +
            "<small>" + fmtTime(m.at) + "</small>";
        const rb = document.createElement("button");
        rb.type = "button"; rb.className = "action-btn"; rb.textContent = "رد على الطالب";
        rb.addEventListener("click", function () {
            openStudentAction(m.code, "msg");
        });
        li.appendChild(rb); ul.appendChild(li);
    });
    const all = readList(MSG_T_KEY);
    let ch = false;
    all.forEach(function (m) { if (m && !m.read) { m.read = true; ch = true; } });
    if (ch) saveList(MSG_T_KEY, all);
    all.forEach(function (m) { if (m && m.id && m.read) pushRow("messages", { id: m.id, is_read: true }); });
    updateMsgBadge();
    ul.querySelectorAll(".msg-item").forEach(function (li) { li.classList.remove("unread"); li.querySelector(".status").textContent = "مقروءة"; li.querySelector(".status").classList.remove("new"); });
}
/*__PART7__*/
function initStudentArea() {
    refreshFromCloud(function () {
        applyAvatar();
        renderWelcome(); renderMyTasks(); renderMyEval(); renderMyMessages();
        renderMyToTeacher();
    });
    initToTeacherForm(); renderMyToTeacher();
    setupPhotoControl("attachMyPhoto", "imgMyPhoto", "prevMyPhoto", function () { return session ? session.code : null; });
    showPhotoState("prevMyPhoto", "attachMyPhoto", session.code);
}
function renderWelcome() {
    const banner = $("welcomeBanner"); if (!banner || !session) return;
    const w = getWelcome(session.code);
    if (w) { $("welcomeTextStudent").textContent = w.text; banner.hidden = false; }
    else banner.hidden = true;
}
function renderMyTasks() {
    const ul = $("myTasks"); if (!ul) return;
    const items = readList(TASKS_KEY).filter(function (t) { return t && t.code === session.code; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد مطلوبات.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (t) {
        if (!t.id) { t.id = "t" + t.at + Math.floor(Math.random() * 100000); }
        const li = document.createElement("li");
        li.className = "task-item" + (t.done ? " done" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!t.done;
        cb.addEventListener("change", function () {
            const all = readList(TASKS_KEY);
            const one = all.find(function (x) { return x && x.id === t.id; }) || all.find(function (x) { return x && x.code === t.code && x.text === t.text && x.at === t.at; });
            if (one) one.done = cb.checked;
            saveList(TASKS_KEY, all); renderMyTasks();
            if (one && one.id) pushRow("tasks", { id: one.id, code: one.code, text: one.text, done: !!one.done, at: one.at });
        });
        li.appendChild(cb);
        const sp = document.createElement("span"); sp.textContent = t.text; li.appendChild(sp);
        ul.appendChild(li);
    });
}
function renderMyEval() {
    const list = readList(EVALS_KEY).filter(function (e) { return e && e.code === session.code; });
    $("myEval").textContent = list.length ? ("تقييم اليوم: " + list[0].stars + " نجوم — " + (list[0].note || "")) : "لا يوجد تقييم بعد.";
}
function renderMyMessages() {
    const ul = $("myMessages"); if (!ul) return;
    const items = readList(MSG_S_KEY).filter(function (m) { return m && m.code === session.code; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد رسائل.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (m) {
        const li = document.createElement("li"); li.className = "msg-item";
        li.innerHTML = "<p>" + esc(m.text || "") + "</p>" +
            (m.image ? '<img class="msg-img" src="' + esc(m.image) + '" alt="">' : "") +
            "<small>" + fmtTime(m.at) + "</small>";
        ul.appendChild(li);
    });
}
function initToTeacherForm() {
    setupAttach("attachToTeacher", "imgToTeacher", "prevToTeacher", "toTeacher");
    const form = $("toTeacherForm"); const box = $("toTeacherError"); const fail = failFn(form, box);
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = $("toTeacherText").value.trim();
        if (!text && !attachState.toTeacher) return fail("اكتب رسالتك او ارفق صورة", $("toTeacherText"));
        const list = readList(MSG_T_KEY);
        list.unshift({ code: session.code, text: text, image: attachState.toTeacher || null, read: false, at: Date.now() });
        const sent = list[0];
        if (!saveListSafe(MSG_T_KEY, list)) return fail("مساحة التخزين ممتلئة");
        pushRow("messages", { kind: "t", code: sent.code, text: sent.text || null, image: sent.image, is_read: false, at: sent.at });
        okFn(form, box); form.reset(); clearAttach("toTeacher", "attachToTeacher", "prevToTeacher");
        renderMyToTeacher(); toast("تم ارسال رسالتك");
    });
    form.addEventListener("input", function () { okFn(form, box); });
}
function renderMyToTeacher() {
    const ul = $("myToTeacher"); if (!ul) return;
    const items = readList(MSG_T_KEY).filter(function (m) { return m && m.code === session.code; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لم ترسل رسائل بعد.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (m) {
        const li = document.createElement("li"); li.className = "msg-item";
        li.innerHTML = "<p>" + esc(m.text || "") + "</p>" +
            (m.image ? '<img class="msg-img" src="' + esc(m.image) + '" alt="">' : "") +
            '<span class="status">' + (m.read ? "تمت القراءة" : "وصلت (لم تقرأ بعد)") + "</span>" +
            "<small>" + fmtTime(m.at) + "</small>";
        ul.appendChild(li);
    });
}

