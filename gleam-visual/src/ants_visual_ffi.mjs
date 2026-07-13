export function render(concepts) {
  const app = document.getElementById("app");
  if (!app) return;

  // Convert Gleam list (linked cons cells) to JS array
  const arr = [];
  let curr = concepts;
  while (curr && curr.head !== undefined) {
    arr.push(curr.head);
    curr = curr.tail;
  }

  const ns = "http://www.w3.org/2000/svg";
  const xlink = "http://www.w3.org/1999/xlink";
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

  arr.forEach((c, i) => {
    const baseX = bases[c.domain] ?? 600;
    const x = baseX + Math.sin(i * 1.37) * 160;
    const y = 80 + c.layer * 110 + Math.cos(i * 0.93) * 80;

    const g = document.createElementNS(ns, "g");
    g.style.cursor = "pointer";

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 6);
    circle.setAttribute("fill", colors[c.domain] ?? "#94a3b8");
    circle.setAttribute("opacity", "0.85");
    g.appendChild(circle);

    const link = document.createElementNS(ns, "a");
    const q = encodeURIComponent(c.name_ja + " " + c.domain);
    link.setAttributeNS(xlink, "xlink:href", "https://www.google.com/search?q=" + q);
    link.setAttribute("target", "_blank");

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", x + 10);
    text.setAttribute("y", y + 3);
    text.setAttribute("fill", "#e2e8f0");
    text.setAttribute("font-size", "10");
    text.textContent = c.name_ja;
    link.appendChild(text);
    g.appendChild(link);

    const title = document.createElementNS(ns, "title");
    title.textContent = c.name_en + "\n" + c.description;
    g.appendChild(title);

    svg.appendChild(g);
  });

  app.appendChild(svg);
}

export function logError(msg) {
  console.error(msg);
}
