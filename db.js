/* Mrs.Rana — cloud sync layer (Supabase + localStorage cache) */
(function () {
    const LS_KEYS = ["rana_students", "rana_guardians", "rana_tasks", "rana_evaluations",
        "rana_messages_student", "rana_messages_guardian", "rana_messages_to_teacher",
        "rana_welcome", "rana_student_photos"];

    const api = {
        ready: false,
        sb: null,
        // قراءة من الكاش المحلي (متزامنة — نفس سلوك الكود القديم)
        readList(k) {
            try {
                const v = JSON.parse(localStorage.getItem(k) || "[]");
                return Array.isArray(v) ? v : [];
            } catch (e) { return []; }
        },
        readPhotos() {
            try { return JSON.parse(localStorage.getItem("rana_student_photos") || "{}"); }
            catch (e) { return {}; }
        },
        // سحب نسخة السحابة كاملة قبل الدخول
        pullAll() {
            if (!this.ready) return Promise.resolve(false);
            const sb = this.sb;
            const jobs = [
                sb.from("students").select("*").then(r => ["rana_students", (r.data || []).map(s => ({
                    code: s.code, secret: s.secret, name: s.name, age: s.age || "",
                    school: s.school || "", grade: s.grade || "", at: s.at || Date.parse(s.updated_at) || Date.now()
                }))]),
                sb.from("guardians").select("*").then(r => ["rana_guardians", (r.data || []).map(g => ({
                    code: g.code, name: g.name, secret: g.secret, phone: g.phone || "",
                    studentName: g.student_name || "", at: g.at || Date.parse(g.updated_at) || Date.now()
                }))]),
                sb.from("tasks").select("*").order("id", { ascending: false }).then(r => ["rana_tasks", (r.data || []).map(t => ({
                    id: t.id, code: t.code, text: t.text, done: !!t.done, at: t.at || Date.parse(t.updated_at) || Date.now()
                }))]),
                sb.from("evals").select("*").order("id", { ascending: false }).then(r => ["rana_evaluations", (r.data || []).map(e => ({
                    id: e.id, code: e.code, stars: e.stars, note: e.note || "", at: e.at || Date.parse(e.updated_at) || Date.now()
                }))]),
                sb.from("messages").select("*").order("id", { ascending: false }).then(r => {
                    const all = r.data || [];
                    const by = { s: [], g: [], t: [] };
                    all.forEach(m => {
                        const rec = { id: m.id, code: m.code, text: m.text || "", image: m.image || null, read: !!m.is_read, at: m.at || Date.parse(m.updated_at) || Date.now() };
                        if (m.kind === "s") by.s.push(rec);
                        else if (m.kind === "g") by.g.push(rec);
                        else if (m.kind === "t") by.t.push(rec);
                    });
                    return [
                        ["rana_messages_student", by.s],
                        ["rana_messages_guardian", by.g],
                        ["rana_messages_to_teacher", by.t]
                    ];
                }),
                sb.from("welcome").select("*").then(r => ["rana_welcome", (r.data || []).map(w => ({
                    code: w.code, text: w.text, at: w.at || Date.parse(w.updated_at) || Date.now()
                }))]),
                sb.from("photos").select("code,image").then(r => {
                    const o = {};
                    (r.data || []).forEach(p => { if (p && p.code && p.image) o[p.code] = p.image; });
                    return ["rana_student_photos", o, true];
                })
            ];
            return Promise.all(jobs).then(parts => {
                parts.flat().forEach(([k, v, isObj]) => {
                    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* مساحة ممتلئة — الكاش القديم يبقى */ }
                });
                return true;
            }).catch(() => false);
        },
        // رفع سجل واحد (upsert) — fire-and-forget
        push(table, row) {
            if (!this.ready) return;
            this.sb.from(table).upsert(row, { onConflict: table === "messages" || table === "tasks" || table === "evals" ? "id" : "code" })
                .then(() => {}, () => {});
        },
        // حذف سجل واحد من السحابة
        remove(table, match) {
            if (!this.ready) return;
            let q = this.sb.from(table).delete();
            Object.keys(match).forEach(k => { q = q.eq(k, match[k]); });
            q.then(() => {}, () => {});
        },
        // سحب جدول واحد (للمعلمين)
        pullTable(table) {
            if (!this.ready) return Promise.resolve(null);
            return this.sb.from(table).select("*").then(r => r.data || []).catch(() => null);
        },
        init() {
            try {
                if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
                this.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
                this.ready = true;
            } catch (e) { this.ready = false; }
        }
    };

    api.init();
    window.DB = api;
    window.DB_KEYS = LS_KEYS;
})();
