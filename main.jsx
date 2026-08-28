
// ============================================================
//  TriliumNext Flux · 入口（render bundle 主脚本）
//  在 Trilium 中该笔记为 Render 类型，直接子级 code 笔记
//  （本目录其余 jsx 子模块 + config.json 模板）会被一起打包，此处按「子笔记标题」引用：
//      const { ... } = backendBridge;  // backendBridge.jsx
//      const { ... } = taskParser;     // taskParser.jsx
//      const { ... } = groupLogic;     // groupLogic.jsx
//      const { ... } = dkLogic;        // dkLogic.jsx
//      const { ... } = txLogic;        // txLogic.jsx
//      const { ... } = styles;         // styles.jsx
//      const { ... } = panelView;      // panelView.jsx
//      const { ... } = i18n;           // i18n.jsx
//  注意：子模块标题必须与目录文件名一致且为 ASCII。
//  配置：在宿主笔记上加关系 configNote 指向一份 JSON/代码 配置笔记（官方推荐方案）；
//        没有配置笔记时使用内置默认配置。
// ============================================================

import { useState, useEffect, useRef } from "trilium:preact";
import { activateNote } from "trilium:api";

const { loadData, completeTask, toggleDkDay, stampRepeatDate, saveTxState, loadTxState, loadJsonConfig, saveJsonConfig } = backendBridge;
const { parseTasks, countCheckboxes } = taskParser;
const { classifyNotes, normState } = groupLogic;
const { localDateStr, weekDays, currentWeekKey } = dkLogic;
const { beep, freshState } = txLogic;
const { injectStyles } = styles;
const { PanelView, LoadingBox, EmptyState, ErrorBox, SettingsModal, setI18n } = panelView;
const { createI18n } = i18n;
const { initTagQuickInsert, destroyTagQuickInsert } = tagQuickInsert;

// ── 插件元信息 ──
const PLUGIN_VERSION = '1.1.0';
const PLUGIN_REPO = 'https://github.com/ZangXincz/TriliumNext-Flux'; // TODO: 发布前替换为真实仓库地址

// ── 默认配置（与配置笔记模板保持一致）──
const DEFAULT_CONFIG = {
    version: 1,
    enabled: true,
    lang: 'en',
    features: {
        today: true,
        projects: true,
        onHold: true,
        cycling: true,
        future: true,
        dk: true,
        tx: true,
        inbox: true
    },
    inbox: { titles: ['inbox', '收集箱'] },
    projectRoot: { titles: [] }, // 留空 = 全树带 state 的笔记都算项目
    tx: { defaultRest: 5, notifyMethods: ['message', 'sound'] }, // 提醒默认休息分钟与提醒方式
    tqi: { enabled: true, candidates: null } // v5.0+ 候选池内置，candidates 字段已忽略（保留仅为向后兼容）
};

// 深合并：extra 只覆盖 base 中出现的键，数组/原始值直接替换
function deepMerge(base, extra) {
    if (!base || typeof base !== 'object' || Array.isArray(base)) return extra;
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra;
    const out = {};
    for (const k of Object.keys(base)) {
        const b = base[k], e = extra[k];
        if (e === undefined) out[k] = b;
        else if (b && typeof b === 'object' && !Array.isArray(b) && e && typeof e === 'object' && !Array.isArray(e)) {
            out[k] = deepMerge(b, e);
        } else {
            out[k] = e;
        }
    }
    return out;
}

// 宿主（被渲染的）笔记 —— render bundle 运行时注入全局 originEntity
const hostNote = (typeof originEntity !== 'undefined' && originEntity) ? originEntity : null;
const hostNoteId = hostNote ? hostNote.noteId : '';

