// ============================================================
//  taskParser — 笔记内容解析（纯逻辑，无依赖）
//  使用原生 DOM（DOMParser）解析 HTML，无第三方依赖
//  作为 render bundle 的子模块，入口用标题「taskParser」引用：
//      const { parseTasks, countCheckboxes } = taskParser;
// ============================================================

// 将 HTML 内容解析为可查询的 DOM 根
function parseHtml(content) {
    const doc = new DOMParser().parseFromString(String(content), 'text/html');
    return doc.body;
}

// 查找某元素之后最近的 <ul> 兄弟
function nextUl(el) {
    let node = el.nextElementSibling;
    while (node) {
        if (node.tagName === 'UL') return node;
        node = node.nextElementSibling;
    }
    return null;
}

// 收集某元素之后的所有 <ul> 兄弟
function nextAllUls(el) {
    const result = [];
    let node = el.nextElementSibling;
    while (node) {
        if (node.tagName === 'UL') result.push(node);
        node = node.nextElementSibling;
    }
    return result;
}

// 解析打卡记录行：
//   新格式 "20260824~20260830 dk1周：周一(1/2) 周二(2/2)（周进度4/6）"
//   旧格式 "20260824~20260830 dk1周：周一，周三（进度2/4）"（无次数括号 → 按 1 次处理）
// 注意：([^（]+?) 至少一个字符 + "（进度N/M / 相当于是N/M / 周进度N/M）"必选，
// 否则非贪婪 [^（]*? 匹配空串 → days 恒为空 → 前端永远 0/目标
// 返回 days: [{ dow, count, target }]（每天打卡次数 + 当天目标）
function parseDkRecord(text) {
    const m = text.match(/(\d{8})~(\d{8})\s+dk(\d+)周：([^（]+?)（(?:相当于是|进度|周进度)(\d+)\/(\d+)）/);
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
        weekStart: m[1],
        weekEnd: m[2],
        weekNum: parseInt(m[3], 10),
        days: dayCounts,
        // 总进度按天数算：当天次数打满（count >= target）才算 1 天
        count: dayCounts.filter(x => x.count >= x.target).length,
        target: parseInt(m[6], 10) || 0
    };
}

// 月份位置日：start=1号，end=最后一天，endwork=最后一个工作日
function monthPos(y, m, pos) {
    if (pos === 'start') return { y, m, d: 1 };
    const last = new Date(y, m + 1, 0).getDate();
    if (pos === 'end') return { y, m, d: last };
    let d = last;
    while (new Date(y, m, d).getDay() === 0 || new Date(y, m, d).getDay() === 6) d--;
    return { y, m, d };
}

function fmtDateStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 位置型重复任务的当前计划日期：本月位置日未过期→取本月，否则下月
function posPlanDate(todayStr, pos) {
    const t = new Date(todayStr + 'T00:00:00');
    const cur = monthPos(t.getFullYear(), t.getMonth(), pos);
    if (new Date(cur.y, cur.m, cur.d) >= t) return fmtDateStr(cur.y, cur.m, cur.d);
    const next = monthPos(t.getFullYear(), t.getMonth() + 1, pos);
    return fmtDateStr(next.y, next.m, next.d);
}

// 读取 checkbox 的完成状态（兼容旧 HTML 与属性标记）
export function getTaskState(input) {
    const el = input.closest('[data-trilium-task-state]');
    if (el) {
        return String(el.getAttribute('data-trilium-task-state')).toLowerCase();
    }
    if (input.checked || input.hasAttribute('checked')) return 'done';
    return 'none';
}

