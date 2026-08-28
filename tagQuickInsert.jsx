// ============================================================
//  tagQuickInsert — 「输入 # 弹出自定义候选」（TriliumNext Flux 子模块）
//  作为 render bundle 的子模块，入口用标题「tagQuickInsert」引用：
//      const { initTagQuickInsert, destroyTagQuickInsert } = tagQuickInsert;
//
//  依赖注入（不直接 import i18n / config，由入口 main.jsx 传入）：
//      initTagQuickInsert({ t, config })
//        t      —— i18n 翻译函数（createI18n(config.lang) 的结果）
//        config —— deepMerge 后的配置对象（含 lang / tqi.enabled）
//
//  候选池：内置 TQI_DEFAULT_CANDIDATES（label 统一英文，desc 支持
//  {zh, en} 双语按 config.lang 显示；日期条目初始化时动态填真实日期）。
//  动态候选：选中/输入 #repeat:数字单位（如 #repeat:1d）后实时生成
//  「锚点组合」:start/:end/:endwork/:actual 及直接完成；#repeat:2 等未预置
//  间隔数动态补全单位；#habit:数字 生成每天次数层；#timer:数字 生成休息时长层。
//  提示文案走注入的 t（键：tqi.nav / tqi.insert / tqi.close / tqi.empty）。
//
//  ⚠️ 注意：
//    - 子模块里避免使用 ?? 空值合并（Trilium 编译时不注入 helper），一律用 ||。
//    - 本文件是子模块，不负责顶层自动初始化；生命周期由 main.jsx 的
//      useEffect 挂载（init）与清理（destroy）控制。
// ============================================================

