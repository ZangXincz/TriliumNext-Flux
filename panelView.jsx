// ============================================================
//  panelView — 视图层（纯展示，无状态、无数据获取）
//  所有数据与回调均由入口 main.jsx 通过 props 注入，
//  本模块不依赖任何其他子模块（含 Preact hooks），
//  仅使用 bundle 提供的 JSX/h。
//  文案统一走 i18n：main.jsx 调用 setI18n(t) 注册翻译函数，
//  弹窗内文案则使用传入的 t（随草稿语言实时预览）。
//  作为 render bundle 的子模块，入口用标题「panelView」引用：
//      const { PanelView, LoadingBox, EmptyState, ErrorBox, SettingsModal, setI18n } = panelView;
// ============================================================

// 模块级翻译函数（由 main.jsx 通过 setI18n 注入）
let _t = key => (typeof key === 'string' ? key : '');
export function setI18n(t) { _t = t; }

// 加载提示（首次加载时显示）
export function LoadingBox() {
    return <p style="color:var(--muted-text-color,#888)">{_t('app.loading')}</p>;
}

// 空状态
export function EmptyState() {
    return <p style="color:var(--muted-text-color,#888)">{_t('app.empty')}</p>;
}

// 错误提示
export function ErrorBox({ message }) {
    return (
        <div style="color: #e64553; background: rgba(230,69,83,.08); padding: 12px 14px; border-radius: 8px; font-size: 15px;">
            {_t('app.loadError')}<br /><br />
            {message}
        </div>
    );
}

// 组标题 + 计数徽标
function GroupTitle({ title, count }) {
    return (
        <div class="th-group-title">
            {title}
            <span class="th-group-count">{count}</span>
        </div>
    );
}

// 任务列表容器（左侧竖线）
function TaskList({ children }) {
    return (
        <div class="th-task-list" style="border-left: 2px solid var(--main-border-color, #313244); padding-left: 14px;">
            {children}
        </div>
    );
}

// 优先级徽标（P1 红 / P2 黄 / P3 灰，复用任务进度比例外观，加对应浅色背景）
// 颜色/背景用内联样式，确保不被全局 CSS 覆盖
function PriorityBadge({ priority }) {
    const m = String(priority || '').match(/p(\d+)/i);
    if (!m) return null;
    const level = parseInt(m[1], 10);
    const styles = {
        p1: 'color:#c93a4b;background:rgba(230,69,83,.15);',
        p2: 'color:#a8800f;background:rgba(232,184,79,.22);',
        p3: 'color:#646b7a;background:rgba(166,173,200,.25);'
    };
    const key = level <= 1 ? 'p1' : level === 2 ? 'p2' : 'p3';
    return <span class="th-group-count" style={styles[key]}>{priority}</span>;
}

// 重复任务节奏文本（#repeat:Nd/Nw/Nm/Ny + 可选位置/基准后缀）
function repeatLabel(rp) {
    const n = rp.interval;
    if (rp.pos === 'start') return _t('repeat.start');
    if (rp.pos === 'end') return _t('repeat.end');
    if (rp.pos === 'endwork') return _t('repeat.endwork');
    const k = 'repeat.' + rp.unit + (n > 1 ? 'n' : '');
    return _t(k, { n }) + (rp.pos === 'actual' ? _t('repeat.actual') : '');
}

// 循环线条图标（灰色，跟随标签文字颜色）
function RepeatIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 2l4 4-4 4"/>
            <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
            <path d="M7 22l-4-4 4-4"/>
            <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
        </svg>
    );
}

