// ============================================================
//  txLogic — 间隔计时提醒（#timer:N:M）纯逻辑 + 声音
//  无后端依赖、无模块级状态；计时状态由 main.jsx 统一管理，
//  通过 backendBridge.saveTxState 持久化到配置笔记 txState 字段。
//  作为 render bundle 的子模块，入口用标题「txLogic」引用：
//      const { beep, freshState } = txLogic;
// ============================================================

// 全新计时状态
// phase: idle(待开始) → work(进行中) → restWait(进行结束待休息) → rest(休息中) → idle
export function freshState() {
    return { phase: 'idle', endTime: null, totalMs: 0 };
}

// 阶段中文名（供 UI 徽标）
export function phaseLabel(phase) {
    switch (phase) {
        case 'work': return '进行中';
        case 'rest': return '休息中';
        case 'restWait': return '待休息';
        default: return '待开始';
    }
}

// 声音提醒：Web Audio 生成短促蜂鸣（无需外部音频文件）
export function beep(times = 3) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const t0 = ctx.currentTime + 0.05;
        for (let i = 0; i < times; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            const st = t0 + i * 0.4;
            gain.gain.setValueAtTime(0.25, st);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.32);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.34);
        }
        setTimeout(() => { try { ctx.close(); } catch (e) { /* noop */ } }, times * 400 + 600);
    } catch (e) {
        console.warn('[th] 声音播放失败', e);
    }
}
