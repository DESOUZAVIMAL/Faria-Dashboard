/* TimeSync frontend */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const app = $("#app");
  const VIEWER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let me = null, team = [], requests = [], date = todayStr();
  let selected = new Set(), duration = 60, modal = null;

  /* ── date helpers ── */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function shiftDate(n) {
    const [y,m,d] = date.split("-").map(Number);
    const dt = new Date(y, m-1, d+n);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }
  function fmtDateLabel(ds) {
    const [y,m,d] = ds.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    if (ds === todayStr()) return "Today";
    const tom = shiftDate(1);
    if (ds === tom && date === todayStr()) return "Tomorrow";
    return dt.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
  }
  function dayStartLocal() {
    const [y,m,d] = date.split("-").map(Number);
    return new Date(y, m-1, d).getTime();
  }
  function tzOffsetMin(tz, atMs) {
    try {
      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone:tz, hour12:false,
        year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit",
      });
      const p = {};
      dtf.formatToParts(new Date(atMs)).forEach(x => p[x.type] = x.value);
      const asUTC = Date.UTC(+p.year, +p.month-1, +p.day, p.hour==="24"?0:+p.hour, +p.minute);
      return (asUTC - atMs) / 60000;
    } catch { return 0; }
  }
  function memberLocalToInstant(tz, hour, dayShift=0) {
    const [y,m,d] = date.split("-").map(Number);
    const roughUTC = Date.UTC(y, m-1, d+dayShift, Math.floor(hour), Math.round((hour%1)*60));
    return roughUTC - tzOffsetMin(tz, roughUTC)*60000;
  }
  const instToHour = ms => (ms - dayStartLocal()) / 3.6e6;
  function fmtHM(ms, tz) {
    return new Intl.DateTimeFormat("en-US", {timeZone:tz, hour:"2-digit", minute:"2-digit", hour12:false}).format(new Date(ms));
  }
  function localClock(tz) {
    try { return fmtHM(Date.now(), tz); } catch { return "--:--"; }
  }

  /* ── availability helpers ── */
  function workBands(member) {
    // STRICT: exactly one band per person — the workday that STARTS on the
    // viewed date. A late-night band (e.g. US seen from Asia) clips at your
    // midnight and continues on the NEXT day's view, never wraps to the left.
    const day0 = dayStartLocal(), dayEnd = day0 + 24*3.6e6;
    const bands = [];
    for (const shift of [-1,0,1]) {
      const s = memberLocalToInstant(member.tz, member.workStart, shift);
      let e = memberLocalToInstant(member.tz, member.workEnd, shift);
      if (e <= s) e += 24*3.6e6;
      if (s >= day0 && s < dayEnd) bands.push([s, e]);
    }
    return bands;
  }
  const inAnyBand = (t, bands) => bands.some(([s,e]) => t>=s && t<e);
  function clampSeg(s, e) {
    const a = Math.max(0, instToHour(s)), b = Math.min(24, instToHour(e));
    if (b <= a) return null;
    return {left:(a/24)*100, width:((b-a)/24)*100};
  }

  /* ── api ── */
  const api = (url, opts) => fetch(url, opts).then(r => { if (!r.ok) throw r; return r.json(); });

  async function loadAll() {
    const start = new Date(dayStartLocal()).toISOString();
    const end   = new Date(dayStartLocal() + 24*3.6e6).toISOString();
    [team, requests] = await Promise.all([
      api(`/api/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
      api("/api/requests"),
    ]);
    if (selected.size === 0 && me) selected = new Set([me.email]);
    render();
  }

  function requestBlocksFor(email) {
    return requests
      .filter(r => r.status !== "declined" && (r.attendees.includes(email) || r.requester === email))
      .map(r => ({start:Date.parse(r.start), end:Date.parse(r.end), status:r.status, title:r.title}));
  }
  function freeSlots() {
    const sel = team.filter(m => selected.has(m.email));
    if (sel.length < 2) return Array(48).fill(false);
    const day0 = dayStartLocal(), need = duration/30;
    const stepFree = [];
    for (let s=0; s<48; s++) {
      const t = day0 + s*1.8e6;
      stepFree.push(sel.every(m => {
        if (!inAnyBand(t, workBands(m))) return false;
        if (m.busy.some(b => t>=Date.parse(b.start) && t<Date.parse(b.end))) return false;
        if (requestBlocksFor(m.email).some(b => t>=b.start && t<b.end)) return false;
        return true;
      }));
    }
    return stepFree.map((_,s) => {
      if (s+need > 48) return false;
      for (let k=0; k<need; k++) if (!stepFree[s+k]) return false;
      return true;
    });
  }

  /* ── rendering ── */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function render() {
    if (!me) return renderSignin();
    const day0 = dayStartLocal();
    const nowH = (Date.now() - day0) / 3.6e6;
    const slots = freeSlots();
    const freeCount = slots.filter(Boolean).length;
    const isToday = date === todayStr();

    app.innerHTML = `
    <div class="app"><div class="wrap">
      <div class="topbar">
        <div class="brand">
          <h1>TimeSync</h1>
          <p>Every row is on <b>your clock</b> (${esc(VIEWER_TZ)}). Dark shading = night for that person.</p>
        </div>
        <div class="userchip">
          ${me.picture ? `<img src="${esc(me.picture)}" alt="">` : ""}
          <span class="uname">${esc(me.name)}</span>
          <a class="btn ghost sm" href="/today.html" style="text-decoration:none">Today</a>
          <button class="btn ghost sm" id="profileBtn">My hours</button>
          <button class="btn ghost sm" id="logoutBtn">Sign out</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="day-nav">
          <button id="prevDay" title="Previous day">‹</button>
          <span class="day-label">${esc(fmtDateLabel(date))}</span>
          <button id="nextDay" title="Next day">›</button>
        </div>
        <button class="btn ghost sm" id="todayBtn" ${isToday?"disabled":""}>Today</button>
        <div class="toolbar-right">
          <label>Length</label>
          <select id="durPick">
            <option value="30"  ${duration===30 ?"selected":""}>30 min</option>
            <option value="60"  ${duration===60 ?"selected":""}>1 hour</option>
            <option value="90"  ${duration===90 ?"selected":""}>1.5 hrs</option>
            <option value="120" ${duration===120?"selected":""}>2 hours</option>
          </select>
          <button class="btn ghost sm" id="refreshBtn">↻ Refresh</button>
        </div>
      </div>

      <div class="card">
        <div class="gantt-header">
          ${Array.from({length:24},(_,h)=>`<span>${h%3===0?h+":00":""}</span>`).join("")}
        </div>
        ${team.map(m => rowHTML(m, nowH)).join("")}

        <div class="slots-section">
          <div class="slots-label">
            ${selected.size >= 2
              ? freeCount > 0
                ? `${freeCount} free slot${freeCount>1?"s":""} for all ${selected.size} selected — click a green slot to request a meeting`
                : `No free slots found for all ${selected.size} selected people on this day`
              : "Tick at least 2 people (including yourself) to find shared free time"}
          </div>
          <div class="slotstrip">
            ${slots.map((ok,s) => `<div class="slot${ok?" ok":""}" data-slot="${s}" ${ok?`tabindex="0" title="${fmtSlot(s)} your time — everyone free"`:""}></div>`).join("")}
          </div>
        </div>

        <div class="legend">
          <span><i style="background:var(--free-soft);border:1px solid var(--free-border)"></i>Working hours</span>
          <span><i style="background:var(--busy)"></i>Busy</span>
          <span><i style="background:var(--pending)"></i>Pending request</span>
          <span><i style="background:var(--confirmed)"></i>Confirmed</span>
          <span><i style="background:var(--night);opacity:.35"></i>Night for them</span>
          <span><i style="background:var(--accent)"></i>Now</span>
          <span><i style="background:var(--free)"></i>Everyone free</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Meeting requests</div>
        ${requests.length===0
          ? `<div style="font-size:13px;color:var(--mut);padding:6px 0">No requests yet. Select people and click a free slot above to send one.</div>`
          : requests.map(reqHTML).join("")}
      </div>
    </div></div>
    ${modal ? modalHTML() : ""}
    <div class="tip" id="tt"></div>`;

    bindEvents();
    setupTooltips();
  }

  function fmtSlot(s) {
    return `${String(Math.floor(s/2)).padStart(2,"0")}:${s%2?"30":"00"}`;
  }

  function rowHTML(m, nowH) {
    const bands = workBands(m).map(([s,e])=>clampSeg(s,e)).filter(Boolean);
    const busy  = m.busy.map(b => {
      const s=Date.parse(b.start), e=Date.parse(b.end);
      return {seg:clampSeg(s,e), s, e};
    }).filter(x=>x.seg);
    const reqBlocks = requestBlocksFor(m.email)
      .map(b=>({seg:clampSeg(b.start,b.end), ...b})).filter(x=>x.seg);
    const day0 = dayStartLocal();
    const nights = Array.from({length:24},(_,c)=>{
      const lh = +new Intl.DateTimeFormat("en-US",{timeZone:m.tz,hour:"2-digit",hour12:false})
        .format(new Date(day0+c*3.6e6+1.8e6));
      return lh<7||lh>=20?`<div class="nightcell" style="left:${(c/24)*100}%;width:${100/24}%"></div>`:"";
    }).join("");

    const initials = m.name.split(" ").map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
    const avatar = m.picture
      ? `<img class="who-avatar" src="${esc(m.picture)}" alt="${esc(m.name)}">`
      : `<div class="who-initials">${esc(initials)}</div>`;

    return `<div class="row">
      <div class="who">
        ${avatar}
        <div class="who-info">
          <div class="nm">
            <input type="checkbox" data-sel="${esc(m.email)}" ${selected.has(m.email)?"checked":""} aria-label="Include ${esc(m.name)}">
            <span class="nm-label">${esc(m.name)}</span>
            ${m.email===me.email?`<span class="you-badge">you</span>`:""}
          </div>
          <div class="rl">${esc(m.tz)} · ${localClock(m.tz)} there</div>
          ${m.connected?"":` <div class="notconnected">⚠ hasn't signed in</div>`}
        </div>
      </div>
      <div class="lane">
        ${nights}
        ${bands.map(s=>`<div class="band" style="left:${s.left}%;width:${s.width}%"></div>`).join("")}
        ${busy.map(b=>`<div class="blk busy" style="left:${b.seg.left}%;width:${b.seg.width}%"
          data-tip="Busy · ${fmtHM(b.s,m.tz)}–${fmtHM(b.e,m.tz)} (${esc(m.tz)})"><span>Busy</span></div>`).join("")}
        ${reqBlocks.map(b=>`<div class="blk ${b.status}" style="left:${b.seg.left}%;width:${b.seg.width}%"
          data-tip="${esc(b.title)} · ${fmtHM(b.start,m.tz)}–${fmtHM(b.end,m.tz)} · ${b.status}"><span>${esc(b.title)}</span></div>`).join("")}
        ${nowH>=0&&nowH<=24?`<div class="nowline" style="left:${(nowH/24)*100}%"></div>`:""}
      </div>
    </div>`;
  }

  function reqHTML(r) {
    const s=Date.parse(r.start), e=Date.parse(r.end);
    const mine = r.requester===me.email;
    const canRespond = r.status==="pending" && r.attendees.includes(me.email) && r.responses[me.email]!=="accept";
    return `<div class="req">
      <div>
        <div class="req-title">${esc(r.title)}</div>
        <div class="req-meta">
          ${fmtHM(s,VIEWER_TZ)}–${fmtHM(e,VIEWER_TZ)} your time ·
          by ${esc(r.requesterName)} · with ${r.attendees.map(esc).join(", ")}
          ${r.eventLink?` · <a href="${esc(r.eventLink)}" target="_blank">Open in Calendar</a>`:""}
        </div>
      </div>
      <div class="req-actions">
        <span class="pill ${r.status}">${r.status}</span>
        ${canRespond?`<button class="btn teal sm" data-accept="${r.id}">Accept</button>
                      <button class="btn ghost sm" data-decline="${r.id}">Decline</button>`:""}
        ${r.status!=="declined"?`<button class="btn ghost sm" data-notes="${r.id}">Notes</button>
                                 <button class="btn ghost sm" data-brief="${r.id}">Prep brief</button>`:""}
        ${mine&&r.status==="pending"?`<button class="btn ghost sm" data-cancel="${r.id}">Cancel</button>`:""}
      </div>
    </div>`;
  }

  function modalHTML() {
    if (modal.type==="notes") {
      const d = modal.draft;
      return `<div class="overlay" id="ovl"><div class="modal">
        <h3>Meeting memory — ${esc(d.title)}</h3>
        <div class="fld"><label>What was discussed / decided</label>
          <textarea id="nNotes" rows="6" style="width:100%;font-family:inherit;font-size:13px;padding:8px;border:1px solid var(--line);border-radius:8px">${esc(d.notes||"")}</textarea>
        </div>
        <div style="font-size:12px;font-weight:600;margin:6px 0">Action items</div>
        ${d.actions.map((a,i)=>`<div style="display:flex;gap:6px;margin:4px 0;align-items:center">
          <input type="checkbox" data-adone="${i}" ${a.done?"checked":""} title="done?">
          <input data-atext="${i}" value="${esc(a.text)}" placeholder="task" style="flex:2">
          <input data-aowner="${i}" value="${esc(a.owner)}" placeholder="owner" style="flex:1">
          <button class="btn ghost sm" data-adel="${i}">✕</button>
        </div>`).join("")}
        <button class="btn ghost sm" id="nAdd" style="margin-top:4px">+ Add action item</button>
        <div class="modal-actions">
          <button class="btn ghost" id="mCancel">Cancel</button>
          <button class="btn teal" id="nSave">Save</button>
        </div>
      </div></div>`;
    }
    if (modal.type==="brief") {
      return `<div class="overlay" id="ovl"><div class="modal">
        <h3>Prep brief</h3>
        ${modal.loading
          ? `<div style="color:var(--mut);font-size:13px">Reading last meeting's memory…</div>`
          : `<div style="white-space:pre-wrap;font-size:13px;background:var(--paper);padding:12px;border-radius:8px">${esc(modal.data.brief)}</div>
             ${modal.data.pendingActions.length
               ? `<div style="font-size:12px;font-weight:600;margin:10px 0 4px">Still open from previous meetings</div>` +
                 modal.data.pendingActions.map(a=>`<div class="tzline">→ ${esc(a.text)}${a.owner?` — <b>${esc(a.owner)}</b>`:""}</div>`).join("")
               : ""}`}
        <div class="modal-actions">
          <button class="btn ghost" id="mCancel">Close</button>
        </div>
      </div></div>`;
    }
    if (modal.type==="profile") {
      return `<div class="overlay" id="ovl"><div class="modal">
        <h3>My working hours</h3>
        <div class="fld"><label>Role / title</label><input id="pRole" value="${esc(me.role||"")}"></div>
        <div style="display:flex;gap:10px">
          <div class="fld" style="flex:1"><label>Work starts (local)</label>
            <input id="pStart" type="number" min="0" max="23" value="${me.workStart}"></div>
          <div class="fld" style="flex:1"><label>Work ends</label>
            <input id="pEnd" type="number" min="1" max="24" value="${me.workEnd}"></div>
        </div>
        <div style="font-size:11px;color:var(--mut);margin-top:4px">Timezone read from Google Calendar: <b>${esc(me.tz)}</b></div>
        <div class="modal-actions">
          <button class="btn ghost" id="mCancel">Cancel</button>
          <button class="btn teal" id="pSave">Save</button>
        </div>
      </div></div>`;
    }
    const startMs = dayStartLocal() + modal.slot*1.8e6;
    const endMs   = startMs + duration*60000;
    const sel = team.filter(m => selected.has(m.email));
    return `<div class="overlay" id="ovl"><div class="modal">
      <h3>Send meeting request</h3>
      <div class="fld"><label>Title</label><input id="mTitle" placeholder="e.g. Sprint planning" autofocus></div>
      <div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 6px">This time for each person</div>
      ${sel.map(m=>`<div class="tzline"><b>${esc(m.name)}</b> — ${fmtHM(startMs,m.tz)}–${fmtHM(endMs,m.tz)} <span style="color:var(--mut)">(${esc(m.tz)})</span></div>`).join("")}
      <div style="font-size:11px;color:var(--mut);margin-top:10px">When everyone accepts, a Google Calendar event with a Meet link is created automatically.</div>
      <div class="modal-actions">
        <button class="btn ghost" id="mCancel">Cancel</button>
        <button class="btn teal" id="mSend">Send request</button>
      </div>
    </div></div>`;
  }

  function renderSignin() {
    app.innerHTML = `<div class="signin">
      <div class="logo">TimeSync</div>
      <p class="tagline">See your whole team's availability on your clock.<br>Find the overlap and book in one click.</p>
      <a class="signin-btn" href="/auth/google">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Sign in with Google
      </a>
    </div>`;
  }

  /* ── tooltip ── */
  function setupTooltips() {
    const tt = $("#tt");
    if (!tt) return;
    document.querySelectorAll("[data-tip]").forEach(el => {
      el.addEventListener("mouseenter", e => {
        tt.textContent = el.dataset.tip;
        tt.style.opacity = "1";
        tt.style.left = e.clientX + 12 + "px";
        tt.style.top  = e.clientY - 36 + "px";
      });
      el.addEventListener("mousemove", e => {
        tt.style.left = e.clientX + 12 + "px";
        tt.style.top  = e.clientY - 36 + "px";
      });
      el.addEventListener("mouseleave", () => { tt.style.opacity = "0"; });
    });
  }

  /* ── events ── */
  function bindEvents() {
    $("#prevDay")?.addEventListener("click", () => { date=shiftDate(-1); loadAll(); });
    $("#nextDay")?.addEventListener("click", () => { date=shiftDate(1);  loadAll(); });
    $("#todayBtn")?.addEventListener("click", () => { date=todayStr();   loadAll(); });
    $("#durPick")?.addEventListener("change", e => { duration=+e.target.value; render(); });
    $("#refreshBtn")?.addEventListener("click", loadAll);
    $("#logoutBtn")?.addEventListener("click", async () => { await api("/auth/logout",{method:"POST"}); location.reload(); });
    $("#profileBtn")?.addEventListener("click", () => { modal={type:"profile"}; render(); });

    document.querySelectorAll("[data-sel]").forEach(cb =>
      cb.addEventListener("change", () => {
        cb.checked ? selected.add(cb.dataset.sel) : selected.delete(cb.dataset.sel);
        render();
      })
    );
    document.querySelectorAll(".slot.ok").forEach(el => {
      const open = () => { modal={type:"request", slot:+el.dataset.slot}; render(); };
      el.addEventListener("click", open);
      el.addEventListener("keydown", e => e.key==="Enter" && open());
    });
    document.querySelectorAll("[data-accept]").forEach(b =>
      b.addEventListener("click", () => respond(b.dataset.accept, "accept")));
    document.querySelectorAll("[data-decline]").forEach(b =>
      b.addEventListener("click", () => respond(b.dataset.decline, "decline")));
    document.querySelectorAll("[data-cancel]").forEach(b =>
      b.addEventListener("click", async () => { await api(`/api/requests/${b.dataset.cancel}`,{method:"DELETE"}); loadAll(); }));

    // Meeting memory: open notes editor
    document.querySelectorAll("[data-notes]").forEach(b =>
      b.addEventListener("click", () => {
        const r = requests.find(x => x.id === b.dataset.notes);
        modal = { type:"notes", id:r.id, draft:{ title:r.title, notes:r.notes||"", actions:(r.actions||[]).map(a=>({...a})) } };
        render();
      }));
    // Meeting memory: AI prep brief
    document.querySelectorAll("[data-brief]").forEach(b =>
      b.addEventListener("click", async () => {
        modal = { type:"brief", loading:true };
        render();
        try {
          const data = await api(`/api/requests/${b.dataset.brief}/brief`);
          modal = { type:"brief", loading:false, data };
        } catch {
          modal = { type:"brief", loading:false, data:{ brief:"Could not load the brief — are you a participant of this meeting?", pendingActions:[] } };
        }
        render();
      }));
    // Notes editor internals (mutate draft without re-render to keep focus)
    $("#nNotes")?.addEventListener("input", e => (modal.draft.notes = e.target.value));
    $("#nAdd")?.addEventListener("click", () => { modal.draft.actions.push({text:"",owner:"",done:false}); render(); });
    document.querySelectorAll("[data-atext]").forEach(i =>
      i.addEventListener("input", () => (modal.draft.actions[+i.dataset.atext].text = i.value)));
    document.querySelectorAll("[data-aowner]").forEach(i =>
      i.addEventListener("input", () => (modal.draft.actions[+i.dataset.aowner].owner = i.value)));
    document.querySelectorAll("[data-adone]").forEach(i =>
      i.addEventListener("change", () => (modal.draft.actions[+i.dataset.adone].done = i.checked)));
    document.querySelectorAll("[data-adel]").forEach(b =>
      b.addEventListener("click", () => { modal.draft.actions.splice(+b.dataset.adel,1); render(); }));
    $("#nSave")?.addEventListener("click", async () => {
      await api(`/api/requests/${modal.id}/notes`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ notes:modal.draft.notes, actions:modal.draft.actions.filter(a=>a.text.trim()) }),
      });
      modal = null;
      loadAll();
    });

    $("#ovl")?.addEventListener("click", e => { if(e.target.id==="ovl"){modal=null;render();} });
    $("#mCancel")?.addEventListener("click", () => { modal=null; render(); });
    $("#mSend")?.addEventListener("click", sendRequest);
    $("#pSave")?.addEventListener("click", async () => {
      me = await api("/api/me", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({role:$("#pRole").value, workStart:$("#pStart").value, workEnd:$("#pEnd").value}),
      });
      modal=null; loadAll();
    });
  }

  async function respond(id, action) {
    await api(`/api/requests/${id}/respond`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({action}),
    });
    loadAll();
  }

  async function sendRequest() {
    const startMs = dayStartLocal() + modal.slot*1.8e6;
    const endMs   = startMs + duration*60000;
    const attendees = [...selected].filter(e => e!==me.email);
    await api("/api/requests", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        title: $("#mTitle").value||"Team sync",
        start: new Date(startMs).toISOString(),
        end:   new Date(endMs).toISOString(),
        attendees,
      }),
    });
    modal=null; loadAll();
  }

  /* ── boot ── */
  (async () => {
    try {
      me = await api("/api/me");
      await loadAll();
      setInterval(loadAll, 60000);
    } catch {
      renderSignin();
    }
  })();
})();