// 单行任务
function TaskRow({ t, isDueGroup, today, leaving, onOpen, onComplete }) {
    let dateTag = null;
    if (t.date) {
        if (!isDueGroup) {
            dateTag = <span class="th-task-date">{t.date}</span>;
        } else if (t.date === today) {
            dateTag = <span class="th-task-date today">{_t('task.today')} · {t.date}</span>;
        } else {
            dateTag = <span class="th-task-date overdue">{_t('task.overdue')} · {t.date}</span>;
        }
    }
    return (
        <div class={"th-task-row" + (leaving ? ' th-leaving' : '')} data-note-id={t.noteId} data-cb-index={t.checkboxIndex}>
            <span class="th-task-check" title={_t('task.complete')} onClick={onComplete}>✓</span>
            <span class="th-task-text" data-note-id={t.noteId} title={_t('task.open')} onClick={onOpen}>{t.displayText}</span>
            {t.repeat && (
                <span class="th-repeat-badge" title={_t('task.repeat')}><RepeatIcon />{repeatLabel(t.repeat)}</span>
            )}
            {t.fromProject && <span class="th-project-tag">{t.fromProject}</span>}
            {dateTag}
        </div>
    );
}

// 项目条目（进行中 / 暂停·等待响应 / 循环阶段）
function ProjectRow({ p, cycling, onHold, onOpen }) {
    return (
        <div class="th-project-row" data-note-id={p.noteId} title={_t('project.open')} onClick={onOpen}>
            <span class="th-project-name">{p.title}</span>
            {cycling && <span class="th-project-state">{_t('project.cycling')}</span>}
            {onHold && <span class="th-project-state onhold">{_t('project.onHold')}</span>}
            <PriorityBadge priority={p.priority} />
            <span class="th-group-count th-project-ratio">{p.done}/{p.total}</span>
        </div>
    );
}