// ── 全屏提醒 ─────────────────────────────────────────────────
// 直接挂到 document.body：离开面板所在 tab 也能弹出
// （trilium:preact 不提供 createPortal，无法 portal 到 body）
let fullscreenTimer = null;
function showFullscreen(msg, dismissText) {
    const existing = document.querySelector('.th-fullscreen-alert');
    if (existing) existing.remove();
    if (fullscreenTimer) clearTimeout(fullscreenTimer);
    const el = document.createElement('div');
    el.className = 'th-fullscreen-alert';
    el.addEventListener('click', () => el.remove());
    const box = document.createElement('div');
    box.className = 'th-fullscreen-alert-box';
    const icon = document.createElement('div');
    icon.className = 'th-fullscreen-alert-icon';
    icon.textContent = '⏰';
    const text = document.createElement('p');
    text.className = 'th-fullscreen-alert-text';
    text.textContent = msg;
    const btn = document.createElement('button');
    btn.className = 'th-btn primary';
    btn.textContent = dismissText;
    btn.addEventListener('click', (e) => { e.stopPropagation(); el.remove(); });
    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btn);
    el.appendChild(box);
    document.body.appendChild(el);
    fullscreenTimer = setTimeout(() => el.remove(), 10 * 60 * 1000); // 兜底自动关闭
}

// ── 轻提示 toast ──────────────────────────────────────────────
// 同样挂到 document.body：trilium:api 的 showMessage 只显示在当前 tab
let toastTimer = null;
function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    const existing = document.querySelector('.th-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'th-toast';
    el.textContent = msg;
    el.addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 8000); // 8 秒后自动消失
}

