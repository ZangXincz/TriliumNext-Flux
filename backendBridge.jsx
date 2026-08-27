// ============================================================
//  backendBridge — 前后端桥接（唯一允许访问后端 api 的模块）
//  所有 runOnBackend 函数体必须完全自包含（不能引用模块闭包变量，
//  数据一律通过参数传入；runOnBackend 会把函数体发送到后端执行）。
//  注意：findTaskLiRange 在每个使用它的回调体内各有一份副本
//  （completeTask / stampRepeatDate / toggleDkDay），修改时必须三处同步。
//  注意：子模块里避免使用 ?? 空值合并（Trilium 编译时不注入
//        _nullishCoalesce helper，会导致加载失败），用 || 替代。
//  作为 render bundle 的子模块，入口用标题「backendBridge」引用：
//      const { loadData, completeTask, toggleDkDay, stampRepeatDate,
//              saveTxState, loadTxState, loadJsonConfig, saveJsonConfig } = backendBridge;
// ============================================================

import { runOnBackend } from "trilium:api";

// ── 配置笔记定位（官方推荐方案：宿主笔记上添加 ~configNote 关系指向配置笔记）──
// 仅通过 ~configNote 关系定位；没有该关系的宿主使用内置默认配置。
// 前端 FNote.getOwnedAttributes() 不支持 (type, name) 参数过滤，且前端走内存缓存，
// 刷新后可能读到旧数据；因此读取也走 runOnBackend：与 saveJsonConfig 共用同一套
// 后端定位逻辑，直接读数据库，保证保存后 F5 刷新必然读到最新配置。

