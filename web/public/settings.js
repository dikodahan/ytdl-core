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

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function renderDocs() {
  const origin = window.location.origin;
  $("api-docs").textContent = `# Health (no auth)
curl -s ${origin}/api/v1/health

# Create a token in this Settings UI, then:

# List extractors / options
curl -s ${origin}/api/v1/meta \\
  -H "Authorization: Bearer ytdl_YOUR_TOKEN"

# Extract (auto-detect site, or force with service/site)
curl -s ${origin}/api/v1/extract \\
  -H "Authorization: Bearer ytdl_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://www.dailymotion.com/video/x5kesuj","service":"dailymotion"}'

# List video ids (youporn / youjizz listing pages)
curl -s ${origin}/api/v1/list \\
  -H "Authorization: Bearer ytdl_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://www.youporn.com/category/amateur/","service":"youporn","limit":20}'

# Optional: X-API-Token header instead of Authorization
curl -s ${origin}/api/v1/extract \\
  -H "X-API-Token: ytdl_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"aqz-KE-bpKQ","service":"youtube"}'
`;
}

async function refreshTokens() {
  const data = await api("/api/v1/tokens");
  $("store-path").textContent = `Stored at ${data.store}`;
  const tbody = $("tokens").querySelector("tbody");
  tbody.innerHTML = "";

  const list = (data.tokens || []).filter(t => t.active);
  if (!list.length) {
    tbody.append(el("tr", {}, [el("td", { colSpan: "5", text: "No active tokens yet." })]));
    return;
  }

  for (const t of list) {
    tbody.append(
      el("tr", {}, [
        el("td", { text: t.name }),
        el("td", { text: t.prefix }),
        el("td", { text: fmtDate(t.createdAt) }),
        el("td", { text: fmtDate(t.lastUsedAt) }),
        el("td", {}, [
          el("button", {
            type: "button",
            className: "ghost",
            text: "Revoke",
            onclick: async () => {
              if (!confirm(`Revoke token “${t.name}”?`)) return;
              await api(`/api/v1/tokens/${t.id}/revoke`, { method: "POST", body: "{}" });
              await refreshTokens();
            },
          }),
          " ",
          el("button", {
            type: "button",
            className: "ghost",
            text: "Delete",
            onclick: async () => {
              if (!confirm(`Permanently delete token “${t.name}”?`)) return;
              await api(`/api/v1/tokens/${t.id}`, { method: "DELETE" });
              await refreshTokens();
            },
          }),
        ]),
      ]),
    );
  }
}

function showCreated(token) {
  const box = $("created");
  box.hidden = false;
  box.className = "summary";
  box.innerHTML = "";
  box.append(
    el("div", {}, [
      el("strong", { text: "Token created — copy it now" }),
      el("div", { text: `${token.name} · ${token.prefix}` }),
      el("code", { className: "token-secret", text: token.token }),
      el("div", { className: "actions" }, [
        el("button", {
          type: "button",
          text: "Copy token",
          onclick: async () => {
            await navigator.clipboard.writeText(token.token);
            $("create-status").textContent = "Token copied to clipboard.";
          },
        }),
      ]),
      el("p", {
        className: "hint warn",
        text: "This full secret is not stored. Only a hash remains on disk after you leave this page.",
      }),
    ]),
  );
}

async function boot() {
  renderDocs();
  await refreshTokens();

  $("create-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("create-status").textContent = "Creating…";
    try {
      const name = $("token-name").value.trim() || "API token";
      const data = await api("/api/v1/tokens", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      $("token-name").value = "";
      showCreated(data.token);
      $("create-status").textContent = data.warning || "Created.";
      await refreshTokens();
    } catch (err) {
      $("create-status").textContent = err.message || String(err);
    }
  });
}

boot().catch(err => {
  $("store-path").textContent = err.message || String(err);
  $("create-status").textContent =
    "Token management is only available from localhost (or with an existing Bearer token).";
});
