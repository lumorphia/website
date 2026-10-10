// 選んだテーマをこの端末で記憶する。外部には送信しない。
const themeButton = document.querySelector(".theme");
function syncThemeButton() {
  if (!themeButton) return;
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute(
    "aria-label",
    dark ? "ライト表示に切り替える" : "ダーク表示に切り替える",
  );
}
themeButton?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeSelected = "true";
  try {
    window.localStorage.setItem("lumorphia-theme", dark ? "dark" : "light");
  } catch {
    // 保存できない場合は、現在のページ内だけで切り替える。
  }
  syncThemeButton();
});
window.addEventListener("lumorphia-theme-change", syncThemeButton);
syncThemeButton();
