const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.add("js");

if (reduceMotion) document.documentElement.classList.add("motion-reduced");

const current = new URL(window.location.href).pathname.split("/").pop() || "index.html";

document.querySelectorAll("[data-nav-page]").forEach((link) => {
  const routeAliases = link.dataset.navPage.split(/\s+/);

  if (routeAliases.includes(current)) {
    link.setAttribute("aria-current", "page");
    link.querySelector(".status-dot")?.removeAttribute("hidden");
  }
});

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, instance) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      entry.target.classList.add("is-visible");
      instance.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
}
