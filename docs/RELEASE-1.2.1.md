# TriliumNext Flux v1.2.1

## 优化 · 快速输入弹出框（`#` 候选）

- **关闭方式**：现在支持按 **Esc** 或**点击弹窗外任意位置**关闭，不再必须点选候选项
- **弹出位置**：根据光标位置智能判断——
  - 光标下方空间足够 → 默认出现在下方
  - 光标在页面/面板最底部、下方放不下时 → 自动改弹到光标**上方**，避免弹出框下部分被遮挡
- 弹窗定位时同步收进视口，左右边缘不再溢出


---

# TriliumNext Flux v1.2.1 (English)

## Improved · Quick-insert popup (`#` candidates)

- **Dismissal**: press **Esc** or **click anywhere outside** the popup to close it — no longer necessary to pick a candidate
- **Placement**: smart up/down based on the caret position —
  - enough space below → opens below as before
  - caret near the bottom of the page/panel → opens **above** the caret so the lower part is never clipped
- The popup is also clamped into the viewport so it no longer overflows the edges

