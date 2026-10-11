/* =========================================================
   Job Files — drawings, DXF/CAD, photos, PDFs, signed contracts
   Stored privately in Supabase Storage at <shop>/<job>/<file>.
   ========================================================= */
const FILE_MAX = 50 * 1024 * 1024;
const BUCKET = 'kerf-files';
const LOCAL_BLOBS = new Map(); // demo mode only: file id → object URL (gone on reload)
const UPLOADING = new Map(); // job id → files still uploading
const isImageFile = (f) => /^image\//.test(f.type || '') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name || '');
const fileExt = (f) => { const m = String(f.name || '').match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toUpperCase() : 'FILE'; };
const safeName = (n) => String(n || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').slice(-90) || 'file';
const canDeleteFiles = () => S.canWrite && isStaff();

async function uploadFiles(jobId, list) {
  if (!guardWrite()) return;
  const files = Array.from(list || []);
  if (!files.length || !jobOf(jobId)) return;
  const big = files.filter((f) => f.size > FILE_MAX);
  if (big.length) toast(`${big.map((f) => f.name).join(', ')} ${big.length > 1 ? 'are' : 'is'} over 50 MB and wasn’t uploaded`, { bad: true, ms: 7000 });
  const ok = files.filter((f) => f.size <= FILE_MAX && f.size > 0);
  if (!ok.length) return;
  UPLOADING.set(jobId, (UPLOADING.get(jobId) || 0) + ok.length); schedule();
  const names = [];
  let failed = 0, firstErr = '';
  for (const f of ok) {
    const id = uid();
    const path = `${S.shopId || 'demo'}/${jobId}/${id}-${safeName(f.name)}`;
    let thumb = '';
    if (/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { try { thumb = await readImage(f, { max: 320 }); } catch (e) { thumb = ''; } }
    try {
      if (S.mode === 'db') {
        const { error } = await SB.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (error) throw error;
      } else {
        LOCAL_BLOBS.set(id, URL.createObjectURL(f));
      }
      await put('files', id, { jobId, name: f.name, size: f.size, type: f.type || '', path, thumb, by: S.me || '', at: Date.now() });
      names.push(f.name);
    } catch (e) {
      failed++; firstErr = firstErr || (e && e.message) || '';
      console.warn('upload failed', e);
    }
    UPLOADING.set(jobId, Math.max(0, (UPLOADING.get(jobId) || 1) - 1)); schedule();
  }
  if (names.length) {
    await addNote(jobId, `Added ${names.length} file${names.length === 1 ? '' : 's'}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}`, 'event');
    await patch('jobs', jobId, { updatedAt: Date.now() });
    toast(`${names.length} file${names.length === 1 ? '' : 's'} added`);
  }
  if (failed) {
    const hint = /bucket/i.test(firstErr) ? ' Run the latest database setup script in Supabase to turn on file storage.' : /exceed|size|large/i.test(firstErr) ? ' The file is too big.' : '';
    toast(`${failed} file${failed === 1 ? '' : 's'} didn’t upload.${hint}`, { bad: true, ms: 8000 });
  }
}
async function fileUrl(f, download = false) {
  if (S.mode !== 'db') {
    const u = LOCAL_BLOBS.get(f.id);
    if (!u) throw new Error('Demo files are only kept until you reload the page.');
    return u;
  }
  const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(f.path, 3600, download ? { download: f.name } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
function openFile(id) {
  const f = S.files.get(id);
  if (!f) return;
  if (isImageFile(f)) { photoViewer(id); return; }
  const w = window.open('', '_blank'); // opened right away so the browser doesn't block it
  fileUrl(f).then((u) => { if (w) w.location.href = u; else location.assign(u); })
    .catch((e) => { if (w) w.close(); toast(e.message || 'Couldn’t open that file', { bad: true }); });
}
async function downloadFile(id) {
  const f = S.files.get(id);
  if (!f) return;
  try {
    const u = await fileUrl(f, true);
    const a = document.createElement('a');
    a.href = u; a.download = f.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast(e.message || 'Couldn’t download that file', { bad: true }); }
}
async function deleteFile(f, quiet = false) {
  if (S.mode === 'db') {
    const { error } = await SB.storage.from(BUCKET).remove([f.path]);
    if (error && !quiet) { reportErr(error); return false; }
  } else {
    const u = LOCAL_BLOBS.get(f.id); if (u) URL.revokeObjectURL(u); LOCAL_BLOBS.delete(f.id);
  }
  await remove('files', f.id);
  return true;
}
function photoViewer(id) {
  const f = S.files.get(id);
  if (!f) return;
  const photos = filesForJob(f.jobId).filter(isImageFile);
  const i = photos.findIndex((x) => x.id === id);
  const by = member(f.by);
  MS = { kind: 'photo', id, list: photos.map((x) => x.id) };
  openModal({
    title: f.name, wide: true, cls: 'viewer',
    body: `<div class="viewer-img" id="viewer-img">${f.thumb ? `<img src="${safeImg(f.thumb)}" alt="" class="blurry">` : ''}<span class="faint" id="viewer-wait">Loading…</span></div>
      <div class="faint" style="font-size:12.5px">${esc(by ? by.name : 'Someone')} · ${ago(f.at)} · ${fmtBytes(f.size)}${photos.length > 1 ? ` · ${i + 1} of ${photos.length}` : ''}</div>`,
    foot: `${canDeleteFiles() ? `<button class="btn danger left" data-act="file-delete" data-id="${esc(f.id)}">${icon('trash')}Delete</button>` : ''}${photos.length > 1 ? `<button class="btn icon" data-act="photo-step" data-d="-1" aria-label="Previous photo">${icon('back')}</button><button class="btn icon" data-act="photo-step" data-d="1" aria-label="Next photo">${icon('next')}</button>` : ''}<button class="btn" data-act="file-download" data-id="${esc(f.id)}">${icon('download')}Download</button><button class="btn primary" data-act="close-modal">Done</button>`,
  });
  fileUrl(f).then((u) => {
    const box = $('#viewer-img');
    if (!box || !MS || MS.id !== id) return;
    const img = new Image();
    img.alt = f.name;
    img.onload = () => { box.innerHTML = ''; box.appendChild(img); };
    img.onerror = () => { const w = $('#viewer-wait'); if (w) w.textContent = 'This photo can’t be shown here. Use Download.'; };
    img.src = u;
  }).catch((e) => { const w = $('#viewer-wait'); if (w) w.textContent = e.message || 'Couldn’t load the photo.'; });
}
function filesCardHTML(j) {
  const list = filesForJob(j.id);
  const up = UPLOADING.get(j.id) || 0;
  const photos = list.filter(isImageFile), docs = list.filter((f) => !isImageFile(f));
  const W = S.canWrite;
  const del = canDeleteFiles();
  const docRow = (f) => { const m = member(f.by); return `<div class="row frow"><span class="fext" data-ext="${esc(fileExt(f))}">${esc(fileExt(f))}</span>
    <button class="grow linkish" data-act="file-open" data-id="${esc(f.id)}"><span class="t1">${esc(f.name)}</span><span class="t2">${fmtBytes(f.size)} · ${esc(m ? m.name.split(' ')[0] : 'Someone')} · ${ago(f.at)}</span></button>
    <button class="btn icon ghost sm" data-act="file-download" data-id="${esc(f.id)}" aria-label="Download ${esc(f.name)}">${icon('download')}</button>
    ${del ? `<button class="btn icon ghost sm" data-act="file-delete" data-id="${esc(f.id)}" aria-label="Delete ${esc(f.name)}">${icon('trash')}</button>` : ''}</div>`; };
  return `<div class="card files-card" data-drop-files="${esc(j.id)}"><div class="card-h"><h2>Files</h2><span class="faint">${list.length || ''}</span>
      ${W ? `<label class="btn sm">${icon('camera')}Photo<input type="file" accept="image/*" capture="environment" multiple class="sr" data-upload="jobfiles" data-id="${esc(j.id)}"></label>
      <label class="btn sm">${icon('clip')}Attach file<input type="file" multiple class="sr" data-upload="jobfiles" data-id="${esc(j.id)}"></label>` : ''}</div>
    ${up ? `<div class="uploading"><i></i>Uploading ${up} file${up === 1 ? '' : 's'}…</div>` : ''}
    ${photos.length ? `<div class="photo-grid">${photos.map((f) => `<button class="pthumb" data-act="file-open" data-id="${esc(f.id)}" aria-label="Open ${esc(f.name)}">${safeImg(f.thumb) ? `<img src="${safeImg(f.thumb)}" alt="" loading="lazy">` : `<span>${esc(fileExt(f))}</span>`}</button>`).join('')}</div>` : ''}
    ${docs.length ? `<div class="rows">${docs.map(docRow).join('')}</div>` : ''}
    ${!list.length && !up ? `<div class="dropzone">${icon('clip')}<b>Drawings, DXF files, photos, plans, signed contracts</b><span>${W ? 'Drop files here, or use Attach file. Crew can add site photos from their phone.' : 'No files yet.'}</span></div>` : W ? '<div class="drop-hint">Drop files anywhere on this card to attach them</div>' : ''}
  </div>`;
}
const FILE_ACTIONS = {
  'file-open': (el) => openFile(el.dataset.id),
  'file-download': (el) => downloadFile(el.dataset.id),
  'file-delete': async (el) => {
    const f = S.files.get(el.dataset.id); if (!f) return;
    if (!(await confirmBox(`Delete ${f.name}?`, 'It’s removed for everyone. This can’t be undone.', 'Delete', true))) return;
    if (await deleteFile(f)) { await addNote(f.jobId, `Deleted file: ${f.name}`, 'event'); toast('File deleted'); }
  },
  'photo-step': (el) => {
    if (!MS || MS.kind !== 'photo') return;
    const i = MS.list.indexOf(MS.id); const n = MS.list.length;
    photoViewer(MS.list[(i + Number(el.dataset.d) + n) % n]);
  },
};
/* drag files from the computer onto a job's Files card */
document.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  const z = e.target.closest && e.target.closest('[data-drop-files]');
  if (!z || !S.canWrite) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  z.classList.add('filedrop');
});
document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-drop-files]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('filedrop'); });
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  const z = e.target.closest && e.target.closest('[data-drop-files]');
  if (!z) return;
  e.preventDefault(); z.classList.remove('filedrop');
  uploadFiles(z.dataset.dropFiles, e.dataTransfer.files);
});