// 解析笔记内容，返回未完成任务的数组
// 返回项: { text, displayText, checkboxIndex, date, repeat, repeatStamp, dkDays, dkPerDay, dkTarget, dkRecords }
// 打卡目标: #dk:N 或 #dk:N:M → dkDays=N, dkPerDay=M(缺省1), dkTarget=N（每周目标天数，按天计进度）
// 重复任务: #repeat:Nd/Nw/Nm/Ny（每N天/周/月/年），可选后缀 :actual(按实际完成日) / :start(每月初) / :end(每月底) / :endwork(每月末工作日)
// 位置型重复（:start/:end/:endwork）可省略 #日期：date 自动取当前周期计划日期，repeatStamp 标记待补写
// tags: { dk: [..], tx: [..], defaultRest: 5 } —— 打卡/提醒标签别名列表（默认 ['dk'] / ['tx']），defaultRest 为 #tx 缺省休息分钟
// features: 功能开关。dk/tx 关闭时不识别对应标签（省正则匹配 + 打卡记录 DOM 遍历）；
//           展示文本仍会清理标记（避免 #dk:7 这类标签裸露显示）
export function parseTasks(content, today, tags, features) {
    const dkEnabled = !features || features.dk !== false;
    const txEnabled = !features || features.tx !== false;
    const dkAliases = (tags && tags.dk && tags.dk.length > 0) ? tags.dk : ['dk'];
    const txAliases = (tags && tags.tx && tags.tx.length > 0) ? tags.tx : ['tx'];
    const txDefaultRest = (tags && tags.defaultRest != null) ? tags.defaultRest : 5;
    const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 功能关闭时用永不匹配的正则（/(?!)/），完全跳过对应标签识别
    const dkRe = dkEnabled
        ? new RegExp('#(?:' + dkAliases.map(escRe).join('|') + '):(\\d+)(?::(\\d+))?', 'i')
        : /(?!)/;
    const txRe = txEnabled
        ? new RegExp('#(?:' + txAliases.map(escRe).join('|') + '):(\\d+)(?::(\\d+))?(?::([^#:]*))?(?::([^#:]*))?', 'i')
        : /(?!)/;
    // displayText 清理用同一组别名（始终清理，保持展示干净）
    const dkCleanRe = new RegExp('#(?:' + dkAliases.map(escRe).join('|') + '):\\d+(?::\\d+)?', 'gi');
    const txCleanRe = new RegExp('#(?:' + txAliases.map(escRe).join('|') + '):\\d+(?::\\d+)?(?::[^#:]*)?(?::[^#:]*)?', 'gi');

    const tasks = [];
    const tmp = parseHtml(content);
    let cbIndex = 0;
    const inputs = tmp.querySelectorAll('input[type="checkbox"]');
    for (const input of inputs) {
        const idx = cbIndex++;
        const st = getTaskState(input);
        if (st === 'done' || st === 'cancelled') continue;

        // 任务文本：优先取 checkbox 后紧跟的 <span>，否则取父元素文本
        let text = '';
        const span = input.nextElementSibling;
        text = span && span.tagName === 'SPAN'
            ? span.textContent
            : input.parentElement.textContent;
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // 提取日期 #YYYY-MM-DD
        const m = text.match(/#(\d{4}-\d{2}-\d{2})/);
        // 提取打卡目标 #dk:N 或 #dk:N:M（N=每周目标天数，M=每天打卡次数，缺省 1；支持配置的标签别名）
        const dk = text.match(dkRe);
        // 提取间隔计时提醒 #tx:N:M:A:B（N=进行分钟，M=休息分钟，A=进行中文本，B=休息中文本，均可省略；支持配置的标签别名）
        const tx = text.match(txRe);
        // 提取重复规则 #repeat:Nd/Nw/Nm/Ny，可选后缀 :actual/:start/:endwork/:end
        // 注意 endwork 必须排在 end 前面，否则 :endwork 会被误匹配为 :end
        const repeat = text.match(/#repeat:(\d+)([dwmy])(?::(actual|start|endwork|end))?/i);
        const repeatPos = repeat && repeat[3] ? repeat[3].toLowerCase() : null;

        // 位置型重复任务（每月初/底/末工作日）可省略 #日期：自动取当前周期计划日期并标记待补写
        let date = m ? m[1] : null;
        let repeatStamp = null;
        if (!date && repeatPos && ['start', 'end', 'endwork'].includes(repeatPos) && today) {
            date = posPlanDate(today, repeatPos);
            repeatStamp = date;
        }

        // 展示文本去掉内部标记
        const displayText = text
            .replace(/#\d{4}-\d{2}-\d{2}/g, '')
            .replace(dkCleanRe, '')
            .replace(txCleanRe, '')
            .replace(/#repeat:\d+[dwmy](?::(?:actual|start|endwork|end))?/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        // 打卡任务：解析下方记录 li（由当前任务节点起，向下找子级或后续 ul）
        let dkRecords = [];
        if (dk) {
            const li = input.closest('li');
            let recLis = null;
            if (li) {
                recLis = li.querySelectorAll('ul > li');
                if (!recLis.length) {
                    const u = nextUl(li);
                    recLis = u ? u.querySelectorAll('li') : [];
                }
                if (!recLis.length) {
                    const u = li.closest('ul');
                    const nu = u ? nextUl(u) : null;
                    recLis = nu ? nu.querySelectorAll('li') : [];
                }
                if (!recLis.length) {
                    const u = li.closest('ul');
                    recLis = u
                        ? nextAllUls(u).flatMap(u2 => [...u2.querySelectorAll('li')])
                        : [];
                }
            }
            for (const el of recLis) {
                const inputEl = el.querySelector('input[type="checkbox"]');
                if (inputEl) {
                    const s = getTaskState(inputEl);
                    if (s === 'done' || s === 'cancelled') continue;
                }
                const rec = parseDkRecord(el.textContent.replace(/\s+/g, ' ').trim());
                if (rec) dkRecords.push(rec);
            }
            dkRecords.sort((a, b) => b.weekNum - a.weekNum);
        }

        const dkDays = dk ? parseInt(dk[1], 10) : null;
        const dkPerDay = dk ? (dk[2] ? parseInt(dk[2], 10) : 1) : null;
        tasks.push({
            text,
            displayText: displayText || text,
            checkboxIndex: idx,
            date,
            // 重复任务: #repeat:Nd/Nw/Nm/Ny，可选后缀 :actual(按实际完成) / :start(每月初) / :end(每月底) / :endwork(每月末工作日)
            repeat: repeat ? {
                interval: parseInt(repeat[1], 10),
                unit: repeat[2].toLowerCase(),
                pos: repeat[3] ? repeat[3].toLowerCase() : 'plan'
            } : null,
            // 位置型重复任务需要把计算出的日期补写进笔记（首次渲染后）
            repeatStamp,
            dkDays,
            dkPerDay,
            dkTarget: dkDays != null ? dkDays : null,
            dkRecords,
            // 间隔计时提醒 #tx:N:M:A:B → { work, rest, workLabel, restLabel }（N/M=分钟，A/B=阶段文本，均可省）
            tx: tx ? {
                work: parseInt(tx[1], 10),
                rest: tx[2] ? parseInt(tx[2], 10) : txDefaultRest,
                workLabel: tx[3] ? tx[3].trim() : null,
                restLabel: tx[4] ? tx[4].trim() : null
            } : null
        });
    }
    return tasks;
}

// 统计内容中 checkbox 完成数
export function countCheckboxes(content) {
    const tmp = parseHtml(content);
    let done = 0;
    let total = 0;
    const inputs = tmp.querySelectorAll('input[type="checkbox"]');
    for (const input of inputs) {
        total++;
        const st = getTaskState(input);
        if (st === 'done' || st === 'cancelled') done++;
    }
    return { done, total };
}
