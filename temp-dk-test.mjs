// 临时测试：模拟 toggleDkDay 核心重建逻辑，验证多打卡任务顺序是否变化
// 从 backendBridge.jsx 提取的 HTML 处理逻辑（mock api）

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

function rebuild(content, cbIndex, dateStr) {
    const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const comp = s => String(s).replace(/-/g, '');
    const d = new Date(dateStr + 'T00:00:00');
    const dowCN = WEEK_CN[d.getDay()];
    const monday = new Date(d);
    const wd = d.getDay();
    monday.setDate(d.getDate() + (wd === 0 ? -6 : 1 - wd));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekRange = `${comp(fmt(monday))}~${comp(fmt(sunday))}`;

    const range = findTaskLiRange(content, cbIndex);
    if (!range) throw new Error('未找到对应的任务');
    const liStart = range.start;
    const liEnd = range.end;
    const liContent = content.slice(liStart, liEnd);

    const ulIdxInTask = liContent.toLowerCase().indexOf('<ul');
    const labelPart = ulIdxInTask >= 0
        ? liContent.slice(0, ulIdxInTask)
        : liContent.replace(/<\/li>\s*$/i, '');

    const nextCb = content.toLowerCase().indexOf('<input type="checkbox"', liEnd);
    const nextLiStart = nextCb >= 0 ? content.lastIndexOf('<li', nextCb) : content.length;

    const region = content.slice(liStart, nextLiStart);
    const recRe = /<li[^>]*>((?:(?!<\/?li)[\s\S])*?dk\d+周(?:(?!<\/?li)[\s\S])*?)<\/li>/g;
    const recItems = [];
    let rm;
    while ((rm = recRe.exec(region)) !== null) {
        const inner = rm[1];
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

    function parseRec(text) {
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

    const recs = recItems.filter(r => r.state !== 'done' && r.state !== 'cancelled');
    const dkTagRe = /#(?:dk|checkin|habit):(\d+)(?::(\d+))?/i;
    function parseTarget(taskLi) {
        const ui = taskLi.toLowerCase().indexOf('<ul');
        const taskPart = ui >= 0 ? taskLi.slice(0, ui) : taskLi;
        const text = taskPart.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const m = text.match(dkTagRe);
        if (!m) return { dkDays: 0, dkPerDay: 1 };
        const dkDays = parseInt(m[1], 10) || 0;
        const dkPerDay = m[2] ? (parseInt(m[2], 10) || 1) : 1;
        return { dkDays, dkPerDay };
    }
    const { dkDays, dkPerDay } = parseTarget(liContent);

    const weekRec = recs.find(r => r.range === weekRange) || null;
    const maxWeek = recs.reduce((m, r) => Math.max(m, r.weekNum), 0);
    const dayCounts = weekRec ? weekRec.days.map(x => Object.assign({}, x)) : [];
    const dayIdx = dayCounts.findIndex(x => x.dow === dowCN);
    if (dayIdx >= 0) {
        const it = dayCounts[dayIdx];
        if (it.count >= dkPerDay) dayCounts.splice(dayIdx, 1);
        else { it.count += 1; it.target = dkPerDay; }
    } else {
        dayCounts.push({ dow: dowCN, count: 1, target: dkPerDay });
    }
    dayCounts.sort((a, b) => WEEK_CN.indexOf(a.dow) - WEEK_CN.indexOf(b.dow));
    const weekRecAll = recItems.find(r => r.range === weekRange) || null;
    const weekNum = weekRec ? weekRec.weekNum : (weekRecAll ? weekRecAll.weekNum : maxWeek + 1);
    const dayText = dayCounts.map(x => `${x.dow}(${x.count}/${dkPerDay})`).join(' ');
    const daysDone = dayCounts.filter(x => x.count >= dkPerDay).length;
    const weekProgressText = `（周进度${daysDone}/${dkDays}）`;
    let weekUpdated = false;
    const outRecs = recItems.map(r => {
        if (r.range !== weekRange) return r;
        weekUpdated = true;
        if (dayCounts.length === 0) return null;
        const newText = `${weekRange} dk${weekNum}周：${dayText}${weekProgressText}`;
        return { ...r, days: dayCounts, raw: newText, state: 'doing' };
    }).filter(Boolean);
    if (!weekUpdated && dayCounts.length > 0) {
        const newText = `${weekRange} dk${weekNum}周：${dayText}${weekProgressText}`;
        outRecs.push({ range: weekRange, weekNum, days: dayCounts, raw: newText, state: 'doing' });
    }
    outRecs.sort((a, b) => b.weekNum - a.weekNum);
    const recordLis = outRecs.map(r => `<li class="dk-note">${r.raw}</li>`);
    const newUl = recordLis.length > 0 ? `<ul>\n${recordLis.join('\n')}\n</ul>` : '';

    const newTaskLi = `${labelPart}${newUl ? '\n' + newUl : ''}</li>`;
    let tail = content.slice(liEnd, nextLiStart);
    tail = tail.replace(recRe, '');
    tail = tail.replace(/<ul[^>]*>\s*<\/ul>/gi, '');
    const finalContent = content.slice(0, liStart) + newTaskLi + tail + content.slice(nextLiStart);

    return { finalContent, debug: { liStart, liEnd, nextLiStart, region: region.slice(0, 150) } };
}

// ── 任务文本顺序提取（按 checkbox 顺序取任务名） ──
function taskOrder(html) {
    const out = [];
    html.replace(/<li[^>]*>((?:(?!<\/?li)[\s\S])*?)<\/li>/g, (_, inner, off) => {
        const name = inner.match(/<span[^>]*>([^<]*)/);
        out.push((name ? name[1] : inner.slice(0, 20)).trim().replace(/\s+/g, ' '));
        return _;
    });
    return out.filter(x => x && !/^\d{8}~/.test(x));
}

// ── 测试用例 ──
const T = (name, html, cbIndex, dateStr, desc) => {
    try {
        const before = taskOrder(html);
        const { finalContent } = rebuild(html, cbIndex, dateStr);
        const after = taskOrder(finalContent);
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        console.log(`\n=== ${name} ${changed ? '【顺序变了!】' : 'OK'} ===`);
        console.log('说明:', desc);
        console.log('before:', before);
        console.log('after :', after);
        if (changed) console.log('finalContent:\n' + finalContent);
    } catch (e) {
        console.log(`\n=== ${name} ERROR: ${e.message} ===`);
    }
};

// 用例1：规范嵌套 ul，两个打卡任务相邻
T('用例1 规范嵌套-点击A', `<ul class="todo-list">
<li><span>A习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"><ul><li class="dk-note">20260817~20260823 dk1周：周一(1/1)（周进度1/5）</li><li class="dk-note">20260824~20260830 dk2周：周二(1/1)（周进度1/5）</li></ul></li>
<li><span>B习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"><ul><li class="dk-note">20260824~20260830 dk2周：周一(1/1)（周进度1/5）</li></ul></li>
<li><span>C普通任务</span><input type="checkbox" data-trilium-task-state="doing"></li>
</ul>`, 0, '2026-08-26', '两个打卡任务相邻，点击 A');

// 用例2：记录在兄弟 ul（历史残留形态）
T('用例2 兄弟ul-点击A', `<ul class="todo-list">
<li><span>A习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"></li>
<ul><li class="dk-note">20260824~20260830 dk2周：周二(1/1)（周进度1/5）</li></ul>
<li><span>B习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"></li>
<ul><li class="dk-note">20260824~20260830 dk2周：周一(1/1)（周进度1/5）</li></ul>
<li><span>C普通任务</span><input type="checkbox" data-trilium-task-state="doing"></li>
</ul>`, 0, '2026-08-26', '记录为兄弟 ul 形态，点击 A');

// 用例3：混合形态，点击中间 B
T('用例3 混合-点击B', `<ul class="todo-list">
<li><span>A习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"><ul><li class="dk-note">20260824~20260830 dk2周：周二(1/1)（周进度1/5）</li></ul></li>
<li><span>B习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"></li>
<ul><li class="dk-note">20260824~20260830 dk2周：周一(1/1)（周进度1/5）</li></ul>
<li><span>C习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing"><ul><li class="dk-note">20260824~20260830 dk2周：周三(1/1)（周进度1/5）</li></ul></li>
</ul>`, 1, '2026-08-24', 'A嵌套+B兄弟+C嵌套，点击中间 B');

// 用例4：li 未闭合（Trilium 常见精简结构）
T('用例4 li未闭合精简结构', `<ul class="todo-list">
<li><span>A习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing">
<ul>
<li class="dk-note">20260824~20260830 dk2周：周二(1/1)（周进度1/5）</li>
</ul>
<li><span>B习惯 #dk:5</span><input type="checkbox" data-trilium-task-state="doing">
<ul>
<li class="dk-note">20260824~20260830 dk2周：周一(1/1)（周进度1/5）</li>
</ul>
<li><span>C普通</span><input type="checkbox">
</ul>`, 0, '2026-08-26', 'li 未用 </li> 闭合（ul 直接跟下一个 li），点击 A');
