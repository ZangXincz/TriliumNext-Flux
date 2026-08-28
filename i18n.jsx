// ============================================================
//  i18n — 中英文案字典 + 翻译函数（纯模块，无依赖）
//  作为 render bundle 的子模块，入口用标题「i18n」引用：
//      const { createI18n } = i18n;
//  用法: const t = createI18n(config.lang); t('group.due');
//        t('dk.weekLabel', { n: 3 })   // {n} 占位符替换
//  值可为字符串 / 数组（数组原样返回，用于帮助条目列表）。
//  注意：子模块里避免使用 ?? 空值合并（Trilium 编译时不注入
//        _nullishCoalesce helper，会导致加载失败），用 || 替代。
// ============================================================

const ZH = {
    // ── 面板通用 ──
    'app.loading': '⏳ 正在加载任务…',
    'app.empty': '✓ 没有未完成的任务。',
    'app.loadError': '✗ 加载任务失败',
    'app.disabled': 'TriliumNext Flux 已停用，可在设置中重新启用。',
    'settings.open': '打开设置',
    'settings.gear': '设置',

    // ── 分组标题 ──
    'group.due': '逾期与今日',
    'group.projects': '进行中的项目',
    'group.onHold': '暂停 / 等待响应',
    'group.cycling': '循环阶段项目',
    'group.inbox': '收集箱',
    'group.future': '计划任务',
    'group.dk': '打卡',
    'group.tx': '间隔计时提醒',

    // ── 任务行 ──
    'task.complete': '标记为已完成',
    'task.open': '打开笔记',
    'task.today': '今日',
    'task.overdue': '逾期',
    'task.repeat': '重复任务',

    // ── 项目 ──
    'project.open': '打开项目',
    'project.cycling': '打卡中',
    'project.onHold': '暂停中',

    // ── 重复节奏 ──
    'repeat.d': '每天', 'repeat.dn': '每{n}天',
    'repeat.w': '每周', 'repeat.wn': '每{n}周',
    'repeat.m': '每月', 'repeat.mn': '每{n}月',
    'repeat.y': '每年', 'repeat.yn': '每{n}年',
    'repeat.start': '每月初',
    'repeat.end': '每月底',
    'repeat.endwork': '每月末工作日',
    'repeat.actual': '（按实际）',

    // ── 打卡 ──
    'dow.周日': '日', 'dow.周一': '一', 'dow.周二': '二', 'dow.周三': '三',
    'dow.周四': '四', 'dow.周五': '五', 'dow.周六': '六',
    'dk.weekLabel': '第{n}周',
    'dk.progress': '进度{a}/{b}',
    'dk.lastWeek': '上一周',
    'dk.clickCheckin': '点击打卡',
    'dk.fullClear': '已满（点击清零）',
    'dk.dayTitle': '{date} · {dow} · {cnt}/{per}{extra}',
    'dk.extraFull': ' · 已满（点击清零）',
    'dk.extraClick': ' · 点击打卡',

    // ── 间隔计时提醒 ──
    'tx.idle': '待开始',
    'tx.work': '进行中',
    'tx.workShort': '进行',
    'tx.resting': '休息中',
    'tx.restShort': '休息',
    'tx.restWait': '待休息',
    'tx.restWaitCustom': '待{label}',
    'tx.start': '开始',
    'tx.startRest': '开始休息',
    'tx.reset': '重置',
    'tx.meta': '{work}{n}分 · {rest}{m}分',
    'tx.notifyWork': '⏰ 时间到，休息一下吧',
    'tx.notifyRest': '☕ 休息结束，可以重新开始',
    'tx.notifyWorkLabel': '⏰ 时间到，{label}吧',
    'tx.notifyWorkRestMin': '⏰ 时间到，休息 {n} 分钟',
    'tx.dismiss': '知道了',

    // ── 标签快速插入（# 快速输入）──
    'tqi.nav': '选择',
    'tqi.insert': '插入',
    'tqi.close': '关闭',
    'tqi.empty': '无匹配词条',

    // ── 设置弹窗 ──
    'settings.title': '设置',
    'settings.save': '保存',
    'settings.cancel': '取消',
    'settings.reset': '恢复默认',
    'settings.resetConfirm': '确定恢复所有设置为默认值？',
    'settings.helpTitle': '使用指南（#标记）',
    'settings.saveOk': '设置已保存',
    'settings.noConfigNote': '未找到配置笔记。请在宿主笔记上添加关系 configNote 指向一份 JSON/代码 配置笔记。',
    'settings.wrongType': '配置笔记是 {type} 类型，必须是 json 或 code 类型才能保存配置。请在宿主笔记上添加 ~configNote 关系，指向一个 json/code 类型的配置笔记。',

    'tab.general': '基础设置',
    'tab.tasks': '任务',
    'tab.projects': '项目',
    'tab.dk': '打卡',
    'tab.tx': '提醒',

    // 基础设置
    'set.lang': '语言',
    'set.langZh': '中文',
    'set.langEn': 'English',
    'set.enabled': '是否启用',
    'set.enabledDesc': '关闭后面板停止展示任务',
    'set.fTqi': '# 快速录入',
    'set.fTqiDesc': '输入 # 时弹出日期、重复、习惯、计时候选',
    'set.version': '版本',
    'set.repo': 'GitHub 仓库',
    'set.openRepo': '打开',

    // 任务
    'set.fToday': '逾期与今日',
    'set.fTodayDesc': '今天到期与已逾期的任务',
    'set.fFuture': '计划任务',
    'set.fFutureDesc': '未来日期的任务',
    'set.fInbox': '收集箱',
    'set.fInboxDesc': '收集箱里的任务单独成组展示',
    'set.inboxTitles': '收集箱标题',
    'set.inboxTitlesDesc': '逗号分隔。root 下标题匹配的笔记及其子树都算收集箱',

    // 项目
    'set.fProjects': '进行中的项目',
    'set.fProjectsDesc': 'state=In-Progress 的项目',
    'set.fOnHold': '暂停 / 等待响应',
    'set.fOnHoldDesc': 'state=On-Hold 的项目',
    'set.fCycling': '循环阶段项目',
    'set.fCyclingDesc': 'state=Cycling-Phase 的项目',
    'set.projectRoot': '项目上级目录',
    'set.projectRootDesc': '逗号分隔。面板只扫描这些目录下的内容，留空则扫描全部笔记',
    'set.projectRootPlaceholder': '留空 = 全局获取，例如 Projects',

    // 打卡（标签固定 #habit）
    'set.fDk': '打卡功能',
    'set.fDkDesc': '显示打卡卡片（#habit 标签）',

    // 提醒（标签固定 #timer）
    'set.fTx': '提醒功能',
    'set.fTxDesc': '显示间隔计时提醒卡片（#timer 标签）',
    'set.txRest': '默认休息分钟',
    'set.txRestDesc': '#timer:N 未写休息分钟时的缺省值',
    'set.txNotify': '提醒方式',
    'set.txNotifyDesc': '到点时通过勾选的方式提醒你',
    'set.txNotifyMessage': '弹窗提示',
    'set.txNotifyFullscreen': '全屏提醒',
    'set.txNotifySound': '声音',

    // ── 帮助（各 Tab 底部） ──
    'help.general': [
        ['Render 笔记', '将本 bundle 设为 Render 类型，挂在任意笔记上即可使用。'],
        ['~configNote', '配置笔记（JSON/代码 类型），在宿主笔记上加关系 configNote 指向它。'],
        ['没有配置笔记', '插件使用默认配置运行，首次保存设置前请先创建配置笔记并添加关系。']
    ],
    'help.tasks': [
        ['#2026-08-27', '指定日期：今天到期显示在「今日」，未来显示在「计划任务」。'],
        ['#repeat:1w', '每周重复（1d/1w/1m/1y）。必须同时标注 #日期 作为起点，完成时自动按周期推进并记录历史。'],
        ['#repeat:1m:start', '每月初重复；:end 每月底；:endwork 每月末工作日（位置型可省略 #日期）。'],
        ['#repeat:1d:actual', '按实际完成日期推进——断更后再完成，下次计划从实际完成那天起算，不补齐错过的日期。']
    ],
    'help.projects': [
        ['state=In-Progress', '项目显示在「进行中的项目」。'],
        ['state=On-Hold', '项目显示在「暂停 / 等待响应」。'],
        ['state=Cycling-Phase', '项目显示在「循环阶段项目」。'],
        ['#priority=P1', '项目排序优先级（P1 最高，P2、P3 依次）。']
    ],
    'help.dk': [
        ['#habit:5', '每周目标 5 天，每天最多 1 次。'],
        ['#habit:4:2', '每周目标 4 天，每天最多 2 次；当天全部打满才算 1 天，总进度按天数计。'],
        ['点击格子', '打卡记录自动写入任务下方子列表。']
    ],
    'help.tx': [
        ['#timer:50:10', '进行 50 分钟，休息 10 分钟。'],
        ['#timer:25:5:专注:放松', '自定义阶段名称（可选）。'],
        ['到点提醒', '按下方勾选的方式提醒（弹窗 / 全屏 / 声音）；刷新页面后计时状态自动恢复。']
    ]
};