// ── 内置候选池（label 统一英文；desc 支持 {zh, en} 双语）──
// 日期条目通过 dateOffset / weekend / nextWeek / monthEnd / nextMonth /
// nextMonthSameDay 在初始化时动态计算插入日期；habit / timer / repeat 为模板 + 动态生成。
// 日期分两层：主条目 today / tomorrow / next；next 组子条目（group:'next'）
// 默认隐藏，前缀命中带 expand:'next' 的 next 主条目时整组展开。
// 子条目 label 用连写驼峰（nextWeekend / nextMonday / nextWeek / monthEnd /
// nextMonthStart / nextMonth），空格始终作为标签输入的中断符（输入空格即关闭弹窗）。
const TQI_DEFAULT_CANDIDATES = [
    // ── 日期：第一层只显示 今天/明天/next；输入 next 展开「后续日期」组 ──
    { icon: '📅', label: 'today', dateOffset: 0, desc: { zh: '今天', en: 'Today' } },
    { icon: '📅', label: 'tomorrow', dateOffset: 1, desc: { zh: '明天', en: 'Tomorrow' } },
    { icon: '📅', label: 'next', nextWeek: true, expand: 'next',
      desc: { zh: '更多日期', en: 'More dates' } },
    // next 组（默认隐藏，前缀命中 next 时展开；label 用连写驼峰，输入无需空格）
    { icon: '📅', label: 'nextWeekend', weekend: true, group: 'next', desc: { zh: '本周末', en: 'Weekend' } },
    { icon: '📅', label: 'nextMonday', nextWeek: true, group: 'next', desc: { zh: '下周一', en: 'Next Mon' } },
    { icon: '📅', label: 'nextWeek', dateOffset: 7, group: 'next', desc: { zh: '下周', en: '+7 days' } },
    { icon: '📅', label: 'monthEnd', monthEnd: true, group: 'next', desc: { zh: '月底', en: 'Month end' } },
    { icon: '📅', label: 'nextMonthStart', nextMonth: true, group: 'next', desc: { zh: '下月初', en: 'Next 1st' } },
    { icon: '📅', label: 'nextMonth', nextMonthSameDay: true, group: 'next', desc: { zh: '下月同日', en: 'Same day' } },
    // ── 重复任务 #repeat（子组，前缀过滤同 next；选中任意单位后自动续写锚点组合）──
    { icon: '🔁', label: 'repeat', expand: 'repeat', insert: '#repeat:1w',
      desc: { zh: '重复任务', en: 'Repeat task' } },
    { icon: '🔁', label: 'repeat:1d', group: 'repeat', insert: '#repeat:1d', cont: true, desc: { zh: '每天', en: 'Daily' } },
    { icon: '🔁', label: 'repeat:1w', group: 'repeat', insert: '#repeat:1w', cont: true, desc: { zh: '每周', en: 'Weekly' } },
    { icon: '🔁', label: 'repeat:1m', group: 'repeat', insert: '#repeat:1m', cont: true, desc: { zh: '每月', en: 'Monthly' } },
    { icon: '🔁', label: 'repeat:1y', group: 'repeat', insert: '#repeat:1y', cont: true, desc: { zh: '每年', en: 'Yearly' } },
    // ── 习惯打卡 #habit（子组，前缀过滤同 repeat；选中天数后自动续写每天次数）──
    { icon: '🌱', label: 'habit', expand: 'habit', insert: '#habit:5',
      desc: { zh: '习惯打卡', en: 'Habit' } },
    { icon: '🌱', label: 'habit:3', group: 'habit', insert: '#habit:3', cont: true, desc: { zh: '每周 3 天', en: '3 days/wk' } },
    { icon: '🌱', label: 'habit:5', group: 'habit', insert: '#habit:5', cont: true, desc: { zh: '每周 5 天', en: '5 days/wk' } },
    { icon: '🌱', label: 'habit:7', group: 'habit', insert: '#habit:7', cont: true, desc: { zh: '每周 7 天', en: '7 days/wk' } },
    // ── 间隔计时 #timer（子组，前缀过滤同 repeat；选中专注时长后自动续写休息时长）──
    { icon: '⏱', label: 'timer', expand: 'timer', insert: '#timer:25:5',
      desc: { zh: '专注计时', en: 'Focus timer' } },
    { icon: '⏱', label: 'timer:25', group: 'timer', insert: '#timer:25', cont: true, desc: { zh: '专注 25 分', en: 'Focus 25 min' } },
    { icon: '⏱', label: 'timer:50', group: 'timer', insert: '#timer:50', cont: true, desc: { zh: '专注 50 分', en: 'Focus 50 min' } },
    // ── 固定排序 #priority（子组，前缀过滤同 next；任意 1-10 数字由动态层补全）──
    { icon: '🔝', label: 'priority', expand: 'priority', insert: '#priority:5',
      desc: { zh: '固定排序', en: 'Fixed order' } },
    { icon: '🔝', label: 'priority:1', group: 'priority', insert: '#priority:1', desc: { zh: '最前', en: 'Top' } },
    { icon: '🔝', label: 'priority:5', group: 'priority', insert: '#priority:5', desc: { zh: '常用', en: 'Common' } },
    { icon: '🔝', label: 'priority:10', group: 'priority', insert: '#priority:10', desc: { zh: '靠后', en: 'Bottom' } },
];

// ── 状态 ──
let i18nT = null;           // 翻译函数（由 main 注入）
let curLang = 'zh';         // 界面语言（决定 desc 双语显示）
let tagPool = [];           // [{ label, insert, icon, desc }]
let popupEl = null;
let candidates = [];
let selectedIdx = 0;
let currentPrefix = '';
let shown = false;
let activeEditor = null;
let boundEditors = new WeakSet();
let bound = false;
let pollTimer = null;

const TQI_DEBUG = true;
const POPUP_CLASS = 'tqi-popup';

function dbg(...args) {
    if (TQI_DEBUG) console.log('[tqi]', ...args);
}

