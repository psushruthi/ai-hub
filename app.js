(function () {
  "use strict";
  var CFG = window.HUB_CONFIG || { SHEET_ID: "", TABS: [] };
  var D = {};
  var app = document.getElementById("app");
  var tabsEl = document.getElementById("tabs");
  var syncEl = document.getElementById("sync");
  var state = { q: "", type: null, disease: "", evType: null, interest: {} };

  var TABS = [
    ["home", "Overview"], ["people", "People"], ["events", "Events"], ["learn", "Learn"],
    ["collaborate", "Collaborate"], ["resources", "Resources"], ["governance", "Governance"], ["help", "Get help"],
    ["impact", "Impact"], ["plan", "Launch plan"]
  ];

  // ---------- data loading ----------
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    text = text.replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {}; head.forEach(function (h, j) { o[h] = (r[j] || "").trim(); }); return o;
    });
  }
  function getText(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  function loadTab(name) {
    var local = function () { return getText("data/" + name + ".csv").then(function (t) { return { rows: parseCSV(t), live: false }; }); };
    if (!CFG.SHEET_ID) return local();
    var url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(CFG.SHEET_ID) + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(name);
    return getText(url).then(function (t) {
      var rows = parseCSV(t);
      if (!rows.length) throw new Error("empty");
      return { rows: rows, live: true };
    }).catch(local);
  }
  function load() {
    var names = ["people", "events", "learn", "resources", "posts", "kpis"];
    return Promise.all(names.map(loadTab)).then(function (res) {
      var live = 0;
      res.forEach(function (r, i) { D[names[i]] = r.rows; if (r.live) live++; });
      if (live === names.length) { syncEl.textContent = "Live from the shared spreadsheet"; syncEl.style.setProperty("--sync", "#2E8B57"); }
      else if (live) { syncEl.textContent = "Partly live from the spreadsheet"; syncEl.style.setProperty("--sync", "#C9A227"); }
      else { syncEl.textContent = "Showing saved copy of the spreadsheet"; }
    });
  }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function list(s) { return String(s || "").split(";").map(function (x) { return x.trim(); }).filter(Boolean); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function initials(n) { return n.replace(/,.*$/, "").split(/\s+/).filter(function (p) { return /^[A-Z][a-z]/.test(p); }).map(function (p) { return p[0]; }).slice(0, 2).join(""); }
  function badge(status) {
    var s = (status || "").toLowerCase();
    var cls = s === "proposed" ? "proposed" : (s === "existing" || s === "scheduled") ? "existing" : "example";
    return '<span class="badge ' + cls + '">' + esc(status || "Example") + "</span>";
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function sortedEvents() { return D.events.slice().sort(function (a, b) { return (parseDate(a.date) || 0) - (parseDate(b.date) || 0); }); }
  function upcoming() { var t = new Date(); t.setHours(0, 0, 0, 0); return sortedEvents().filter(function (e) { var d = parseDate(e.date); return !d || d >= t; }); }
  function link(url, text) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + "</a>" : ""; }

  function evRow(e) {
    var d = parseDate(e.date);
    return '<div class="row"><span class="date"><small>' + (d ? MON[d.getMonth()] : "TBD") + "</small>" + (d ? d.getDate() : "-") + '</span><div class="body">' +
      '<div class="tags">' + badge(e.status) + '<span class="tag">' + esc(e.type) + "</span></div>" +
      "<h3>" + esc(e.title) + "</h3><p>" + esc([e.speaker, e.time, e.location].filter(Boolean).join(" · ")) + "</p>" +
      (e.link ? '<p class="small">' + link(e.link, "From the CCBB calendar") + "</p>" : "") + "</div></div>";
  }

  // ---------- views ----------
  var V = {};

  V.home = function () {
    var seminars = D.events.filter(function (e) { return (e.status || "").toLowerCase() === "scheduled"; }).length;
    var existing = D.learn.concat(D.resources).filter(function (x) { return (x.status || "").toLowerCase() === "existing"; }).length;
    var tiles = [
      ["people", "People", "Find who works on AI and data science, by data type, disease or method."],
      ["events", "Events", "Seminars, workshops, office hours and networking in one calendar."],
      ["learn", "Learn", "AI learning for every role, starting with what IU already offers."],
      ["collaborate", "Collaborate", "Post a need or join a project across departments."],
      ["resources", "Resources", "Analysis cores, guidance, funding and templates."],
      ["governance", "Governance", "Clear, shared rules for using data and AI safely and responsibly."],
      ["help", "Get help", "Not sure where to start? Describe it and get pointed the right way."]
    ];
    return '<section class="view">' +
      '<div class="hero"><div class="secthead"><span class="eyebrow">Everything AI, in one place</span>' +
      "<h1>Connect the AI work already happening across the school.</h1>" +
      '<p class="lede">AI and data science work is spread across centers, departments, cores and partners. This hub brings it together, so anyone can find a collaborator, a session, a resource or a person to ask.</p></div>' +
      '<div class="list"><span class="eyebrow">Coming up</span>' + upcoming().slice(0, 3).map(evRow).join("") + "</div></div>" +
      '<div class="facts">' +
      "<div><b>45</b><span>CCBB members across IU and Purdue</span></div>" +
      "<div><b>" + D.people.length + "</b><span>profiled so far from public pages</span></div>" +
      "<div><b>" + seminars + "</b><span>upcoming CCBB seminars</span></div>" +
      "<div><b>" + existing + "</b><span>existing programs and resources linked</span></div></div>" +
      '<div class="grid">' + tiles.map(function (t) { return '<a class="card" href="#' + t[0] + '"><h3>' + t[1] + '</h3><p class="muted">' + t[2] + '</p><span class="go">Open ' + t[1] + " →</span></a>"; }).join("") + "</div></section>";
  };

  V.people = function () {
    var types = uniq([].concat.apply([], D.people.map(function (p) { return list(p.data_types); }))).sort();
    var dis = uniq([].concat.apply([], D.people.map(function (p) { return list(p.disease_focus); }))).sort();
    return '<section class="view"><div class="secthead"><span class="eyebrow">People</span><h2>Who works on AI and data science?</h2>' +
      '<p class="lede">A starting sample of ' + D.people.length + " CCBB members, summarized from their public faculty profiles. Search by topic, or filter by the kind of data they work with.</p></div>" +
      '<div class="toolbar"><label class="search" for="pq"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="pq" type="search" placeholder="Try Alzheimer\'s, pathology, EHR, deep learning" autocomplete="off" aria-label="Search people" value="' + esc(state.q) + '"></label>' +
      '<label class="small" for="dis"><span class="muted">Disease focus </span><select id="dis"><option value="">All</option>' + dis.map(function (d) { return '<option' + (state.disease === d ? " selected" : "") + ">" + esc(d) + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="chips" role="group" aria-label="Filter by data type">' + types.map(function (t) { return '<button type="button" class="chip" data-type="' + esc(t) + '" aria-pressed="' + (state.type === t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<p class="small muted" id="pc" aria-live="polite"></p><div class="grid" id="pg"></div></section>';
  };
  function drawPeople() {
    var t = state.q.trim().toLowerCase();
    var res = D.people.filter(function (p) {
      if (state.type && list(p.data_types).indexOf(state.type) < 0) return false;
      if (state.disease && list(p.disease_focus).indexOf(state.disease) < 0) return false;
      if (!t) return true;
      return [p.name, p.title, p.department, p.focus, p.data_types, p.disease_focus, p.methods].join(" ").toLowerCase().indexOf(t) > -1;
    });
    document.getElementById("pc").textContent = res.length + (res.length === 1 ? " person" : " people") + " shown";
    document.getElementById("pg").innerHTML = res.length ? res.map(function (p) {
      return '<article class="card person"><div class="who"><span class="av" aria-hidden="true">' + esc(initials(p.name)) + "</span><div><h3>" + esc(p.name) + "</h3><p>" + esc(p.title) + "</p></div></div>" +
        '<p class="kv">' + esc(p.department) + "</p><p>" + esc(p.focus) + "</p>" +
        '<div class="tags">' + list(p.data_types).map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div>" +
        '<p class="kv"><b>Methods:</b> ' + esc(list(p.methods).join(", ")) + "<br><b>Disease focus:</b> " + esc(list(p.disease_focus).join(", ")) + "</p>" +
        '<div class="meta"><span class="muted">From public profile</span>' + link(p.profile_url, "View profile") + "</div></article>";
    }).join("") : '<div class="card muted">No one matches yet. Try a broader word or clear the filters.</div>';
  }

  V.events = function () {
    var types = uniq(D.events.map(function (e) { return e.type; }));
    var evs = sortedEvents().filter(function (e) { return !state.evType || e.type === state.evType; });
    return '<section class="view"><div class="secthead"><span class="eyebrow">Events</span><h2>One calendar for AI across the school</h2>' +
      '<p class="lede">Real seminars from the CCBB calendar, alongside the kinds of sessions the office could add. One shared calendar helps people find events and avoids duplicate programming.</p></div>' +
      '<div class="chips" role="group" aria-label="Filter by type">' + types.map(function (t) { return '<button type="button" class="chip" data-ev="' + esc(t) + '" aria-pressed="' + (state.evType === t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<div class="list">' + evs.map(evRow).join("") + "</div></section>";
  };

  V.learn = function () {
    var levels = uniq(D.learn.map(function (l) { return l.level; }));
    return '<section class="view"><div class="secthead"><span class="eyebrow">Learn</span><h2>An AI learning path for every role</h2>' +
      '<p class="lede">Built on what IU and CCBB already offer, with new sessions only where there is a gap. <span class="badge existing">Existing</span> items are real programs today. <span class="badge proposed">Proposed</span> items are ideas for the office.</p></div>' +
      '<div class="levels">' + levels.map(function (lv, i) {
        var items = D.learn.filter(function (l) { return l.level === lv; });
        return '<div class="level"><span class="eyebrow">Level ' + (i + 1) + "</span><h3 style=\"font-size:24px\">" + esc(lv) + '</h3><span class="muted">' + esc(items[0].audience) + "</span>" +
          items.map(function (it) { return '<div class="item"><div class="tags">' + badge(it.status) + '<span class="tag">' + esc(it.offered_by) + "</span></div><h4>" + (it.link ? link(it.link, it.title) : esc(it.title)) + "</h4><p>" + esc(it.description) + "</p></div>"; }).join("") + "</div>";
      }).join("") + "</div></section>";
  };

  V.collaborate = function () {
    return '<section class="view"><div class="secthead"><span class="eyebrow">Collaborate</span><h2>Post a need, or join a project</h2>' +
      '<p class="lede">A simple board where clinicians, researchers and trainees find each other across departments. The office follows up on every post to make introductions. These posts are examples.</p></div>' +
      '<div class="grid">' + D.posts.map(function (p, i) {
        var on = state.interest[i];
        return '<article class="card"><div class="tags">' + badge("Example") + '<span class="tag">' + esc(p.data_type) + "</span></div><h3>" + esc(p.title) + "</h3><p class=\"muted\">" + esc(p.description) + "</p>" +
          '<div class="meta" style="align-items:center"><span><b>Looking for:</b> ' + esc(p.looking_for) + '</span><button type="button" class="btn' + (on ? " done" : " ghost") + '" data-int="' + i + '">' + (on ? "Interest noted" : "I'm interested") + "</button></div></article>";
      }).join("") + "</div></section>";
  };

  V.resources = function () {
    return '<section class="view"><div class="secthead"><span class="eyebrow">Resources</span><h2>What you need to get started</h2>' +
      '<p class="lede">Existing services are linked directly. Proposed guides fill the gaps people run into most: data access, approved tools and funding.</p></div>' +
      '<div class="grid">' + D.resources.map(function (r) {
        return '<article class="card"><div class="tags">' + badge(r.status) + '<span class="tag">' + esc(r.category) + "</span></div><h3>" + esc(r.name) + "</h3><p class=\"muted\">" + esc(r.description) + "</p>" +
          '<div class="meta"><span class="muted">' + esc(r.offered_by) + "</span>" + link(r.link, "Visit") + "</div></article>";
      }).join("") + "</div></section>";
  };

  V.governance = function () {
    var PR = [
      ["Patient privacy first", "Every AI project follows HIPAA, IRB and data use agreements from the start."],
      ["Human oversight", "AI supports decisions. People stay responsible for them."],
      ["Fair and equitable", "Projects check for bias and consider the patients and communities they affect."],
      ["Transparent", "Teams document data sources, methods and limits, so results can be trusted and repeated."]
    ];
    var G = [
      ["IU GenAI principles", "Principles and recommendations from IU's GenAI Faculty Task Force for responsible use in research, teaching and operations.", "Existing", "https://ai.iu.edu/initiatives/"],
      ["Data access process", "One clear path for requesting data for AI projects, with privacy and IRB checklists.", "Proposed", ""],
      ["Approved AI tools list", "Which AI tools are approved for research, and what kinds of data are safe to use with each.", "Proposed", ""],
      ["AI project review checklist", "A short checklist teams complete before a pilot: data, privacy, bias, evaluation plan and who is accountable.", "Proposed", ""],
      ["Safety and governance working group", "Faculty, clinicians, data and compliance staff who meet monthly to update guidance as AI changes.", "Proposed", ""]
    ];
    return '<section class="view"><div class="secthead"><span class="eyebrow">Governance</span><h2>Shared rules for safe, responsible AI</h2>' +
      '<p class="lede">Clear guidance helps people start AI projects with confidence instead of guessing. The office would build on IU\'s existing principles and add practical tools for IUSM teams.</p></div>' +
      '<div class="principles">' + PR.map(function (p) { return "<div><b>" + p[0] + "</b>" + p[1] + "</div>"; }).join("") + "</div>" +
      '<div class="grid">' + G.map(function (g) {
        return '<article class="card"><div class="tags">' + badge(g[2]) + "</div><h3>" + esc(g[0]) + '</h3><p class="muted">' + esc(g[1]) + "</p>" + (g[3] ? '<div class="meta"><span class="muted">Indiana University</span>' + link(g[3], "Visit") + "</div>" : "") + "</article>";
      }).join("") + "</div></section>";
  };

  var ROUTES = [
    [/data|access|irb|privacy|hipaa|de-?ident|ehr|record/i, "Data access guide", "A coordinator walks you through requesting data and the privacy steps."],
    [/sequenc|rna|omic|proteom|genom|bioinformatic|analy/i, "Bioinformatics Core", "Start with a consult request in iLab. The core handles sequencing, proteomics and multi-omics analysis."],
    [/collab|partner|someone|expert|mentor|who /i, "People directory", "Search People for a match, and the office can make a warm introduction."],
    [/train|learn|course|workshop|class|literacy|teach/i, "Learning path", "See Learn for the right level, starting with GenAI 101, or ask for a session for your team."],
    [/grant|fund|proposal|pilot|money|award/i, "Funding and grant support", "The office helps shape the idea, find a funding call and build the team."],
    [/tool|chatgpt|copilot|llm|gpt|gemini|claude|approved/i, "Approved AI tools", "Check which tools are approved for research and what data is safe to use."],
    [/comput|gpu|server|cluster|hpc|storage|big red/i, "Research computing", "The office connects you with computing support to size and request resources."]
  ];
  V.help = function () {
    return '<section class="view"><div class="secthead"><span class="eyebrow">Get help</span><h2>Not sure where to start?</h2>' +
      '<p class="lede">Describe what you need in plain words. The hub suggests a next step, and a coordinator follows up. Over time, the requests show the office what people need most.</p></div>' +
      '<form class="help" id="hf"><label class="f" for="role">I am a<select id="role"><option>Faculty member</option><option>Clinician</option><option>Research staff</option><option>Student or trainee</option><option>External partner</option></select></label>' +
      '<label class="f" for="need">What do you need?<textarea id="need" placeholder="Example: I have RNA-seq data and need help analyzing it"></textarea></label>' +
      '<div><button class="btn" type="submit">Suggest a next step</button></div><div id="out" aria-live="polite"></div></form></section>';
  };

  V.impact = function () {
    var types = uniq([].concat.apply([], D.people.map(function (p) { return list(p.data_types); })));
    var counts = types.map(function (t) { return [t, D.people.filter(function (p) { return list(p.data_types).indexOf(t) > -1; }).length]; }).sort(function (a, b) { return b[1] - a[1]; });
    var max = Math.max.apply(null, counts.map(function (c) { return c[1]; })) || 1;
    var W = 640, rowH = 34, L = 200, top = 8, H = top + counts.length * rowH + 10, bw = W - L - 50;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Number of profiled CCBB members by data type">';
    counts.forEach(function (c, i) {
      var y = top + i * rowH, w = Math.max(4, bw * c[1] / max);
      svg += '<text x="' + (L - 10) + '" y="' + (y + 21) + '" text-anchor="end">' + esc(c[0]) + "</text>" +
        '<rect x="' + L + '" y="' + (y + 6) + '" width="' + w + '" height="22" rx="2" fill="' + (i === 0 ? "#990000" : "#D9A3A3") + '"/>' +
        '<text x="' + (L + w + 8) + '" y="' + (y + 22) + '" style="fill:#191919;font-weight:700">' + c[1] + "</text>";
    });
    svg += "</svg>";
    return '<section class="view"><div class="secthead"><span class="eyebrow">Impact</span><h2>Every program, measured</h2>' +
      '<p class="lede">The office reports what it delivers: who it reaches, what gets built and where to improve. The first numbers come from the hub itself. The rest are year-one targets.</p></div>' +
      '<div class="kpis">' + D.kpis.map(function (k) { return '<div class="kpi"><b>' + esc(k.value) + "</b><span>" + esc(k.label) + "</span><em>" + esc(k.note) + "</em></div>"; }).join("") + "</div>" +
      '<div class="chartbox"><h3>Where expertise is deep, and where it is thin</h3><p class="small muted" style="margin:4px 0 14px">Profiled CCBB members by the kind of data they work with. Calculated live from the People tab.</p>' + svg + "</div></section>";
  };

  V.plan = function () {
    var P = [
      ["First 30 days", "Listen and map", ["Meet leaders of departments, centers and cores", "Inventory what already exists: courses, cores, seminars, tools", "Ask faculty, staff and trainees what they need", "Start the people directory from public profiles"], "A clear picture of what exists, what people need, and the gaps"],
      ["Days 31 to 60", "Open the front door", ["Launch the hub with people, events and resources", "Run the first AI literacy workshop", "Open the help request form with a two-day reply goal", "Publish data access and approved tool guidance", "Form a safety and governance working group"], "One place everyone knows to go"],
      ["Days 61 to 90", "Grow and measure", ["Open the collaboration board", "Support the first pilot funding round", "Start the impact dashboard", "Share a first quarterly report with leadership"], "Programs that run on their own and show results"]
    ];
    var PR = [["Amplify before building", "Link and promote what IU and CCBB already offer, and build new only where there is a gap."], ["One front door", "Every question has one place to go and one person who follows up."], ["Measure from day one", "Each program has a goal and a number, reviewed every quarter."], ["Easy to keep running", "Content lives in a shared spreadsheet, so any staff member can update the hub."]];
    return '<section class="view"><div class="secthead"><span class="eyebrow">Launch plan</span><h2>How I would build this in the first 90 days</h2>' +
      '<p class="lede">A first draft, to be shaped by what leadership and departments need.</p></div>' +
      '<div class="phases">' + P.map(function (p) { return '<div class="phase"><div class="ph-head"><span>' + p[0] + "</span><h3>" + p[1] + "</h3></div><ul>" + p[2].map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ul><p class="out">Result: ' + p[3] + "</p></div>"; }).join("") + "</div>" +
      '<div class="secthead"><h3 style="font-size:24px">Principles</h3></div><div class="principles">' + PR.map(function (p) { return "<div><b>" + p[0] + "</b>" + p[1] + "</div>"; }).join("") + "</div></section>";
  };

  // ---------- routing ----------
  tabsEl.innerHTML = TABS.map(function (t) { return '<li><a href="#' + t[0] + '" data-v="' + t[0] + '">' + t[1] + "</a></li>"; }).join("");

  function show() {
    var v = (location.hash || "").replace("#", "");
    if (!V[v]) v = "home";
    app.innerHTML = V[v]();
    Array.prototype.forEach.call(tabsEl.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-v") === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var cur = tabsEl.querySelector('[aria-current="page"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (v === "people") {
      drawPeople();
      document.getElementById("pq").addEventListener("input", function (e) { state.q = e.target.value; drawPeople(); });
      document.getElementById("dis").addEventListener("change", function (e) { state.disease = e.target.value; drawPeople(); });
    }
    if (v === "help") {
      document.getElementById("hf").addEventListener("submit", function (e) {
        e.preventDefault();
        var txt = document.getElementById("need").value, out = document.getElementById("out");
        if (!txt.trim()) { out.innerHTML = '<p class="small muted">Add a sentence about what you need, then try again.</p>'; return; }
        var hit = ROUTES.filter(function (r) { return r[0].test(txt); })[0] || [null, "A coordinator", "The office reads your request and points you to the right person."];
        out.innerHTML = '<div class="route"><span class="small muted">Suggested next step</span><b>' + esc(hit[1]) + "</b><span>" + esc(hit[2]) + '</span><span class="small muted">Demo only. Nothing was sent.</span></div>';
      });
    }
    window.scrollTo(0, 0);
  }

  app.addEventListener("click", function (e) {
    var c = e.target.closest("[data-type]");
    if (c) {
      var k = c.getAttribute("data-type"); state.type = state.type === k ? null : k;
      Array.prototype.forEach.call(app.querySelectorAll("[data-type]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-type") === state.type)); });
      drawPeople(); return;
    }
    var t = e.target.closest("[data-ev]");
    if (t) { var ty = t.getAttribute("data-ev"); state.evType = state.evType === ty ? null : ty; app.innerHTML = V.events(); return; }
    var n = e.target.closest("[data-int]");
    if (n) { var i = n.getAttribute("data-int"); state.interest[i] = !state.interest[i]; app.innerHTML = V.collaborate(); }
  });
  window.addEventListener("hashchange", show);

  load().then(show).catch(function () {
    app.innerHTML = '<p>The hub could not load its data. If you opened this file directly, run it from GitHub Pages or a local web server.</p>';
  });
})();
