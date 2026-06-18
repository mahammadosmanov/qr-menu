// ============================================================
// QR Menü — admin editörü + GitHub Contents API
// Bağımlılık yok. Veri menu.json'a (ve görseller images/'a) commit'lenir.
// ============================================================

const API = 'https://api.github.com';
const LS_CONFIG = 'qrmenu.config';
const LS_TOKEN = 'qrmenu.token';

const state = {
  config: { owner: '', repo: '', branch: 'main', token: '' },
  menu: null,        // düzenlenen menü nesnesi
  sha: null,         // menu.json'un mevcut sha'sı (güncellemede gerekli)
  pendingImages: {}, // { itemId: "data:image/jpeg;base64,..." } — Kaydet'te commit edilir
};

// ---------- DOM kısayolları ----------
const $ = (id) => document.getElementById(id);
const dom = {
  owner: $('ownerInput'), repo: $('repoInput'), branch: $('branchInput'),
  token: $('tokenInput'), remember: $('rememberToken'),
  loadBtn: $('loadBtn'), connStatus: $('connStatus'), connPanel: $('connPanel'),
  editor: $('editor'), topActions: $('topActions'),
  reloadBtn: $('reloadBtn'), saveBtn: $('saveBtn'),
  restName: $('restNameInput'), currency: $('currencyInput'),
  cats: $('cats'), addCatBtn: $('addCatBtn'), toast: $('toast'),
};

// ---------- küçük DOM yardımcısı (değerler property ile atanır → kaçış derdi yok) ----------
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return node;
}

