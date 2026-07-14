/* global app state */
let meta = { sites: [], capabilities: {}, globalOptions: [] };
let lastResult = null;

const $ = id => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setStatus(text, kind = "") {
  const node = $("status");
  node.textContent = text;
  node.className = `status ${kind}`.trim();
}

function renderOptionControl(opt, prefix = "") {
  const name = prefix ? `${prefix}.${opt.key}` : opt.key;
  const wrap = el("label", { className: "field", "data-key": opt.key });

  if (opt.type === "boolean") {
    wrap.className = "option-bool";
    const input = el("input", {
      type: "checkbox",
      name,
      id: name,
      checked: !!opt.default,
    });
    wrap.append(input, el("span", { text: opt.label }));
    return wrap;
  }

  wrap.append(el("span", { text: opt.label }));

  if (opt.type === "multiselect") {
    const box = el("div", { className: "clients", id: name });
    const selected = new Set(Array.isArray(opt.default) ? opt.default : []);
    for (const choice of opt.choices || []) {
      const id = `${name}-${choice.value}`;
      box.append(
        el("label", {}, [
          el("input", {
            type: "checkbox",
            name: `${name}[]`,
            value: choice.value,
            id,
            checked: selected.has(choice.value),
          }),
          choice.label,
        ]),
      );
    }
    wrap.append(box);
  } else if (opt.type === "select") {
    const select = el("select", { name, id: name });
    for (const choice of opt.choices || []) {
      select.append(
        el("option", {
          value: choice.value,
          text: choice.label,
          selected: String(opt.default ?? "") === String(choice.value),
        }),
      );
    }
    wrap.append(select);
  } else if (opt.type === "textarea") {
    wrap.append(
      el("textarea", {
        name,
        id: name,
        placeholder: opt.description || "",
        text: opt.default || "",
      }),
    );
  } else {
    wrap.append(
      el("input", {
        type: opt.type === "number" ? "number" : "text",
        name,
        id: name,
        value: opt.default ?? "",
        placeholder: opt.description || "",
      }),
    );
  }

  if (opt.description && opt.type !== "textarea") {
    wrap.append(el("p", { className: "hint", text: opt.description }));
  }
  return wrap;
}

function renderSiteHelp(siteName) {
  const host = $("site-help");
  if (!host) return;
  host.innerHTML = "";
  const site = meta.sites.find(s => s.name === siteName);
  if (!site) {
    host.append(el("p", { className: "site-help-usage", text: "Select a site to see which link to paste." }));
    return;
  }

  const usage =
    site.urlUsage ||
    `Paste a URL accepted by ${site.name}${site.description ? ` — ${site.description}` : ""}.`;
  host.append(el("p", { className: "site-help-usage", text: usage }));

  if (site.status && site.status !== "ready") {
    host.append(
      el("p", {
        className: "site-help-notes",
        text: `Status: ${site.status}. Extraction may be unavailable until this site is migrated.`,
      }),
    );
  }

  if (site.notes) {
    host.append(el("p", { className: "site-help-notes", text: site.notes }));
  }

  if (site.examples?.length) {
    const list = el("ul", { className: "site-help-examples" });
    for (const example of site.examples) {
      list.append(
        el("li", {}, [
          el("code", { text: example }),
          el("button", {
            type: "button",
            className: "ghost",
            text: "Use",
            onclick: () => {
              $("url").value = example;
              $("url").focus();
              setStatus(`Filled example for ${site.name}`, "ok");
            },
          }),
        ]),
      );
    }
    host.append(list);
  }
}

function renderSiteOptions(siteName) {
  const host = $("site-options");
  host.innerHTML = "";
  const site = meta.sites.find(s => s.name === siteName);
  renderSiteHelp(siteName);
  if (!site) return;
  for (const opt of site.options || []) {
    host.append(renderOptionControl(opt, "site"));
  }
  const input = $("url");
  if (input && site.examples?.[0] && !input.value) {
    input.placeholder = site.examples[0];
  }
}

function renderGlobalOptions() {
  const host = $("global-options");
  host.innerHTML = "";
  for (const opt of meta.globalOptions || []) {
    host.append(renderOptionControl(opt, "global"));
  }
  const status = $("impersonate-status");
  if (meta.capabilities?.impersonateAvailable) {
    status.textContent = "CycleTLS available — TLS impersonation / Cloudflare bypass enabled.";
    status.className = "hint";
  } else {
    status.textContent =
      "CycleTLS not installed — install optionalDependency `cycletls` for full Cloudflare TLS bypass.";
    status.className = "hint warn";
  }
}

function collectPayload() {
  const site = $("site").value;
  const payload = {
    url: $("url").value.trim(),
    site,
  };

  const siteMeta = meta.sites.find(s => s.name === site);
  for (const opt of siteMeta?.options || []) {
    if (opt.type === "multiselect") {
      payload[opt.key] = [...document.querySelectorAll(`input[name="site.${opt.key}[]"]:checked`)].map(
        n => n.value,
      );
    } else if (opt.type === "boolean") {
      payload[opt.key] = document.getElementById(`site.${opt.key}`)?.checked === true;
    } else {
      const node = document.getElementById(`site.${opt.key}`);
      payload[opt.key] = node ? node.value : opt.default;
    }
  }

  for (const opt of meta.globalOptions || []) {
    const node = document.getElementById(`global.${opt.key}`);
    if (!node) continue;
    if (opt.type === "boolean") payload[opt.key] = node.checked;
    else if (opt.key === "impersonate") payload.impersonate = node.value || false;
    else payload[opt.key] = node.value;
  }

  return payload;
}