export default function TriliumNextFlux() {

    const [today] = useState(() => localDateStr(new Date()));      // 本次会话内固定，与原版 TODAY 一致
    const [weekDaysArr] = useState(() => weekDays());
    const [weekKey] = useState(() => currentWeekKey());

    // ── 配置 ──
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const configRef = useRef(DEFAULT_CONFIG);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState('general');
    const [draft, setDraft] = useState(null);
    const [settingsError, setSettingsError] = useState('');

    // 设置弹窗：按 ESC 关闭
    useEffect(() => {
        if (!settingsOpen) return;
        const onKey = e => { if (e.key === 'Escape') setSettingsOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [settingsOpen]);

    // 翻译函数：面板用 config.lang；tRef 供 tick / 异步回调取最新语言
    const t = createI18n(config.lang);
    const tRef = useRef(t);
    tRef.current = t;

    // 面板状态: loading | ready | empty | error
    const [status, setStatus] = useState('loading');
    const [groups, setGroups] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // 防重入 + 加载中再次请求 → 结束后补刷一次
    const busyRef = useRef(false);
    const pendingRef = useRef(false);

    // 交互视觉状态
    const [leavingKeys, setLeavingKeys] = useState(() => new Set());  // 任务行淡出中
    const [workingKeys, setWorkingKeys] = useState(() => new Map());  // 打卡格切换中 (key -> {dateStr})

    // ── 间隔计时提醒（#timer:N:M）状态 ──
    const [txStates, setTxStates] = useState({});   // key「noteId:cbIndex」→ { phase, endTime, totalMs }
    const [now, setNow] = useState(() => Date.now()); // 每秒刷新，驱动倒计时显示
    const txRef = useRef({});                        // txStates 实时副本（tick 内读取）
    const groupsRef = useRef(null);                  // groups 实时副本（提醒文案用）

    useEffect(() => {
        injectStyles();
    }, []);

    // ── 标签快速插入（# 快速输入）：Flux 挂载时注册全局监听器；配置变化时刷新候选池/i18n ──
    useEffect(() => {
        if (config.tqi && config.tqi.enabled === false) return;
        initTagQuickInsert({ t: tRef.current, config: configRef.current });
        return () => destroyTagQuickInsert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    async function load() {
        if (busyRef.current) { pendingRef.current = true; return; }
        busyRef.current = true;
        try {
            const cfg = configRef.current;
            // 后端: 任务/打卡/提醒全树扫描；项目卡片范围按项目文件夹配置限定。
            // 传入功能开关：关闭「暂停」时后端直接跳过暂停项目（不读内容不返回）
            const res = await loadData({
                inboxTitles: (cfg.inbox && cfg.inbox.titles) || [],
                projectRootTitles: (cfg.projectRoot && cfg.projectRoot.titles) || []
            }, cfg.features);
            // 兼容旧格式（后端缓存未刷新时可能直接返回数组）
            const data = Array.isArray(res) ? res : (res.notes || []);
            // 前端: 解析每个笔记的任务 + 勾选统计（打卡 #habit / 提醒 #timer 固定标签）
            const tags = {
                defaultRest: (cfg.tx && cfg.tx.defaultRest) || 5
            };
            const notes = data.map(note => {
                const tasks = parseTasks(note.content, today, tags, cfg.features);
                // 项目卡片才需要 done/total 进度；普通任务不做重复的 DOM 解析
                const st = normState(note.state);
                // 项目卡片：后端已按「项目文件夹配置」判定（note.isProject）；旧缓存无此字段时按 state 兜底
                const isProj = note.isProject !== false && (st === 'inprogress' || st === 'cyclingphase' || st === 'onhold');
                const cb = isProj ? countCheckboxes(note.content) : { done: 0, total: 0 };
                return Object.assign({}, note, { tasks, done: cb.done, total: cb.total });
            });

            // 位置型重复任务（#repeat:1m:start/end/endwork 未写日期）→ 自动补写当前计划日期
            const toStamp = [];
            for (const note of notes) {
                for (const t of note.tasks) {
                    if (t.repeatStamp) {
                        toStamp.push({ noteId: note.noteId, cbIndex: t.checkboxIndex, dateStr: t.repeatStamp });
                    }
                }
            }
            if (toStamp.length) {
                try {
                    await Promise.all(toStamp.map(s => stampRepeatDate(s.noteId, s.cbIndex, s.dateStr)));
                    pendingRef.current = true; // 补写后再拉一次，让界面与笔记一致
                    return;
                } catch (e) {
                    console.error('[th] 补写重复任务日期失败', e); // 失败不阻塞，30s 定时刷新再试
                }
            }

            const g = classifyNotes(notes, today, cfg.features);
            groupsRef.current = g;
            setGroups(g);
            setStatus(g.empty ? 'empty' : 'ready');
            setLeavingKeys(new Set()); // 淡出中的行已随新数据消失
        } catch (e) {
            console.error(e);
            setErrorMsg(e.message || String(e));
            setStatus('error');
        } finally {
            busyRef.current = false;
            if (pendingRef.current) { pendingRef.current = false; load(); }
        }
    }

    useEffect(() => {
        // 先读配置，再加载任务（配置异步，load 内通过 configRef 取最新值）
        (async () => {
            try {
                const saved = await loadJsonConfig(hostNoteId);
                const merged = deepMerge(DEFAULT_CONFIG, saved || {});
                configRef.current = merged;
                setConfig(merged);
            } catch (e) {
                console.warn('[th] 读取配置失败，使用默认配置', e);
            }
            load();
        })();
        const timer = setInterval(load, 30 * 1000); // 30 秒自动刷新
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 交互回调 ──────────────────────────────────────────────

    function handleOpenProject(p) {
        activateNote(p.noteId);
    }

    function handleOpenTask(t) {
        jumpToNoteCheckbox(t.noteId, t.checkboxIndex);
    }

    // 勾选完成：先标记该行淡出，后端写库后延迟刷新（等淡出动画播完）
    async function handleCompleteTask(t) {
        const key = `${t.noteId}:${t.checkboxIndex}`;
        if (leavingKeys.has(key)) return; // 防重复点击
        setLeavingKeys(prev => new Set(prev).add(key));
        try {
            await completeTask(t.noteId, t.checkboxIndex);
            setTimeout(async () => { await load(); }, 280);
        } catch (e) {
            console.error(e);
            setLeavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
    }

    // 打卡切换：该格子进入 working（禁用防重复），后端写库后刷新
    async function handleToggleDkDay(t, dateStr) {
        const key = `${t.noteId}:${t.checkboxIndex}`;
        if (workingKeys.has(key)) return; // 防重复点击
        setWorkingKeys(prev => new Map(prev).set(key, { dateStr }));
        try {
            const cfg = configRef.current;
            await toggleDkDay(t.noteId, t.checkboxIndex, dateStr, ['habit'], cfg.lang); // 打卡标签固定 #habit
            await load();
        } catch (e) {
            console.error(e);
        } finally {
            setWorkingKeys(prev => { const m = new Map(prev); m.delete(key); return m; });
        }
    }

    // ── 间隔计时提醒（#timer:N:M）核心逻辑 ────────────────────────

    const txKey = t => `${t.noteId}:${t.checkboxIndex}`;
    const txWorkMs = t => (t.tx.work || 1) * 60000;
    const txRestMs = t => (t.tx.rest || 5) * 60000;

    // 更新单个计时器状态并持久化
    function applyTx(key, updater) {
        const next = Object.assign({}, txRef.current);
        next[key] = updater(next[key] || freshState());
        txRef.current = next;
        setTxStates(next);
        try {
            saveTxState(hostNoteId, next).then(res => {
                if (res && !res.ok) console.warn('[th] 保存计时状态失败：宿主笔记未配置 ~configNote，计时状态不会持久化');
            });
        } catch (e) { console.warn('[th] 保存计时状态失败', e); }
    }

    function handleTxStart(t) {
        const ms = txWorkMs(t);
        applyTx(txKey(t), () => ({ phase: 'work', endTime: Date.now() + ms, totalMs: ms }));
    }

    function handleTxRest(t) {
        const ms = txRestMs(t);
        applyTx(txKey(t), () => ({ phase: 'rest', endTime: Date.now() + ms, totalMs: ms }));
    }

    function handleTxReset(t) {
        applyTx(txKey(t), () => freshState());
    }

    // 到期提醒：按配置勾选的提醒方式执行（声音 / 弹窗 / 全屏；文案走 i18n）
    function notifyTx(key, which) {
        const methods = (configRef.current.tx && configRef.current.tx.notifyMethods) || ['message', 'sound'];
        const T = tRef.current;
        let msg = which === 'work' ? T('tx.notifyWork') : T('tx.notifyRest');
        const g = groupsRef.current;
        if (g && g.txTasks) {
            const t = g.txTasks.find(x => `${x.noteId}:${x.checkboxIndex}` === key);
            if (t && which === 'work') {
                const rl = t.tx.restLabel;
                msg = rl ? T('tx.notifyWorkLabel', { label: rl }) : T('tx.notifyWorkRestMin', { n: t.tx.rest });
            }
        }
        if (methods.indexOf('sound') >= 0) { try { beep(); } catch (e) {} }
        if (methods.indexOf('message') >= 0) { showToast(msg); }
        if (methods.indexOf('fullscreen') >= 0) { showFullscreen(msg, T('tx.dismiss')); }
    }

    // 初始化：恢复持久化计时状态 + 500ms tick（驱动倒计时 + 到期推进状态机）
    // 依赖提醒开关：关闭「提醒」时完全不启动 tick（停止每秒 setNow 触发的整面板 re-render）
    useEffect(() => {
        if (config.features && config.features.tx === false) return;
        (async () => {
            try {
                const raw = await loadTxState(hostNoteId);
                if (raw) {
                    const saved = JSON.parse(raw);
                    txRef.current = saved;
                    setTxStates(saved);
                }
            } catch (e) { console.warn('[th] 恢复计时状态失败', e); }
        })();
        const iv = setInterval(() => {
            const next = Object.assign({}, txRef.current);
            // 无进行中的计时器（work/rest 且带 endTime）→ 无需刷新倒计时，
            // 跳过 setNow：省掉每 500ms 触发的整面板 re-render
            let active = false;
            for (const key of Object.keys(next)) {
                const st = next[key];
                if ((st.phase === 'work' || st.phase === 'rest') && st.endTime) { active = true; break; }
            }
            if (!active) return;
            const ts = Date.now();
            setNow(ts);
            let changed = false;
            for (const key of Object.keys(next)) {
                const st = next[key];
                // 工作到期 → 待休息（提醒用户点「开始休息」）
                if (st.phase === 'work' && st.endTime && ts >= st.endTime) {
                    next[key] = { phase: 'restWait', endTime: null, totalMs: 0 };
                    changed = true;
                    notifyTx(key, 'work');
                }
                // 休息到期 → 回到待开始（提醒后用户可重新开始）
                else if (st.phase === 'rest' && st.endTime && ts >= st.endTime) {
                    next[key] = freshState();
                    changed = true;
                    notifyTx(key, 'rest');
                }
            }
            if (changed) {
                txRef.current = next;
                setTxStates(next);
                try {
                    saveTxState(hostNoteId, next).then(res => {
                        if (res && !res.ok) console.warn('[th] 保存计时状态失败：宿主笔记未配置 ~configNote，计时状态不会持久化');
                    });
                } catch (e) { console.warn('[th] 保存计时状态失败', e); }
            }
        }, 500);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.features ? config.features.tx : true]);

    // ── 设置 ──────────────────────────────────────────────────

    function openSettings() {
        setDraft(JSON.parse(JSON.stringify(configRef.current)));
        setSettingsTab('general');
        setSettingsError('');
        setSettingsOpen(true);
    }

    // 按点号路径更新草稿字段（如 'features.dk' / 'inbox.titles' / 'tx.defaultRest'）
    function patchDraft(path, value) {
        setDraft(d => {
            if (!d) return d;
            const next = JSON.parse(JSON.stringify(d));
            const parts = String(path).split('.');
            let cur = next;
            for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
            cur[parts[parts.length - 1]] = value;
            return next;
        });
    }

    // 保存：合并写入配置笔记，立即生效并刷新面板
    // 失败时保留弹窗并在弹窗顶部提示（常见原因：宿主笔记未配置 ~configNote 关系 / 配置笔记类型不对）
    async function handleSaveSettings() {
        try {
            const res = await saveJsonConfig(hostNoteId, draft);
            const ET = createI18n(draft ? draft.lang : config.lang);
            if (!res || !res.ok) {
                setSettingsError(res && res.error ? String(res.error) : ET('settings.noConfigNote'));
                return;
            }
            if (res.noteType && res.noteType !== 'json' && res.noteType !== 'code') {
                setSettingsError(ET('settings.wrongType', { type: res.noteType }));
                return;
            }
            const merged = deepMerge(DEFAULT_CONFIG, res.config || draft);
            configRef.current = merged;
            setConfig(merged);
            setSettingsOpen(false);
            await load();
        } catch (e) {
            console.error('[th] 保存配置失败', e);
            setSettingsError(String(e && e.message || e));
        }
    }

    // 恢复默认：整份默认配置写入并刷新
    async function handleResetSettings() {
        if (!window.confirm(tRef.current('settings.resetConfirm'))) return;
        try {
            const res = await saveJsonConfig(hostNoteId, DEFAULT_CONFIG);
            const ET = createI18n(draft ? draft.lang : config.lang);
            if (!res || !res.ok) {
                setSettingsError(res && res.error ? String(res.error) : ET('settings.noConfigNote'));
                return;
            }
            if (res.noteType && res.noteType !== 'json' && res.noteType !== 'code') {
                setSettingsError(ET('settings.wrongType', { type: res.noteType }));
                return;
            }
            const merged = deepMerge(DEFAULT_CONFIG, res.config || {});
            configRef.current = merged;
            setConfig(merged);
            setSettingsOpen(false);
            await load();
        } catch (e) {
            console.error('[th] 重置配置失败', e);
            setSettingsError(String(e && e.message || e));
        }
    }

    // ── 渲染 ──────────────────────────────────────────────────

    setI18n(t); // 注册翻译函数（面板内全部组件共享）

    let content;
    if (!config.enabled) {
        // 总开关关闭 → 停用视图（设置入口保留，便于重新启用）
        content = (
            <div class="th-disabled">
                <p>{t('app.disabled')}</p>
                <button class="th-btn primary" onClick={openSettings}>{t('settings.open')}</button>
            </div>
        );
    } else if (status === 'loading') {
        content = <LoadingBox />;
    } else if (status === 'error') {
        content = <ErrorBox message={errorMsg} />;
    } else if (status === 'empty') {
        content = <EmptyState />;
    } else {
        content = (
            <PanelView
                groups={groups}
                today={today}
                weekKey={weekKey}
                weekDaysArr={weekDaysArr}
                leavingKeys={leavingKeys}
                workingKeys={workingKeys}
                txStates={txStates}
                now={now}
                onOpenProject={handleOpenProject}
                onOpenTask={handleOpenTask}
                onCompleteTask={handleCompleteTask}
                onToggleDkDay={handleToggleDkDay}
                onTxStart={handleTxStart}
                onTxRest={handleTxRest}
                onTxReset={handleTxReset}
            />
        );
    }

    // 根容器样式（与原 $root.css 一致）；右上角常驻设置齿轮
    const tDraft = createI18n(draft ? draft.lang : config.lang); // 弹窗文案随草稿语言实时预览
    return (
        <div style="padding: 28px 32px; font-family: var(--detail-font-family, 'Segoe UI', sans-serif); font-size: 16px; line-height: 1.5; color: var(--main-text-color); box-sizing: border-box;">
            <div class="th-shell">
                {content}
                <button class="th-gear" title={t('settings.gear')} onClick={openSettings}>⚙️</button>
            </div>
            {settingsOpen && draft && (
                <SettingsModal
                    t={tDraft}
                    draft={draft}
                    tab={settingsTab}
                    onTab={setSettingsTab}
                    onPatch={patchDraft}
                    onSave={handleSaveSettings}
                    onClose={() => setSettingsOpen(false)}
                    onReset={handleResetSettings}
                    version={PLUGIN_VERSION}
                    repo={PLUGIN_REPO}
                    error={settingsError}
                />
            )}
        </div>
    );
}

// ============================================================
//  打开笔记并滚动定位到第 cbIndex 个 checkbox（任务行 / 打卡标题共用）
//  cbIndex 与后端一致：按文档顺序对笔记内所有 checkbox（含嵌套子任务）计数
// ============================================================
function jumpToNoteCheckbox(noteId, cbIndex) {
    activateNote(noteId);
    let attempts = 0;
    const timer = setInterval(() => {
        attempts++;
        let box = null;
        try {
            // 优先取当前激活 tab 中该笔记的内容容器
            const ctx = api.tabManager.getActiveContext();
            const nc = ctx && ctx.noteContext;
            if (nc && String(nc.noteId) === String(noteId) && nc.$content && nc.$content[0]) {
                // 校验容器仍挂在 document 上，避免拿到已被卸载的旧内容
                if (document.contains(nc.$content[0])) {
                    box = nc.$content[0];
                }
            }
        } catch (e) { /* 内部 API 不可用时降级 */ }
        if (!box) {
            // 降级：优先用 CSS 选择器收窄到「可见」的笔记内容区，
            // 避免多标签页时选中隐藏 tab 的容器 / document 中残留 checkbox 干扰索引
            const cands = document.querySelectorAll(
                '#note-content-container .note-content, .note-content .ck-content, .note-content, .ck-content'
            );
            let cand = null;
            for (const c of cands) {
                const cs = getComputedStyle(c);
                if (cs.display !== 'none' && c.offsetParent !== null) { cand = c; break; }
            }
            if (!cand && cands.length > 0) cand = cands[0];
            if (cand) { box = cand; }
            else { box = document; }
        }

        // 深度遍历所有 checkbox，嵌套子任务也在内，顺序与后端索引一致
        const inputs = box.querySelectorAll('input[type="checkbox"]');
        if (inputs.length > cbIndex) {
            clearInterval(timer);
            const el = inputs[cbIndex];
            // 滚动到内容区中央（而非仅露出边缘）
            scrollElementToCenter(el);
            // 短暂高亮所在行，便于肉眼定位
            const li = el.closest('li');
            if (li) {
                li.style.outline = '2px solid rgba(137,180,250,.9)';
                li.style.outlineOffset = '1px';
                li.style.borderRadius = '4px';
                li.style.transition = 'outline .2s';
                setTimeout(() => { li.style.outline = ''; }, 1600);
            }
            return;
        }
        // 最多等 10 秒（激活 + 内容渲染），100ms 轮询更跟手
        if (attempts > 100) clearInterval(timer);
    }, 100);
}

// ============================================================
//  将元素滚动到所在滚动容器的可视区中央
//  Trilium 内容区是独立滚动容器，且内容组件在笔记激活/渲染完成后会
//  异步恢复滚动位置（并可能带 CSS scroll-behavior: smooth 动画），
//  单次 scrollTop 赋值会被平滑动画或组件恢复冲掉（现象：笔记打开但停在顶部/原位置）。
//  处理:
//   1) 赋值前临时禁用容器的 smooth → 瞬时定位，不被动画吞掉
//   2) 多次校准(0/50/150/300/600/1000ms) → 对抗组件异步恢复滚动位置
//   3) 找不到滚动容器 / 最终仍不可见 → 降级 scrollIntoView
// ============================================================
function scrollElementToCenter(el) {
    // 从外到里找第一个可滚动祖先
    function findScrollTarget() {
        if (!document.contains(el)) return null;
        const rect = el.getBoundingClientRect();
        if (!rect.height && !rect.width) return null;

        const chain = [];
        let node = el.parentElement;
        while (node && node !== document.documentElement) {
            chain.push(node);
            node = node.parentElement;
        }
        for (let i = chain.length - 1; i >= 0; i--) {
            const c = chain[i];
            const cs = getComputedStyle(c);
            if (c.scrollHeight > c.clientHeight + 1 && /^(auto|scroll|overlay)$/.test(cs.overflowY)) {
                return c;
            }
        }
        return null;
    }

    // 把 target.scrollTop 设为使 el 垂直居中的值；返回是否已居中
    function centerOn(target) {
        if (!document.contains(el)) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.height && !rect.width) return false;
        const cRect = target.getBoundingClientRect();
        const targetCenter = rect.top - cRect.top + rect.height / 2;
        const delta = targetCenter - target.clientHeight / 2;
        const maxTop = target.scrollHeight - target.clientHeight;
        const newTop = Math.max(0, Math.min(maxTop, target.scrollTop + delta));

        // 临时禁用 CSS smooth：smooth 下 scrollTop 赋值会变成动画，50ms 只滚一小段
        const prevBehavior = target.style.scrollBehavior;
        target.style.scrollBehavior = 'auto';
        target.scrollTop = newTop;
        target.style.scrollBehavior = prevBehavior;

        return Math.abs(delta) <= 3;
    }

    const target = findScrollTarget();
    if (!target) {
        try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); }
        catch (e) { el.scrollIntoView(true); }
        return;
    }

    // 立即居中 + 多次校准，覆盖 Trilium 激活/渲染后异步恢复滚动位置的窗口
    [0, 50, 150, 300, 600, 1000].forEach(t => setTimeout(() => centerOn(target), t));

    // 最终兜底：1.5s 后元素仍不在容器可视区内 → 交给浏览器 scrollIntoView
    setTimeout(() => {
        if (!document.contains(el)) return;
        const rect = el.getBoundingClientRect();
        const cRect = target.getBoundingClientRect();
        const visible = rect.bottom > cRect.top && rect.top < cRect.bottom;
        if (!visible) {
            try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); }
            catch (e) { el.scrollIntoView(true); }
        }
    }, 1500);
}