// ---------- UTF-8 ⇆ base64 (Türkçe karakter güvenli) ----------
function base64ToBytes(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64(bytes) {
  // Büyük dizilerde call-stack taşmasını önlemek için parça parça.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}
function base64ToUtf8(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

// ---------- slug (Türkçe sadeleştir) ----------
const TR_MAP = { ç:'c', Ç:'c', ş:'s', Ş:'s', ı:'i', İ:'i', ğ:'g', Ğ:'g', ö:'o', Ö:'o', ü:'u', Ü:'u' };
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g'); // birleşik aksan işaretleri
function slugify(str) {
  return (str || '')
    .split('').map((c) => TR_MAP[c] ?? c).join('')
    .toLowerCase()
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function allIds(except) {
  const ids = new Set();
  for (const c of state.menu?.categories || []) {
    if (c !== except) ids.add(c.id);
    for (const i of c.items || []) if (i !== except) ids.add(i.id);
  }
  return ids;
}
function uniqueId(base, except) {
  const taken = allIds(except);
  let id = base || 'oge';
  if (!taken.has(id)) return id;
  let n = 2;
  while (taken.has(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

// ---------- durum / bildirim ----------
function setStatus(msg, kind = 'info') {
  dom.connStatus.textContent = msg;
  dom.connStatus.className = `conn-status ${kind}`;
}
let toastTimer = null;
function toast(msg, kind = 'info') {
  dom.toast.textContent = msg;
  dom.toast.className = `toast ${kind}`;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 3500);
}
function overlay(on, text = 'İşleniyor…') {
  let node = $('overlayNode');
  if (on) {
    if (!node) {
      node = el('div', { class: 'overlay', id: 'overlayNode', role: 'status', 'aria-live': 'polite' }, text);
      document.body.appendChild(node);
    } else { node.textContent = text; node.hidden = false; }
  } else if (node) {
    node.remove();
  }
}

// ---------- GitHub API ----------
function headers() {
  return {
    'Authorization': `Bearer ${state.config.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
function repoBase() {
  const { owner, repo } = state.config;
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
async function ghGet(path) {
  const url = `${repoBase()}/contents/${path}?ref=${encodeURIComponent(state.config.branch)}`;
  return fetch(url, { headers: headers() });
}
async function ghPut(path, contentB64, message, sha) {
  const body = { message, content: contentB64, branch: state.config.branch };
  if (sha) body.sha = sha;
  return fetch(`${repoBase()}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
// Ortak HTTP hata mesajı.
function httpError(status) {
  if (status === 401 || status === 403) return 'Token geçersiz veya yetkisiz. Token\'ı kontrol et.';
  if (status === 404) return 'Bulunamadı: owner/repo/dal/dosya yolu yanlış olabilir.';
  if (status === 409) return 'Çakışma: menü dışarıdan değişmiş.';
  if (status === 422) return 'Geçersiz istek (422). Dosya yolu veya sha hatalı olabilir.';
  if (status === 429) return 'İstek sınırı doldu, biraz sonra tekrar dene.';
  return `Sunucu hatası (${status}).`;
}

// ---------- config persist ----------
function loadSavedConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(LS_CONFIG) || '{}');
    if (c.owner) dom.owner.value = c.owner;
    if (c.repo) dom.repo.value = c.repo;
    if (c.branch) dom.branch.value = c.branch;
  } catch { /* yok say */ }
  const t = localStorage.getItem(LS_TOKEN);
  if (t) { dom.token.value = t; dom.remember.checked = true; }
}
function persistConfig() {
  const { owner, repo, branch } = state.config;
  localStorage.setItem(LS_CONFIG, JSON.stringify({ owner, repo, branch }));
  if (dom.remember.checked) localStorage.setItem(LS_TOKEN, state.config.token);
  else localStorage.removeItem(LS_TOKEN);
}

// ---------- yükleme ----------
function readConfigFromForm() {
  state.config = {
    owner: dom.owner.value.trim(),
    repo: dom.repo.value.trim(),
    branch: dom.branch.value.trim() || 'main',
    token: dom.token.value.trim(),
  };
}
async function loadMenu() {
  readConfigFromForm();
  const { owner, repo, token } = state.config;
  if (!owner || !repo || !token) {
    setStatus('owner, repo ve token zorunlu.', 'err');
    return;
  }
  dom.loadBtn.disabled = true;
  setStatus('Yükleniyor…', 'info');
  try {
    const res = await ghGet('menu.json');
    if (!res.ok) { setStatus(httpError(res.status), 'err'); return; }
    const data = await res.json();
    const json = base64ToUtf8(data.content || '');
    state.menu = normalizeMenu(JSON.parse(json));
    state.sha = data.sha;
    state.pendingImages = {};
    persistConfig();
    setStatus('Menü yüklendi.', 'ok');
    showEditor();
  } catch (err) {
    console.error(err);
    setStatus('Bağlantı/çözümleme hatası: ' + (err.message || err), 'err');
  } finally {
    dom.loadBtn.disabled = false;
  }
}

// Eksik alanları güvenli varsayılanlarla doldur.
function normalizeMenu(m) {
  m = m || {};
  m.restaurant = m.restaurant || {};
  m.categories = Array.isArray(m.categories) ? m.categories : [];
  for (const c of m.categories) {
    c.items = Array.isArray(c.items) ? c.items : [];
    for (const i of c.items) {
      if (typeof i.available !== 'boolean') i.available = true;
      if (i.image === undefined) i.image = null;
      if (i.note == null) i.note = '';
    }
  }
  return m;
}

// ---------- editör render ----------
function showEditor() {
  dom.connPanel.hidden = true;
  dom.editor.hidden = false;
  dom.topActions.hidden = false;
  dom.restName.value = state.menu.restaurant.name || '';
  dom.currency.value = state.menu.restaurant.currency || 'TL';
  renderCats();
}

function renderCats() {
  dom.cats.innerHTML = '';
  state.menu.categories.forEach((cat, ci) => {
    dom.cats.appendChild(buildCatBlock(cat, ci));
  });
}

function buildCatBlock(cat, ci) {
  const total = state.menu.categories.length;

  const iconInput = el('input', {
    class: 'input cat-icon-input', type: 'text', value: cat.icon || '',
    maxlength: '4', title: 'Emoji ikon',
    oninput: (e) => { cat.icon = e.target.value; },
  });
  const nameInput = el('input', {
    class: 'input cat-name-input', type: 'text', value: cat.name || '',
    placeholder: 'Kategori adı',
    oninput: (e) => { cat.name = e.target.value; },
  });

  const tools = el('div', { class: 'cat-tools' }, [
    el('button', {
      class: 'icon-btn', type: 'button', title: 'Yukarı', disabled: ci === 0,
      onclick: () => moveCat(ci, -1),
    }, '↑'),
    el('button', {
      class: 'icon-btn', type: 'button', title: 'Aşağı', disabled: ci === total - 1,
      onclick: () => moveCat(ci, 1),
    }, '↓'),
    el('button', {
      class: 'icon-btn danger', type: 'button', title: 'Kategoriyi sil',
      onclick: () => deleteCat(ci),
    }, '🗑'),
  ]);

  const head = el('div', { class: 'cat-head' }, [iconInput, nameInput, tools]);

  const list = el('div', { class: 'item-list' },
    cat.items.map((item, ii) => buildItemRow(cat, ci, item, ii)));

  const addRow = el('div', { class: 'add-item-row' }, [
    el('button', {
      class: 'btn btn-outline btn-sm', type: 'button',
      onclick: () => addItem(ci),
    }, '+ Ürün Ekle'),
  ]);

  return el('div', { class: 'cat-block' }, [head, list, addRow]);
}

function buildItemRow(cat, ci, item, ii) {
  const total = cat.items.length;

  // available toggle
  const toggle = el('label', { class: 'switch', title: 'Stokta' }, [
    el('input', {
      type: 'checkbox', checked: item.available !== false,
      onchange: (e) => {
        item.available = e.target.checked;
        row.classList.toggle('unavailable', !item.available);
      },
    }),
    el('span', { class: 'slider' }),
  ]);

  // görsel hücresi
  const fileInput = el('input', {
    type: 'file', accept: 'image/*', style: 'display:none',
    onchange: (e) => onPickImage(e, item),
  });
  const thumbSrc = state.pendingImages[item.id] || item.image || null;
  const thumbBox = el('button', {
    class: 'thumb-box', type: 'button', title: 'Görsel ekle/değiştir',
    'aria-label': thumbSrc ? 'Görseli değiştir' : 'Görsel ekle',
    onclick: () => fileInput.click(),
  }, thumbSrc ? el('img', { src: thumbSrc, alt: '' }) : '＋');
  const thumbCell = el('div', { class: 'thumb-cell' }, [
    thumbBox, fileInput,
    (thumbSrc
      ? el('button', { class: 'thumb-remove', type: 'button', onclick: () => removeImage(item) }, 'kaldır')
      : null),
  ]);

  // ad / fiyat / not
  const nameIn = el('input', {
    class: 'input btn-sm name-in', type: 'text', value: item.name || '',
    placeholder: 'Ürün adı',
    oninput: (e) => {
      item.name = e.target.value;
      // Henüz kaydedilmemiş ürünün id'sini addan üret; varsa bekleyen görsel
      // anahtarını ve image yolunu yeni id'ye taşı (sıra: önce-ad ya da önce-görsel).
      if (item._auto) {
        const oldId = item.id;
        const newId = uniqueId(slugify(item.name) || 'urun', item);
        if (newId !== oldId) {
          if (state.pendingImages[oldId] != null) {
            state.pendingImages[newId] = state.pendingImages[oldId];
            delete state.pendingImages[oldId];
          }
          if (item.image) item.image = `images/${newId}.jpg`;
          item.id = newId;
        }
      }
    },
  });
  const priceIn = el('input', {
    class: 'input btn-sm price-in', type: 'number', inputmode: 'decimal',
    min: '0', step: 'any', value: item.price ?? 0, placeholder: '0',
    oninput: (e) => {
      const n = parseFloat(e.target.value);
      item.price = Number.isFinite(n) ? n : 0;
    },
  });
  const noteIn = el('input', {
    class: 'input btn-sm note-in', type: 'text', value: item.note || '',
    placeholder: 'Not (ör. Kişi Başı) — opsiyonel',
    oninput: (e) => { item.note = e.target.value; },
  });
  const fields = el('div', { class: 'item-fields' }, [
    el('div', { class: 'name-price' }, [nameIn, priceIn]),
    noteIn,
  ]);

  const tools = el('div', { class: 'row-tools' }, [
    el('button', { class: 'icon-btn', type: 'button', title: 'Yukarı', disabled: ii === 0, onclick: () => moveItem(ci, ii, -1) }, '↑'),
    el('button', { class: 'icon-btn', type: 'button', title: 'Aşağı', disabled: ii === total - 1, onclick: () => moveItem(ci, ii, 1) }, '↓'),
    el('button', { class: 'icon-btn danger', type: 'button', title: 'Ürünü sil', onclick: () => deleteItem(ci, ii) }, '🗑'),
  ]);

  const row = el('div', {
    class: 'item-row' + (item.available === false ? ' unavailable' : ''),
  }, [toggle, thumbCell, fields, tools]);
  return row;
}

// ---------- yapısal işlemler (state güncelle → yeniden çiz) ----------
function moveCat(ci, dir) {
  const arr = state.menu.categories;
  const j = ci + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[ci], arr[j]] = [arr[j], arr[ci]];
  renderCats();
}
function deleteCat(ci) {
  const c = state.menu.categories[ci];
  if (!confirm(`"${c.name || 'kategori'}" ve içindeki tüm ürünler silinsin mi?`)) return;
  state.menu.categories.splice(ci, 1);
  renderCats();
}
function addCategory() {
  const id = uniqueId('kategori');
  state.menu.categories.push({ id, name: 'Yeni Kategori', icon: '🍽️', items: [] });
  renderCats();
  dom.cats.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function addItem(ci) {
  const cat = state.menu.categories[ci];
  const id = uniqueId('urun');
  cat.items.push({ id, name: '', price: 0, note: '', image: null, available: true, _auto: true });
  renderCats();
}
function moveItem(ci, ii, dir) {
  const arr = state.menu.categories[ci].items;
  const j = ii + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[ii], arr[j]] = [arr[j], arr[ii]];
  renderCats();
}
function deleteItem(ci, ii) {
  const item = state.menu.categories[ci].items[ii];
  if (!confirm(`"${item.name || 'ürün'}" silinsin mi?`)) return;
  delete state.pendingImages[item.id];
  state.menu.categories[ci].items.splice(ii, 1);
  renderCats();
}

// ---------- görsel ----------
async function onPickImage(e, item) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // aynı dosya tekrar seçilebilsin
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file, 800, 0.8);
    // _auto'yu DONDURMA: ad sonradan yazılırsa id ve bu pending anahtarı birlikte taşınır.
    state.pendingImages[item.id] = dataUrl;
    item.image = `images/${item.id}.jpg`;
    renderCats();
    toast('Görsel hazır — Kaydet\'e basınca yüklenecek.', 'info');
  } catch (err) {
    console.error(err);
    toast('Görsel işlenemedi.', 'err');
  }
}
function removeImage(item) {
  delete state.pendingImages[item.id];
  item.image = null;
  renderCats();
}
// Canvas ile client-side resize: en uzun kenar ≤ maxEdge, JPEG.
function resizeImage(file, maxEdge = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width >= height && width > maxEdge) {
        height = Math.round((height * maxEdge) / width); width = maxEdge;
      } else if (height > width && height > maxEdge) {
        width = Math.round((width * maxEdge) / height); height = maxEdge;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';        // JPEG'de şeffaflık yok
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı')); };
    img.src = url;
  });
}

