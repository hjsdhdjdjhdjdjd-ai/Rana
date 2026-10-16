/* Mrs.Rana — guardian panel (localStorage backend) */
const SESSION_KEY = "rana_session";
const STUDENTS_KEY = "rana_students";
const TASKS_KEY = "rana_tasks";
const EVALS_KEY = "rana_evaluations";
const MSG_S_KEY = "rana_messages_student";
const MSG_G_KEY = "rana_messages_guardian";
function $(id) { return document.getElementById(id); }
function getSession() { try { const r = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function readList(k) { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function fmtTime(ts) { try { return new Date(ts).toLocaleString("ar-EG"); } catch (e) { return ""; } }
function loadStudents() { const added = readList(STUDENTS_KEY); return added.filter(function (s) { return s && s.code; }); }
function openImage(src) { const o = document.createElement("div"); o.className = "img-overlay"; const im = document.createElement("img"); im.src = src; o.appendChild(im); o.addEventListener("click", function () { o.remove(); }); document.body.appendChild(o); }
document.addEventListener("click", function (e) { const t = e.target && e.target.closest ? e.target.closest(".msg-img") : null; if (t && t.src) openImage(t.src); });
const session = getSession();
if (!session || session.type !== "guardian") { location.replace("index.html"); }
else {
    $("guardianName").textContent = session.name || "—";
    $("guardianPhone").textContent = session.phone || "—";
    $("loginTime").textContent = session.at ? fmtTime(session.at) : "—";
    const st = loadStudents().find(function (s) { return s && s.code === session.code; });
    const sName = (st && st.name) || session.studentName || "—";
    $("linkedStudent").textContent = sName;
    $("linkedCode").textContent = session.code || "—";
    $("linkedTasksTitle").textContent = sName;
    const area = $("linkedArea"); if (area) area.hidden = false;
    const paint = () => { renderTasks(session.code); renderEval(session.code); renderMsgs(session.code); };
    paint();
    try {
        if (window.DB && DB.ready) DB.pullAll().then(paint).catch(paint);
    } catch (e) {}
    $("logoutBtn").addEventListener("click", function () {
        const back = (session && session.page) || "index.html";
        localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
        location.href = back;
    });
}
function renderTasks(code) {
    const ul = $("linkedTasks"); if (!ul) return;
    const items = readList(TASKS_KEY).filter(function (t) { return t && t.code === code; });
    if (!items.length) { ul.innerHTML = '<li class="empty">لا توجد مطلوبات.</li>'; return; }
    ul.innerHTML = "";
    items.forEach(function (t) {
        const li = document.createElement("li");
        li.className = "task-item" + (t.done ? " done" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!t.done; cb.disabled = true;
        li.appendChild(cb);
        const sp = document.createElement("span"); sp.textContent = t.text || ""; li.appendChild(sp);
        ul.appendChild(li);
    });
}
function renderEval(code) {
    const list = readList(EVALS_KEY).filter(function (e) { return e && e.code === code; });
    $("linkedEval").textContent = list.length ? ("تقييم اليوم: " + list[0].stars + " نجوم — " + (list[0].note || "")) : "لا يوجد تقييم بعد.";
}
function renderMsgs(code) {
    const ul = $("linkedMessages"); if (!ul) return;
    const items = readList(MSG_G_KEY).filter(function (m) { return m && m.code === code; });
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

