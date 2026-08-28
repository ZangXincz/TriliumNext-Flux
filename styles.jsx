// ============================================================
//  styles — TriliumNext Flux 全部样式（集中一处维护）
//  作为 render bundle 的子模块，入口用标题「styles」引用：
//      const { TASK_STYLES, injectStyles } = styles;
// ============================================================

export const TASK_STYLES = `
    .th-task-check {
        flex-shrink: 0;
        width: 15px;
        height: 15px;
        margin-top: 3px;
        border: 1.5px solid var(--main-border-color, #45475a);
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color .15s, background .15s, color .15s;
        color: transparent;
        font-size: 10px;
        line-height: 1;
        user-select: none;
    }
    .th-task-check:hover {
        border-color: var(--main-text-color);
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
    }
    .th-task-check.th-completing {
        border-color: var(--active-item-background-color, #a6e3a1);
        background: rgba(166, 227, 161, .15);
        color: var(--active-item-background-color, #a6e3a1);
        pointer-events: none;
    }
    .th-task-text {
        cursor: pointer;
        transition: color .15s;
    }
    .th-task-text:hover {
        color: var(--link-color, var(--main-text-color));
        text-decoration: underline;
    }
    .th-task-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 3px 0;
        font-size: 16px;
        line-height: 1.45;
    }
    /* 勾选完成后淡出（对应原 fadeOut，由 main 的 leavingKeys 触发） */
    .th-task-row.th-leaving {
        opacity: 0;
        transition: opacity .25s;
    }
    .th-task-date {
        margin-left: auto;
        flex-shrink: 0;
        font-size: 12px;
        line-height: 20px;
        padding: 0 7px;
        border-radius: 10px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
        white-space: nowrap;
    }
    .th-task-date.overdue,
    .th-task-date.today {
        color: #e64553;
        background: rgba(230, 69, 83, .12);
        font-weight: 600;
    }
    .th-due .th-task-text {
        color: #e64553;
        font-weight: 500;
    }
    .th-group-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .06em;
        color: var(--muted-text-color, #888);
    }
    .th-group-count {
        font-size: 13px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
        padding: 1px 7px;
        border-radius: 10px;
    }
    /* 优先级徽标：复用任务进度比例样式，仅文字颜色按 P1/P2/P3 区分 */
    .th-group-count.p1 { color: #e64553; }
    .th-group-count.p2 { color: #e8b84f; }
    .th-group-count.p3 { color: #a6adc8; }
    .th-project-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-bottom: 6px;
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 8px;
        cursor: pointer;
        transition: border-color .15s, background .15s;
    }
    .th-project-row:hover {
        background: var(--accented-background-color, #313244);
    }
    .th-project-name {
        flex: 1;
        font-weight: 600;
    }
    .th-project-state {
        flex-shrink: 0;
        font-size: 11px;
        padding: 1px 7px;
        border-radius: 8px;
        background: rgba(140, 170, 255, .14);
        color: #8caaff;
        margin-right: 2px;
    }
    .th-project-state.onhold {
        background: rgba(232, 184, 79, .16);
        color: #e8b84f;
    }
    /* 重复任务标签：灰色线条图标 + 文本，样式与 th-project-tag 一致 */
    .th-repeat-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 11px;
        line-height: 16px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
        white-space: nowrap;
        flex-shrink: 0;
    }
    .th-repeat-badge svg {
        flex-shrink: 0;
    }
    .th-project-tag {
        display: inline-block;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 11px;
        line-height: 16px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
    }

    /* ── 布局: 左侧打卡 / 右侧任务管理 ── */
    .th-layout {
        display: flex;
        align-items: flex-start;
        gap: 0;
    }
    .th-left {
        flex: 0 0 340px;
        min-width: 320px;
    }
    .th-divider {
        width: 1px;
        align-self: stretch;
        background: var(--main-border-color, #313244);
        margin: 0 24px;
    }
    .th-right {
        flex: 1;
        min-width: 0;
    }
    @media (max-width: 900px) {
        .th-layout { flex-direction: column; }
        .th-divider { display: none; }
        .th-left { flex: none; width: 100%; }
    }

    /* ── 打卡卡片 ── */
    .th-dk-card {
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 10px; /* 打卡卡片之间的间隔 */
    }
    .th-dk-card:hover {
        border-color: var(--main-border-color);
    }
    .th-dk-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
    }
    .th-dk-title {
        flex: 1;
        min-width: 0;
        font-weight: 600;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color .15s;
    }
    .th-dk-title:hover {
        color: var(--link-color, var(--main-text-color));
        text-decoration: underline;
    }
    .th-dk-week-label {
        flex-shrink: 0;
        font-size: 13px;
        color: var(--muted-text-color, #888);
    }
    .th-dk-progress {
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 700;
    }
    .th-dk-progress.done {
        color: #a6e3a1;
    }
    /* 一周 7 日格子：grid 等宽，周几灰字写在格子里 */
    .th-dk-week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
    }
    .th-dk-day {
        min-width: 0;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        cursor: pointer;
        transition: all .15s;
        box-shadow: inset 0 0 0 1px var(--main-border-color, #313244);
    }
    /* 每天多次打卡（#habit:N:M）：当前格子渲染与单次打卡完全一致（仅多一层内联渐变进度背景），
       不设额外布局规则，高度统一 18px；将来若在格子里竖排 星期+进度条+次数 再恢复布局 */
    .th-dk-day.partial {
        box-shadow: inset 0 0 0 1px rgba(166, 227, 161, .4);
    }
    .th-dk-day:hover {
        box-shadow: inset 0 0 0 1px var(--main-text-color);
    }
    .th-dk-day .th-dk-dow {
        font-size: 10px;
        line-height: 1;
        color: var(--muted-text-color, #888);
    }
    .th-dk-day.today {
        box-shadow: inset 0 0 0 1px var(--link-color, #89b4fa), 0 0 0 1px var(--link-color, #89b4fa);
    }
    .th-dk-day.done {
        background: #E9F8E7;
        box-shadow: inset 0 0 0 1px rgba(166, 227, 161, .6);
    }
    .th-dk-day.done .th-dk-dow {
        color: transparent;
    }
    .th-dk-day.working {
        opacity: .45;
        pointer-events: none;
    }
    /* 历史周记录 */
    .th-dk-history {
        margin-top: 6px;
        border-top: 1px dashed var(--main-border-color, #313244);
        padding-top: 4px;
    }
    .th-dk-hist-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--muted-text-color, #888);
    }
    .th-dk-hist-week {
        color: var(--main-text-color);
        font-weight: 600;
        min-width: 52px;
    }
    .th-dk-hist-range {
        font-size: 12px;
        color: var(--muted-text-color, #888);
        font-variant-numeric: tabular-nums;
    }
    .th-dk-hist-progress {
        margin-left: auto;
        font-variant-numeric: tabular-nums;
    }

    /* ── 间隔计时提醒（#timer:N:M） ── */
    .th-tx-card {
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 10px;
        padding: 10px 12px;
        margin-bottom: 10px;
    }
    .th-tx-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }
    .th-tx-title {
        flex: 1;
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }
    .th-tx-title:hover {
        text-decoration: underline;
    }
    .th-tx-phase {
        flex-shrink: 0;
        font-size: 11px;
        padding: 1px 8px;
        border-radius: 8px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
    }
    .th-tx-phase.work {
        color: #e8b84f;
        background: rgba(232, 184, 79, .14);
    }
    .th-tx-phase.rest {
        color: #8caaff;
        background: rgba(140, 170, 255, .14);
    }
    .th-tx-phase.restWait {
        color: #a6e3a1;
        background: rgba(166, 227, 161, .14);
    }
    .th-tx-time {
        font-size: 28px;
        font-weight: 700;
        text-align: center;
        line-height: 1.2;
        margin: 2px 0 6px;
        font-variant-numeric: tabular-nums;
    }
    .th-tx-bar {
        height: 4px;
        border-radius: 2px;
        background: var(--accented-background-color, #313244);
        overflow: hidden;
        margin-bottom: 8px;
    }
    .th-tx-bar-fill {
        height: 100%;
        border-radius: 2px;
        background: #a6e3a1;
        transition: width .3s linear;
    }
    .th-tx-btns {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .th-tx-btn {
        flex: 1;
        max-width: 110px;
        padding: 5px 0;
        border: 1px solid var(--main-border-color, #45475a);
        border-radius: 6px;
        background: transparent;
        color: var(--main-text-color, #cdd6f4);
        font-size: 13px;
        cursor: pointer;
        transition: background .15s;
    }
    .th-tx-btn:hover {
        background: var(--accented-background-color, #313244);
    }
    .th-tx-btn.primary {
        border-color: rgba(166, 227, 161, .5);
        color: #a6e3a1;
    }
    .th-tx-btn.primary:hover {
        background: rgba(166, 227, 161, .12);
    }
    .th-tx-meta {
        flex: 1;
        font-size: 11px;
        color: var(--muted-text-color, #888);
        text-align: right;
        white-space: nowrap;
    }

    /* ============================================================
       设置弹窗 & 齿轮按钮
       ============================================================ */
    .th-shell {
        position: relative;
        min-height: 50px;
    }
    .th-gear {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 34px;
        height: 34px;
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 8px;
        background: var(--accented-background-color, #313244);
        color: var(--muted-text-color, #888);
        font-size: 17px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color .15s, border-color .15s, background .15s, opacity .15s;
        opacity: .45;
        z-index: 5;
    }
    .th-gear:hover {
        opacity: 1;
        color: var(--main-text-color, #cdd6f4);
        border-color: var(--main-text-color, #cdd6f4);
        background: var(--accented-background-color, #313244);
    }
    .th-disabled {
        padding: 40px 0;
        text-align: center;
        color: var(--muted-text-color, #888);
    }
    .th-disabled .th-btn {
        margin-top: 12px;
    }

    /* 模态遮罩 */
    .th-modal-mask {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, .45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    .th-modal {
        width: min(680px, 92vw);
        height: min(70vh, 620px); /* 固定高度：切 Tab 时窗口不跳动 */
        display: flex;
        flex-direction: column;
        background: var(--main-background-color, #1e1e2e);
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 12px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, .45);
        overflow: hidden;
    }
    .th-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid var(--main-border-color, #313244);
    }
    .th-modal-title {
        font-size: 16px;
        font-weight: 700;
    }
    .th-modal-close {
        border: none;
        background: none;
        color: var(--muted-text-color, #888);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        transition: color .15s, background .15s;
    }
    .th-modal-close:hover {
        color: var(--main-text-color, #cdd6f4);
        background: var(--accented-background-color, #313244);
    }
    .th-modal-tabs {
        display: flex;
        gap: 4px;
        padding: 10px 14px 0;
        border-bottom: 1px solid var(--main-border-color, #313244);
        flex-wrap: wrap;
    }
    .th-modal-tab {
        padding: 7px 14px;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        font-size: 13px;
        color: var(--muted-text-color, #888);
        border: 1px solid transparent;
        border-bottom: none;
        transition: color .15s, background .15s;
        user-select: none;
    }
    .th-modal-tab:hover {
        color: var(--main-text-color, #cdd6f4);
    }
    .th-modal-tab.active {
        color: var(--main-text-color, #cdd6f4);
        background: var(--accented-background-color, #313244);
        border-color: var(--main-border-color, #313244);
    }
    .th-modal-body {
        flex: 1;
        min-height: 0;
        padding: 14px 18px;
        overflow-y: auto;
    }
    .th-modal-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 18px;
        border-top: 1px solid var(--main-border-color, #313244);
    }

    /* 全屏提醒（到点覆盖整个页面，点击任意处关闭） */
    .th-fullscreen-alert {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        z-index: 2147483647 !important;
        background: rgba(0, 0, 0, .65) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        animation: th-alert-in .2s ease;
    }
    .th-fullscreen-alert-box {
        background: var(--main-background-color, #1e1e2e);
        border: 1px solid var(--main-border-color, #313244);
        border-radius: 16px;
        padding: 36px 48px;
        max-width: min(520px, 88vw);
        text-align: center;
        box-shadow: 0 18px 60px rgba(0, 0, 0, .5);
    }
    .th-fullscreen-alert-icon {
        font-size: 52px;
        margin-bottom: 14px;
    }
    .th-fullscreen-alert-text {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 22px;
        color: var(--main-text-color, #cdd6f4);
        line-height: 1.5;
    }
    .th-fullscreen-alert .th-btn {
        font-size: 15px;
    }
    @keyframes th-alert-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* 轻提示 toast（挂到 body，跨 tab 可见） */
    .th-toast {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 19000;
        max-width: 320px;
        padding: 12px 18px;
        background: rgba(24, 26, 32, .92);
        color: #fff;
        font-size: 13px;
        line-height: 1.5;
        border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, .35);
        cursor: pointer;
        animation: th-toast-in .25s ease-out;
    }
    @keyframes th-toast-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* 提醒方式复选框组 */
    .th-set-checks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
    }
    .th-set-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--main-text-color, #cdd6f4);
        cursor: pointer;
        user-select: none;
    }
    .th-set-check input {
        width: 15px;
        height: 15px;
        accent-color: var(--accent-color, #89b4fa);
        cursor: pointer;
    }

    /* 设置行 */
    .th-set-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px dashed var(--main-border-color, #313244);
    }
    .th-set-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .th-set-label {
        font-size: 14px;
        font-weight: 600;
    }
    .th-set-desc {
        font-size: 12px;
        color: var(--muted-text-color, #888);
    }

    /* 开关 */
    .th-switch {
        appearance: none;
        -webkit-appearance: none;
        width: 42px;
        height: 22px;
        border-radius: 11px;
        background: var(--accented-background-color, #313244);
        position: relative;
        cursor: pointer;
        transition: background .15s;
        flex-shrink: 0;
        margin: 0;
        border: 1px solid var(--main-border-color, #45475a);
    }
    .th-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--muted-text-color, #888);
        transition: left .15s, background .15s;
    }
    .th-switch:checked {
        background: rgba(166, 227, 161, .3);
        border-color: rgba(166, 227, 161, .6);
    }
    .th-switch:checked::after {
        left: 22px;
        background: #a6e3a1;
    }

    /* 输入框 */
    .th-set-input {
        width: 240px;
        max-width: 55%;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid var(--main-border-color, #45475a);
        background: transparent;
        color: var(--main-text-color, #cdd6f4);
        font-size: 13px;
        outline: none;
        transition: border-color .15s;
    }
    .th-set-input:focus {
        border-color: var(--link-color, #89b4fa);
    }
    .th-set-num {
        width: 90px;
    }
    .th-set-radios {
        display: flex;
        gap: 14px;
        flex-shrink: 0;
    }
    .th-set-radio {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 14px;
        white-space: nowrap;
    }
    .th-set-radio input {
        accent-color: #89b4fa;
        cursor: pointer;
    }

    /* 帮助区 */
    .th-set-help {
        margin-top: 16px;
        padding: 12px 14px;
        border: 1px dashed var(--main-border-color, #313244);
        border-radius: 8px;
        background: rgba(137, 180, 250, .05);
    }
    .th-set-help-title {
        font-size: 12px;
        font-weight: 700;
        color: var(--link-color, #89b4fa);
        margin-bottom: 8px;
    }
    .th-help-row {
        display: flex;
        gap: 10px;
        align-items: baseline;
        padding: 3px 0;
        font-size: 13px;
        line-height: 1.5;
    }
    .th-help-row code {
        color: #f38ba8;
        background: rgba(243, 139, 168, .1);
        padding: 0 5px;
        border-radius: 4px;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .th-help-row span {
        color: var(--muted-text-color, #888);
    }

    /* 按钮 */
    .th-btn {
        padding: 7px 18px;
        border-radius: 6px;
        border: 1px solid var(--main-border-color, #45475a);
        background: transparent;
        color: var(--main-text-color, #cdd6f4);
        font-size: 13px;
        cursor: pointer;
        transition: background .15s, border-color .15s;
    }
    .th-btn:hover {
        background: var(--accented-background-color, #313244);
    }
    .th-btn.primary {
        border-color: rgba(166, 227, 161, .5);
        color: #a6e3a1;
    }
    .th-btn.primary:hover {
        background: rgba(166, 227, 161, .12);
    }
    .th-btn.danger {
        border-color: rgba(230, 69, 83, .5);
        color: #e64553;
    }
    .th-btn.danger:hover {
        background: rgba(230, 69, 83, .12);
    }
    .th-link {
        color: var(--link-color, #89b4fa);
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap;
    }
    .th-link:hover {
        text-decoration: underline;
    }
`;

// 注入到 <head>（带 id 保护，避免重复注入）
export function injectStyles() {
    if (!document.getElementById('th-task-styles')) {
        const style = document.createElement('style');
        style.id = 'th-task-styles';
        style.textContent = TASK_STYLES;
        document.head.appendChild(style);
    }
}