// ---------- kaydetme ----------
function serializeMenu() {
  const m = state.menu;
  return {
    restaurant: {
      name: (m.restaurant.name || '').trim() || 'Kafe Adı',
      currency: (m.restaurant.currency || '').trim() || 'TL',
    },
    categories: m.categories.map((c) => ({
      id: c.id,
      name: c.name || '',
      icon: c.icon || '',
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name || '',
        price: Number(i.price) || 0,
        note: i.note || '',
        image: i.image || null,
        available: i.available !== false,
      })),
    })),
  };
}

async function commitPendingImages() {
  const entries = Object.entries(state.pendingImages);
  for (let k = 0; k < entries.length; k++) {
    const [id, dataUrl] = entries[k];
    const b64 = dataUrl.split(',')[1];
    const path = `images/${id}.jpg`;
    overlay(true, `Görsel yükleniyor (${k + 1}/${entries.length})…`);

    // Üzerine yazılıyorsa mevcut dosyanın sha'sı gerekir.
    let sha;
    const getRes = await ghGet(path);
    if (getRes.ok) { sha = (await getRes.json()).sha; }
    else if (getRes.status !== 404) {
      throw new Error(`Görsel okunamadı (${getRes.status}): ${id}.jpg`);
    }

    const putRes = await ghPut(path, b64, `Görsel: ${id}.jpg`, sha);
    if (!putRes.ok) throw new Error(`Görsel yüklenemedi (${putRes.status}): ${id}.jpg`);
    delete state.pendingImages[id];
  }
}

