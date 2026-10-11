// CookieはAccountsのホスト内に保ち、表示用のプロフィールだけを受け取る。
const accountOrigin = document.querySelector(
  'meta[name="lumorphia-accounts-origin"]',
)?.content;
const toggle = document.querySelector("#account-menu-toggle");
const menu = document.querySelector("#account-menu");
const wrapper = document.querySelector("#account-user");
function closeAccountMenu() {
  if (menu) menu.hidden = true;
  toggle?.setAttribute("aria-expanded", "false");
}
toggle?.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  toggle.setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("pointerdown", (event) => {
  if (!wrapper?.contains(event.target)) closeAccountMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu && !menu.hidden) {
    closeAccountMenu();
    toggle?.focus();
  }
});
async function refreshAccount() {
  if (!accountOrigin || !wrapper) return;
  try {
    const response = await fetch(`${accountOrigin}/api/website/session`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Session unavailable");
    const { user } = await response.json();
    wrapper.hidden = !user;
    document.querySelector("#account-login").hidden = !!user;
    closeAccountMenu();
    if (!user) return;
    document.querySelector("#account-name").textContent = user.name;
    document.querySelector("#menu-name").textContent = user.name;
    document.querySelector("#menu-handle").textContent = `@${user.handle}`;
    const avatar = document.querySelector("#account-avatar");
    avatar.textContent = Array.from(user.name)[0]?.toUpperCase() ?? "";
    if (
      user.image &&
      new URL(user.image, accountOrigin).protocol === "https:"
    ) {
      const image = document.createElement("img");
      image.src = user.image;
      image.alt = "";
      image.addEventListener("error", () => {
        avatar.textContent = Array.from(user.name)[0]?.toUpperCase() ?? "";
      });
      avatar.replaceChildren(image);
    }
  } catch {
    // Accountsが利用できないときも、通常のログインリンクを使えるようにする。
    wrapper.hidden = true;
    document.querySelector("#account-login").hidden = false;
    closeAccountMenu();
  }
}
window.addEventListener("pageshow", () => void refreshAccount());
window.addEventListener("focus", () => void refreshAccount());
