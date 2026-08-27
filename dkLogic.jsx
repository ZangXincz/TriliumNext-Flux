// ============================================================
//  dkLogic — 周打卡纯逻辑（无依赖，纯函数）
//  作为 render bundle 的子模块，入口用标题「dkLogic」引用：
//      const { localDateStr, weekDays, currentWeekKey } = dkLogic;
// ============================================================

// 本地日期字符串 YYYY-MM-DD
export function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 今天的日期字符串
export function todayStr() {
    return localDateStr(new Date());
}

export const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 日期压缩为纯数字（用于周范围 key）
export const compDate = s => String(s).replace(/-/g, '');

// 返回某日期所在周的周一（0 点）
export function getMondayOf(date) {
    const d = new Date(date);
    const wd = d.getDay(); // 0 = 周日
    d.setDate(d.getDate() + (wd === 0 ? -6 : 1 - wd));
    return d;
}

// 本周周一 ~ 周日 共 7 天
// 返回 [{ dateStr, dowCN, dayNum }, ...]
export function weekDays() {
    const monday = getMondayOf(new Date());
    const arr = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        arr.push({
            dateStr: localDateStr(d),
            dowCN: WEEK_CN[d.getDay()],
            dayNum: d.getDate()
        });
    }
    return arr;
}

// 本周范围 key，如 "20260824~20260830"
export function currentWeekKey() {
    const monday = getMondayOf(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${compDate(localDateStr(monday))}~${compDate(localDateStr(sunday))}`;
}