function renderResults(data) {
  lastResult = data;
  $("copy-json").disabled = !data;

  const summary = $("summary");
  const recommended = $("recommended");
  if (!data?.ok) {
    summary.className = "summary";
    summary.textContent = data?.error || "Extraction failed";
    recommended.hidden = true;
    $("formats").querySelector("tbody").innerHTML = "";
    return;
  }

  summary.className = "summary";
  summary.innerHTML = "";
  summary.append(
    el("div", {}, [
      el("strong", { text: data.title || data.id || "Untitled" }),
      el(
        "div",
        {
          text: `${data.extractor || "?"} · ${data.formatCount} VLC-ready · ${data.elapsedMs}ms · ${data.duration || "?"}s`,
        },
      ),
      data.webpage_url
        ? el("div", {}, [el("a", { href: data.webpage_url, target: "_blank", rel: "noreferrer", text: data.webpage_url })])
        : null,
    ]),
  );

  const rec = data.recommended;
  const recUrl = rec?.url || rec?.manifest_url;
  if (recUrl) {
    recommended.hidden = false;
    recommended.className = "summary";
    recommended.innerHTML = "";
    recommended.append(
      el("div", {}, [
        el("strong", { text: "Best for VLC" }),
        el("div", {
          text: `${rec.qualityLabel || rec.resolution || rec.format_id} · client ${rec.client || "?"} · itag ${rec.itag || rec.format_id}`,
        }),
        el("div", { className: "actions" }, [
          el(
            "button",
            {
              type: "button",
              text: "Copy stream URL",
              onclick: async () => {
                await navigator.clipboard.writeText(recUrl);
                setStatus("Copied stream URL — Media → Open Network Stream in VLC", "ok");
              },
            },
          ),
          el(
            "button",
            {
              type: "button",
              className: "ghost",
              text: "Copy vlc command",
              onclick: async () => {
                await navigator.clipboard.writeText(`vlc '${recUrl}'`);
                setStatus("Copied vlc '…' command", "ok");
              },
            },
          ),
        ]),
      ]),
    );
  } else {
    recommended.hidden = true;
  }

  const tbody = $("formats").querySelector("tbody");
  tbody.innerHTML = "";
  for (const f of data.formats || []) {
    const codecs = [f.vcodec, f.acodec].filter(c => c && c !== "none").join(" / ") || "—";
    const url = f.url;
    const actions = url
      ? el("td", {}, [
          el("button", {
            type: "button",
            className: "ghost",
            text: "Copy",
            onclick: async () => {
              await navigator.clipboard.writeText(url);
              setStatus(`Copied itag ${f.itag || f.format_id}`, "ok");
            },
          }),
        ])
      : el("td", { text: "—" });
    tbody.append(
      el("tr", {}, [
        el("td", { text: String(f.format_id || f.itag || "") }),
        el("td", { text: f.resolution || f.qualityLabel || "—" }),
        el("td", { text: codecs }),
        el("td", { text: f.client || "—" }),
        actions,
      ]),
    );
  }
}

async function boot() {
  const res = await fetch("/api/meta");
  meta = await res.json();

  const siteSelect = $("site");
  siteSelect.innerHTML = "";
  // Prefer ready extractors first; still list planned so users can see URL expectations early.
  const sites = [...(meta.sites || [])].sort((a, b) => {
    const ar = a.status === "ready" || !a.status ? 0 : 1;
    const br = b.status === "ready" || !b.status ? 0 : 1;
    if (ar !== br) return ar - br;
    return String(a.name).localeCompare(String(b.name));
  });
  for (const site of sites) {
    const label =
      site.status && site.status !== "ready"
        ? `${site.name} (${site.status}) — ${site.description}`
        : `${site.name} — ${site.description}`;
    siteSelect.append(el("option", { value: site.name, text: label }));
  }
  siteSelect.addEventListener("change", () => renderSiteOptions(siteSelect.value));
  if (sites[0]) renderSiteOptions(sites[0].name);
  renderGlobalOptions();

  $("extract-form").addEventListener("submit", async e => {
    e.preventDefault();
    const payload = collectPayload();
    setStatus("Extracting…", "busy");
    $("run").disabled = true;
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus(data.error || `HTTP ${res.status}`, "err");
        renderResults(data);
      } else {
        setStatus(`OK · ${data.formatCount} formats`, "ok");
        renderResults(data);
      }
    } catch (err) {
      setStatus(err.message || String(err), "err");
      renderResults({ error: err.message || String(err) });
    } finally {
      $("run").disabled = false;
    }
  });

  $("copy-json").addEventListener("click", async () => {
    if (!lastResult) return;
    await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
    setStatus("Copied JSON", "ok");
  });
}

boot().catch(err => setStatus(err.message || String(err), "err"));
