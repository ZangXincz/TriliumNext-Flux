# TriliumNext Flux v1.2.0

## 新增 · #priority 固定排序

任务、习惯打卡、间隔提醒的卡片顺序现在可以**固定**：

- 在任务文本中写 `#priority:N`（N=1~10，**越小越靠前**），支持四种写法：

  `#priority:1` / `#priority1` / `#p:1` / `#p1`

- 排序规则：**先按日期**，同日期再按优先级；不写 `#priority` 的任务排最后，保持原有顺序
- 习惯打卡：打卡后数据重载不再打乱顺序，卡片始终按 `#priority` 固定排列（核心场景）
- 任务行上的优先级以**数字徽标**显示，样式与日期标签一致、紧贴日期左侧；打卡与提醒卡片**不显示**徽标，仅参与排序
- `#` 快速录入新增 `priority` 候选：输入 `priority` 弹出常用档（1/2/3/5/7/10），输入 `priority:N` 精确补全任意 1-10
- 帮助面板补充 `#priority` 用法说明（并区分项目笔记属性 `#priority=P1` 与任务标签 `#priority:1`）

## 其他

- 任务排序规则调整：日期优先，同日期内按优先级排序

---

# TriliumNext Flux v1.2.0 (English)

## New · #priority fixed sort

Card order for tasks, weekly check-ins and interval timers can now be **pinned**:

- Write `#priority:N` in the task text (N=1~10, **lower = first**). Four syntaxes supported:

  `#priority:1` / `#priority1` / `#p:1` / `#p1`

- Sort rule: **date first**, then priority within the same date; tasks without `#priority` go last, keeping their original order
- Weekly check-ins: reloading after a check-in no longer shuffles the cards — order stays fixed via `#priority`
- Task rows show the priority as a **numeric badge** styled like the date tag, right before it; check-in and timer cards **don't show** the badge (sort only)
- Quick insert (#) adds `priority` candidates: type `priority` for common levels (1/2/3/5/7/10), or `priority:N` to complete any 1-10
- Help panel documents `#priority` (and clarifies the difference from the project attribute `#priority=P1`)

## Other changes

- Task sorting now prefers the date; priority only applies within the same date
