export function render(gleam_list) {
  const app = document.getElementById("app");
  if (!app) return;

  // Convert Gleam list to JS array
  const nodes = [];
  let curr = gleam_list;
  while (curr && curr.head !== undefined) {
    nodes.push(curr.head);
    curr = curr.tail;
  }

  const n = nodes.length;

  // Colour per domain
  const colours = {
    software: [59, 130, 246],
    architecture: [248, 113, 113],
    philosophy: [192, 132, 252],
  };

  // Initial positions: spread in a sphere
  nodes.forEach((node, i) => {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 200 + Math.random() * 50;
    node.x = r * Math.sin(theta) * Math.cos(phi);
    node.y = r * Math.sin(theta) * Math.sin(phi);
    node.z = r * Math.cos(theta);
    node.vx = 0;
    node.vy = 0;
    node.vz = 0;
    const c = colours[node.domain] || [148, 163, 184];
    node.r = c[0];
    node.g = c[1];
    node.b = c[2];
  });

  // Setup canvas
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  app.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  function resize() {
    const w = app.clientWidth;
    const h = app.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    return { w, h };
  }
  let { w, h } = resize();
  window.addEventListener("resize", () => { ({ w, h } = resize()); });

  const ctx = canvas.getContext("2d");

  // Camera / interaction
  let rx = 0.3, ry = 0;
  let target_rx = 0.3, target_ry = 0;
  let auto_rotate = true;
  let mouse_down = false;
  let last_mx = 0, last_my = 0;

  canvas.addEventListener("mousedown", (e) => {
    mouse_down = true;
    auto_rotate = false;
    last_mx = e.clientX;
    last_my = e.clientY;
  });
  window.addEventListener("mouseup", () => { mouse_down = false; });
  window.addEventListener("mousemove", (e) => {
    if (!mouse_down) return;
    target_ry += (e.clientX - last_mx) * 0.005;
    target_rx += (e.clientY - last_my) * 0.005;
    last_mx = e.clientX;
    last_my = e.clientY;
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoom += e.deltaY * -0.001;
    zoom = Math.max(0.3, Math.min(zoom, 4));
  }, { passive: false });
  let zoom = 1;

  // Physics simulation state
  let time = 0;
  const rel_types = ["influence", "opposes", "implements", "analogy", "relates", "belongs_to"];

  // Create simple random links if no explicit relations passed;
  // fallback: connect adjacent list items within same domain
  let links = [];
  const by_domain = {};
  nodes.forEach(n => {
    by_domain[n.domain] = by_domain[n.domain] || [];
    by_domain[n.domain].push(n);
  });
  Object.values(by_domain).forEach(group => {
    for (let i = 0; i < group.length - 1; i++) {
      links.push({ a: group[i], b: group[i + 1], strength: 0.02 });
    }
  });

  function tick() {
    time += 0.016;

    // Amoeba breathing parameters
    const pulse = Math.sin(time * 0.7);
    const expansion = 1 + pulse * 0.15;
    const link_base = 90 * expansion;
    const repulsion = 8000 * expansion;
    const attraction = 0.003 * expansion;
    const rotation_speed = 0.002 + Math.sin(time * 0.3) * 0.001;

    // Apply forces
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      a.fx = 0; a.fy = 0; a.fz = 0;

      // Repulsion between all pairs
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dz = a.z - b.z;
        let dist_sq = dx*dx + dy*dy + dz*dz;
        if (dist_sq < 1) dist_sq = 1;
        const f = repulsion / dist_sq;
        const d = Math.sqrt(dist_sq);
        dx /= d; dy /= d; dz /= d;
        a.fx += dx * f; a.fy += dy * f; a.fz += dz * f;
        b.fx -= dx * f; b.fy -= dy * f; b.fz -= dz * f;
      }

      // Domain attraction toward cluster centre
      const cx = a.domain === "software" ? -220 : a.domain === "architecture" ? 0 : 220;
      a.fx += (cx - a.x) * attraction;
      a.fy += (0 - a.y) * attraction * 0.5;
      a.fz += (0 - a.z) * attraction * 0.5;

      // Gentle orbit around Y axis (self-rotation)
      const ox = -a.z * rotation_speed;
      const oz = a.x * rotation_speed;
      a.fx += ox;
      a.fz += oz;

      // Damping
      a.vx = (a.vx + a.fx) * 0.92;
      a.vy = (a.vy + a.fy) * 0.92;
      a.vz = (a.vz + a.fz) * 0.92;

      // Integration
      a.x += a.vx;
      a.y += a.vy;
      a.z += a.vz;
    }

    // Spring links
    links.forEach(l => {
      const a = l.a, b = l.b;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dz = b.z - a.z;
      const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
      const f = (d - link_base) * l.strength;
      dx /= d; dy /= d; dz /= d;
      a.vx += dx * f;
      a.vy += dy * f;
      a.vz += dz * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
      b.vz -= dz * f;
    });
  }

  function project(x, y, z) {
    // Smooth camera transition
    rx += (target_rx - rx) * 0.05;
    ry += (target_ry - ry) * 0.05;

    // Rotate around X then Y
    let cy = Math.cos(rx), sy = Math.sin(rx);
    let y1 = y * cy - z * sy;
    let z1 = y * sy + z * cy;

    let cx = Math.cos(ry), sx = Math.sin(ry);
    let x2 = x * cx + z1 * sx;
    let z2 = -x * sx + z1 * cx;

    // Perspective projection
    const fov = 600 * zoom;
    const scale = fov / (fov + z2);
    return {
      x: w/2 + x2 * scale,
      y: h/2 + y1 * scale,
      scale: scale,
      z: z2,
    };
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    tick();

    const projected = nodes.map(n => ({ node: n, p: project(n.x, n.y, n.z) }));
    projected.sort((a, b) => b.p.z - a.p.z);

    // Draw links first (behind nodes)
    ctx.lineWidth = 0.5;
    links.forEach(l => {
      const pa = projected.find(pp => pp.node === l.a);
      const pb = projected.find(pp => pp.node === l.b);
      if (!pa || !pb || pa.p.z < -400 || pb.p.z < -400) return;
      const alpha = (1 - Math.max(pa.p.z, pb.p.z) / 600) * 0.2;
      ctx.strokeStyle = `rgba(${l.a.r}, ${l.a.g}, ${l.a.b}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(pa.p.x, pa.p.y);
      ctx.lineTo(pb.p.x, pb.p.y);
      ctx.stroke();
    });

    // Draw nodes
    projected.forEach(pp => {
      const pr = pp.p;
      if (pr.z < -500) return;
      const alpha = Math.max(0, Math.min(1, 1 - pr.z / 500));
      const s = Math.max(2, 8 * pr.scale);

      // Glow
      const glow = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, s * 3);
      glow.addColorStop(0, `rgba(${pp.node.r}, ${pp.node.g}, ${pp.node.b}, ${alpha * 0.25})`);
      glow.addColorStop(1, `rgba(${pp.node.r}, ${pp.node.g}, ${pp.node.b}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, s * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = `rgba(${pp.node.r}, ${pp.node.g}, ${pp.node.b}, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, s, 0, Math.PI * 2);
      ctx.fill();

      // Label for foreground nodes
      if (pr.scale > 0.7 && alpha > 0.5) {
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.85})`;
        ctx.font = `${Math.max(9, 11 * pr.scale)}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
        ctx.fillText(pp.node.name_ja, pr.x + s + 4, pr.y + 3);
      }
    });

    if (auto_rotate) {
      target_ry += 0.003;
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

export function logError(msg) {
  console.error(msg);
}
