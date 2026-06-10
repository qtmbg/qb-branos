/* QB BrandOS · File upload card
   Last updated: 2026-05-22
   Spec reference: chapter-03/step-3-spec.md §1 (Bucket + RLS) + §3 sub-PR 3B.

   Self-contained vanilla module. Loads via:
     <script src="/js/qb-file-upload.js" defer></script>
   then a one-line mount call from the host page once auth is resolved:
     QBFileUpload.mount(parentEl, { authToken, userId });

   Behavior summary:
     - Loads supabase-js from CDN on mount (same pattern as qb-realtime-manager).
     - Lists files in user-uploads/{userId}/ via Supabase Storage list API.
     - Drag-drop + click-to-browse upload affordance.
     - Client-side guards before upload: file_size_limit (25 MB), allowed
       MIME types. Bucket enforces both at the storage layer too.
     - Original filename stored in Storage object metadata.
     - Delete button per row.
     - Inline error display.
     - DOM tokens from :root only, reduced-motion respected.
*/

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.QBFileUpload) return;

  const BUCKET = 'user-uploads';
  const FILE_SIZE_LIMIT_BYTES = 26214400; // 25 MB · matches migration 019
  const FILE_SIZE_LIMIT_LABEL = '25 MB';
  const ALLOWED_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
    'application/pdf',
  ]);
  const ACCEPT_ATTR = '.png,.jpg,.jpeg,.svg,.webp,.pdf,image/png,image/jpeg,image/svg+xml,image/webp,application/pdf';

  // Chapter 3 step 4 · the attach-to-Visual-DNA affordance. Mirrors the
  // server-side vision discipline (agents/contract.js): PNG, JPEG, and
  // WebP only, 5 MB cap. SVG and PDF upload fine but are not readable by
  // the agent, so their rows carry no attach button.
  const VISION_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const VISION_CAP_BYTES = 5 * 1024 * 1024;
  const VISION_AGENT_TYPE = 'visual_dna_synthesizer';

  let supabaseClient = null;
  let authToken = null;
  let userId = null;
  let mountEl = null;
  let listEl = null;
  let dropZoneEl = null;
  let fileInputEl = null;
  let errorEl = null;
  let statusEl = null;
  let stylesInjected = false;

  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function extFromMime(mime) {
    const map = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/svg+xml': 'svg',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return map[mime] || 'bin';
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-qb-file-upload', '1');
    style.textContent = `
      .qb-file-card {
        background: var(--cream-card);
        border: 2px solid var(--ink);
        border-radius: var(--radius-card);
        padding: var(--space-l);
        box-shadow: 0 9px var(--ink);
        margin-top: var(--space-l);
      }
      @media (min-width: 640px) {
        .qb-file-card { box-shadow: 0 16px var(--ink); }
      }
      .qb-file-card_eyebrow {
        font-family: var(--font-mono);
        font-size: var(--step--2);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ink);
        opacity: 0.7;
        margin-bottom: var(--space-2xs);
      }
      .qb-file-card_title {
        font-family: var(--font-display);
        font-weight: 600;
        font-size: var(--step-3);
        font-variation-settings: 'SOFT' 60;
        margin: 0 0 var(--space-s) 0;
        color: var(--ink);
      }
      .qb-file-card_meta {
        font-family: var(--font-body);
        font-size: var(--step--1);
        color: var(--ink);
        opacity: 0.75;
        margin-bottom: var(--space-m);
      }
      .qb-file-drop {
        border: 2px dashed var(--ink);
        border-radius: var(--radius-card);
        padding: var(--space-l);
        text-align: center;
        cursor: pointer;
        transition: background var(--duration-pill) var(--ease-pill);
      }
      .qb-file-drop:hover,
      .qb-file-drop.is-dragover {
        background: var(--cream-warm, var(--cream));
      }
      .qb-file-drop_label {
        font-family: var(--font-body);
        font-size: var(--step-0);
        color: var(--ink);
      }
      .qb-file-drop_hint {
        font-family: var(--font-mono);
        font-size: var(--step--2);
        letter-spacing: 0.06em;
        color: var(--ink);
        opacity: 0.6;
        margin-top: var(--space-2xs);
      }
      .qb-file-input { display: none; }
      .qb-file-list {
        list-style: none;
        padding: 0;
        margin: var(--space-m) 0 0 0;
      }
      .qb-file-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-s);
        padding: var(--space-s) 0;
        border-top: 1px solid var(--ink);
        border-top-color: rgba(45, 21, 33, 0.15);
      }
      .qb-file-row:first-child { border-top: none; }
      .qb-file-row_main {
        flex: 1;
        min-width: 0;
      }
      .qb-file-row_name {
        font-family: var(--font-body);
        font-size: var(--step-0);
        color: var(--ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .qb-file-row_meta {
        font-family: var(--font-mono);
        font-size: var(--step--2);
        letter-spacing: 0.04em;
        color: var(--ink);
        opacity: 0.65;
        margin-top: 2px;
      }
      .qb-file-row_delete {
        background: transparent;
        border: 1px solid var(--ink);
        border-radius: var(--radius-pill);
        padding: 0.3em 0.8em;
        font-family: var(--font-mono);
        font-size: var(--step--2);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        color: var(--ink);
      }
      .qb-file-row_delete:hover {
        background: var(--ink);
        color: var(--cream);
      }
      .qb-file-row_delete[disabled] {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .qb-file-row_attach {
        background: var(--ink);
        color: var(--cream);
        border: 1px solid var(--ink);
        border-radius: var(--radius-pill);
        padding: 0.3em 0.8em;
        font-family: var(--font-mono);
        font-size: var(--step--2);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .qb-file-row_attach:hover {
        background: transparent;
        color: var(--ink);
      }
      .qb-file-row_attach[disabled] {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .qb-file-status {
        font-family: var(--font-body);
        font-size: var(--step--1);
        color: var(--ink);
        margin-top: var(--space-s);
      }
      .qb-file-status:empty { display: none; }
      .qb-file-empty {
        font-family: var(--font-body);
        font-size: var(--step--1);
        color: var(--ink);
        opacity: 0.65;
        font-style: italic;
        padding: var(--space-s) 0;
      }
      .qb-file-error {
        font-family: var(--font-body);
        font-size: var(--step--1);
        color: var(--rose-deep, #B33A5C);
        margin-top: var(--space-s);
      }
      .qb-file-error:empty { display: none; }
      @media (prefers-reduced-motion: reduce) {
        .qb-file-drop { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  async function loadSupabase() {
    if (supabaseClient) return supabaseClient;
    const url = window.QB?.SUPA_URL;
    const anon = window.QB?.SUPA_KEY;
    if (!url || !anon) throw new Error('QB.SUPA_URL / QB.SUPA_KEY not configured');
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient = mod.createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${authToken}` } },
    });
    return supabaseClient;
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || '';
  }

  function buildSkeleton() {
    const card = document.createElement('section');
    card.className = 'qb-file-card';
    card.setAttribute('aria-labelledby', 'qb-file-card-title');

    const eyebrow = document.createElement('div');
    eyebrow.className = 'qb-file-card_eyebrow';
    eyebrow.textContent = 'Your files';
    card.appendChild(eyebrow);

    const title = document.createElement('h2');
    title.id = 'qb-file-card-title';
    title.className = 'qb-file-card_title';
    title.textContent = 'Brand references';
    card.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'qb-file-card_meta';
    meta.textContent = `Upload logo references, brand documents, and other source files. ${FILE_SIZE_LIMIT_LABEL} per file. PNG, JPEG, SVG, WebP, PDF. Attach a PNG, JPEG, or WebP up to 5 MB and Visual DNA reads it on its next run.`;
    card.appendChild(meta);

    const drop = document.createElement('label');
    drop.className = 'qb-file-drop';
    drop.setAttribute('for', 'qb-file-input');
    drop.setAttribute('tabindex', '0');
    drop.innerHTML = `
      <div class="qb-file-drop_label">Drop files here or click to choose</div>
      <div class="qb-file-drop_hint">${FILE_SIZE_LIMIT_LABEL} max</div>
    `;
    dropZoneEl = drop;
    card.appendChild(drop);

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'qb-file-input';
    input.className = 'qb-file-input';
    input.multiple = true;
    input.accept = ACCEPT_ATTR;
    fileInputEl = input;
    card.appendChild(input);

    const list = document.createElement('ul');
    list.className = 'qb-file-list';
    list.setAttribute('aria-label', 'Uploaded files');
    listEl = list;
    card.appendChild(list);

    const err = document.createElement('div');
    err.className = 'qb-file-error';
    err.setAttribute('aria-live', 'polite');
    errorEl = err;
    card.appendChild(err);

    const status = document.createElement('div');
    status.className = 'qb-file-status';
    status.setAttribute('aria-live', 'polite');
    statusEl = status;
    card.appendChild(status);

    return card;
  }

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  }

  // Chapter 3 step 4 · rerun Visual DNA with an attached reference image.
  // Flow: find the latest delivered Visual DNA artifact (RLS scopes the
  // read to the signed-in user), then POST /api/agents/rerun with the
  // file path + the reference-image contract type. The server validates
  // ownership, MIME, and the 5 MB vision cap again before any dispatch.
  async function attachToVisualDna(objName, btn) {
    showError('');
    showStatus('');
    btn.disabled = true;
    try {
      const supa = await loadSupabase();
      const { data: rows, error: qErr } = await supa
        .from('artifacts')
        .select('id,version')
        .eq('artifact_type', VISION_AGENT_TYPE)
        .eq('status', 'delivered')
        .order('version', { ascending: false })
        .limit(1);
      if (qErr) throw new Error(qErr.message || 'artifact lookup failed');
      const sourceArtifact = rows?.[0];
      if (!sourceArtifact?.id) {
        showError('Run Visual DNA first. Attaching needs a delivered Visual DNA artifact to rerun against.');
        btn.disabled = false;
        return;
      }
      const res = await fetch('/api/agents/rerun', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artifact_id: sourceArtifact.id,
          files: [{ path: `${userId}/${objName}`, type: 'reference-image' }],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `rerun failed (${res.status})`);
      }
      showStatus('Visual DNA is rereading with your image. The new version lands in your Console.');
    } catch (e) {
      showError(`Attach failed: ${e?.message || e}`);
    }
    btn.disabled = false;
  }

  function clientGuard(file) {
    if (file.size > FILE_SIZE_LIMIT_BYTES) {
      return `${file.name}: too large (${formatBytes(file.size)} > ${FILE_SIZE_LIMIT_LABEL}).`;
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return `${file.name}: file type ${file.type || 'unknown'} not allowed.`;
    }
    return null;
  }

  async function uploadOne(file) {
    const supa = await loadSupabase();
    const id = uuid();
    const ext = extFromMime(file.type);
    const path = `${userId}/${id}.${ext}`;
    const { error } = await supa.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      metadata: { original_filename: file.name },
    });
    if (error) {
      throw new Error(error.message || 'Upload failed');
    }
    return { id, path, name: file.name, mime: file.type, size: file.size };
  }

  async function uploadMany(files) {
    showError('');
    const errors = [];
    for (const file of files) {
      const guardMsg = clientGuard(file);
      if (guardMsg) {
        errors.push(guardMsg);
        continue;
      }
      try {
        await uploadOne(file);
      } catch (e) {
        errors.push(`${file.name}: ${e?.message || 'upload failed'}`);
      }
    }
    if (errors.length > 0) {
      showError(errors.join(' · '));
    }
    await refreshList();
  }

  async function refreshList() {
    if (!listEl) return;
    const supa = await loadSupabase().catch(() => null);
    if (!supa) {
      listEl.innerHTML = '<li class="qb-file-empty">Storage client unavailable.</li>';
      return;
    }
    const { data, error } = await supa.storage.from(BUCKET).list(userId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) {
      listEl.innerHTML = '';
      showError(`Could not list files: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      listEl.innerHTML = '<li class="qb-file-empty">No files yet.</li>';
      return;
    }
    listEl.innerHTML = '';
    for (const obj of data) {
      const li = document.createElement('li');
      li.className = 'qb-file-row';

      const main = document.createElement('div');
      main.className = 'qb-file-row_main';
      const nameEl = document.createElement('div');
      nameEl.className = 'qb-file-row_name';
      nameEl.textContent = obj.metadata?.original_filename || obj.name;
      const metaEl = document.createElement('div');
      metaEl.className = 'qb-file-row_meta';
      const size = obj.metadata?.size ? formatBytes(obj.metadata.size) : '';
      const mime = obj.metadata?.mimetype || '';
      const date = obj.created_at ? new Date(obj.created_at).toLocaleDateString() : '';
      metaEl.textContent = [size, mime, date].filter(Boolean).join(' · ');
      main.appendChild(nameEl);
      main.appendChild(metaEl);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'qb-file-row_delete';
      del.textContent = 'Remove';
      del.addEventListener('click', async () => {
        del.disabled = true;
        const fullPath = `${userId}/${obj.name}`;
        const { error: delErr } = await supa.storage.from(BUCKET).remove([fullPath]);
        if (delErr) {
          showError(`Delete failed: ${delErr.message}`);
          del.disabled = false;
          return;
        }
        await refreshList();
      });

      li.appendChild(main);

      // Attach affordance only on agent-readable rows: vision MIME within
      // the 5 MB cap. SVG and PDF rows carry no button by design.
      const rowMime = obj.metadata?.mimetype || '';
      const rowSize = obj.metadata?.size || 0;
      if (VISION_MIME.has(rowMime) && rowSize > 0 && rowSize <= VISION_CAP_BYTES) {
        const attach = document.createElement('button');
        attach.type = 'button';
        attach.className = 'qb-file-row_attach';
        attach.textContent = 'Attach to Visual DNA';
        attach.addEventListener('click', () => attachToVisualDna(obj.name, attach));
        li.appendChild(attach);
      }

      li.appendChild(del);
      listEl.appendChild(li);
    }
  }

  function wireDragDrop() {
    if (!dropZoneEl || !fileInputEl) return;

    dropZoneEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropZoneEl.classList.add('is-dragover');
    });
    dropZoneEl.addEventListener('dragleave', () => {
      dropZoneEl.classList.remove('is-dragover');
    });
    dropZoneEl.addEventListener('drop', async e => {
      e.preventDefault();
      dropZoneEl.classList.remove('is-dragover');
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) await uploadMany(files);
    });

    fileInputEl.addEventListener('change', async () => {
      const files = Array.from(fileInputEl.files || []);
      if (files.length > 0) await uploadMany(files);
      fileInputEl.value = '';
    });
  }

  window.QBFileUpload = {
    async mount(slot, opts) {
      if (!slot || !opts || !opts.authToken || !opts.userId) return;
      if (slot.dataset.qbFileMounted === 'true') return;
      authToken = opts.authToken;
      userId = opts.userId;
      mountEl = slot;
      injectStyles();
      slot.innerHTML = '';
      slot.appendChild(buildSkeleton());
      slot.dataset.qbFileMounted = 'true';
      wireDragDrop();
      try {
        await refreshList();
      } catch (e) {
        showError(`Failed to load files: ${e?.message || e}`);
      }
    },
    unmount() {
      if (mountEl) {
        mountEl.innerHTML = '';
        mountEl.dataset.qbFileMounted = 'false';
      }
      mountEl = null;
      listEl = null;
      dropZoneEl = null;
      fileInputEl = null;
      errorEl = null;
      statusEl = null;
      authToken = null;
      userId = null;
      supabaseClient = null;
    },
    refresh: () => refreshList().catch(() => {}),
  };
})();