async function saveMenu() {
  if (!state.menu) return;
  dom.saveBtn.disabled = true;
  try {
    // 1) Bekleyen görselleri commit et; kısmi başarıyı kullanıcıya net bildir.
    const pendingBefore = Object.keys(state.pendingImages).length;
    try {
      await commitPendingImages();
    } catch (imgErr) {
      overlay(false);
      const committed = pendingBefore - Object.keys(state.pendingImages).length;
      if (committed > 0) {
        toast(`Bazı görseller yüklendi (${committed}/${pendingBefore}) ama menü güncellenemedi. Lütfen tekrar Kaydet'e bas.`, 'err');
      } else {
        toast('Görsel yüklenemedi: ' + (imgErr.message || imgErr), 'err');
      }
      return; // menu.json'a geçme — kalan görseller pendingImages'te tutulur
    }

    // 2) menu.json'u UTF-8 base64 olarak commit et.
    overlay(true, 'Menü kaydediliyor…');
    const json = JSON.stringify(serializeMenu(), null, 2);
    const b64 = utf8ToBase64(json);
    const res = await ghPut('menu.json', b64, 'Menü güncellendi', state.sha);

    if (res.status === 409) {
      // sha çakışması: dış değişiklik var. Kullanıcıya bilinçli seçim sun.
      overlay(false);
      const fresh = await ghGet('menu.json');
      if (fresh.ok) {
        state.sha = (await fresh.json()).sha;
        const reload = confirm(
          'Menü başka bir yerden değiştirilmiş.\n\n' +
          'TAMAM = uzaktaki güncel sürümü yükle (senin kaydedilmemiş düzenlemelerin gider).\n' +
          'İPTAL = kendi sürümünle devam et (tekrar Kaydet, dış değişikliklerin ÜZERİNE YAZAR).'
        );
        if (reload) { await loadMenu(); }
        else { toast('Güncel sürüm alındı. Tekrar Kaydet\'e basarsan dış değişiklikler üzerine yazılır.', 'info'); }
      } else {
        state.sha = null; // bayat sha ile 409/422 döngüsünü kır
        toast('Güncel sürüm alınamadı (' + httpError(fresh.status) + '). "Yeniden Yükle" ile baştan yükleyin.', 'err');
      }
      return;
    }
    if (!res.ok) { overlay(false); toast(httpError(res.status), 'err'); return; }

    const out = await res.json();
    state.sha = out.content?.sha || state.sha; // sonraki kayıt için yeni sha
    // Kaydedildi: tüm id'ler artık kalıcı → otomatik id üretimini dondur (dosya adı tutarlılığı).
    state.menu.categories.forEach((c) => c.items.forEach((i) => { delete i._auto; }));
    overlay(false);
    toast('Kaydedildi ✓ Yayın ~1 dk içinde güncellenir.', 'ok');
  } catch (err) {
    console.error(err);
    overlay(false);
    toast('Kaydedilemedi: ' + (err.message || err), 'err');
  } finally {
    dom.saveBtn.disabled = false;
  }
}

// ---------- olaylar ----------
dom.loadBtn.addEventListener('click', loadMenu);
dom.reloadBtn.addEventListener('click', () => {
  if (Object.keys(state.pendingImages).length || state.menu) {
    if (!confirm('Kaydedilmemiş değişiklikler kaybolabilir. Sunucudan yeniden yüklensin mi?')) return;
  }
  loadMenu();
});
dom.saveBtn.addEventListener('click', saveMenu);
dom.addCatBtn.addEventListener('click', addCategory);
dom.restName.addEventListener('input', (e) => { state.menu.restaurant.name = e.target.value; });
dom.currency.addEventListener('input', (e) => { state.menu.restaurant.currency = e.target.value; });

// Yüklenmemiş görsel varken sayfadan çıkış uyarısı (geri alınamayan tek durum).
window.addEventListener('beforeunload', (e) => {
  if (Object.keys(state.pendingImages).length) {
    e.preventDefault();
    e.returnValue = '';
  }
});

loadSavedConfig();
