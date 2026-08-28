// ============================================================
//  groupLogic — 任务分组归类 + 排序（纯函数，无依赖）
//  输入: 已解析的笔记数组（含 tasks/done/total）
//  输出: 各分组列表，供 panelView 渲染
//  作为 render bundle 的子模块，入口用标题「groupLogic」引用：
//      const { classifyNotes, normState } = groupLogic;
// ============================================================

// 状态规范化：小写、去空白与标点（如 "In Progress" -> "inprogress"）
export function normState(s) {
    return String(s || '').toLowerCase().replace(/[\s\p{Pd}_]+/gu, '');
}

// 优先级排序权重：P1 > P2 > P3 > 无
export function priorityRank(v) {
    const m = String(v || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 99;
}

// 项目排序：优先级升序，同优先级按标题
export function byPriority(a, b) {
    return priorityRank(a.priority) - priorityRank(b.priority)
        || a.title.localeCompare(b.title, 'zh');
}

// 任务排序：按日期升序，无日期排最后
export function byDate(a, b) {
    return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99');
}

// 固定排序优先级权重：#priority:N（1~10，越小越靠前），null/越界一律视为 99（排最后）
export function priorityRankN(v) {
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    return (n >= 1 && n <= 10) ? n : 99;
}

// 任务/打卡/提醒统一排序：先按日期升序（无日期排最后），
// 同日期再按固定优先级 #priority:N 升序（1 最前，无优先级排最后）；
// JS sort 稳定 → 其余保持原顺序
export function byTaskOrder(a, b) {
    return byDate(a, b)
        || priorityRankN(a.priority) - priorityRankN(b.priority);
}

// 对已解析的笔记列表做分组归类
// notes: [{ noteId, title, state, priority, isInbox, tasks, done, total }]
// today: 本地日期 YYYY-MM-DD
// features: 功能开关（缺省全部开启）
//   { today, projects, onHold, cycling, future, dk, tx, inbox }
//   - 关闭某功能 = 对应分组不产生内容；dk/tx 任务在关闭时也不会进入其他组
//   - 关闭 inbox 时，收集箱任务按日期回落到普通分组
// 返回: {
//   projects, onHoldProjects, cyclingProjects,  // 进行中 / 暂停·等待响应 / 循环阶段项目
//   group1,                           // 逾期与今日（合并排序）
//   overdue, todayTasks,
//   inboxTasks, futureTasks,
//   dkTasks,                          // 打卡任务
//   txTasks,                          // 间隔计时提醒任务
//   empty                             // 是否无任何内容
// }
export function classifyNotes(notes, today, features) {
    const f = Object.assign({
        today: true, projects: true, onHold: true, cycling: true,
        future: true, dk: true, tx: true, inbox: true
    }, features || {});

    const projects = [];
    const onHoldProjects = [];
    const cyclingProjects = [];
    const overdue = [];
    const todayTasks = [];
    const inboxTasks = [];
    const futureTasks = [];
    const dkTasks = [];
    const txTasks = [];

    // 按日期归组（受 today/future 开关控制）
    const pushByDate = (item) => {
        if (item.date && item.date < today) {
            if (f.today) overdue.push(item);
        } else if (item.date && item.date === today) {
            if (f.today) todayTasks.push(item);
        } else if (item.date && item.date > today) {
            if (f.future) futureTasks.push(item);
        }
    };

    for (const note of notes) {
        const tasks = note.tasks || [];
        const stateNorm = normState(note.state);
        // 项目判定以后端 isProject 为准（受项目文件夹配置约束）；旧缓存无此字段时按 state 兜底
        const isProj = note.isProject !== false && (stateNorm === 'inprogress' || stateNorm === 'cyclingphase' || stateNorm === 'onhold');

        if (isProj) {
            const p = {
                noteId: note.noteId,
                title: note.title,
                done: note.done,
                total: note.total,
                cycling: stateNorm === 'cyclingphase',
                onHold: stateNorm === 'onhold',
                priority: note.priority || ''
            };
            if (p.cycling) { if (f.cycling) cyclingProjects.push(p); }
            else if (p.onHold) { if (f.onHold) onHoldProjects.push(p); }
            else { if (f.projects) projects.push(p); }

            // 暂停项目内部任务也纳入全局视图：项目可能正在等待某个任务完成，
            // 该任务的截止日期/重复/打卡提醒仍需显示，直到任务完成才解除暂停
            // 项目内带日期的任务也纳入全局视图
            for (const t of tasks) {
                const item = Object.assign({}, t, {
                    noteId: note.noteId,
                    fromProject: note.title
                });
                if (t.dkTarget || t.tx) {
                    if (f.dk && t.dkTarget) dkTasks.push(item);
                    if (f.tx && t.tx) txTasks.push(item);
                    continue;
                }
                pushByDate(item);
            }
            continue;
        }

        for (const t of tasks) {
            const item = Object.assign({}, t, { noteId: note.noteId });
            if (t.dkTarget || t.tx) {
                if (f.dk && t.dkTarget) dkTasks.push(item);
                if (f.tx && t.tx) txTasks.push(item);
                continue;
            }
            if (note.isInbox && f.inbox) inboxTasks.push(item);
            else pushByDate(item);
        }
    }

    projects.sort(byPriority);
    onHoldProjects.sort(byPriority);
    cyclingProjects.sort(byPriority);
    // 任务/打卡/提醒统一排序：日期优先，同日期按固定优先级 #priority:N（1~10，越小越靠前）
    overdue.sort(byTaskOrder);
    todayTasks.sort(byTaskOrder);
    futureTasks.sort(byTaskOrder);
    inboxTasks.sort(byTaskOrder);
    dkTasks.sort(byTaskOrder);
    txTasks.sort(byTaskOrder);

    const group1 = overdue.concat(todayTasks);
    const totalTasks = group1.length + inboxTasks.length + futureTasks.length + dkTasks.length + txTasks.length;
    const empty = totalTasks === 0 && projects.length === 0 && onHoldProjects.length === 0 && cyclingProjects.length === 0;

    return {
        projects,
        onHoldProjects,
        cyclingProjects,
        overdue,
        todayTasks,
        inboxTasks,
        futureTasks,
        dkTasks,
        txTasks,
        group1,
        empty
    };
}