// ── 样式（仿官方斜杠命令浮层）──
let stylesInjected = false;
function injectTqiStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const css = `
.${POPUP_CLASS} {
    position: fixed; z-index: 99999;
    width: 320px;
    background: var(--main-background-color, #ffffff);
    color: var(--main-text-color, #2c2c2c);
    border: 1px solid var(--main-border-color, #e5e5e5);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
    font-family: inherit;
    font-size: 13px; line-height: 1.35;
    padding: 4px;
}
.${POPUP_CLASS} .tqi-hint {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px 8px;
    font-size: 11px; color: var(--muted-text-color, #888);
    border-bottom: 1px solid var(--main-border-color, #f0f0f0);
    margin-bottom: 2px;
}
.${POPUP_CLASS} .tqi-kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    background: var(--accented-background-color, rgba(66,133,244,.10));
    color: var(--accented-text-color, #4285f4);
    padding: 1px 5px; border-radius: 3px;
    border: 1px solid var(--main-border-color, rgba(0,0,0,.06));
}
.${POPUP_CLASS} .tqi-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
}
.${POPUP_CLASS} .tqi-item.tqi-sel {
    background: var(--accented-background-color, rgba(66,133,244,.10));
}
.${POPUP_CLASS} .tqi-icon {
    flex: 0 0 28px; width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accented-background-color, rgba(66,133,244,.12));
    color: var(--accented-text-color, #4285f4);
    border-radius: 6px;
    font-size: 15px; line-height: 1;
}
.${POPUP_CLASS} .tqi-body {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 2px;
}
.${POPUP_CLASS} .tqi-label {
    font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.${POPUP_CLASS} .tqi-desc {
    color: var(--muted-text-color, #888);
    font-size: 11px; line-height: 1.3;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.${POPUP_CLASS} .tqi-empty {
    padding: 16px; text-align: center;
    color: var(--muted-text-color, #999);
    font-size: 12px;
}
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
}

// ── 日期工具：动态计算「今天/明天/本周末/下周一/月底/下月」等真实日期 ──
function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function weekendDate() {
    // 本周末 = 本周日（今天已是周日 → 即今天）
    const d = new Date();
    return addDays(d, (7 - d.getDay()) % 7);
}
function nextMonday() {
    const d = new Date();
    let diff = (1 - d.getDay() + 7) % 7; // 今天是周一 → 下周一
    if (diff === 0) diff = 7;
    return addDays(d, diff);
}
function monthLastDay() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function firstOfNextMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
function nextMonthSameDayDate() {
    // 下个月同日（JS Date 自动处理月末溢出，如 1/31 → 3/2/3）
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// ── 配置应用：注入 i18n + 构建候选池（可重复调用，刷新配置）──
function applyConfig(t, config) {
    i18nT = t || null;
    const cfg = config || {};
    curLang = cfg.lang === 'en' ? 'en' : 'zh';
    const tqi = cfg.tqi || {};
    // v5.0+：候选池内置 TQI_DEFAULT_CANDIDATES，不再读取 config.tqi.candidates
    // （保留 config.tqi.candidates 字段仅为向后兼容，实际忽略——避免旧配置笔记残留覆盖内置）
    const raw = TQI_DEFAULT_CANDIDATES;
    tagPool = raw.map(c => {
        const isObj = typeof c === 'object' && c !== null;
        const rawLabel = isObj ? String(c.label || '') : String(c || '');
        const label = rawLabel.replace(/^#/, '').trim();
        const icon = isObj && c.icon ? String(c.icon) : '◆';
        const desc = isObj && c.desc ? c.desc : '';
        let insert = isObj && c.insert !== undefined && String(c.insert) !== ''
            ? String(c.insert)
            : ('#' + label);
        if (isObj) {
            if (c.dateOffset !== undefined) insert = '#' + fmtDate(addDays(new Date(), c.dateOffset));
            else if (c.weekend) insert = '#' + fmtDate(weekendDate());
            else if (c.nextWeek) insert = '#' + fmtDate(nextMonday());
            else if (c.monthEnd) insert = '#' + fmtDate(monthLastDay());
            else if (c.nextMonth) insert = '#' + fmtDate(firstOfNextMonth());
            else if (c.nextMonthSameDay) insert = '#' + fmtDate(nextMonthSameDayDate());
        }
        const out = { label, insert, icon, desc };
        if (isObj) {
            if (c.group) out.group = String(c.group);
            if (c.expand) out.expand = String(c.expand);
            if (c.cont) out.cont = true;
        }
        return out;
    }).filter(x => x.label);
    dbg('候选池加载完成，共', tagPool.length, '个（内置 v5.0，config.tqi.candidates 已忽略）');
}

// ── 编辑器实例 ──
async function getEditor() {
    try {
        const ed = await api.getActiveContextTextEditor();
        return ed || null;
    } catch (e) { return null; }
}

// ── 从 model 读光标前文本（文本节点直取 + 节点回溯）──
function getTextBefore(editor) {
    try {
        const sel = editor.model.document.selection;
        if (!sel) return '';
        const pos = sel.getFirstPosition();
        if (!pos) return '';

        let text = '';
        if (pos.textNode && pos.textNode.is('$text')) {
            try {
                const off = pos.offsetIn(pos.textNode);
                text = pos.textNode.data.slice(0, off);
            } catch (e) { /* 忽略 */ }
        }
        let cur = pos;
        let guard = 0;
        while (cur && guard++ < 400) {
            const nb = cur.nodeBefore;
            if (nb && nb.is('$text')) {
                text = nb.data + text;
                if (text.length > 200) break;
                cur = editor.model.createPositionBefore(nb);
            } else {
                break;
            }
        }
        return text;
    } catch (e) {
        dbg('getTextBefore 异常:', e && (e.message || e));
        return '';
    }
}

function matchPrefix(textBefore) {
    const m = String(textBefore).match(/(^|\s)(#[^\s]*)$/);
    return m ? m[2] : null;
}

// ── 核心：编辑器 model 变化时判定并刷新浮层 ──
function onModelChange(editor) {
    const textBefore = getTextBefore(editor);
    const prefix = matchPrefix(textBefore);
    if (prefix) {
        showPopup(prefix);
    } else {
        hidePopup();
    }
}

// 绑定实例（WeakSet 去重）；silent=true 时静默失败（轮询用）
function ensureEditorBound(silent) {
    getEditor().then(editor => {
        if (editor && editor.model && editor.model.document) {
            activeEditor = editor;
            if (!boundEditors.has(editor)) {
                boundEditors.add(editor);
                editor.model.document.on('change:data', () => onModelChange(editor));
                dbg('已绑定编辑器实例');
            }
        } else if (!silent) {
            dbg('getActiveContextTextEditor 暂不可用，跳过本轮绑定');
        }
    });
}

// 轮询绑定：应用启动后编辑器可能尚未 ready，持续尝试直到成功
function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
        ensureEditorBound(true);
        if (boundEditors.size > 0) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }, 800);
}

// ── desc 双语解析：{zh, en} 对象或普通字符串 ──
function resolveDesc(d) {
    if (d && typeof d === 'object') return d[curLang] || d.zh || d.en || '';
    return d || '';
}

// ── 动态候选生成：repeat / timer 按输入实时补全 ──
// repeat 层进式：label 只显示「下一步要补的片段」，insert 始终是完整标签。
//   第 2 级（repeat: / repeat:N）→ 片段 1d 1w 1m 1y（数字实时代入）
//   第 3/4 级（repeat:N单位 / repeat:N单位:）→ 锚点后缀 :start/:end/:endwork/:actual
function repeatUnitCandidates(q) {
    // q 形如 "repeat:2" / "repeat:25"（静态池只预置了 1 系列，其他间隔数在此动态补全）
    // label 用完整标签（repeat:2d），与静态池 repeat:1d 风格一致（同 next）
    // cont: true → 选中后不加尾随空格，继续进入下一级（选 2w 后还能追加 :end 等锚点）
    const n = q.split(':')[1] || '1';
    return [
        { icon: '🔁', label: 'repeat:' + n + 'd', insert: '#repeat:' + n + 'd', cont: true, desc: { zh: '每 ' + n + ' 天', en: 'Every ' + n + ' days' } },
        { icon: '🔁', label: 'repeat:' + n + 'w', insert: '#repeat:' + n + 'w', cont: true, desc: { zh: '每 ' + n + ' 周', en: 'Every ' + n + ' weeks' } },
        { icon: '🔁', label: 'repeat:' + n + 'm', insert: '#repeat:' + n + 'm', cont: true, desc: { zh: '每 ' + n + ' 月', en: 'Every ' + n + ' months' } },
        { icon: '🔁', label: 'repeat:' + n + 'y', insert: '#repeat:' + n + 'y', cont: true, desc: { zh: '每 ' + n + ' 年', en: 'Every ' + n + ' years' } },
    ];
}
function repeatSuffixCandidates(q) {
    // q 形如 "repeat:2w" / "repeat:2w:" / "repeat:2w:en"（静态池未预置的间隔数 → 动态生成锚点）
    // label 用完整标签（repeat:2w:end），与静态池 repeat:1w:end 风格一致（同 next）
    const m = q.match(/^repeat:(\d+)([dwmy])/i);
    const n = m ? m[1] : '1';
    const unit = m ? m[2].toLowerCase() : 'w';
    const base = 'repeat:' + n + unit;
    const tail = q.slice(base.length); // "" / ":" / ":en"
    // 月初/月底/月末工作日只对「月」有意义；「按实际完成顺延」对所有单位可选
    const anchors = unit === 'm'
        ? [
            { icon: '📆', label: base + ':start', insert: '#' + base + ':start', desc: { zh: '每月初', en: 'Month start' } },
            { icon: '📆', label: base + ':end', insert: '#' + base + ':end', desc: { zh: '每月底', en: 'Month end' } },
            { icon: '📆', label: base + ':endwork', insert: '#' + base + ':endwork', desc: { zh: '月末工作日', en: 'Last workday' } },
            { icon: '🔁', label: base + ':actual', insert: '#' + base + ':actual', desc: { zh: '按实际完成顺延', en: 'Roll from done' } },
        ]
        : [
            { icon: '🔁', label: base + ':actual', insert: '#' + base + ':actual', desc: { zh: '按实际完成顺延', en: 'Roll from done' } },
        ];
    let items = anchors;
    if (tail && tail[0] === ':') items = items.filter(i => i.label.toLowerCase().startsWith(base + tail));
    // 还没输入尾冒号（如 repeat:2w）：首位提供「直接完成」，选中即插入当前完整形式（按计划日期顺延）
    if (q.indexOf(':', q.indexOf(':') + 1) < 0) {
        items.unshift({ icon: '🔁', label: base, insert: '#' + base, desc: { zh: '直接完成', en: 'Finish now' } });
    }
    return items;
}
// habit 动态层进：每周天数已定（habit:3 / habit:5:…）→ 直接完成 + 每天次数选项
function habitTimesCandidates(q) {
    const m = q.match(/^habit:(\d+)/i);
    const n = m ? m[1] : '5';
    const base = 'habit:' + n;
    const tail = q.slice(base.length); // "" / ":" / ":2"
    let items = [
        { icon: '🌱', label: base, insert: '#' + base, desc: { zh: '每周 ' + n + ' 天', en: n + ' days/wk' } },
        { icon: '🌱', label: base + ':2', insert: '#' + base + ':2', desc: { zh: '每周 ' + n + ' 天，最多 2 次/天', en: n + ' days/wk, max 2/day' } },
        { icon: '🌱', label: base + ':3', insert: '#' + base + ':3', desc: { zh: '每周 ' + n + ' 天，最多 3 次/天', en: n + ' days/wk, max 3/day' } },
    ];
    if (tail && tail[0] === ':') items = items.filter(i => i.label.toLowerCase().startsWith(base + tail));
    return items;
}
// timer 动态层进：专注时长已定（timer:25 / timer:25:…）→ 直接完成 + 休息时长选项
function timerCandidates(q) {
    const m = q.match(/^timer:(\d+)(?::(\d+))?/i);
    const n = m ? m[1] : '25';
    const r = m && m[2] ? m[2] : '';
    const base = 'timer:' + n;
    const tail = q.slice(base.length); // "" / ":" / ":10"
    let items = [
        { icon: '⏱', label: base, insert: '#' + base, desc: { zh: '专注 ' + n + ' 分', en: 'Focus ' + n + ' min' } },
        { icon: '⏱', label: base + ':5', insert: '#' + base + ':5', desc: { zh: '专注 ' + n + ' / 休息 5 分', en: 'Focus ' + n + ' / rest 5' } },
        { icon: '⏱', label: base + ':10', insert: '#' + base + ':10', desc: { zh: '专注 ' + n + ' / 休息 10 分', en: 'Focus ' + n + ' / rest 10' } },
    ];
    if (tail && tail[0] === ':') {
        items = items.filter(i => i.label.toLowerCase().startsWith(base + tail));
        // 休息分钟已定（timer:N:M）：追加「自定义阶段名」提示——默认进行/休息即可，也可改任意文字
        if (/^timer:\d+:\d+$/.test(q)) {
            const stagePh = curLang === 'en' ? 'Focus name:Relax name' : '自定义专注内容:自定义放松内容';
            items.push({
                icon: '⏱',
                label: base + ':' + r + ':' + stagePh,
                insert: '#' + base + ':' + r + ':' + stagePh,
                desc: { zh: '自定义阶段名（可选）', en: 'Custom phase labels' }
            });
        }
    }
    return items;
}

// priority 固定排序动态补全：输入 priority / priority:N 生成 1-10
// 未输数字：显示常用档 1/2/3/5/7/10；已输数字：精确过滤（priority:1 → 1、10；priority:9 → 9）
function priorityCandidates(q) {
    const m = q.match(/^priority:(\d*)$/i);
    const cur = m ? m[1] : '';
    const nums = cur
        ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].filter(n => n.startsWith(cur))
        : ['1', '2', '3', '5', '7', '10'];
    return nums.map(n => ({
        icon: '🔝',
        label: 'priority:' + n,
        insert: '#priority:' + n,
        desc: { zh: '固定排序 ' + n + '（越小越靠前）', en: 'Sort ' + n + ' (lower first)' }
    }));
}

// 总入口：动态优先，静态池前缀匹配兜底
function getCandidates(q) {
    // ── priority 固定排序：priority / priority:N → 动态补全 1-10 ──
    if (/^priority(?::\d*)?$/i.test(q)) return priorityCandidates(q);
    // ── repeat 动态层进：任何单位选定后（repeat:1d / repeat:2w / repeat:1d:…）生成锚点组合；
    //    数字已输但静态池未预置（repeat:2 / repeat:25）时先动态补全单位。timer 同理。──
    if (/^repeat:\d+[dwmy]($|:)/.test(q)) return repeatSuffixCandidates(q);
    if (/^repeat:\d+$/.test(q) && q !== 'repeat:1') return repeatUnitCandidates(q);
    // habit 天数已定（habit:3 / habit:5:…）→ 每天次数层
    if (/^habit:\d+(:|$)/.test(q)) return habitTimesCandidates(q);
    // timer 专注时长已定（timer:25 / timer:25:…）→ 休息时长层
    if (/^timer:\d+(:|$)/.test(q)) return timerCandidates(q);
    const lq = q.toLowerCase();
    // 空输入：只显示主条目（隐藏 next 组等 group 条目）
    if (!lq) return tagPool.filter(i => !i.group);
    // 过滤时忽略空格 + 大小写：输入 nextweek / next week / NextWeek 都等价匹配
    const norm = s => s.toLowerCase().replace(/\s+/g, '');
    const normQ = norm(lq);
    const out = [];
    const seen = new Set();
    for (const item of tagPool) {
        if (!norm(item.label).startsWith(normQ)) continue;
        // 主条目带 expand：命中时把整个子组展开，自身不展示（避免冗余，用户已输入 next 就只想看具体选项）
        if (item.expand) {
            for (const sub of tagPool) {
                if (sub.group === item.expand && !seen.has(sub.label)) {
                    seen.add(sub.label);
                    out.push(sub);
                }
            }
        } else {
            if (!seen.has(item.label)) { seen.add(item.label); out.push(item); }
        }
    }
    return out;
}

// ── 浮层 ──
function showPopup(prefix) {
    const q = prefix.slice(1).toLowerCase();
    candidates = getCandidates(q).slice(0, 8);
    if (!candidates.length) { hidePopup(); return; }

    selectedIdx = 0;
    currentPrefix = prefix;
    ensurePopupEl();
    renderPopup();
    positionPopup();
    shown = true;
}

function positionPopup() {
    if (!popupEl) return;
    popupEl.style.display = 'block';
    const w = popupEl.offsetWidth || 320;
    const h = popupEl.offsetHeight || 220;
    const M = 6;    // 光标与弹窗间距
    const EDGE = 8; // 视口边距
    try {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            const rect = sel.getRangeAt(0).getClientRects()[0] || sel.getRangeAt(0).getBoundingClientRect();
            if (rect) {
                const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - w - EDGE));
                const spaceBelow = window.innerHeight - rect.bottom - M;
                const spaceAbove = rect.top - M;
                let top;
                if (spaceBelow < h && spaceAbove >= h) {
                    // 下方放不下、上方放得下 → 弹到光标上方，避免下部分被遮挡
                    top = Math.max(EDGE, rect.top - h - M);
                } else {
                    // 默认下方；两侧都放不下时也优先下方，但强行收进视口
                    top = rect.bottom + M;
                    if (top + h > window.innerHeight - EDGE) {
                        top = Math.max(EDGE, window.innerHeight - h - EDGE);
                    }
                }
                popupEl.style.left = left + 'px';
                popupEl.style.top = top + 'px';
                return;
            }
        }
    } catch (e) { /* 兜底 */ }
    popupEl.style.left = Math.min(80, window.innerWidth - w - 10) + 'px';
    popupEl.style.top = '80px';
}

function ensurePopupEl() {
    if (popupEl) return;
    popupEl = document.createElement('div');
    popupEl.className = POPUP_CLASS;
    popupEl.style.display = 'none';
    document.body.appendChild(popupEl);
    popupEl.addEventListener('mousedown', e => e.preventDefault());
    popupEl.addEventListener('click', e => {
        const item = e.target.closest('.tqi-item');
        if (item && item.dataset.idx !== undefined) {
            acceptCandidate(Number(item.dataset.idx));
        }
    });
    // 鼠标 hover 同步高亮
    popupEl.addEventListener('mousemove', e => {
        const item = e.target.closest('.tqi-item');
        if (item && item.dataset.idx !== undefined) {
            const idx = Number(item.dataset.idx);
            if (idx !== selectedIdx) {
                selectedIdx = idx;
                renderPopup();
            }
        }
    });
}

function renderPopup() {
    if (!popupEl) return;
    const L = (k, d) => (i18nT ? i18nT(k) : d);
    let html = '<div class="tqi-hint">' +
        '<span class="tqi-kbd">↑↓</span>' + escapeHtml(L('tqi.nav', '选择')) +
        '<span class="tqi-kbd">↵</span>' + escapeHtml(L('tqi.insert', '插入')) +
        '<span class="tqi-kbd">Esc</span>' + escapeHtml(L('tqi.close', '关闭')) +
        '</div>';
    if (!candidates.length) {
        html += '<div class="tqi-empty">' + escapeHtml(L('tqi.empty', '无匹配词条')) + '</div>';
    } else {
        candidates.forEach((item, i) => {
            const cls = i === selectedIdx ? ' tqi-sel' : '';
            const descTxt = resolveDesc(item.desc);
            const descHtml = descTxt
                ? `<div class="tqi-desc">${escapeHtml(descTxt)}</div>`
                : '';
            html += `<div class="tqi-item${cls}" data-idx="${i}">` +
                `<span class="tqi-icon">${escapeHtml(item.icon)}</span>` +
                `<div class="tqi-body">` +
                    `<div class="tqi-label">${escapeHtml(item.label)}</div>` +
                    descHtml +
                `</div>` +
                `</div>`;
        });
    }
    popupEl.innerHTML = html;
    const items = popupEl.querySelectorAll('.tqi-item');
    if (items[selectedIdx]) items[selectedIdx].scrollIntoView({ block: 'nearest' });
}

function moveSelection(delta) {
    if (!candidates.length) return;
    selectedIdx = (selectedIdx + delta + candidates.length) % candidates.length;
    renderPopup();
}

function hidePopup() {
    shown = false;
    currentPrefix = '';
    if (popupEl) { popupEl.style.display = 'none'; popupEl.innerHTML = ''; }
}

// ── 插入：替换已输入前缀 + 写入完整内容 ──
function acceptCandidate(idx) {
    const item = candidates[idx];
    if (!item) return;
    const insertText = item.insert || ('#' + item.label);
    const cont = !!item.cont; // 层进式片段：插入后不加空格，立即刷新下一级候选（如 1w → 锚点）
    const tail = cont ? '' : ' ';
    const editor = activeEditor;
    if (editor && editor.model) {
        try {
            editor.model.change(writer => {
                const sel = editor.model.document.selection;
                const pos = sel.getFirstPosition();
                const textBefore = getTextBefore(editor);
                const lastHash = textBefore.lastIndexOf('#');
                let start = pos;
                if (lastHash >= 0) {
                    const n = textBefore.length - lastHash;
                    try {
                        for (let i = 0; i < n; i++) start = start.getShiftedBy(-1);
                    } catch (e) { start = pos; }
                }
                if (start !== pos) {
                    writer.remove(writer.createRange(start, pos));
                }
                writer.insertText(insertText + tail, start);
            });
            dbg('已插入', insertText + (cont ? '（续写）' : ''));
        } catch (e) {
            console.warn('[tqi] 插入失败', e);
            try { api.addTextToActiveContextEditor(insertText + tail); } catch (e2) { /* 忽略 */ }
        }
    } else {
        try { api.addTextToActiveContextEditor(insertText + tail); } catch (e) { /* 忽略 */ }
    }
    hidePopup();
    // 层进式续写：不关闭弹窗，基于新前缀立即刷新为下一级候选
    if (cont && editor) onModelChange(editor);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// ── 全局键盘/鼠标：挂 window 捕获阶段（比 document 更外层），
//    即使 Trilium 在 document 上注册的捕获监听先 stopPropagation，
//    这里也能在事件传播的更早阶段收到，保证 Esc / 点击外部一定可关闭。──
function onKeydown(e) {
    if (!shown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); moveSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); moveSelection(-1); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (candidates[selectedIdx]) acceptCandidate(selectedIdx);
    }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hidePopup(); }
}

function onDocMousedown(e) {
    if (shown && popupEl && !popupEl.contains(e.target)) hidePopup();
}

// 输入触发：确保当前活动编辑器已被绑定
function onGlobalInput() {
    ensureEditorBound();
}

// ── 生命周期（由 main.jsx 调用）──
export function initTagQuickInsert({ t, config } = {}) {
    applyConfig(t, config);
    if (bound) return; // 已注册过全局监听器，仅刷新候选池/i18n
    bound = true;
    injectTqiStyles();
    window.addEventListener('input', onGlobalInput, true);
    window.addEventListener('keydown', onKeydown, true);
    window.addEventListener('mousedown', onDocMousedown, true);
    startPolling();
    ensureEditorBound();
    dbg('v5.0 已初始化（Flux 子模块）');
}

export function destroyTagQuickInsert() {
    if (!bound) return;
    bound = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    window.removeEventListener('input', onGlobalInput, true);
    window.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('mousedown', onDocMousedown, true);
    hidePopup();
    if (popupEl && popupEl.parentNode) popupEl.parentNode.removeChild(popupEl);
    popupEl = null;
    activeEditor = null;
    boundEditors = new WeakSet();
}
