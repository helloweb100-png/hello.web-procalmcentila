/* ==========================================================================
   PROCAM CENTLA | main.js
   - Degradación segura: si GSAP/Lenis no cargan (o el usuario prefiere menos
     movimiento) el sitio funciona completo, solo sin las animaciones avanzadas.
   - Sin listeners de scroll manuales: ScrollTrigger / IntersectionObserver.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = Boolean(window.gsap && window.ScrollTrigger);
  const lite = !hasGSAP || reduce;
  let lenis = null;

  /* ------------------------------------------------------------------ */
  /* Datos del negocio (fuente: sitio actual de Procam Centla)           */
  /* ------------------------------------------------------------------ */
  const WA = { info: '529131073535', cobros: '529131160127', soporte: '529134035510' };
  const waUrl = (line, msg) => `https://wa.me/${WA[line] || WA.info}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;

  const LOCALITIES = [
    { id: 'frontera', name: 'Frontera', short: 'Frontera', status: 'on', hub: true },
    { id: 'arroyo-polo-1', name: 'Arroyo Polo 1.ª Sección', short: 'Arroyo Polo 1.ª', status: 'on' },
    { id: 'arroyo-polo-2', name: 'Arroyo Polo 2.ª Sección', short: 'Arroyo Polo 2.ª', status: 'on' },
    { id: 'arroyo-polo-3', name: 'Arroyo Polo 3.ª Sección', short: 'Arroyo Polo 3.ª', status: 'on' },
    { id: 'el-faisan', name: 'El Faisán', short: 'El Faisán', status: 'on' },
    { id: 'la-estrella', name: 'La Estrella', short: 'La Estrella', status: 'on' },
    { id: 'nueva-esperanza', name: 'Nueva Esperanza (San Pedrito)', short: 'Nueva Esperanza', status: 'on' },
    { id: 'revolucion', name: 'Revolución', short: 'Revolución', status: 'on' },
    { id: 'san-roman', name: 'San Román', short: 'San Román', status: 'on' },
    { id: 'carrillo-centro', name: 'Carrillo Centro', short: 'Carrillo Centro', status: 'on' },
    { id: 'carrillo-norte', name: 'Carrillo Norte', short: 'Carrillo Norte', status: 'on' },
    { id: 'carrillo-sur', name: 'Carrillo Sur', short: 'Carrillo Sur', status: 'on' },
    { id: 'barra-de-san-pedro', name: 'Barra de San Pedro', short: 'Barra de San Pedro', status: 'soon' },
    { id: 'nuevo-centla', name: 'Nuevo Centla', short: 'Nuevo Centla', status: 'soon' },
  ];

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  /* ------------------------------------------------------------------ */
  /* Enlaces de WhatsApp                                                 */
  /* ------------------------------------------------------------------ */
  function initWhatsAppLinks() {
    $$('[data-wa]').forEach((a) => {
      a.href = waUrl(a.dataset.wa, a.dataset.msg);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-describedby', 'wa-note');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Estado "atendiendo ahora" (horario real, zona Centro de México)    */
  /* ------------------------------------------------------------------ */
  function isOpenNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const day = get('weekday');
    const mins = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    if (['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day)) return mins >= 480 && mins < 1020;
    if (day === 'Sat') return mins >= 480 && mins < 840;
    return false;
  }

  function initOpenStatus() {
    const nodes = $$('[data-open-status]');
    if (!nodes.length) return;
    const paint = () => {
      let open = false;
      try { open = isOpenNow(); } catch (e) { return; }
      nodes.forEach((n) => {
        n.classList.toggle('is-closed', !open);
        const label = $('[data-open-label]', n);
        if (label) label.textContent = open ? 'Atendiendo ahora' : 'Fuera de horario, te respondemos al abrir';
      });
    };
    paint();
    setInterval(paint, 60000);
  }

  /* ------------------------------------------------------------------ */
  /* Header, progreso, navegación activa y menú móvil                    */
  /* ------------------------------------------------------------------ */
  function initHeader() {
    const header = $('#header');
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);

    // Sección activa en el menú
    const links = $$('[data-nav]');
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-active'));
        const a = map.get(e.target.id);
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;
    const set = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      root.classList.toggle('menu-open', open);
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { set(false); burger.focus(); } });
    $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) set(false); });
  }

  /* Anclas con scroll suave (Lenis o nativo) */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      const offset = -((parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 68) - 1);
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.pushState(null, '', id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  function initToTop() {
    const btn = $('#toTop');
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (lenis) lenis.scrollTo(0, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Utilidades de texto: dividir en palabras con máscara                */
  /* ------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.dataset.splitDone) return $$('.sw__i', el);
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = 'sw';
            outer.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span');
            inner.className = 'sw__i';
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    // El punto de marca viaja pegado a la última palabra (no se descuelga a otra línea)
    $$('.dot', el).forEach((d) => {
      const prev = d.previousElementSibling;
      if (prev && prev.classList.contains('sw')) prev.querySelector('.sw__i').appendChild(d);
    });
    el.dataset.splitDone = '1';
    return $$('.sw__i', el);
  }

  /* ------------------------------------------------------------------ */
  /* Red de partículas del hero (canvas)                                 */
  /* ------------------------------------------------------------------ */
  function initNetwork() {
    const canvas = $('#net');
    if (!canvas) return;
    const host = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1, nodes = [], pulses = [], raf = 0, last = 0, spawn = 0, visible = true;
    const mouse = { x: -9999, y: -9999 };
    let LINK = 130;

    const resize = () => {
      const r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      LINK = clamp(w * 0.115, 100, 150);
      const count = clamp(Math.round((w * h) / 17500), 24, 86);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: 1.1 + Math.random() * 1.9,
      }));
      pulses = [];
      if (reduce) draw(0);
    };

    const neighbors = (i) => {
      const a = nodes[i]; const out = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = a.x - nodes[j].x, dy = a.y - nodes[j].y;
        if (dx * dx + dy * dy < LINK * LINK) out.push(j);
      }
      return out;
    };

    const spawnPulse = () => {
      if (pulses.length > 9) return;
      const i = Math.floor(Math.random() * nodes.length);
      const n = neighbors(i);
      if (!n.length) return;
      pulses.push({ a: i, b: n[Math.floor(Math.random() * n.length)], t: 0, dur: 0.7 + Math.random() * 0.7, hops: 2 + Math.floor(Math.random() * 4) });
    };

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx * dt * 60; n.y += n.vy * dt * 60;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
        const mx = n.x - mouse.x, my = n.y - mouse.y, md = mx * mx + my * my;
        if (md < 150 * 150 && md > 1) { const f = (1 - Math.sqrt(md) / 150) * 0.6; n.x += (mx / Math.sqrt(md)) * f; n.y += (my / Math.sqrt(md)) * f; }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(28,63,217,${(1 - Math.sqrt(d2) / LINK) * 0.2})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 170) {
          ctx.strokeStyle = `rgba(79,123,255,${(1 - md / 170) * 0.5})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = 'rgba(28,63,217,.5)';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      // Paquetes de datos viajando por la red
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += dt / p.dur;
        const a = nodes[p.a], b = nodes[p.b];
        const e = p.t < 0.5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
        const x = lerp(a.x, b.x, Math.min(e, 1)), y = lerp(a.y, b.y, Math.min(e, 1));
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        g.addColorStop(0, 'rgba(79,123,255,.85)'); g.addColorStop(1, 'rgba(79,123,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
        if (p.t >= 1) {
          if (p.hops > 0) {
            const n = neighbors(p.b).filter((j) => j !== p.a);
            if (n.length) { pulses[k] = { a: p.b, b: n[Math.floor(Math.random() * n.length)], t: 0, dur: 0.6 + Math.random() * 0.6, hops: p.hops - 1 }; continue; }
          }
          pulses.splice(k, 1);
        }
      }
    }

    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((ts - last) / 1000 || 0.016, 0.05);
      last = ts;
      spawn -= dt;
      if (spawn <= 0) { spawnPulse(); spawn = 0.28 + Math.random() * 0.4; }
      draw(dt);
    };
    const start = () => { if (!raf && visible && !document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    let lw = 0, lh = 0;
    resize();
    lw = w; lh = h;
    new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (Math.abs(r.width - lw) < 2 && Math.abs(r.height - lh) < 140) return;
      resize(); lw = w; lh = h;
    }).observe(host);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(host);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (finePointer) {
      host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
      host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    }
    start();
  }

  /* ------------------------------------------------------------------ */
  /* Asistente de plan                                                   */
  /* ------------------------------------------------------------------ */
  function initPlans() {
    const finder = $('#finder');
    if (!finder) return;
    const range = $('#devices');
    const out = $('#devicesOut');
    const planEl = $('#finderPlan');
    const whyEl = $('#finderWhy');
    const cta = $('#finderCta');
    const PLANS = [40, 80, 120, 200];
    const WHY = {
      40: 'Ideal para navegar, usar redes y resolver tus pendientes en línea.',
      80: 'Perfecto para streaming y varios dispositivos conectados a la vez.',
      120: 'Pensado para hogares conectados y para trabajar desde casa sin interrupciones.',
      200: 'Máxima velocidad simétrica para negocios, juegos y uso intensivo.',
    };
    let current = 0;
    const counter = { v: 40 };

    const update = () => {
      const base = Number($('input[name="uso"]:checked', finder).value);
      const devices = Number(range.value);
      out.textContent = devices;
      range.style.setProperty('--p', `${((devices - 1) / (Number(range.max) - 1)) * 100}%`);
      const need = (base + (devices - 1) * 6) * 1.15;
      const plan = PLANS.find((p) => p >= need) || 200;
      whyEl.textContent = WHY[plan];
      cta.dataset.msg = `Hola, quiero contratar el plan de ${plan} Mbps de Procam Centla.`;
      cta.href = waUrl('info', cta.dataset.msg);
      $$('.plan').forEach((li) => li.classList.toggle('is-rec', Number(li.dataset.mbps) === plan));
      if (plan !== current) {
        current = plan;
        if (hasGSAP && !reduce) gsap.to(counter, { v: plan, duration: 0.7, ease: 'power3.out', onUpdate: () => { planEl.textContent = Math.round(counter.v); } });
        else planEl.textContent = plan;
      }
    };
    finder.addEventListener('input', update);
    finder.addEventListener('change', update);
    update();
  }

  /* ------------------------------------------------------------------ */
  /* Cobertura: buscador + topología de red                              */
  /* ------------------------------------------------------------------ */
  function initCoverage() {
    const list = $('#locList');
    const input = $('#locInput');
    const stage = $('#topoStage');
    const result = $('#locResult');
    const msg = $('#resMsg');
    const cta = $('#resCta');
    const ctaTxt = $('#resCtaTxt');
    const formSel = $('#fLoc');
    if (!list || !stage) return;

    // Opciones del formulario
    if (formSel) {
      LOCALITIES.forEach((l) => { const o = document.createElement('option'); o.value = l.name; o.textContent = l.status === 'soon' ? `${l.name} (próximamente)` : l.name; formSel.appendChild(o); });
      const other = document.createElement('option'); other.value = 'Otra localidad (revisar mi zona)'; other.textContent = 'Otra localidad (revisar mi zona)'; formSel.appendChild(other);
    }

    // Chips
    LOCALITIES.forEach((l) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'loc'; b.dataset.id = l.id; b.dataset.status = l.status;
      b.innerHTML = `${icon(l.status === 'on' ? 'check-circle' : 'clock')}<span>${l.short}</span>`;
      b.setAttribute('aria-pressed', 'false');
      li.appendChild(b); list.appendChild(li);
    });

    // Topología (esquema ilustrativo, no geográfico)
    const W = 640, H = 560, cx = W / 2, cy = H / 2 - 4;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Esquema de la red de Procam: Frontera al centro conectada con las localidades con servicio' });
    const gLinks = svgEl('g'); const gPulse = svgEl('g'); const gNodes = svgEl('g');
    svg.append(gLinks, gPulse, gNodes);

    const ringA = LOCALITIES.slice(1, 6);
    const ringB = LOCALITIES.slice(6);
    const pos = { frontera: { x: cx, y: cy } };
    ringA.forEach((l, i) => { const a = (-90 + i * 72 + 18) * Math.PI / 180; pos[l.id] = { x: cx + Math.cos(a) * 135, y: cy + Math.sin(a) * 120, a }; });
    ringB.forEach((l, i) => { const a = (-90 + i * 45 + 22.5) * Math.PI / 180; pos[l.id] = { x: cx + Math.cos(a) * 250, y: cy + Math.sin(a) * 220, a }; });

    const parent = {};
    ringA.forEach((l) => { parent[l.id] = 'frontera'; });
    ringB.forEach((l) => {
      let best = null, bd = 1e9;
      ringA.forEach((p) => { const d = Math.hypot(pos[l.id].x - pos[p.id].x, pos[l.id].y - pos[p.id].y); if (d < bd) { bd = d; best = p.id; } });
      parent[l.id] = best;
    });

    const linkEls = {};
    const curve = (a, b) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx - dy / len * 14).toFixed(1)} ${(my + dx / len * 14).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    };
    LOCALITIES.slice(1).forEach((l, idx) => {
      const d = curve(pos[parent[l.id]], pos[l.id]);
      const p = svgEl('path', { d, class: `t-link${l.status === 'soon' ? ' t-link--soon' : ''}` });
      gLinks.appendChild(p); linkEls[l.id] = p;
      if (!reduce && l.status === 'on') {
        const c = svgEl('circle', { r: '3.4', class: 't-pulse' });
        const dur = 2.6 + (idx % 5) * 0.55;
        const m = svgEl('animateMotion', { dur: `${dur}s`, repeatCount: 'indefinite', begin: `${(idx * 0.37).toFixed(2)}s`, path: d, keyPoints: '0;1', keyTimes: '0;1', calcMode: 'linear' });
        const o = svgEl('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;.15;.85;1', dur: `${dur}s`, repeatCount: 'indefinite', begin: `${(idx * 0.37).toFixed(2)}s` });
        c.append(m, o); gPulse.appendChild(c);
      }
    });

    const nodeEls = {};
    LOCALITIES.forEach((l) => {
      const { x, y, a } = pos[l.id];
      const g = svgEl('g', { class: `t-node${l.hub ? ' t-hub' : ''}`, 'data-id': l.id, 'data-status': l.status, tabindex: '0', role: 'button', 'aria-label': `${l.name}, ${l.status === 'on' ? 'con servicio' : 'próximamente'}` });
      g.append(
        svgEl('circle', { class: 't-ring', cx: x, cy: y, r: l.hub ? 34 : 18 }),
        svgEl('circle', { class: 't-core', cx: x, cy: y, r: l.hub ? 15 : 8.5 }),
      );
      const t = svgEl('text', { x, y: l.hub ? y + 40 : (a !== undefined && Math.sin(a) < 0 ? y - 20 : y + 28) });
      t.textContent = l.short;
      g.appendChild(t); gNodes.appendChild(g); nodeEls[l.id] = g;
    });
    stage.appendChild(svg);

    // Selección
    let selected = null;
    const hot = (id) => {
      Object.values(linkEls).forEach((p) => p.classList.remove('is-hot'));
      let k = id;
      while (k && k !== 'frontera') { linkEls[k] && linkEls[k].classList.add('is-hot'); k = parent[k]; }
    };
    const setState = (state, text, ctaText, ctaMsg) => {
      result.dataset.state = state; msg.textContent = text; ctaTxt.textContent = ctaText;
      cta.dataset.msg = ctaMsg; cta.href = waUrl('info', ctaMsg);
    };
    const select = (id, fromSearch = false) => {
      const l = LOCALITIES.find((x) => x.id === id);
      if (!l) return;
      selected = id;
      $$('.loc', list).forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
      Object.entries(nodeEls).forEach(([k, n]) => n.classList.toggle('is-active', k === id));
      hot(id);
      if (formSel) formSel.value = l.name;
      if (l.status === 'on') {
        setState('on', `Sí, ya llegamos a ${l.name}. Escríbenos y agenda tu instalación.`, `Quiero internet en ${l.short}`,
          `Hola, quiero contratar internet por fibra óptica de Procam en ${l.name}.`);
      } else {
        setState('soon', `${l.name} está próxima a recibir servicio. Escríbenos y te avisamos en cuanto llegue.`, 'Avísame cuando llegue',
          `Hola, vivo en ${l.name} y quiero que me avisen cuando llegue la fibra óptica de Procam.`);
      }
      if (!fromSearch && input) {
        input.value = '';
        $$('.loc', list).forEach((b) => { b.parentElement.hidden = false; });
        Object.values(nodeEls).forEach((n) => n.classList.remove('is-dim'));
      }
    };
    const reset = () => {
      selected = null;
      $$('.loc', list).forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); b.parentElement.hidden = false; });
      Object.values(nodeEls).forEach((n) => { n.classList.remove('is-active', 'is-dim'); });
      hot(null);
      setState('idle', 'Selecciona tu localidad para ver si ya llegamos.', 'Consultar mi zona por WhatsApp', 'Hola, quiero saber si tienen cobertura de fibra óptica en mi zona.');
    };

    list.addEventListener('click', (e) => { const b = e.target.closest('.loc'); if (b) select(b.dataset.id); });
    gNodes.addEventListener('click', (e) => { const n = e.target.closest('.t-node'); if (n) select(n.dataset.id); });
    gNodes.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.t-node')) { e.preventDefault(); select(e.target.closest('.t-node').dataset.id); } });

    input.addEventListener('input', () => {
      const q = norm(input.value);
      if (!q) { reset(); return; }
      const matches = LOCALITIES.filter((l) => norm(l.name).includes(q) || norm(l.short).includes(q));
      $$('.loc', list).forEach((b) => { b.parentElement.hidden = !matches.some((m) => m.id === b.dataset.id); });
      Object.entries(nodeEls).forEach(([k, n]) => n.classList.toggle('is-dim', !matches.some((m) => m.id === k)));
      if (matches.length === 1) select(matches[0].id, true);
      else if (matches.length === 0) {
        selected = null; hot(null);
        Object.values(nodeEls).forEach((n) => n.classList.remove('is-active'));
        setState('none', `No encontramos "${input.value.trim()}" en nuestra lista. Escríbenos y revisamos si podemos llegar a tu zona.`, 'Consultar mi zona',
          `Hola, vivo en ${input.value.trim()} y quiero saber si pueden llevarme fibra óptica de Procam.`);
      } else {
        selected = null; hot(null);
        $$('.loc', list).forEach((b) => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        Object.values(nodeEls).forEach((n) => n.classList.remove('is-active'));
        setState('idle', `Encontramos ${matches.length} localidades. Elige la tuya.`, 'Consultar mi zona por WhatsApp', 'Hola, quiero saber si tienen cobertura de fibra óptica en mi zona.');
      }
    });
    reset();
  }

  /* ------------------------------------------------------------------ */
  /* FAQ                                                                 */
  /* ------------------------------------------------------------------ */
  function initFAQ() {
    const acc = $('#acc');
    if (!acc) return;
    const items = $$('.acc__item', acc);
    items.forEach((item) => {
      const btn = $('.acc__q', item);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        items.forEach((it) => { const b = $('.acc__q', it); const o = it === item && open; b.setAttribute('aria-expanded', String(o)); it.classList.toggle('is-open', o); });
        if (hasGSAP) setTimeout(() => window.ScrollTrigger.refresh(), 700);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Formulario → WhatsApp                                               */
  /* ------------------------------------------------------------------ */
  function initForm() {
    const form = $('#contactForm');
    if (!form) return;
    const name = $('#fName'), loc = $('#fLoc'), plan = $('#fPlan'), msgEl = $('#fMsg'), ok = $('#formOk');
    const setErr = (input, text) => {
      const f = input.closest('.field');
      f.classList.toggle('is-invalid', Boolean(text));
      $('.field__err', f).textContent = text || '';
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
    };
    name.addEventListener('input', () => name.value.trim().length >= 2 && setErr(name, ''));
    loc.addEventListener('change', () => loc.value && setErr(loc, ''));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      if (name.value.trim().length < 2) { setErr(name, 'Escribe tu nombre para saber cómo llamarte.'); valid = false; } else setErr(name, '');
      if (!loc.value) { setErr(loc, 'Elige tu localidad para revisar la cobertura.'); valid = false; } else setErr(loc, '');
      if (!valid) { (name.value.trim().length < 2 ? name : loc).focus(); return; }

      const lines = [
        `Hola, soy ${name.value.trim()}. Quiero información sobre el internet por fibra óptica de Procam Centla.`,
        `Localidad: ${loc.value}`,
        `Plan de interés: ${plan.value || 'Aún no lo sé, necesito ayuda'}`,
      ];
      if (msgEl.value.trim()) lines.push(`Mensaje: ${msgEl.value.trim()}`);
      const url = waUrl('info', lines.join('\n'));

      form.classList.add('is-sending');
      ok.textContent = '';
      setTimeout(() => {
        form.classList.remove('is-sending');
        const w = window.open(url, '_blank', 'noopener');
        if (!w) window.location.href = url;
        ok.innerHTML = `Listo, te llevamos a WhatsApp. Si no se abrió, <a href="${url}" target="_blank" rel="noopener noreferrer">toca aquí</a>.`;
      }, 700);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Botón flotante de WhatsApp                                          */
  /* ------------------------------------------------------------------ */
  function initFloat() {
    const wa = $('#waFloat');
    const close = $('#waClose');
    if (!wa) return;
    let seen = false;
    try { seen = sessionStorage.getItem('procam-wa-tip') === '1'; } catch (e) { /* almacenamiento no disponible */ }
    const hide = () => { wa.classList.remove('is-tip'); try { sessionStorage.setItem('procam-wa-tip', '1'); } catch (e) { /* noop */ } };
    close.addEventListener('click', hide);
    if (!seen) {
      const show = () => { wa.classList.add('is-tip'); setTimeout(hide, 11000); };
      const arm = () => setTimeout(show, 7000);
      if (root.classList.contains('is-ready')) arm();
      else new MutationObserver((_, obs) => { if (root.classList.contains('is-ready')) { obs.disconnect(); arm(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interacciones de puntero (solo mouse): foco de luz y magnetismo     */
  /* ------------------------------------------------------------------ */
  function initPointerFx() {
    if (!finePointer) return;
    $$('[data-spot]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
          raf = 0;
        });
      });
    });
    if (!hasGSAP || reduce) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ================================================================== */
  /* MODO ANIMADO (GSAP + ScrollTrigger [+ Lenis])                      */
  /* ================================================================== */
  function initLenis() {
    if (!window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.92, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    if (root.classList.contains('is-loading')) lenis.stop();
  }

  function preloadImages() {
    const urls = [$('#heroPhoto img'), $('#xpImg')].filter(Boolean).map((i) => i.currentSrc || i.src);
    return Promise.all(urls.map((u) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
  }

  function runPreloader() {
    return new Promise((resolve) => {
      const pre = $('#preloader');
      if (!pre) { resolve(); return; }
      const pctEl = $('#plPct'), arc = $('#plArc'), fill = $('#plFill'), bar = $('#plBar'), status = $('#plStatus'), core = $('#plCore');
      const top = $('.preloader__panel--t'), bot = $('.preloader__panel--b');
      const phrases = [[0, 'Iniciando conexión'], [28, 'Sincronizando la fibra óptica'], [60, 'Verificando la red'], [90, 'Todo listo']];
      const state = { p: 0 };
      const render = () => {
        const p = state.p;
        pctEl.textContent = Math.round(p);
        arc.style.strokeDashoffset = 100 - p;
        fill.style.clipPath = `inset(${100 - p}% 0 0 0)`;
        bar.style.transform = `scaleX(${p / 100})`;
        const ph = [...phrases].reverse().find(([t]) => p >= t);
        if (ph && status.textContent !== ph[1]) status.textContent = ph[1];
      };
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
      const ready = Promise.race([Promise.all([fonts, loaded, preloadImages()]), wait(6500)]);

      const exit = () => {
        const tl = gsap.timeline();
        tl.to(core, { autoAlpha: 0, scale: 1.14, duration: 0.55, ease: 'power2.in' })
          .to(top, { yPercent: -101, duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
          .to(bot, { yPercent: 101, duration: 1.1, ease: 'expo.inOut' }, '<')
          .add(() => { root.classList.remove('is-loading'); if (lenis) lenis.start(); resolve(); }, '-=0.75')
          .add(() => pre.remove());
      };
      const t1 = gsap.to(state, { p: 90, duration: 2.0, ease: 'power2.out', onUpdate: render });
      Promise.all([ready, new Promise((r) => t1.eventCallback('onComplete', r))]).then(() => {
        gsap.to(state, { p: 100, duration: 0.7, ease: 'power2.inOut', onUpdate: render, onComplete: exit });
      });
    });
  }

  function playHeroIntro() {
    root.classList.add('is-ready');
    const title = $('[data-hero-title]');
    const words = splitWords(title);
    title.classList.add('is-split');
    const copy = $$('.hero__copy [data-hero]');
    const visual = $('[data-hero-visual]');
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 1.15, stagger: 0.07 }, 0.05)
      .fromTo(copy, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.14 }, 0.1)
      .fromTo(visual, { autoAlpha: 0, scale: 0.9, y: 50 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1.6, ease: 'expo.out' }, 0.15)
      .fromTo('.wdg', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 1, stagger: 0.16, ease: 'back.out(1.7)' }, 0.95)
      .to('.hero__canvas', { opacity: 1, duration: 1.8, ease: 'power2.out' }, 0.2)
      .add(() => { [...copy, visual].forEach((el) => { el.classList.add('is-in'); gsap.set(el, { clearProps: 'opacity,visibility,transform' }); }); });
  }

  function heroMotion() {
    // Medidor animado (constante)
    const num = $('#gaugeNum'), fill = $('#gaugeFill');
    const g = { v: 0 };
    const gt = gsap.timeline({ repeat: -1, repeatDelay: 1.1, yoyo: true, paused: true });
    gt.to(g, { v: 200, duration: 2.8, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(g.v); fill.style.strokeDashoffset = 100 - (g.v / 200) * 100; } });
    ScrollTrigger.create({ trigger: '#inicio', start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? gt.play() : gt.pause()) });

    // Parallax / inclinación con el puntero
    if (!finePointer) return;
    const hero = $('#inicio'), photo = $('#heroPhoto');
    const rx = gsap.quickTo(photo, 'rotationY', { duration: 1, ease: 'power3.out' });
    const ry = gsap.quickTo(photo, 'rotationX', { duration: 1, ease: 'power3.out' });
    const wdgs = $$('.wdg').map((el) => ({ depth: Number(el.dataset.depth) || 0, x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3.out' }) }));
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      rx(nx * 9); ry(-ny * 9);
      wdgs.forEach((w) => { w.x(nx * w.depth * 1.6); w.y(ny * w.depth * 1.6); });
    });
    hero.addEventListener('pointerleave', () => { rx(0); ry(0); wdgs.forEach((w) => { w.x(0); w.y(0); }); });
  }

  function runCounters(scope) {
    $$('[data-count]', scope).forEach((el) => {
      const end = Number(el.dataset.count); const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2.2, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('es-MX'); } });
    });
  }

  function scrollMotion() {
    gsap.registerPlugin(ScrollTrigger);

    // Barra de progreso
    gsap.to('#progressBar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // Revelados genéricos
    ScrollTrigger.batch($$('[data-r]'), {
      start: 'top 89%', once: true,
      onEnter: (batch) => gsap.fromTo(batch, { autoAlpha: 0, y: 42 }, {
        autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, overwrite: true,
        onComplete: () => batch.forEach((el) => { el.classList.add('is-in'); gsap.set(el, { clearProps: 'opacity,visibility,transform' }); }),
      }),
    });

    // Titulares por palabras
    $$('[data-split]').forEach((h) => {
      const words = splitWords(h);
      gsap.set(words, { yPercent: 118 });
      h.classList.add('is-split');
      ScrollTrigger.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.15, stagger: 0.055, ease: 'power4.out' }) });
    });

    // Listón de localidades: velocidad ligada al scroll
    const track = $('#ribbonTrack');
    if (track) {
      track.innerHTML += track.innerHTML;
      track.style.animation = 'none';
      const tw = gsap.to(track, { xPercent: -50, duration: 62, ease: 'none', repeat: -1 });
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: (self) => { const k = clamp(Math.abs(self.getVelocity()) / 380, 0, 7); gsap.to(tw, { timeScale: (self.direction === 1 ? 1 : -1) * (1 + k), duration: 0.35, overwrite: true }); },
      });
      ScrollTrigger.addEventListener('scrollEnd', () => gsap.to(tw, { timeScale: 1, duration: 1.4, overwrite: true }));
    }

    const mm = gsap.matchMedia();

    // ---- Imagen que se abre con el scroll ----
    const xpStage = $('#xpStage');
    if (xpStage) {
      $$('[data-count]', xpStage).forEach((el) => { el.textContent = '0'; });
      mm.add({ desk: '(min-width: 768px)', mob: '(max-width: 767.98px)' }, (ctx) => {
        const desk = ctx.conditions.desk;
        const media = $('#xpMedia'), img = $('#xpImg'), scrim = $('#xpScrim'), content = $('#xpContent'), wl = $('#xpL'), wr = $('#xpR');
        const from = desk ? 'inset(18% 36% 18% 36% round 28px)' : 'inset(24% 12% 28% 12% round 24px)';
        gsap.set(media, { clipPath: from });
        gsap.set(img, { scale: 1.4 });
        let counted = false;
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: xpStage, start: 'top top', end: '+=210%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
        });
        tl.to(media, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 0.62, ease: 'power1.inOut' }, 0)
          .to(img, { scale: 1, duration: 0.8 }, 0)
          .to(wl, desk ? { x: () => -window.innerWidth * 0.42, autoAlpha: 0, duration: 0.5 } : { yPercent: -160, autoAlpha: 0, duration: 0.5 }, 0.02)
          .to(wr, desk ? { x: () => window.innerWidth * 0.42, autoAlpha: 0, duration: 0.5 } : { yPercent: 160, autoAlpha: 0, duration: 0.5 }, 0.02)
          .to(scrim, { opacity: 1, duration: 0.3 }, 0.5)
          .fromTo(content, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.62)
          .fromTo(Array.from(content.children), { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power2.out' }, 0.64)
          .add(() => { if (!counted) { counted = true; runCounters(content); } }, 0.8)
          .to({}, { duration: 0.2 });
        return () => { counted = false; };
      });
    }

    // ---- Pan horizontal (solo escritorio) ----
    const panStage = $('#panStage');
    if (panStage) {
      mm.add('(min-width: 900px)', () => {
        const track = $('#panTrack'), bar = $('#panBar');
        const dist = () => Math.max(0, track.scrollWidth - panStage.clientWidth);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: { trigger: panStage, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }) },
        });
        $$('.pcard').forEach((card) => {
          gsap.fromTo($('img', card), { xPercent: -5 }, { xPercent: 5, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        });
      });
    }

    // ---- Cómo contratar: línea que se dibuja y pasos que se activan ----
    const line = $('#flowLine');
    if (line) {
      gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#flowList', start: 'top 72%', end: 'bottom 72%', scrub: 0.6 } });
      $$('.step').forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 70%', onEnter: () => li.classList.add('is-active'), onLeaveBack: () => li.classList.remove('is-active') }));
    }

    // ---- Parallax suave del fondo del CTA final ----
    const fbg = $('.final__bg img');
    if (fbg) gsap.fromTo(fbg, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.final', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Fotos del bento con parallax interno
    $$('.tile--photo > img').forEach((im) => gsap.fromTo(im, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  }

  function setupMotion() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true }); // evita saltos al ocultarse la barra del navegador móvil
    root.classList.add('js-anim');
    initLenis();
    const title = $('[data-hero-title]');
    if (title) { gsap.set(splitWords(title), { yPercent: 118 }); title.classList.add('is-split'); }

    runPreloader().then(() => { playHeroIntro(); });

    scrollMotion();
    heroMotion();

    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    window.addEventListener('load', () => { refresh(); setTimeout(refresh, 1200); }, { once: true });

    // Ir a la ancla si la URL ya trae una
    window.addEventListener('load', () => {
      if (!location.hash) return;
      const t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(() => (lenis ? lenis.scrollTo(t, { immediate: true, offset: -67 }) : t.scrollIntoView()), 2800);
    }, { once: true });
  }

  /* ================================================================== */
  /* MODO SIMPLE (sin GSAP o con movimiento reducido)                   */
  /* ================================================================== */
  function setupLite() {
    const pre = $('#preloader');
    const finish = () => {
      root.classList.remove('is-loading'); root.classList.add('is-ready');
      if (!pre) return;
      pre.style.transition = 'opacity .4s'; pre.style.opacity = '0';
      setTimeout(() => pre.remove(), 450);
    };
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
    Promise.race([loaded, wait(1800)]).then(finish);
    const p = $('.progress'); if (p) p.classList.add('progress--native');
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  function boot() {
    initWhatsAppLinks();
    initOpenStatus();
    initHeader();
    initMenu();
    initAnchors();
    initToTop();
    initPlans();
    initCoverage();
    initFAQ();
    initForm();
    initFloat();
    initNetwork();
    initPointerFx();
    if (lite) setupLite(); else setupMotion();
    // Seguro anti-bloqueo: el preloader nunca debe quedar atrapado
    setTimeout(() => { const p = $('#preloader'); if (p) { p.remove(); root.classList.remove('is-loading'); root.classList.add('is-ready'); if (lenis) lenis.start(); } }, 10000);
  }

  try { boot(); } catch (err) {
    console.error('[Procam] Error al iniciar, activando modo simple:', err);
    root.classList.remove('js-anim', 'is-loading'); root.classList.add('is-ready');
    const p = $('#preloader'); if (p) p.remove();
  }
})();