const EN = {
    'app.loading': '⏳ Loading tasks…',
    'app.empty': '✓ No pending tasks.',
    'app.loadError': '✗ Failed to load tasks',
    'app.disabled': 'TriliumNext Flux is disabled. Re-enable it in Settings.',
    'settings.open': 'Open Settings',
    'settings.gear': 'Settings',

    'group.due': 'Overdue & Today',
    'group.projects': 'In-Progress Projects',
    'group.onHold': 'On Hold',
    'group.cycling': 'Cycling Projects',
    'group.inbox': 'Inbox',
    'group.future': 'Future Tasks',
    'group.dk': 'Check-in',
    'group.tx': 'Timers',

    'task.complete': 'Mark as done',
    'task.open': 'Open note',
    'task.today': 'Today',
    'task.overdue': 'Overdue',
    'task.repeat': 'Recurring',

    'project.open': 'Open project',
    'project.cycling': 'Cycling',
    'project.onHold': 'On hold',

    'repeat.d': 'Every day', 'repeat.dn': 'Every {n} days',
    'repeat.w': 'Every week', 'repeat.wn': 'Every {n} weeks',
    'repeat.m': 'Every month', 'repeat.mn': 'Every {n} months',
    'repeat.y': 'Every year', 'repeat.yn': 'Every {n} years',
    'repeat.start': 'Monthly (1st)',
    'repeat.end': 'Monthly (last day)',
    'repeat.endwork': 'Monthly (last workday)',
    'repeat.actual': ' (by actual)',

    'dow.周日': 'Sun', 'dow.周一': 'Mon', 'dow.周二': 'Tue', 'dow.周三': 'Wed',
    'dow.周四': 'Thu', 'dow.周五': 'Fri', 'dow.周六': 'Sat',
    'dk.weekLabel': 'Week {n}',
    'dk.progress': '{a}/{b}',
    'dk.lastWeek': 'Last week',
    'dk.clickCheckin': 'Click to check in',
    'dk.fullClear': 'Full (click to reset)',
    'dk.dayTitle': '{date} · {dow} · {cnt}/{per}{extra}',
    'dk.extraFull': ' · Full (click to reset)',
    'dk.extraClick': ' · Click to check in',

    'tx.idle': 'Ready',
    'tx.work': 'Working',
    'tx.workShort': 'Work',
    'tx.resting': 'Resting',
    'tx.restShort': 'Rest',
    'tx.restWait': 'Rest ready',
    'tx.restWaitCustom': '{label} ready',
    'tx.start': 'Start',
    'tx.startRest': 'Start rest',
    'tx.reset': 'Reset',
    'tx.meta': '{work} {n}min · {rest} {m}min',
    'tx.notifyWork': '⏰ Time is up, take a rest',
    'tx.notifyRest': '☕ Break is over, you can start again',
    'tx.notifyWorkLabel': '⏰ Time is up, {label} now',
    'tx.notifyWorkRestMin': '⏰ Time is up, rest {n} min',
    'tx.dismiss': 'Got it',

    'tqi.nav': 'select',
    'tqi.insert': 'insert',
    'tqi.close': 'close',
    'tqi.empty': 'No matching item',

    'settings.title': 'Settings',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.reset': 'Reset to default',
    'settings.resetConfirm': 'Reset all settings to defaults?',
    'settings.helpTitle': 'Usage Guide (#tags)',
    'settings.saveOk': 'Settings saved',
    'settings.noConfigNote': 'Config note not found. Add a "configNote" relation on the host note pointing to a JSON/code config note.',
    'settings.wrongType': 'Config note is of type {type}; it must be json or code to save settings. Add a ~configNote relation on the host note pointing to a json/code config note.',

    'tab.general': 'General',
    'tab.tasks': 'Tasks',
    'tab.projects': 'Projects',
    'tab.dk': 'Check-in',
    'tab.tx': 'Timer',

    'set.lang': 'Language',
    'set.langZh': '中文',
    'set.langEn': 'English',
    'set.enabled': 'Enable plugin',
    'set.enabledDesc': 'Hide the panel when disabled',
    'set.fTqi': 'Quick insert',
    'set.fTqiDesc': 'Show date/repeat/habit/timer candidates while typing #',
    'set.version': 'Version',
    'set.repo': 'GitHub repository',
    'set.openRepo': 'Open',

    'set.fToday': 'Overdue & Today',
    'set.fTodayDesc': 'Tasks due today or overdue',
    'set.fFuture': 'Future tasks',
    'set.fFutureDesc': 'Tasks with future dates',
    'set.fInbox': 'Inbox',
    'set.fInboxDesc': 'Group inbox tasks separately',
    'set.inboxTitles': 'Inbox titles',
    'set.inboxTitlesDesc': 'Comma-separated. Root notes with these titles (and their subtrees) count as inbox',

    'set.fProjects': 'In-progress projects',
    'set.fProjectsDesc': 'Projects with state=In-Progress',
    'set.fOnHold': 'On hold',
    'set.fOnHoldDesc': 'Projects with state=On-Hold',
    'set.fCycling': 'Cycling projects',
    'set.fCyclingDesc': 'Projects with state=Cycling-Phase',
    'set.projectRoot': 'Project root',
    'set.projectRootDesc': 'Comma-separated. Panel only scans these folders; empty = scan all notes',
    'set.projectRootPlaceholder': 'Empty = all notes, e.g. Projects',

    'set.fDk': 'Check-in',
    'set.fDkDesc': 'Show check-in cards (#habit tag)',

    'set.fTx': 'Timer',
    'set.fTxDesc': 'Show interval timer cards (#timer tag)',
    'set.txRest': 'Default rest minutes',
    'set.txRestDesc': 'Used when #timer has no rest value',
    'set.txNotify': 'Notify methods',
    'set.txNotifyDesc': 'How you are notified when a timer ends',
    'set.txNotifyMessage': 'Toast message',
    'set.txNotifyFullscreen': 'Fullscreen alert',
    'set.txNotifySound': 'Sound',

    'help.general': [
        ['Render note', 'Make this bundle a Render-type note and place it anywhere.'],
        ['~configNote', 'A JSON/code config note, linked by a "configNote" relation on the host note.'],
        ['No config note', 'Defaults are used. Add a configNote relation before saving settings for the first time.']
    ],
    'help.tasks': [
        ['#2026-08-27', 'Due date: due today goes to "Today", future dates to "Future Tasks".'],
        ['#repeat:1w', 'Repeat weekly (1d/1w/1m/1y). Always pair with a #date as the starting point; advances and logs history on completion.'],
        ['#repeat:1m:start', 'Repeat on the 1st; :end last day; :endwork last workday of month (no #date needed).'],
        ['#repeat:1d:actual', 'Advance from the actual completion date - after a gap, the next plan starts from the day you actually completed it.']
    ],
    'help.projects': [
        ['state=In-Progress', 'Shown under "In-Progress Projects".'],
        ['state=On-Hold', 'Shown under "On Hold".'],
        ['state=Cycling-Phase', 'Shown under "Cycling Projects".'],
        ['#priority=P1', 'Project sort priority (P1 highest, then P2, P3).']
    ],
    'help.dk': [
        ['#habit:5', 'Target 5 days per week, max 1 per day.'],
        ['#habit:4:2', 'Target 4 days per week, max 2 per day. A day only counts when fully checked in; progress is counted in days.'],
        ['Click a day', 'Check-in records are written below the task automatically.']
    ],
    'help.tx': [
        ['#timer:50:10', 'Work 50 min, rest 10 min.'],
        ['#timer:25:5:focus:break', 'Custom phase labels (optional).'],
        ['Reminder', 'Notified via the methods checked below (toast / fullscreen / sound); timer state survives refresh.']
    ]
};

// 创建翻译函数：t(key, vars)
// vars 中的 {name} 占位符会被替换为传入的值（字符串替换，非正则）
export function createI18n(lang) {
    const table = (lang === 'en' || lang === 'English') ? EN : ZH;
    return function t(key, vars) {
        let v = table[key] !== undefined ? table[key] : ZH[key];
        if (v === undefined) return key;
        if (typeof v !== 'string') return v;   // 数组/数字原样返回
        if (vars) {
            for (const k of Object.keys(vars)) {
                v = v.split('{' + k + '}').join(String(vars[k]));
            }
        }
        return v;
    };
}
