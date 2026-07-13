export function render(gleam_list) {
  // ---- convert Gleam list to JS array ----
  const nodes = [];
  let curr = gleam_list;
  while (curr && curr.head !== undefined) {
    nodes.push(curr.head);
    curr = curr.tail;
  }

  const n = nodes.length;
  const DOMAINS = ["software", "architecture", "philosophy"];
  const PALETTE = {
    software:       [14,  165, 233], // cyan-500
    architecture:   [244, 63,  94],  // rose-500
    philosophy:     [168, 85,  247], // purple-500
    cross_sa:       [6,   182, 212], // cyan-400  (soft-arch)
    cross_ap:       [217, 70,  239], // fuchsia-500 (arch-philo)
    cross_sp:       [99,  102, 241], // indigo-500  (soft-philo)
    cross_all:      [250, 204, 21],  // yellow-400  (all three)
  };

  // ---- state initialisation: scattered ----
  nodes.forEach((node, i) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 300 + Math.random() * 400;
    node.x = r * Math.sin(phi) * Math.cos(theta);
    node.y = r * Math.sin(phi) * Math.sin(theta);
    node.z = r * Math.cos(phi);
    node.vx = 0; node.vy = 0; node.vz = 0;
    const c = PALETTE[node.domain] || [148,163,184];
    node.r = c[0]; node.g = c[1]; node.b = c[2];
    // emergent properties
    node.energy = 0.2 + Math.random() * 0.3;      // 0..1
    node.phase = Math.random() * Math.PI * 2;      // for breathing pulse
    node.state = "quiescent";                     // quiescent | active | supercritical
    node.age = 0;
    node.mass = 1;
  });

  // ---- emergent edges (not fixed; born & die dynamically) ----
  let edges = []; // { a, b, strength, born, type }
  let flashes = []; // { x, y, z, life, color }
  let spawns = [];  // newly birthed hybrid nodes
  let logLines = [];

  function edgeType(a, b) {
    const ds = [a.domain, b.domain].sort();
    if (ds[0] === ds[1]) return "affinity";
    if (ds[0] === "architecture" && ds[1] === "philosophy") return "overlay";
    if (ds[0] === "software"     && ds[1] === "architecture") return "fusion";
    if (ds[0] === "philosophy"   && ds[1] === "software") return "appropriation";
    return "mix";
  }

  function edgeColor(type) {
    switch(type) {
      case "affinity":       return PALETTE.software;      // same colour as domain; overridden per node
      case "fusion":         return PALETTE.cross_sa;
      case "overlay":        return PALETTE.cross_ap;
      case "appropriation":  return PALETTE.cross_sp;
      default:               return PALETTE.cross_all;
    }
  }

  // ---- canvas setup ----
  const app = document.getElementById("app");
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  app.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  let W, H;
  function resize() {
    W = app.clientWidth;
    H = app.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  resize();
  window.addEventListener("resize", resize);
  const ctx = canvas.getContext("2d");

  // ---- camera / interaction ----
  let rx = 0.2, ry = 0, zoom = 0.9;
  let t_rx = 0.2, t_ry = 0;
  let dragging = false, last_x = 0, last_y = 0;
  let auto_rot = true;
  canvas.addEventListener("mousedown", e => { dragging = true; auto_rot = false; last_x = e.clientX; last_y = e.clientY; });
  window.addEventListener("mouseup", () => dragging = false);
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    t_ry += (e.clientX - last_x) * 0.005;
    t_rx += (e.clientY - last_y) * 0.005;
    last_x = e.clientX; last_y = e.clientY;
  });
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoom += e.deltaY * -0.001; zoom = Math.max(0.2, Math.min(zoom, 4)); }, { passive: false });

  // ---- UI overlay ----
  const overlay = document.createElement("div");
  overlay.innerHTML = `
    <div style="position:fixed;top:10px;left:10px;z-index:20;font-size:11px;color:rgba(226,232,240,0.6);pointer-events:none;">
      <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">創発グラフ Emergent Graph</div>
      <div>nodes: <span id="st-nodes">0</span></div>
      <div>edges: <span id="st-edges">0</span></div>
      <div>events: <span id="st-events">0</span></div>
    </div>
    <div style="position:fixed;bottom:10px;right:10px;z-index:20;width:260px;max-height:120px;overflow-y:auto;background:rgba(2,6,23,0.7);border:1px solid rgba(148,163,184,0.2);border-radius:6px;padding:8px;font-size:10px;color:rgba(226,232,240,0.7);pointer-events:none;">
      <div style="font-weight:600;color:#e2e8f0;margin-bottom:3px;">創発ログ</div>
      <div id="log-box"></div>
    </div>
    <div style="position:fixed;bottom:10px;left:10px;z-index:20;font-size:10px;color:rgba(226,232,240,0.3);pointer-events:none;">
      drag to rotate · scroll to zoom
    </div>
  `;
  document.body.appendChild(overlay);
  const el_nodes = document.getElementById("st-nodes");
  const el_edges = document.getElementById("st-edges");
  const el_events = document.getElementById("st-events");
  const el_log = document.getElementById("log-box");
  let event_count = 0;

  function pushLog(msg) {
    logLines.unshift(msg);
    if (logLines.length > 6) logLines.pop();
    el_log.innerHTML = logLines.map(l => `<div>・${l}</div>`).join("");
    event_count++;
    el_events.textContent = event_count;
  }

  // ---- tick: physics + emergent rules ----
  let sim_time = 0;
  const EDGE_MAX_DIST = 260;   // max distance to form an edge
  const EDGE_MIN_DIST = 60;    // too close = no edge (overlap zone)
  const ACTIVATE_DIST = 180;   // nodes within this activate
  const FUSION_DIST = 90;      // extreme proximity triggers supercritical events

  function tick() {
    sim_time += 0.016;
    const pulse = Math.sin(sim_time * 0.5);

    // 1. Movement & forces
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      a.age += 0.001;

      // Brownian drift
      a.vx += (Math.random() - 0.5) * 0.4;
      a.vy += (Math.random() - 0.5) * 0.4;
      a.vz += (Math.random() - 0.5) * 0.4;

      // Global attraction to centre (keep them from flying away)
      a.vx -= a.x * 0.0003;
      a.vy -= a.y * 0.0003;
      a.vz -= a.z * 0.0003;

      // Repulsion (all pairs) - prevents collapse
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        let d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < 1) d2 = 1;
        const f = 1200 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d; dz /= d;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
        b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      }

      // Damping
      a.vx *= 0.96; a.vy *= 0.96; a.vz *= 0.96;

      // Integration
      a.x += a.vx; a.y += a.vy; a.z += a.vz;

      // Breathing phase
      a.phase += 0.02 + a.energy * 0.03;
    }

    // 2. Edge dynamics: birth, strengthen, weaken, death
    // Remove weak/old edges
    edges = edges.filter(e => {
      e.strength -= 0.003 + (1 - e.strength) * 0.002; // decay
      // Proximity boost
      const dx = e.a.x - e.b.x, dy = e.a.y - e.b.y, dz = e.a.z - e.b.z;
      const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
      if (d < ACTIVATE_DIST) {
        e.strength += 0.015;
      }
      e.strength = Math.max(0, Math.min(1, e.strength));
      return e.strength > 0.05;
    });

    // Attempt new edges
    const edge_set = new Set(edges.map(e => e.a.id + ":" + e.b.id));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i], b = nodes[j];
        const key = a.id + ":" + b.id;
        if (edge_set.has(key)) continue;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
        if (d < EDGE_MAX_DIST && d > EDGE_MIN_DIST) {
          // Chance to form edge based on domain match + noise
          let chance = 0.02;
          if (a.domain !== b.domain) chance = 0.08; // cross-domain more interesting!
          if (Math.random() < chance) {
            const type = edgeType(a, b);
            edges.push({ a, b, strength: 0.1, born: sim_time, type });
            edge_set.add(key);
            // Activation bump
            a.energy = Math.min(1, a.energy + 0.08);
            b.energy = Math.min(1, b.energy + 0.08);
            if (a.domain !== b.domain) {
              pushLog(`${a.name_ja} × ${b.name_ja} → ${type === "fusion" ? "融合" : type === "overlay" ? "重ね合わせ" : type === "appropriation" ? "略奪" : "接続"}`);
            }
          }
        }
      }
    }

    // 3. State transitions & emergent events
    nodes.forEach(node => {
      // Count active edges
      const active_edges = edges.filter(e => (e.a === node || e.b === node) && e.strength > 0.3);
      const cross_edges = active_edges.filter(e => e.type !== "affinity");

      // Energy from edges
      node.energy = Math.min(1, node.energy + active_edges.length * 0.02);
      node.energy -= 0.004; // natural decay
      node.energy = Math.max(0.05, node.energy);

      // State machine
      if (node.state === "quiescent" && node.energy > 0.5) {
        node.state = "active";
      } else if (node.state === "active" && node.energy > 0.85 && cross_edges.length >= 2) {
        node.state = "supercritical";
      } else if (node.state === "supercritical" && (node.energy < 0.6 || cross_edges.length < 1)) {
        node.state = "active";
      } else if (node.state === "active" && node.energy < 0.25) {
        node.state = "quiescent";
      }

      // Supercritical event: spawn a flash / resonance
      if (node.state === "supercritical") {
        node.energy -= 0.015;
        // Occasional flash
        if (Math.random() < 0.03) {
          flashes.push({
            x: node.x, y: node.y, z: node.z,
            life: 1.0,
            colour: [255, 255, 255],
          });
          // Pull nearby nodes stronger
          nodes.forEach(other => {
            if (other === node) return;
            const dx = other.x - node.x, dy = other.y - node.y, dz = other.z - node.z;
            const d2 = dx*dx+dy*dy+dz*dz;
            if (d2 < FUSION_DIST * FUSION_DIST) {
              const d = Math.sqrt(d2) || 1;
              const f = 0.8;
              other.vx += (dx/d) * f;
              other.vy += (dy/d) * f;
              other.vz += (dz/d) * f;
            }
          });
        }
      }
    });

    // Update flashes
    flashes = flashes.filter(f => { f.life -= 0.03; return f.life > 0; });

    // Update stats
    el_nodes.textContent = n + spawns.length;
    el_edges.textContent = edges.length;
  }

  // ---- projection ----
  function project(x, y, z) {
    rx += (t_rx - rx) * 0.04;
    ry += (t_ry - ry) * 0.04;

    // rotate X
    const cy = Math.cos(rx), sy = Math.sin(rx);
    const y1 = y * cy - z * sy;
    const z1 = y * sy + z * cy;
    // rotate Y
    const cx = Math.cos(ry), sx = Math.sin(ry);
    const x2 = x * cx + z1 * sx;
    const z2 = -x * sx + z1 * cx;
    // perspective
    const fov = 500 * zoom;
    const sc = fov / (fov + z2);
    return { x: W/2 + x2 * sc, y: H/2 + y1 * sc, scale: sc, z: z2 };
  }

  // ---- draw loop ----
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, W, H);

    tick();

    const proj = nodes.map(node => ({ node, p: project(node.x, node.y, node.z) }));
    proj.sort((a, b) => b.p.z - a.p.z);

    // Draw edges (far ones first)
    edges.forEach(e => {
      const pa = proj.find(pp => pp.node === e.a);
      const pb = proj.find(pp => pp.node === e.b);
      if (!pa || !pb) return;
      if (pa.p.z < -500 || pb.p.z < -500) return;
      const alpha = e.strength * (1 - Math.max(pa.p.z, pb.p.z) / 500) * 0.4;
      if (alpha <= 0) return;
      const c = e.type === "affinity" ? [e.a.r, e.a.g, e.a.b] : edgeColor(e.type);
      ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
      ctx.lineWidth = e.strength * 1.5;
      ctx.beginPath();
      ctx.moveTo(pa.p.x, pa.p.y);
      ctx.lineTo(pb.p.x, pb.p.y);
      ctx.stroke();

      // Midpoint pulse on strong edges
      if (e.strength > 0.7 && e.type !== "affinity") {
        const mx = (pa.p.x + pb.p.x) / 2;
        const my = (pa.p.y + pb.p.y) / 2;
        const pulse = Math.sin(sim_time * 3 + e.born) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${pulse * 0.6})`;
        ctx.beginPath();
        ctx.arc(mx, my, 2 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw nodes
    proj.forEach(pp => {
      const pr = pp.p;
      if (pr.z < -600) return;
      const alpha = Math.max(0, Math.min(1, 1 - pr.z / 600));
      const node = pp.node;
      const is_sc = node.state === "supercritical";
      const is_active = node.state === "active";

      const base_r = 3 + node.energy * 5;
      const breathe = Math.sin(node.phase) * 2;
      const s = Math.max(1.5, (base_r + breathe) * pr.scale);

      // Glow ring (supercritical = larger)
      const glow_r = is_sc ? s * 6 : is_active ? s * 4 : s * 2;
      const grad = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, glow_r);
      const ga = is_sc ? 0.35 : is_active ? 0.2 : 0.08;
      grad.addColorStop(0, `rgba(${node.r}, ${node.g}, ${node.b}, ${alpha * ga})`);
      grad.addColorStop(1, `rgba(${node.r}, ${node.g}, ${node.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, glow_r, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `rgba(${node.r}, ${node.g}, ${node.b}, ${alpha * (is_sc ? 1 : 0.85)})`;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, s, 0, Math.PI * 2);
      ctx.fill();

      // White core for supercritical
      if (is_sc) {
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label (foreground only)
      if (pr.scale > 0.65 && alpha > 0.5) {
        ctx.fillStyle = `rgba(226,232,240,${alpha * (is_active ? 0.9 : 0.5)})`;
        ctx.font = `${Math.max(9, 11 * pr.scale)}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
        ctx.fillText(node.name_ja, pr.x + s + 4, pr.y + 3);
      }
    });

    // Draw flashes
    flashes.forEach(f => {
      const p = project(f.x, f.y, f.z);
      if (p.z < -400) return;
      const r = (1 - f.life) * 40 * p.scale;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `rgba(255,255,255,${f.life * 0.6})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (auto_rot) {
      t_ry += 0.002;
      t_rx = 0.2 + Math.sin(sim_time * 0.2) * 0.1;
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

export function logError(msg) {
  console.error(msg);
}