// 读取配置（后端实现；返回 null 表示没有配置笔记或内容非合法 JSON）
export async function loadJsonConfig(hostNoteId) {
    return runOnBackend((hostNoteId) => {
        function findConfigNoteBackend(host) {
            try {
                const rel = host.getOwnedAttributes('relation', 'configNote')[0];
                if (rel && rel.value) {
                    const n = api.getNote(rel.value);
                    if (n) return n;
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        try {
            const host = api.getNote(hostNoteId);
            if (!host) return null;
            const cfgNote = findConfigNoteBackend(host);
            if (!cfgNote) return null;
            // 用 getContent + JSON.parse（不依赖后端 getJsonContent 是否可用）
            try {
                const raw = cfgNote.getContent() || '';
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                // txState 是运行时计时数据，不混入配置对象（避免污染设置草稿/被设置保存覆盖）
                delete parsed.txState;
                return parsed;
            } catch (e) {
                return null; // 内容为空 / 非合法 JSON 视为未配置
            }
        } catch (e) {
            return null;
        }
    }, [hostNoteId]);
}

// 保存配置（合并写入配置笔记内容 + save）
// 只更新 patch 中出现的字段，保留用户手动添加的其他字段
export async function saveJsonConfig(hostNoteId, patch) {
    return runOnBackend((hostNoteId, patch) => {
        function findConfigNoteBackend(host) {
            try {
                const rel = host.getOwnedAttributes('relation', 'configNote')[0];
                if (rel && rel.value) {
                    const n = api.getNote(rel.value);
                    if (n) return n;
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        // 深度合并：遍历新旧 key 的并集——
        //  旧有、新无 → 保留旧值（用户手动加的字段不丢）
        //  新有、旧无 → 直接采用新值（新字段必须写入，旧实现只遍历 base 导致空配置永远写不进）
        //  都有且都是普通对象 → 递归合并；否则新值覆盖
        function mergeJson(base, extra) {
            if (!base || typeof base !== 'object' || Array.isArray(base)) return extra;
            if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra;
            const out = {};
            const keys = new Set(Object.keys(base).concat(Object.keys(extra)));
            for (const k of keys) {
                const b = base[k], e = extra[k];
                if (e === undefined) out[k] = b;
                else if (b && typeof b === 'object' && !Array.isArray(b) && e && typeof e === 'object' && !Array.isArray(e)) {
                    out[k] = mergeJson(b, e);
                } else {
                    out[k] = e;
                }
            }
            return out;
        }
        try {
            const host = api.getNote(hostNoteId);
            const cfgNote = findConfigNoteBackend(host);
            if (!cfgNote) return { ok: false, config: null };
            // 用 getContent + JSON.parse 读取：内容为空 / 非法 JSON 时不抛错，视为空配置
            let old = {};
            try {
                old = JSON.parse(cfgNote.getContent() || 'null') || {};
            } catch (e) {
                old = {};
            }
            const merged = mergeJson(old, patch);
            cfgNote.setJsonContent(merged);
            cfgNote.save();
            // 返回给前端的 config 不携带 txState（运行时数据，避免写入设置草稿后被旧值覆盖）
            const out = Object.assign({}, merged);
            delete out.txState;
            return { ok: true, config: out, noteType: cfgNote.type };
        } catch (e) {
            return { ok: false, config: null, error: String(e && e.message || e) };
        }
    }, [hostNoteId, patch]);
}

// ── 查询任务数据（text 内容 + 项目），支持配置的数据范围 ──
// cfg: { inboxTitles: [..], projectRootTitles: [..] }
// features: 功能开关。关闭的功能在数据层直接跳过，降低 getContent 与解析开销：
//   - onHold=false：暂停项目内容只用于卡片进度、任务不进全局视图 → 直接跳过（不读内容、不返回）
//   其余开关对应模块的任务仍参与全局分组，无法跳过内容读取，仅做 UI 裁剪
// 收集箱：root 下标题匹配 inboxTitles 的笔记及其子树（任务单独成组）
// 项目根：root 下标题匹配 projectRootTitles 的目录；非空时只扫描这些目录 + 收集箱
export async function loadData(cfg, features) {
    return runOnBackend((cfg, features) => {

        const root = api.getNote('root'); // Trilium 根笔记 noteId 固定为 'root'
        const rootId = root.noteId;

        // root 的直接子级
        const rootChildren = api.sql.getRows(`
            SELECT b.noteId, n.title FROM branches b
            JOIN notes n ON n.noteId = b.noteId
            WHERE b.parentNoteId = ? AND b.isDeleted = 0 AND n.isDeleted = 0
        `, [rootId]);

        // 标题正则（大小写不敏感），供收集箱 / 项目根匹配
        const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const inTitles = (cfg && cfg.inboxTitles) || [];
        const projTitles = (cfg && cfg.projectRootTitles) || [];
        const inRe = inTitles.length > 0 ? new RegExp('^(?:' + inTitles.map(escRe).join('|') + ')$', 'i') : null;
        const projRe = projTitles.length > 0 ? new RegExp('^(?:' + projTitles.map(escRe).join('|') + ')$', 'i') : null;

        const inboxRootIds = inRe ? rootChildren.filter(c => inRe.test(String(c.title || '').trim())).map(c => c.noteId) : [];
        const projectRootIds = projRe ? rootChildren.filter(c => projRe.test(String(c.title || '').trim())).map(c => c.noteId) : [];

        // 收集箱子树集合（含收集箱根及其全部后代，后代中的任务也算收集箱任务）
        const inboxIds = new Set(inboxRootIds);
        if (inboxRootIds.length > 0) {
            const iSql = `
                WITH RECURSIVE i(noteId) AS (
                    SELECT noteId FROM branches
                    WHERE parentNoteId IN (${inboxRootIds.map(() => '?').join(',')}) AND isDeleted = 0
                    UNION
                    SELECT b.noteId FROM branches b JOIN i ON b.parentNoteId = i.noteId
                    WHERE b.isDeleted = 0
                )
                SELECT noteId FROM i
            `;
            api.sql.getRows(iSql, inboxRootIds).forEach(r => inboxIds.add(r.noteId));
        }

        // 扫描范围：项目根 + 收集箱根；均未配置时回退全树
        const scopeIds = [...new Set([...projectRootIds, ...inboxRootIds])];
        const scope = scopeIds.length > 0 ? scopeIds : [rootId];

        // 范围内全部笔记（不限类型，任务取 text，项目不限类型）
        const subtreeSql = `
            WITH RECURSIVE subtree(noteId) AS (
                SELECT noteId FROM branches
                WHERE parentNoteId IN (${scope.map(() => '?').join(',')}) AND isDeleted = 0
                UNION
                SELECT b.noteId FROM branches b JOIN subtree s ON b.parentNoteId = s.noteId
                WHERE b.isDeleted = 0
            )
            SELECT DISTINCT s.noteId, n.title, n.type FROM subtree s
            JOIN notes n ON n.noteId = s.noteId
            WHERE n.isDeleted = 0
        `;
        const rows = api.sql.getRows(subtreeSql, scope);

        // 一次性查出所有笔记的 state 属性，避免逐条读取
        const stateMap = {};
        api.sql.getRows(`
            SELECT noteId, value FROM attributes
            WHERE isDeleted = 0 AND type = 'label' AND LOWER(name) = 'state'
        `).forEach(r => { stateMap[r.noteId] = r.value; });

        // 一次性查出所有笔记的 Priority 属性（P1 / P2 / P3 …）
        const priorityMap = {};
        api.sql.getRows(`
            SELECT noteId, value FROM attributes
            WHERE isDeleted = 0 AND type = 'label' AND LOWER(name) = 'priority'
        `).forEach(r => { priorityMap[r.noteId] = r.value; });

        // 进行中判断（兼容 In-Progress / In‑Progress / In Progress 等写法）
        const isInProgress = v => /^inprogress$/i.test(String(v || '').replace(/[\s\p{Pd}_]+/gu, ''));
        // 循环阶段项目判断（Cycling-Phase / Cycling‑Phase / Cycling Phase 等写法）
        const isCyclingPhase = v => /^cyclingphase$/i.test(String(v || '').replace(/[\s\p{Pd}_]+/gu, ''));
        // 暂停/等待响应项目判断（On-Hold / On Hold 等写法）
        const isOnHold = v => /^onhold$/i.test(String(v || '').replace(/[\s\p{Pd}_]+/gu, ''));

        const result = [];
        for (const row of rows) {
            const state = stateMap[row.noteId] || '';
            // 项目（进行中 / 循环阶段 / 暂停）或 text 笔记才读取内容，避免拉取大文件
            const isProj = isInProgress(state) || isCyclingPhase(state) || isOnHold(state);
            // 功能开关：关闭「暂停」时暂停项目不显示、内部任务不进全局视图 → 直接跳过（省 getContent + 解析）
            if (isOnHold(state) && features && features.onHold === false) continue;
            let content = '';
            if (row.type === 'text' || isProj) {
                const note = api.getNote(row.noteId);
                content = note ? note.getContent() : '';
            }
            result.push({
                noteId: row.noteId,
                title: row.title || '(无标题)',
                type: row.type,
                content,
                state,
                priority: priorityMap[row.noteId] || '',
                isInbox: inboxIds.has(row.noteId)
            });
        }

        return result;
    });
}

// ── 勾选完成 ──
// 普通任务：标记 done；重复任务（#repeat）：推进日期为下一次并写入已完成历史子任务
export async function completeTask(noteId, cbIndex) {
    return runOnBackend((noteId, cbIndex) => {

        const pad = n => String(n).padStart(2, '0');
        const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 定位第 cbIndex 个 checkbox 所在的 <li>...</li> 范围（含嵌套子列表）
        function findTaskLiRange(html, cbIndex) {
            let count = 0, cbOffset = -1;
            html.replace(/<input\s+type="checkbox"([^>]*?)>/gi, (match, attrs, offset) => {
                if (count++ === cbIndex) cbOffset = offset;
                return match;
            });
            if (cbOffset < 0) return null;
            const liOpen = html.lastIndexOf('<li', cbOffset);
            if (liOpen < 0) return null;
            let depth = 1;
            let pos = liOpen + 3;
            while (depth > 0 && pos < html.length) {
                const openIdx = html.indexOf('<li', pos);
                const closeIdx = html.indexOf('</li>', pos);
                if (closeIdx < 0) return null;
                if (openIdx >= 0 && openIdx < closeIdx) {
                    depth++;
                    pos = openIdx + 3;
                } else {
                    depth--;
                    pos = closeIdx + '</li>'.length;
                }
            }
            return { start: liOpen, end: pos };
        }

        // 解析重复规则：#repeat:Nd/Nw/Nm/Ny，可选后缀 :actual(按实际完成) / :start(每月初) / :end(每月底) / :endwork(每月末工作日)
        // 注意 endwork 必须排在 end 前面，否则 :endwork 会被误匹配为 :end
        function parseRepeat(text) {
            const m = text.match(/#repeat:(\d+)([dwmy])(?::(actual|start|endwork|end))?/i);
            if (!m) return null;
            return { interval: parseInt(m[1], 10), unit: m[2].toLowerCase(), pos: m[3] ? m[3].toLowerCase() : 'plan' };
        }

        // ── 日期计算（月末 / 2 月 29 自动钳制）──
        function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
        function addMonthsClamped(d, n) {
            const y = d.getFullYear(), m = d.getMonth() + n;
            const last = new Date(y, m + 1, 0).getDate();
            return new Date(y, m, Math.min(d.getDate(), last));
        }
        function addYearsClamped(d, n) {
            const y = d.getFullYear() + n, m = d.getMonth();
            const last = new Date(y, m + 1, 0).getDate();
            return new Date(y, m, Math.min(d.getDate(), last));
        }
        function lastWorkdayOfMonth(y, m) {
            const d = new Date(y, m + 1, 0);
            while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
            return d;
        }
        // 当前周期位置日（位置型重复的本次计划日期：1号 / 月末 / 月末工作日）
        function currentPosDate(dateStr, pos) {
            const d = new Date(dateStr + 'T00:00:00');
            const y = d.getFullYear(), m = d.getMonth();
            if (pos === 'start') return new Date(y, m, 1);
            if (pos === 'end') return new Date(y, m + 1, 0);
            return lastWorkdayOfMonth(y, m);
        }
        // 下一次日期：默认按规划（原定日期+间隔）；:actual 按完成当天+间隔；:start/:end/:endwork 取锚点月后的位置日
        function calcNextDate(dateStr, rep, doneStr) {
            const base = rep.pos === 'actual'
                ? new Date(doneStr + 'T00:00:00')
                : new Date(dateStr + 'T00:00:00');
            const n = rep.interval;
            switch (rep.unit) {
                case 'd': return addDays(base, n);
                case 'w': return addDays(base, 7 * n);
                case 'm':
                    if (rep.pos === 'start') return new Date(base.getFullYear(), base.getMonth() + n, 1);
                    if (rep.pos === 'end') return new Date(base.getFullYear(), base.getMonth() + n + 1, 0);
                    if (rep.pos === 'endwork') return lastWorkdayOfMonth(base.getFullYear(), base.getMonth() + n);
                    return addMonthsClamped(base, n);
                case 'y': return addYearsClamped(base, n);
            }
            return base;
        }

        const note = api.getNote(noteId);
        let content = note.getContent();

        const range = findTaskLiRange(content, cbIndex);
        if (!range) throw new Error('未找到对应的任务');
        const liStart = range.start, liEnd = range.end;
        const liContent = content.slice(liStart, liEnd);
        const ulIdx = liContent.toLowerCase().indexOf('<ul');
        const labelPart = ulIdx >= 0
            ? liContent.slice(0, ulIdx)
            : liContent.replace(/<\/li>\s*$/i, '');
        const taskText = labelPart.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const rep = parseRepeat(taskText);
        const dateM = taskText.match(/#(\d{4}-\d{2}-\d{2})/);

        // 本次执行日期：优先取任务上的 #日期；位置型重复（start/end/endwork）无日期时按完成日所在周期推算
        let thisDate = dateM ? dateM[1] : null;
        if (!thisDate && rep && ['start', 'end', 'endwork'].includes(rep.pos)) {
            thisDate = fmt(currentPosDate(fmt(new Date()), rep.pos));
        }

        // ── 普通任务（无重复规则 / 无锚点日期）：原逻辑标记 done ──
        if (!rep || !thisDate) {
            let count = 0;
            let targetOffset = -1;
            content = content.replace(
                /<input\s+type="checkbox"([^>]*?)>/gi,
                (match, attrs, offset) => {
                    if (count++ === cbIndex) {
                        targetOffset = offset;
                        if (/\bdata-trilium-task-state\s*=/i.test(attrs)) {
                            return match.replace(
                                /\bdata-trilium-task-state\s*=\s*"[^"]*"/i,
                                'data-trilium-task-state="done"'
                            );
                        }
                        if (/\bchecked\b/i.test(attrs)) return match;
                        return `<input type="checkbox"${attrs} checked>`;
                    }
                    return match;
                }
            );
            if (targetOffset >= 0) {
                const prefix = content.slice(0, targetOffset);
                const lastIdx = prefix.lastIndexOf('data-trilium-task-state');
                if (lastIdx >= 0 && !/<\/li\s*>/i.test(prefix.slice(lastIdx))) {
                    const before = prefix.slice(0, lastIdx);
                    const tail = prefix.slice(lastIdx).replace(
                        /^data-trilium-task-state\s*=\s*"[^"]*"/i,
                        'data-trilium-task-state="done"'
                    );
                    content = before + tail + content.slice(targetOffset);
                }
            }
            note.setContent(content);
            return {};
        }

        // ── 重复任务：推进日期 + 写入历史子任务 ──
        const doneStr = fmt(new Date());
        const nextDate = fmt(calcNextDate(thisDate, rep, doneStr));

        // 历史基础文本 = 任务文本去掉重复标签与日期
        const histTextBase = taskText
            .replace(/#repeat:\d+[dwmy](?::actual|start|endwork|end)?/gi, '')
            .replace(/#\d{4}-\d{2}-\d{2}/g, '')
            .replace(/\s+/g, ' ').trim() || '任务';

        // 收集任务 li 内已有历史子任务（checkbox 行）的日期，并读取折叠行的中间计数
        const histDates = [];
        let oldMidCount = 0;
        const ulParts = [];
        const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
        let um;
        while ((um = ulRe.exec(liContent)) !== null) ulParts.push(um[1]);
        const innerLiRe = /<li[^>]*>((?:(?!<\/?li)[\s\S])*?)<\/li>/g;
        for (const part of ulParts) {
            let lm;
            while ((lm = innerLiRe.exec(part)) !== null) {
                const inner = lm[1];
                if (/class\s*=\s*["']rp-note["']/i.test(lm[0])) {
                    // 折叠行：累加已折叠的中间次数
                    const mc = inner.match(/中间已完成\s*(\d+)\s*次/);
                    if (mc) oldMidCount += parseInt(mc[1], 10);
                    continue;
                }
                if (!/<input[^>]*type="checkbox"/i.test(inner)) continue; // 普通 li 忽略
                const dt = inner.match(/#(\d{4}-\d{2}-\d{2})/);
                if (dt) histDates.push(dt[1]);
            }
        }

        // 写入本次完成记录（原计划日期），去重后从旧到新排列
        if (!histDates.includes(thisDate)) histDates.push(thisDate);
        histDates.sort();

        const makeHistLi = ds =>
            `<li><input type="checkbox" checked data-trilium-task-state="done"><span>${escHtml(histTextBase)} #${ds}</span></li>`;
        let histItems = histDates.map(makeHistLi);
        // 保留最早 2 条 + 最新 2 条，中间折叠为计数行（在既有计数基础上累加本次新折叠的条数）
        if (histDates.length > 4) {
            const midCount = oldMidCount + (histDates.length - 4);
            histItems = [
                ...histItems.slice(0, 2),
                `<li class="rp-note">…中间已完成 ${midCount} 次…</li>`,
                ...histItems.slice(-2)
            ];
        }
        const subUl = histItems.length > 0 ? `<ul>\n${histItems.join('\n')}\n</ul>` : '';

        // 任务行：日期 → 下一次、勾选恢复未完成
        let newLabel = labelPart
            .replace(/#\d{4}-\d{2}-\d{2}/, '#' + nextDate)
            .replace(/data-trilium-task-state\s*=\s*"[^"]*"/i, 'data-trilium-task-state="none"')
            .replace(/<input([^>]*?)\s+checked\s*([^>]*?)>/gi, '<input$1$2>');
        const newTaskLi = newLabel + (subUl ? '\n' + subUl : '') + '</li>';
        const finalContent = content.slice(0, liStart) + newTaskLi + content.slice(liEnd);

        note.setContent(finalContent);

        return {
            repeat: rep,
            done: doneStr,
            next: nextDate,
            history: histDates,
            debug: {
                cbIndex, taskText, doneStr, nextDate, histTextBase, histDates,
                after: finalContent.slice(liStart, liStart + 420)
            }
        };

    }, [noteId, cbIndex]);
}

// ── 位置型重复任务自动补写日期（#repeat:1m:start/end/endwork 可省略 #日期）──
export async function stampRepeatDate(noteId, cbIndex, dateStr) {
    return runOnBackend((noteId, cbIndex, dateStr) => {
        // 定位第 cbIndex 个 checkbox 所在的 <li>...</li> 范围（含嵌套子列表）
        function findTaskLiRange(html, cbIndex) {
            let count = 0, cbOffset = -1;
            html.replace(/<input\s+type="checkbox"([^>]*?)>/gi, (match, attrs, offset) => {
                if (count++ === cbIndex) cbOffset = offset;
                return match;
            });
            if (cbOffset < 0) return null;
            const liOpen = html.lastIndexOf('<li', cbOffset);
            if (liOpen < 0) return null;
            let depth = 1;
            let pos = liOpen + 3;
            while (depth > 0 && pos < html.length) {
                const openIdx = html.indexOf('<li', pos);
                const closeIdx = html.indexOf('</li>', pos);
                if (closeIdx < 0) return null;
                if (openIdx >= 0 && openIdx < closeIdx) {
                    depth++;
                    pos = openIdx + 3;
                } else {
                    depth--;
                    pos = closeIdx + '</li>'.length;
                }
            }
            return { start: liOpen, end: pos };
        }

        const note = api.getNote(noteId);
        const content = note.getContent();
        const range = findTaskLiRange(content, cbIndex);
        if (!range) return {};
        const liContent = content.slice(range.start, range.end);
        const ulIdx = liContent.toLowerCase().indexOf('<ul');
        const labelPart = ulIdx >= 0
            ? liContent.slice(0, ulIdx)
            : liContent.replace(/<\/li>\s*$/i, '');
        // 已有日期则跳过（防重复补写）
        if (/#\d{4}-\d{2}-\d{2}/.test(labelPart)) return { stamped: false };
        // 在任务文本末尾追加日期：优先插到最后一个 </span> 之后，
        // 否则（无 span 结尾）回退到第一个 </span>，避免多 span 时插错位置
        const spanTail = labelPart.match(/^(.*<\/span>)(\s*)$/i);
        const newLabel = spanTail
            ? `${spanTail[1]} #${dateStr}${spanTail[2]}`
            : labelPart.replace(/<\/span>/i, ` #${dateStr}</span>`);
        if (newLabel === labelPart) return { stamped: false };
        note.setContent(content.slice(0, range.start) + newLabel + content.slice(range.end));
        return { stamped: true, date: dateStr };
    }, [noteId, cbIndex, dateStr]);
}

// ── 打卡切换：在任务 li 下方重建本周打卡子记录 ──
// dkTags: 打卡标签别名列表（如 ['dk','checkin','habit']），任一标签都识别为打卡
export async function toggleDkDay(noteId, cbIndex, dateStr, dkTags) {
    return runOnBackend((noteId, cbIndex, dateStr, dkTags) => {

        const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const pad = n => String(n).padStart(2, '0');
        const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const comp = s => String(s).replace(/-/g, '');

        const d = new Date(dateStr + 'T00:00:00');
        const dowCN = WEEK_CN[d.getDay()];

        // 该日期所在周的周一 ~ 周日
        const monday = new Date(d);
        const wd = d.getDay();
        monday.setDate(d.getDate() + (wd === 0 ? -6 : 1 - wd));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekRange = `${comp(fmt(monday))}~${comp(fmt(sunday))}`;

        const note = api.getNote(noteId);
        let content = note.getContent();

        // 定位第 cbIndex 个 checkbox 所在的 <li>...</li> 范围（支持嵌套子列表）
        function findTaskLiRange(html, cbIndex) {
            let count = 0, cbOffset = -1;
            html.replace(/<input\s+type="checkbox"([^>]*?)>/gi, (match, attrs, offset) => {
                if (count++ === cbIndex) cbOffset = offset;
                return match;
            });
            if (cbOffset < 0) return null;
            const liOpen = html.lastIndexOf('<li', cbOffset);
            if (liOpen < 0) return null;
            let depth = 1;
            let pos = liOpen + 3;
            while (depth > 0 && pos < html.length) {
                const openIdx = html.indexOf('<li', pos);
                const closeIdx = html.indexOf('</li>', pos);
                if (closeIdx < 0) return null;
                if (openIdx >= 0 && openIdx < closeIdx) {
                    depth++;
                    pos = openIdx + 3;
                } else {
                    depth--;
                    pos = closeIdx + '</li>'.length;
                }
            }
            return { start: liOpen, end: pos };
        }

        const range = findTaskLiRange(content, cbIndex);
        if (!range) throw new Error('未找到对应的任务');
        const liStart = range.start;
        const liEnd = range.end;
        const liContent = content.slice(liStart, liEnd);

        // ── 方案 B：整块重建 ──
        // 存储可能多形态混乱（任务 li 内嵌套 ul / 任务 li 后兄弟 ul / 历史残留并存的多种形态）。
        // 不做增量修补：把任务 li 到下一个任务之间的区域整体重建，
        // 区域内所有记录文本（无论藏在哪个 ul）统一收集 → 解析 → 重建为一个干净的任务 li。

        // 1) 任务 li 的 label 部分（第一个 <ul 之前；无 ul 则到 </li> 前）
        const ulIdxInTask = liContent.toLowerCase().indexOf('<ul');
        const labelPart = ulIdxInTask >= 0
            ? liContent.slice(0, ulIdxInTask)
            : liContent.replace(/<\/li>\s*$/i, '');

        // 2) 下一个 checkbox 任务 li 起点（本任务记录区域的右边界）
        const nextCb = content.toLowerCase().indexOf('<input type="checkbox"', liEnd);
        const nextLiStart = nextCb >= 0 ? content.lastIndexOf('<li', nextCb) : content.length;

        // 3) 收集区域内所有记录 li（叶子 li 且含 dkN周），并识别各自 todo 状态
        const region = content.slice(liStart, nextLiStart);
        const recRe = /<li[^>]*>((?:(?!<\/?li)[\s\S])*?dk\d+周(?:(?!<\/?li)[\s\S])*?)<\/li>/g;
        const recItems = []; // { range, weekNum, days, raw, state }
        let rm;
        while ((rm = recRe.exec(region)) !== null) {
            const inner = rm[1];
            // 状态：新格式 input 带 data-trilium-task-state；旧格式 checked；纯文本视为进行中
            let state = 'doing';
            const stM = inner.match(/data-trilium-task-state\s*=\s*"([^"]*)"/i);
            if (stM) state = stM[1].toLowerCase();
            if (state === 'none') state = 'doing';
            if (state !== 'done' && state !== 'cancelled' && /<input[^>]*\s+checked\s*[^>]*>/i.test(inner)) {
                state = 'done';
            }
            const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const rec = parseRec(text);
            if (rec) recItems.push({ ...rec, state });
        }

        // 4) 解析记录：{ range, weekNum, days, raw }
        //    days: [{ dow, count, target }]（每天打卡次数 + 当天目标）
        //    兼容旧格式 "周一，周三"（无次数括号 → 按 1 次处理）
        function parseRec(text) {
            // 注意：([^（]+?) 必须至少一个字符，且"（进度N/M / 相当于是N/M / 周进度N/M）"为必选，
            // 否则非贪婪 [^（]*? 会匹配空串，导致 days 恒为空、打卡永远被覆盖
            // 进度数允许 NaN：兼容旧 bug 写入的 "周进度1/NaN" 脏数据，使记录能被解析保留，
            // 下次打卡重建时会用正确进度重写（自愈）
            const m = text.match(/(\d{8})~(\d{8})\s+dk(\d+)周：([^（]+?)（(?:相当于是|进度|周进度)(?:\d+|NaN)\/(?:\d+|NaN)）/);
            if (!m) return null;
            const dayCounts = [];
            for (const item of m[4].split(/[，,、\s]+/).filter(Boolean)) {
                const dm = item.match(/^(周[一二三四五六日])(?:\((\d+)\/(\d+)\))?/);
                if (!dm) continue;
                dayCounts.push({
                    dow: dm[1],
                    count: dm[2] ? parseInt(dm[2], 10) : 1,
                    target: dm[3] ? parseInt(dm[3], 10) : 1
                });
            }
            return {
                range: `${m[1]}~${m[2]}`,
                weekNum: parseInt(m[3], 10),
                days: dayCounts,
                raw: text
            };
        }

        // 进行中的记录（已完成 done / 已取消 cancelled 不参与周进度，与任务取消逻辑一致）
        const recs = recItems.filter(r => r.state !== 'done' && r.state !== 'cancelled');

        // 5) 目标（从任务文本部分提取 #dk:N 或 #dk:N:M；支持标签别名，如 #checkin）
        //    N=每周目标天数, M=每天打卡次数（缺省 1）；周目标总次数 = N × M
        const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dkTagList = (dkTags && dkTags.length > 0) ? dkTags : ['dk'];
        // 别名列表必须用非捕获组 (?:...) 整体包裹，否则多别名时正则变成
        // "#dk|checkin|habit:(\d+)"，'checkin' 分支会匹配任意 "checkin" 文本，
        // 捕获组为空 → parseInt(undefined) = NaN → 记录里出现 "周进度1/NaN"
        const dkTagRe = new RegExp('#(?:' + dkTagList.map(escRe).join('|') + '):(\\d+)(?::(\\d+))?', 'i');
        function parseTarget(taskLi) {
            const ui = taskLi.toLowerCase().indexOf('<ul');
            const taskPart = ui >= 0 ? taskLi.slice(0, ui) : taskLi;
            const text = taskPart.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const m = text.match(dkTagRe);
            if (!m) return { dkDays: 0, dkPerDay: 1 };
            // 防御：parseInt 结果兜底，避免异常值污染记录文本
            const dkDays = parseInt(m[1], 10) || 0;
            const dkPerDay = m[2] ? (parseInt(m[2], 10) || 1) : 1;
            return { dkDays, dkPerDay };
        }
        const { dkDays, dkPerDay } = parseTarget(liContent);
        const weekTarget = dkDays * dkPerDay;

        // 6) 本周记录 + 当天打卡次数切换
        //    未满（count < dkPerDay）→ +1；已满 → 清零移除该日（再次点击即取消当天）
        const weekRec = recs.find(r => r.range === weekRange) || null;
        const maxWeek = recs.reduce((m, r) => Math.max(m, r.weekNum), 0);
        const dayCounts = weekRec ? weekRec.days.map(x => Object.assign({}, x)) : [];
        const daysBefore = JSON.stringify(dayCounts); // 诊断用
        const dayIdx = dayCounts.findIndex(x => x.dow === dowCN);
        if (dayIdx >= 0) {
            const it = dayCounts[dayIdx];
            if (it.count >= dkPerDay) dayCounts.splice(dayIdx, 1); // 已满 → 清零
            else { it.count += 1; it.target = dkPerDay; }
        } else {
            dayCounts.push({ dow: dowCN, count: 1, target: dkPerDay });
        }
        dayCounts.sort((a, b) => WEEK_CN.indexOf(a.dow) - WEEK_CN.indexOf(b.dow));
        const weekTotal = dayCounts.reduce((s, x) => s + x.count, 0);

        // 本周已有记录（含已完成/已取消）时沿用其周号
        const weekRecAll = recItems.find(r => r.range === weekRange) || null;
        const weekNum = weekRec ? weekRec.weekNum : (weekRecAll ? weekRecAll.weekNum : maxWeek + 1);

        // 7) 重建记录 ul：保留各记录原状态（不冲掉用户标记的完成/取消），
        //    本周记录若存在则更新为新文本并重新变为进行中；清零则删除该记录
        //    文本格式: "20260817~20260823 dk1周：周一(1/2) 周二(2/2)（周进度4/6）"
        const dayText = dayCounts.map(x => `${x.dow}(${x.count}/${dkPerDay})`).join(' ');
        // 总进度按天数算：当天次数打满（count >= dkPerDay）才算 1 天
        const daysDone = dayCounts.filter(x => x.count >= dkPerDay).length;
        const weekProgressText = `（周进度${daysDone}/${dkDays}）`;
        let weekUpdated = false;
        const outRecs = recItems.map(r => {
            if (r.range !== weekRange) return r;
            weekUpdated = true;
            if (dayCounts.length === 0) return null; // 清零 → 删除本周记录
            const newText = `${weekRange} dk${weekNum}周：${dayText}${weekProgressText}`;
            return { ...r, days: dayCounts, raw: newText, state: 'doing' };
        }).filter(Boolean);
        if (!weekUpdated && dayCounts.length > 0) {
            const newText = `${weekRange} dk${weekNum}周：${dayText}${weekProgressText}`;
            outRecs.push({ range: weekRange, weekNum, days: dayCounts, raw: newText, state: 'doing' });
        }
        outRecs.sort((a, b) => b.weekNum - a.weekNum);  // 最新周在前
        const recordLis = outRecs.map(r => {
            // 打卡记录写入为普通无序列表项（非 todo checkbox），仅作记录文本
            return `<li class="dk-note">${r.raw}</li>`;
        });
        const newUl = recordLis.length > 0 ? `<ul>\n${recordLis.join('\n')}\n</ul>` : '';

        // 8) 重建任务 li 并替换整个记录区域
        //    任务 li 整体替换为重建后的新 li；任务 li 之外的"兄弟区域"（[liEnd, nextLiStart]）
        //    只移除旧记录 li（记录已并入 newUl），但保留 </ul><ul> 等结构边界。
        //    否则跨 ul 场景（打卡任务与后续任务不在同一个 ul）下边界丢失，
        //    CKEditor 重组时会清空后续内容（如 dsxx/fsf）。
        const newTaskLi = `${labelPart}${newUl ? '\n' + newUl : ''}</li>`;
        let tail = content.slice(liEnd, nextLiStart);
        tail = tail.replace(recRe, '');                       // 移除兄弟区域内的旧记录 li
        tail = tail.replace(/<ul[^>]*>\s*<\/ul>/gi, '');      // 清理被掏空的 ul
        const finalContent = content.slice(0, liStart) + newTaskLi + tail + content.slice(nextLiStart);

        note.setContent(finalContent);
        // 回显验证：setContent 后立即读回，确认 Trilium 是否保留记录 li 结构
        const echoed = note.getContent();
        const echoDkPositions = [...echoed.matchAll(/dk\d+周/g)].map(m => m.index);
        const echoIdx = echoDkPositions.length > 0 ? echoDkPositions[0] : -1;
        return {
            days: dayCounts,
            count: daysDone,
            target: dkDays, weekRange, weekNum,
            debug: {
                cbIndex, dateStr, weekRange, weekTarget, dkDays, dkPerDay,
                labelPart: labelPart.slice(0, 140),               // 任务 label 部分
                recItems: recItems.map(r => `${r.range}#w${r.weekNum}:${r.days.map(x => x.dow + (x.count > 1 ? x.count : '')).join('')}:${r.state}`), // 区域内全部记录及状态
                recsFound: recs.map(r => `${r.range}#w${r.weekNum}:${r.days.map(x => x.dow + (x.count > 1 ? x.count : '')).join('')}`), // 进行中的记录
                weekRecFound: !!weekRec,                           // 是否找到本周进行中记录
                daysBefore,                                        // 写入前已有的打卡日
                nextLiDelta: nextLiStart - liEnd,                  // 区域右边界距任务 li 尾的距离
                regionTail: region.slice(-180),                    // 记录区域结尾（确认没吃相邻任务）
                tailSib: tail.slice(0, 200),                       // 兄弟区域清理后保留的结构（ul 边界等）
                after: finalContent.slice(liStart, liStart + 420), // 重建后的任务区域
                echoHasRecordLi: /<li[^>]*class="dk-note"/i.test(echoed), // setContent 后记录 li 是否还在
                echoDkPositions,                                   // setContent 后 dkN周 的位置
                echoNear: echoIdx >= 0 ? echoed.slice(Math.max(0, echoIdx - 160), echoIdx + 160) : '(no dk)'
            }
        };

    }, [noteId, cbIndex, dateStr, dkTags]);
}

// ── 间隔计时提醒状态持久化 ──
// 把「阶段 + 结束时间戳」以 JSON 写入配置笔记的 txState 顶层字段（通过 ~configNote 关系定位），
// 刷新页面 / 切换到其他笔记后回来时，前端可恢复倒计时。
// 不写笔记标签：标签属于笔记内容数据，计时状态是运行时数据，统一归入配置。
// 注意：必须用宿主笔记（hostNoteId）定位配置笔记，不能用 api.startNote——
// 用户切到其他笔记时 startNote 是当前激活笔记，会定位到错误的配置。
export async function saveTxState(hostNoteId, states) {
    return runOnBackend((noteId, json) => {
        function findConfigNoteBackend(host) {
            try {
                const rel = host.getOwnedAttributes('relation', 'configNote')[0];
                if (rel && rel.value) {
                    const n = api.getNote(rel.value);
                    if (n) return n;
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        try {
            const host = api.getNote(noteId);
            if (!host) return { ok: false };
            const cfgNote = findConfigNoteBackend(host);
            if (!cfgNote) return { ok: false }; // 无配置笔记 → 不持久化（不抛错，计时仍可运行）
            let old = {};
            try {
                old = JSON.parse(cfgNote.getContent() || 'null') || {};
            } catch (e) {
                old = {};
            }
            // 顶层字段整替换：停止/删除的计时器旧 key 不会残留
            const merged = Object.assign({}, old, { txState: JSON.parse(json) });
            cfgNote.setJsonContent(merged);
            cfgNote.save();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: String(e && e.message || e) };
        }
    }, [hostNoteId, JSON.stringify(states)]);
}

// 读取之前保存的计时状态（JSON 字符串，空串表示从未保存 / 配置笔记不存在）
export async function loadTxState(hostNoteId) {
    return runOnBackend((noteId) => {
        function findConfigNoteBackend(host) {
            try {
                const rel = host.getOwnedAttributes('relation', 'configNote')[0];
                if (rel && rel.value) {
                    const n = api.getNote(rel.value);
                    if (n) return n;
                }
            } catch (e) { /* ignore */ }
            return null;
        }
        try {
            const host = api.getNote(noteId);
            if (!host) return '';
            const cfgNote = findConfigNoteBackend(host);
            if (!cfgNote) return '';
            const raw = JSON.parse(cfgNote.getContent() || 'null') || {};
            return raw.txState ? JSON.stringify(raw.txState) : '';
        } catch (e) {
            return '';
        }
    }, [hostNoteId]);
}