// 打卡卡片（一周 7 日窗口）
// working: { dateStr } | null —— 当前正在切换的日期格子（禁用防重复）
// 每天多次打卡（#dk:N:M，dkPerDay > 1）时格子显示进度条：
//   点击 +1，满格（count >= dkPerDay）后再次点击清零
function DkCard({ t, today, weekKey, weekDaysArr, working, onOpen, onToggleDay }) {
    const cur = t.dkRecords.find(r => `${r.weekStart}~${r.weekEnd}` === weekKey);
    const dayCounts = cur ? cur.days : [];     // [{ dow, count, target }]
    const perDay = t.dkPerDay || 1;             // 每天目标次数
    // 总进度按天数算：当天次数打满（count >= perDay）才算 1 天
    const weekCount = cur ? cur.days.filter(x => x.count >= perDay).length : 0;
    const weekTarget = t.dkTarget || 0;         // 每周目标天数 dkDays
    const done = weekTarget > 0 && weekCount >= weekTarget;
    const curWeekNum = cur ? cur.weekNum : (t.dkRecords[0] ? t.dkRecords[0].weekNum + 1 : 1);
    // 只显示上一周（排除当前周），显示日期范围 + 进度
    const history = t.dkRecords
        .filter(r => `${r.weekStart}~${r.weekEnd}` !== weekKey)
        .slice(0, 1);

    return (
        <div class="th-dk-card" data-note-id={t.noteId} data-cb-index={t.checkboxIndex}>
            <div class="th-dk-head">
                <span class="th-dk-title" data-note-id={t.noteId} title={_t('task.open')} onClick={onOpen}>{t.displayText}</span>
                <span class="th-dk-week-label">{_t('dk.weekLabel', { n: curWeekNum })}</span>
                <span class={"th-dk-progress th-dk-progress-main" + (done ? ' done' : '')}>{_t('dk.progress', { a: weekCount, b: weekTarget })}</span>
            </div>
            <div class="th-dk-week">
                {weekDaysArr.map(d => {
                    const info = dayCounts.find(x => x.dow === d.dowCN);
                    const cnt = info ? info.count : 0;
                    const full = perDay > 0 && cnt >= perDay;
                    const isToday = d.dateStr === today;
                    const isWorking = working && working.dateStr === d.dateStr;
                    const pct = perDay > 0 ? Math.min(100, Math.round(cnt / perDay * 100)) : 0;
                    const cls = ['th-dk-day',
                        full ? 'done' : '',
                        cnt > 0 ? 'partial' : '',
                        isToday ? 'today' : '',
                        isWorking ? 'working' : ''
                    ].filter(Boolean).join(' ');
                    // 格子本身按进度涂色：从左往右填充 pct%，0 → 无色，50 → 半格，100 → 满格
                    // 颜色与 .th-dk-day.done 的 #E9F8E7 统一，保证两种打卡格子观感一致
                    const fillStyle = perDay > 1 ? {
                        backgroundImage: `linear-gradient(to right, #E9F8E7 0%, #E9F8E7 ${pct}%, transparent ${pct}%)`
                    } : null;
                    const extra = full ? _t('dk.extraFull') : _t('dk.extraClick');
                    return (
                        <div class={cls} data-dk-date={d.dateStr} style={fillStyle}
                             title={_t('dk.dayTitle', { date: d.dateStr, dow: d.dowCN, cnt, per: perDay, extra })}
                             onClick={() => onToggleDay(d.dateStr)}>
                            <span class="th-dk-dow">{_t('dow.' + d.dowCN)}</span>
                        </div>
                    );
                })}
            </div>
            {history.length > 0 && (
                <div class="th-dk-history">
                    {history.map(r => (
                        <div class="th-dk-hist-row">
                            <span class="th-dk-hist-week">{_t('dk.lastWeek')}</span>
                            <span class="th-dk-hist-range">{r.weekStart}~{r.weekEnd}</span>
                            <span class="th-dk-hist-progress">{_t('dk.progress', { a: r.count, b: r.target || weekTarget })}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// 毫秒 → MM:SS（间隔计时提醒显示用）
function fmtTxTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 间隔计时提醒阶段文本（可被 #tx 第 3/4 参数自定义）
function txPhaseLabel(phase, tx) {
    const wl = tx && tx.workLabel, rl = tx && tx.restLabel;
    if (phase === 'work') return wl || _t('tx.work');
    if (phase === 'rest') return rl || _t('tx.resting');
    if (phase === 'restWait') return rl ? _t('tx.restWaitCustom', { label: rl }) : _t('tx.restWait');
    return _t('tx.idle');
}

// 间隔计时提醒卡片（#tx:N:M）
// state: { phase: 'idle'|'work'|'restWait'|'rest', endTime, totalMs }（由 main.jsx 统一管理）
// now: 当前时间戳（main.jsx 每秒刷新，驱动倒计时）
function TxCard({ t, state, now, onStart, onRest, onReset, onOpen }) {
    const workMs = (t.tx.work || 1) * 60000;
    const restMs = (t.tx.rest || 5) * 60000;
    // 阶段文本（自定义时徽标去掉尾字「中」，meta 更简洁：久坐50分 · 站立远眺10分）
    const wl = (t.tx.workLabel || _t('tx.workShort')).replace(/中$/, '');
    const rl = t.tx.restLabel || _t('tx.restShort');
    const phase = state.phase;
    let remainMs, totalMs;
    if (phase === 'work') {
        totalMs = state.totalMs || workMs;
        remainMs = Math.max(0, (state.endTime || now) - now);
    } else if (phase === 'rest') {
        totalMs = state.totalMs || restMs;
        remainMs = Math.max(0, (state.endTime || now) - now);
    } else if (phase === 'restWait') {
        totalMs = restMs;
        remainMs = restMs;
    } else {
        totalMs = workMs;
        remainMs = workMs;
    }
    const pct = totalMs > 0 ? Math.min(100, Math.max(0, (1 - remainMs / totalMs) * 100)) : 0;
    return (
        <div class="th-tx-card" data-note-id={t.noteId} data-cb-index={t.checkboxIndex}>
            <div class="th-tx-head">
                <span class="th-tx-title" data-note-id={t.noteId} title={_t('task.open')} onClick={onOpen}>{t.displayText}</span>
                <span class={"th-tx-phase" + (phase !== 'idle' ? ' ' + phase : '')}>{txPhaseLabel(phase, t.tx)}</span>
            </div>
            <div class="th-tx-time">{fmtTxTime(remainMs)}</div>
            <div class="th-tx-bar"><div class="th-tx-bar-fill" style={`width:${pct}%`}></div></div>
            <div class="th-tx-btns">
                {phase === 'idle' && <button class="th-tx-btn primary" onClick={onStart}>{_t('tx.start')}</button>}
                {phase === 'work' && <button class="th-tx-btn" onClick={onReset}>{_t('tx.reset')}</button>}
                {phase === 'restWait' && <button class="th-tx-btn primary" onClick={onRest}>{_t('tx.startRest')}</button>}
                {phase === 'rest' && <button class="th-tx-btn" onClick={onReset}>{_t('tx.reset')}</button>}
                <span class="th-tx-meta">{_t('tx.meta', { work: wl, n: t.tx.work, rest: rl, m: t.tx.rest })}</span>
            </div>
        </div>
    );
}

// 面板主视图
// props:
//   groups        — groupLogic.classifyNotes 的返回值
//   today         — 本地日期 YYYY-MM-DD
//   weekKey       — 本周范围 key
//   weekDaysArr   — 本周 7 天 [{ dateStr, dowCN, dayNum }]
//   leavingKeys   — Set「noteId:cbIndex」正在淡出的任务行
//   workingKeys   — Map「noteId:cbIndex」→ 正在切换的日期格子
//   txStates      — 间隔计时提醒状态 Map「noteId:cbIndex」→ { phase, endTime, totalMs }
//   now           — 当前时间戳（驱动倒计时）
//   onOpenProject / onOpenTask / onCompleteTask / onToggleDkDay
//   onTxStart / onTxRest / onTxReset
export function PanelView(props) {
    const {
        groups, today, weekKey, weekDaysArr,
        leavingKeys, workingKeys, txStates, now,
        onOpenProject, onOpenTask, onCompleteTask, onToggleDkDay,
        onTxStart, onTxRest, onTxReset
    } = props;

    const hasDk = groups.dkTasks.length > 0;
    const hasTx = groups.txTasks.length > 0;
    const rowKey = t => `${t.noteId}:${t.checkboxIndex}`;

    // 任务分组（逾期与今日 / 进行中项目 / 暂停·等待响应项目 / 循环阶段项目 / 收集箱 / 计划任务）
    const taskSections = (
        <>
            {groups.group1.length > 0 && (
                <div class="th-group th-due" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.due')} count={groups.group1.length} />
                    <TaskList>
                        {groups.group1.map(t => (
                            <TaskRow key={rowKey(t)} t={t} isDueGroup={true} today={today}
                                     leaving={leavingKeys.has(rowKey(t))}
                                     onOpen={() => onOpenTask(t)} onComplete={() => onCompleteTask(t)} />
                        ))}
                    </TaskList>
                </div>
            )}
            {groups.projects.length > 0 && (
                <div class="th-group" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.projects')} count={groups.projects.length} />
                    <div>
                        {groups.projects.map(p => (
                            <ProjectRow key={p.noteId} p={p} onOpen={() => onOpenProject(p)} />
                        ))}
                    </div>
                </div>
            )}
            {groups.onHoldProjects.length > 0 && (
                <div class="th-group" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.onHold')} count={groups.onHoldProjects.length} />
                    <div>
                        {groups.onHoldProjects.map(p => (
                            <ProjectRow key={p.noteId} p={p} onHold={true} onOpen={() => onOpenProject(p)} />
                        ))}
                    </div>
                </div>
            )}
            {groups.cyclingProjects.length > 0 && (
                <div class="th-group" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.cycling')} count={groups.cyclingProjects.length} />
                    <div>
                        {groups.cyclingProjects.map(p => (
                            <ProjectRow key={p.noteId} p={p} cycling={true} onOpen={() => onOpenProject(p)} />
                        ))}
                    </div>
                </div>
            )}
            {groups.inboxTasks.length > 0 && (
                <div class="th-group" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.inbox')} count={groups.inboxTasks.length} />
                    <TaskList>
                        {groups.inboxTasks.map(t => (
                            <TaskRow key={rowKey(t)} t={t} today={today}
                                     onOpen={() => onOpenTask(t)} onComplete={() => onCompleteTask(t)} />
                        ))}
                    </TaskList>
                </div>
            )}
            {groups.futureTasks.length > 0 && (
                <div class="th-group" style="margin-bottom:20px;">
                    <GroupTitle title={_t('group.future')} count={groups.futureTasks.length} />
                    <TaskList>
                        {groups.futureTasks.map(t => (
                            <TaskRow key={rowKey(t)} t={t} today={today}
                                     onOpen={() => onOpenTask(t)} onComplete={() => onCompleteTask(t)} />
                        ))}
                    </TaskList>
                </div>
            )}
        </>
    );

    // 有打卡/间隔计时提醒任务 → 左右布局；否则只渲染任务分组
    if (hasDk || hasTx) {
        return (
            <div class="th-layout">
                <div class="th-left">
                    {hasDk && (
                        <div class="th-group" style="margin-bottom:20px;">
                            <GroupTitle title={_t('group.dk')} count={groups.dkTasks.length} />
                            {groups.dkTasks.map(t => {
                                const key = rowKey(t);
                                return (
                                    <DkCard key={key} t={t} today={today} weekKey={weekKey} weekDaysArr={weekDaysArr}
                                            working={workingKeys.get(key) || null}
                                            onOpen={() => onOpenTask(t)} onToggleDay={d => onToggleDkDay(t, d)} />
                                );
                            })}
                        </div>
                    )}
                    {hasTx && (
                        <div class="th-group" style="margin-bottom:20px;">
                            <GroupTitle title={_t('group.tx')} count={groups.txTasks.length} />
                            {groups.txTasks.map(t => {
                                const key = rowKey(t);
                                return (
                                    <TxCard key={key} t={t}
                                            state={txStates[key] || { phase: 'idle', endTime: null, totalMs: 0 }} now={now}
                                            onOpen={() => onOpenTask(t)}
                                            onStart={() => onTxStart(t)}
                                            onRest={() => onTxRest(t)}
                                            onReset={() => onTxReset(t)} />
                                );
                            })}
                        </div>
                    )}
                </div>
                <div class="th-divider"></div>
                <div class="th-right">{taskSections}</div>
            </div>
        );
    }
    return taskSections;
}

// ============================================================
//  设置弹窗（5 个 Tab + 各 Tab 底部帮助）
//  所有状态由 main.jsx 持有（draft / tab），本组件纯展示。
// ============================================================

// 开关行
function Toggle({ label, desc, checked, onChange }) {
    return (
        <div class="th-set-row">
            <div class="th-set-info">
                <span class="th-set-label">{label}</span>
                {desc && <span class="th-set-desc">{desc}</span>}
            </div>
            <input type="checkbox" class="th-switch" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        </div>
    );
}

// 标签列表输入（逗号/顿号分隔）
// 非受控显示：输入任何字符/中文/分隔符都不会被吞、光标不跳；
// 每次输入即时解析为数组同步草稿 → 保存时必然拿到最新值（不依赖失焦/回车时序）
function TagsInput({ value, onChange, placeholder }) {
    return (
        <input class="th-set-input"
               defaultValue={(value || []).join('，')}
               placeholder={placeholder}
               onChange={e => onChange(String(e.target.value).split(/[,，、]/).map(s => s.trim()).filter(Boolean))} />
    );
}

// 帮助区（各 Tab 底部）
function HelpBox({ items, t }) {
    if (!items || items.length === 0) return null;
    return (
        <div class="th-set-help">
            <div class="th-set-help-title">💡 {t('settings.helpTitle')}</div>
            {items.map(([code, desc]) => (
                <div class="th-help-row"><code>{code}</code><span>{desc}</span></div>
            ))}
        </div>
    );
}

// 基础设置：语言 / 是否启用 / 版本号 / GitHub 地址
function GeneralTab({ t, draft, onPatch, version, repo }) {
    const lang = draft.lang || 'zh';
    return (
        <div>
            <div class="th-set-row">
                <div class="th-set-info"><span class="th-set-label">{t('set.lang')}</span></div>
                <div class="th-set-radios">
                    <label class="th-set-radio">
                        <input type="radio" name="th-lang" checked={lang === 'zh'} onChange={() => onPatch('lang', 'zh')} />
                        {t('set.langZh')}
                    </label>
                    <label class="th-set-radio">
                        <input type="radio" name="th-lang" checked={lang === 'en'} onChange={() => onPatch('lang', 'en')} />
                        {t('set.langEn')}
                    </label>
                </div>
            </div>
            <Toggle label={t('set.enabled')} desc={t('set.enabledDesc')}
                    checked={draft.enabled} onChange={v => onPatch('enabled', v)} />
            <div class="th-set-row">
                <div class="th-set-info"><span class="th-set-label">{t('set.version')}</span></div>
                <span class="th-set-desc">{version}</span>
            </div>
            <div class="th-set-row">
                <div class="th-set-info"><span class="th-set-label">{t('set.repo')}</span></div>
                <a class="th-link" href={repo} target="_blank" rel="noopener noreferrer">{t('set.openRepo')} ↗</a>
            </div>
        </div>
    );
}

// 任务：开关 + 收集箱标题
function TasksTab({ t, draft, onPatch }) {
    return (
        <div>
            <Toggle label={t('set.fToday')} desc={t('set.fTodayDesc')}
                    checked={draft.features.today} onChange={v => onPatch('features.today', v)} />
            <Toggle label={t('set.fFuture')} desc={t('set.fFutureDesc')}
                    checked={draft.features.future} onChange={v => onPatch('features.future', v)} />
            <Toggle label={t('set.fInbox')} desc={t('set.fInboxDesc')}
                    checked={draft.features.inbox} onChange={v => onPatch('features.inbox', v)} />
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.inboxTitles')}</span>
                    <span class="th-set-desc">{t('set.inboxTitlesDesc')}</span>
                </div>
                <TagsInput value={draft.inbox.titles} placeholder="inbox, 收集箱"
                           onChange={v => onPatch('inbox.titles', v)} />
            </div>
            <HelpBox items={t('help.tasks')} t={t} />
        </div>
    );
}

// 项目：3 个开关 + 上级目录
function ProjectsTab({ t, draft, onPatch }) {
    return (
        <div>
            <Toggle label={t('set.fProjects')} desc={t('set.fProjectsDesc')}
                    checked={draft.features.projects} onChange={v => onPatch('features.projects', v)} />
            <Toggle label={t('set.fOnHold')} desc={t('set.fOnHoldDesc')}
                    checked={draft.features.onHold} onChange={v => onPatch('features.onHold', v)} />
            <Toggle label={t('set.fCycling')} desc={t('set.fCyclingDesc')}
                    checked={draft.features.cycling} onChange={v => onPatch('features.cycling', v)} />
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.projectRoot')}</span>
                    <span class="th-set-desc">{t('set.projectRootDesc')}</span>
                </div>
                <TagsInput value={draft.projectRoot.titles} placeholder={t('set.projectRootPlaceholder')}
                           onChange={v => onPatch('projectRoot.titles', v)} />
            </div>
            <HelpBox items={t('help.projects')} t={t} />
        </div>
    );
}

// 打卡：开关 + 标签别名
function DkTab({ t, draft, onPatch }) {
    return (
        <div>
            <Toggle label={t('set.fDk')} desc={t('set.fDkDesc')}
                    checked={draft.features.dk} onChange={v => onPatch('features.dk', v)} />
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.dkTags')}</span>
                    <span class="th-set-desc">{t('set.dkTagsDesc')}</span>
                </div>
                <TagsInput value={draft.dk.tags} placeholder="dk, checkin, habit"
                           onChange={v => onPatch('dk.tags', v)} />
            </div>
            <HelpBox items={t('help.dk')} t={t} />
        </div>
    );
}

// 提醒：开关 + 标签别名 + 默认休息分钟
function TxTab({ t, draft, onPatch }) {
    return (
        <div>
            <Toggle label={t('set.fTx')} desc={t('set.fTxDesc')}
                    checked={draft.features.tx} onChange={v => onPatch('features.tx', v)} />
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.txTags')}</span>
                    <span class="th-set-desc">{t('set.txTagsDesc')}</span>
                </div>
                <TagsInput value={draft.tx.tags} placeholder="tx, timer, pomodoro"
                           onChange={v => onPatch('tx.tags', v)} />
            </div>
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.txRest')}</span>
                    <span class="th-set-desc">{t('set.txRestDesc')}</span>
                </div>
                <input type="number" min="1" max="120" class="th-set-input th-set-num"
                       value={draft.tx.defaultRest}
                       onChange={e => onPatch('tx.defaultRest', Math.max(1, parseInt(e.target.value, 10) || 5))} />
            </div>
            <div class="th-set-row">
                <div class="th-set-info">
                    <span class="th-set-label">{t('set.txNotify')}</span>
                    <span class="th-set-desc">{t('set.txNotifyDesc')}</span>
                </div>
                <div class="th-set-checks">
                    {[
                        { key: 'message', label: t('set.txNotifyMessage') },
                        { key: 'fullscreen', label: t('set.txNotifyFullscreen') },
                        { key: 'sound', label: t('set.txNotifySound') }
                    ].map(m => (
                        <label class="th-set-check" key={m.key}>
                            <input type="checkbox"
                                   checked={(draft.tx.notifyMethods || ['message', 'sound']).indexOf(m.key) >= 0}
                                   onChange={e => {
                                       const cur = draft.tx.notifyMethods || ['message', 'sound'];
                                       const next = e.target.checked
                                           ? (cur.indexOf(m.key) < 0 ? cur.concat([m.key]) : cur)
                                           : cur.filter(k => k !== m.key);
                                       onPatch('tx.notifyMethods', next);
                                   }} />
                            {m.label}
                        </label>
                    ))}
                </div>
            </div>
            <HelpBox items={t('help.tx')} t={t} />
        </div>
    );
}

// 设置弹窗
// props:
//   t       — 翻译函数（main 用草稿语言创建，切语言即时预览）
//   draft   — 配置草稿（编辑中副本）
//   tab     — 当前 Tab key（state 由 main 持有）
//   onTab   — 切换 Tab
//   onPatch — (path, value) 更新草稿字段，path 用点号路径
//   onSave / onClose / onReset
//   version / repo — 基础设置页展示
export function SettingsModal({ t, draft, tab, onTab, onPatch, onSave, onClose, onReset, version, repo, error }) {
    const TABS = [
        { key: 'general', label: t('tab.general') },
        { key: 'tasks', label: t('tab.tasks') },
        { key: 'projects', label: t('tab.projects') },
        { key: 'dk', label: t('tab.dk') },
        { key: 'tx', label: t('tab.tx') }
    ];
    return (
        <div class="th-modal-mask" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div class="th-modal">
                <div class="th-modal-header">
                    <span class="th-modal-title">⚙️ {t('settings.title')}</span>
                    <button class="th-modal-close" title={t('settings.cancel')} onClick={onClose}>✕</button>
                </div>
                <div class="th-modal-tabs">
                    {TABS.map(tb => (
                        <div class={"th-modal-tab" + (tab === tb.key ? ' active' : '')} onClick={() => onTab(tb.key)}>{tb.label}</div>
                    ))}
                </div>
                <div class="th-modal-body">
                    {error && (
                        <div style="color:#e64553;background:rgba(230,69,83,.1);padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:12px;white-space:pre-wrap;">{error}</div>
                    )}
                    {tab === 'general' && <GeneralTab t={t} draft={draft} onPatch={onPatch} version={version} repo={repo} />}
                    {tab === 'tasks' && <TasksTab t={t} draft={draft} onPatch={onPatch} />}
                    {tab === 'projects' && <ProjectsTab t={t} draft={draft} onPatch={onPatch} />}
                    {tab === 'dk' && <DkTab t={t} draft={draft} onPatch={onPatch} />}
                    {tab === 'tx' && <TxTab t={t} draft={draft} onPatch={onPatch} />}
                </div>
                <div class="th-modal-footer">
                    <button class="th-btn danger" onClick={onReset}>{t('settings.reset')}</button>
                    <span style="flex:1"></span>
                    <button class="th-btn" onClick={onClose}>{t('settings.cancel')}</button>
                    <button class="th-btn primary" onClick={onSave}>{t('settings.save')}</button>
                </div>
            </div>
        </div>
    );
}
