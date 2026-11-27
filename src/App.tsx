import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Dumbbell, Flame, ShieldCheck, Upload, LogOut, Pencil, Trash2, FileText, X, CheckCircle2 } from "lucide-react";
import { supabase, ADMIN_EMAIL } from "./lib/supabase";

type Intensity = "Лёгкая" | "Средняя" | "Высокая";
type Muscle = "Руки" | "Ноги" | "Спина" | "Плечи" | "Грудь" | "Грудь + спина" | "Руки + плечи";
type Training = {
  id: string; title: string; training_date: string | null; goal: string | null;
  training_type: string | null; duration: string | null; description: string | null;
  status: "draft" | "published"; file_path: string | null; file_name: string | null;
  file_type: string | null; intensity: Intensity | null; muscle_group: Muscle | null;
};
const intensities: Intensity[] = ["Лёгкая", "Средняя", "Высокая"];
const muscles: Muscle[] = ["Руки", "Ноги", "Спина", "Плечи", "Грудь", "Грудь + спина", "Руки + плечи"];

export default function App() {
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Training | null>(null);
  const [form, setForm] = useState({ title: "", intensity: "Средняя" as Intensity, muscle_group: "Руки" as Muscle, goal: "", duration: "", description: "", status: "draft" as "draft" | "published" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const configured = Boolean(supabase);
  const filtered = useMemo(() => trainings.filter(t => t.status === "published" &&
    (!intensity || t.intensity === intensity) && (!muscle || t.muscle_group === muscle)
  ), [trainings, intensity, muscle]);

  async function loadTrainings(includeDrafts = false) {
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError("");
    let query = supabase.from("training_programs").select("*").order("created_at", { ascending: false });
    if (!includeDrafts) query = query.eq("status", "published");
    const { data, error } = await query;
    if (error) setError("Не удалось загрузить тренировки. Проверьте подключение к базе данных.");
    else setTrainings((data ?? []) as Training[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadTrainings();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void checkAdmin(data.session.user.id, data.session.user.email ?? "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void checkAdmin(session.user.id, session.user.email ?? "");
      else { setUserEmail(""); setIsAdmin(false); void loadTrainings(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId: string, userMail: string) {
    if (!supabase) return;
    setUserEmail(userMail);
    const { data, error } = await supabase.rpc("is_admin");
    const allowed = !error && data === true && userMail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    setIsAdmin(allowed);
    await loadTrainings(allowed);
  }

  async function sendLogin() {
    if (!supabase) return;
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setNotice("Не удалось войти. Проверьте почту и пароль.");
    else { setPassword(""); setNotice(""); }
  }

  async function logout() { await supabase?.auth.signOut(); setAdminOpen(false); }

  function startNew() {
    setEditing(null);
    setForm({ title: "", intensity: "Средняя", muscle_group: "Руки", goal: "", duration: "", description: "", status: "draft" });
    setFile(null);
  }
  function editTraining(t: Training) {
    setEditing(t);
    setForm({ title: t.title, intensity: t.intensity ?? "Средняя", muscle_group: t.muscle_group ?? "Руки", goal: t.goal ?? "", duration: t.duration ?? "", description: t.description ?? "", status: t.status });
    setFile(null);
  }

  async function saveTraining(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !isAdmin) return;
    setSaving(true); setNotice("");
    let filePath = editing?.file_path ?? null;
    let fileName = editing?.file_name ?? null;
    let fileType = editing?.file_type ?? null;
    if (file) {
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("training-files").upload(path, file, { upsert: false });
      if (uploadError) { setNotice("Не удалось загрузить файл. Проверьте права Storage."); setSaving(false); return; }
      filePath = path; fileName = file.name; fileType = file.type || "application/octet-stream";
    }
    const payload = { ...form, file_path: filePath, file_name: fileName, file_type: fileType, created_by: (await supabase.auth.getUser()).data.user?.id };
    const result = editing
      ? await supabase.from("training_programs").update(payload).eq("id", editing.id)
      : await supabase.from("training_programs").insert(payload);
    if (result.error) setNotice("Не удалось сохранить тренировку. Проверьте обязательные поля и права доступа.");
    else { setNotice("Тренировка сохранена."); setEditing(null); startNew(); await loadTrainings(); }
    setSaving(false);
  }

  async function deleteTraining(t: Training) {
    if (!supabase || !isAdmin || !window.confirm(`Удалить тренировку «${t.title}»?`)) return;
    const { error } = await supabase.from("training_programs").delete().eq("id", t.id);
    if (error) setNotice("Не удалось удалить тренировку.");
    else { if (t.file_path) await supabase.storage.from("training-files").remove([t.file_path]); await loadTrainings(); }
  }

  async function openFile(t: Training) {
    if (!supabase || !t.file_path) return;
    const { data, error } = await supabase.storage.from("training-files").createSignedUrl(t.file_path, 300);
    if (error || !data?.signedUrl) { setNotice("Не удалось открыть файл. Возможно, файл ещё не опубликован."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function reset() { setIntensity(null); setMuscle(null); }
  const step = !intensity ? 0 : !muscle ? 1 : 2;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); reset(); }}><span className="brand-mark"><Dumbbell size={21}/></span><span>TRAINING<span className="brand-accent">HUB</span><small>ТВОЯ ТРЕНИРОВОЧНАЯ БИБЛИОТЕКА</small></span></a>
      <div className="top-actions"><span className="live-dot"/> <span className="top-caption">ПЛАНИРУЙ. ТРЕНИРУЙСЯ. РАСТИ.</span><button className="admin-link" onClick={() => setAdminOpen(true)}><ShieldCheck size={16}/> Кабинет администратора</button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span/> ТВОЙ ПЛАН НА СЕГОДНЯ</div><h1>СИЛА — ЭТО<br/><em>СИСТЕМА.</em></h1><p>Выбери параметры и найди тренировку, которая подходит под твой план.</p><div className="hero-meta"><span><Dumbbell size={15}/> ТРЕНИРОВКИ ПО ГРУППАМ МЫШЦ</span><span><Flame size={15}/> 3 УРОВНЯ ИНТЕНСИВНОСТИ</span></div></div>
        <div className="hero-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-number">01<span>/03</span></div><div className="art-label">FOCUS<br/>ON PROGRESS</div><div className="art-bar"/></div>
      </section>

      <section className="selector-section">
        <div className="section-heading"><div><div className="eyebrow">ПЕРСОНАЛЬНЫЙ ПОДБОР</div><h2>СОБЕРИ СВОЮ <em>ТРЕНИРОВКУ</em></h2></div><div className="step-count">ШАГ <b>{step + 1}</b> / 03</div></div>
        <div className="steps"><span className={step >= 0 ? "active" : ""}/><span className={step >= 1 ? "active" : ""}/><span className={step >= 2 ? "active" : ""}/></div>
        {step === 0 && <div className="choice-block"><div className="choice-title"><span>01</span><div><h3>Выбери интенсивность</h3><p>Начни с комфортного для себя уровня</p></div></div><div className="intensity-grid">{intensities.map((v, i) => <button key={v} className={`choice-card intensity-card ${intensity === v ? "selected" : ""}`} onClick={() => setIntensity(v)}><span className="card-index">0{i+1}</span><span className="choice-icon"><Flame size={24}/></span><strong>{v}</strong><small>{["Спокойный темп","Умеренная нагрузка","Повышенная нагрузка"][i]}</small><ArrowRight className="card-arrow" size={18}/></button>)}</div></div>}
        {step === 1 && <div className="choice-block"><div className="choice-title"><span>02</span><div><h3>На какую группу мышц?</h3><p>Выбери направление тренировки</p></div></div><div className="muscle-grid">{muscles.map((v, i) => <button key={v} className="muscle-card" onClick={() => setMuscle(v)}><span className="muscle-index">0{i+1}</span><Dumbbell size={20}/><strong>{v}</strong><ArrowRight size={17}/></button>)}</div><button className="back-button" onClick={() => setIntensity(null)}><ArrowLeft size={16}/> Назад</button></div>}
        {step === 2 && <div className="results-block"><div className="results-head"><div><div className="eyebrow">ПОДХОДЯЩИЕ ПРОГРАММЫ</div><h3>{muscle} <em>· {intensity?.toLowerCase() ?? ""}</em></h3></div><button className="back-button" onClick={reset}><ArrowLeft size={16}/> Начать заново</button></div>
          {loading ? <div className="empty-state">Загружаем тренировки…</div> : error ? <div className="empty-state">{error}</div> : filtered.length === 0 ? <div className="empty-state"><Dumbbell size={28}/><strong>Пока нет опубликованных тренировок</strong><span>Попробуй другой выбор или загляни позже.</span></div> : <div className="training-grid">{filtered.map(t => <article className="training-card" key={t.id}><div className="training-card-top"><span className="training-tag">{t.intensity}</span>{t.duration && <span className="duration">{t.duration}</span>}</div><h4>{t.title}</h4>{t.goal && <p className="training-goal">{t.goal}</p>}{t.description && <p className="training-desc">{t.description}</p>}{t.file_name && <button className="file-button" onClick={() => void openFile(t)}><FileText size={17}/><span>{t.file_name}</span><ArrowRight size={16}/></button>}{isAdmin && <div className="admin-card-actions"><button onClick={() => editTraining(t)}><Pencil size={14}/> Изменить</button><button onClick={() => void deleteTraining(t)}><Trash2 size={14}/> Удалить</button></div>}</article>)}</div>}
          <button className="back-button results-back" onClick={() => setMuscle(null)}><ArrowLeft size={16}/> Изменить группу мышц</button>
        </div>}
      </section>
      <section className="bottom-strip"><span>01 / CHOOSE YOUR LEVEL</span><span>02 / PICK YOUR FOCUS</span><span>03 / START TRAINING</span></section>
    </main>
    <footer><span>© 2026 TRAINING HUB</span><span>СОЗДАНО ДЛЯ ТВОЕГО ПРОГРЕССА</span></footer>

    {adminOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAdminOpen(false); }}><section className="admin-modal"><div className="modal-head"><div><div className="eyebrow">TRAINING HUB / ADMIN</div><h3>Кабинет <em>администратора</em></h3></div><button className="icon-button" onClick={() => setAdminOpen(false)}><X/></button></div>
      {!configured ? <p className="notice error">Не настроено подключение Supabase. Добавьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.</p> : !isAdmin ? <div className="login-panel"><p>Войти можно только с адреса администратора.</p><label>Электронная почта<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username"/></label><label>Пароль<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" minLength={8} required/></label><button className="primary-button" onClick={() => void sendLogin()}>Войти <ArrowRight size={16}/></button>{notice && <p className="notice">{notice}</p>}</div> : <div className="admin-content"><div className="admin-session"><span><CheckCircle2 size={16}/> {userEmail}</span><button onClick={() => void logout()}><LogOut size={15}/> Выйти</button></div><form className="training-form" onSubmit={saveTraining}><h4>{editing ? "Редактировать тренировку" : "Добавить тренировку"}</h4><label>Название<input required value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="Например, Силовая тренировка"/></label><div className="form-row"><label>Интенсивность<select value={form.intensity} onChange={e => setForm({...form, intensity:e.target.value as Intensity})}>{intensities.map(v => <option key={v}>{v}</option>)}</select></label><label>Группа мышц<select value={form.muscle_group} onChange={e => setForm({...form, muscle_group:e.target.value as Muscle})}>{muscles.map(v => <option key={v}>{v}</option>)}</select></label></div><div className="form-row"><label>Цель<input value={form.goal} onChange={e => setForm({...form, goal:e.target.value})} placeholder="Например, общая физическая подготовка"/></label><label>Длительность<input value={form.duration} onChange={e => setForm({...form, duration:e.target.value})} placeholder="Например, 30 минут"/></label></div><label>Описание<textarea rows={3} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Краткое описание тренировки"/></label><label className="upload-field"><Upload size={19}/><span>{file ? file.name : editing?.file_name ?? "Загрузить файл (PDF, таблица, TXT и др.)"}</span><input type="file" accept=".pdf,.csv,.xlsx,.xls,.txt,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><label>Публикация<select value={form.status} onChange={e => setForm({...form, status:e.target.value as "draft"|"published"})}><option value="draft">Черновик — виден только администратору</option><option value="published">Опубликовано — видно посетителям</option></select></label><div className="form-actions"><button type="button" className="back-button" onClick={startNew}>Сбросить</button><button className="primary-button" disabled={saving}>{saving ? "Сохраняем…" : editing ? "Сохранить изменения" : "Добавить тренировку"} <ArrowRight size={16}/></button></div>{notice && <p className="notice">{notice}</p>}</form><div className="admin-list"><h4>Тренировки</h4>{trainings.length === 0 ? <p>Пока тренировок нет.</p> : trainings.map(t => <div className="admin-list-row" key={t.id}><span>{t.title}<small>{t.intensity} · {t.muscle_group}</small></span><button onClick={() => editTraining(t)} aria-label="Изменить"><Pencil size={15}/></button><button onClick={() => void deleteTraining(t)} aria-label="Удалить"><Trash2 size={15}/></button></div>)}</div></div>}
    </section></div>}
  </div>;
}