export function render(concepts) {
  const app = document.getElementById("app");
  if (!app) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 1200 900");

  const colors = {
    software: "#3b82f6",
    architecture: "#f87171",
    philosophy: "#c084fc",
  };
  const bases = {
    software: 220,
    architecture: 600,
    philosophy: 980,
  };

  concepts.forEach((c, i) => {
    const baseX = bases[c.domain] ?? 600;
    const x = baseX + Math.sin(i * 1.37) * 160;
    const y = 80 + c.layer * 110 + Math.cos(i * 0.93) * 80;

    const g = document.createElementNS(ns, "g");
    g.style.cursor = "default";

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 6);
    circle.setAttribute("fill", colors[c.domain] ?? "#94a3b8");
    circle.setAttribute("opacity", "0.85");
    g.appendChild(circle);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", x + 10);
    text.setAttribute("y", y + 3);
    text.setAttribute("fill", "#e2e8f0");
    text.setAttribute("font-size", "10");
    text.textContent = c.name_ja;
    g.appendChild(text);

    const title = document.createElementNS(ns, "title");
    title.textContent = `${c.name_en}\n${c.description}`;
    g.appendChild(title);

    svg.appendChild(g);
  });

  app.appendChild(svg);
}

export function logError(msg) {
  console.error(msg);
}
