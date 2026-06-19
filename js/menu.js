// ============================================================
// Ada Cafe — müşteri tarafı render mantığı
// Bağımlılık yok, build yok. menu.json'ı okur (offline bootstrap ile).
// ============================================================

const els = {
  title: document.getElementById('siteTitle'),
  tagline: document.getElementById('tagline'),
  nav: document.getElementById('catNav'),
  root: document.getElementById('menuRoot'),
  loading: document.getElementById('loading'),
  error: document.getElementById('errorState'),
  footer: document.getElementById('footerNote'),
};

// Scroll-spy kaynakları — her render'da temizlenip yeniden kurulur (sızıntı önleme).
let activeObserver = null;
let activeOnScroll = null;

// Fotoğraf büyütme (lightbox) — bir kez kurulur.
const lb = {
  root: document.getElementById('lightbox'),
  img: document.getElementById('lightboxImg'),
  cap: document.getElementById('lightboxCap'),
  close: document.getElementById('lightboxClose'),
};
function openLightbox(src, caption) {
  if (!lb.root) return;
  lb.img.src = src;
  lb.img.alt = caption || '';
  lb.cap.textContent = caption || '';
  lb.root.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  if (!lb.root) return;
  lb.root.hidden = true;
  lb.img.removeAttribute('src');
  document.body.style.overflow = '';
}
if (lb.root) {
  lb.close.addEventListener('click', closeLightbox);
  lb.root.addEventListener('click', (e) => { if (e.target === lb.root) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lb.root.hidden) closeLightbox();
  });
}

// Fiyatı biçimle: TL/₺ için "₺650", diğer birimlerde "650 USD".
function formatPrice(price, currency) {
  const num = Number(price);
  const shown = Number.isFinite(num) ? num.toLocaleString('tr-TR') : price;
  const cur = (currency || '').trim();
  if (cur === 'TL' || cur === '₺' || cur === 'TRY') return `₺${shown}`;
  return `${shown} ${cur}`.trim();
}

function clearStatus() {
  if (els.loading) els.loading.remove();
  els.error.hidden = true;
}

function showError(message, { retry = false } = {}) {
  if (els.loading) els.loading.remove();
  els.root.innerHTML = '';
  els.nav.innerHTML = '';
  els.error.hidden = false;
  els.error.innerHTML = '';

  const emoji = document.createElement('span');
  emoji.className = 'state-emoji';
  emoji.textContent = '🍽️';
  const text = document.createElement('div');
  text.textContent = message;
  els.error.append(emoji, text);

  if (retry) {
    const btn = document.createElement('button');
    btn.className = 'retry-btn';
    btn.type = 'button';
    btn.textContent = 'Tekrar dene';
    btn.addEventListener('click', () => load());
    els.error.append(btn);
  }
}

// Ürün kartı: solda görsel (yoksa kategori emojili tile), sağda ad/not/fiyat.
function buildCard(item, currency, catIcon) {
  const card = document.createElement('article');
  card.className = 'item-card';

  const thumb = document.createElement('div');
  thumb.className = 'item-thumb';
  if (item.image) {
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    // Görsel yüklenemezse emoji placeholder'a düş.
    img.addEventListener('error', () => {
      img.remove();
      const ph = document.createElement('span');
      ph.className = 'ph';
      ph.textContent = catIcon || '🍽️';
      thumb.appendChild(ph);
    });
    thumb.appendChild(img);
    // Fotoğrafa tıklayınca/Enter ile büyüt (lightbox).
    thumb.classList.add('zoomable');
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('aria-label', `${item.name || 'Ürün'} fotoğrafını büyüt`);
    const openZoom = () => {
      const current = thumb.querySelector('img');
      if (current) openLightbox(current.src, item.name || '');
    };
    thumb.addEventListener('click', openZoom);
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(); }
    });
  } else {
    const ph = document.createElement('span');
    ph.className = 'ph';
    ph.textContent = catIcon || '🍽️';
    thumb.appendChild(ph);
  }

  const info = document.createElement('div');
  info.className = 'item-info';

  const name = document.createElement('h3');
  name.className = 'item-name';
  name.textContent = item.name || '';
  info.appendChild(name);

  if (item.note) {
    const note = document.createElement('p');
    note.className = 'item-note';
    note.textContent = item.note;
    info.appendChild(note);
  }

  // Açıklama (içindekiler) — fiyatın üstünde.
  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'item-desc';
    desc.textContent = item.description;
    info.appendChild(desc);
  }

  const price = document.createElement('span');
  price.className = 'price';
  price.textContent = formatPrice(item.price, currency);
  info.appendChild(price);

  card.append(thumb, info);
  return card;
}

function render(data) {
  const restaurant = data.restaurant || {};
  const currency = restaurant.currency || '';
  const name = restaurant.name || 'Menü';

  els.title.textContent = name;
  document.title = `${name} — Menü`;

  if (restaurant.tagline) {
    els.tagline.innerHTML = '';
    const leaf1 = document.createElement('span'); leaf1.className = 'leaf'; leaf1.textContent = '🌿';
    const leaf2 = leaf1.cloneNode(true);
    els.tagline.append(leaf1, document.createTextNode(restaurant.tagline), leaf2);
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  // available:false ürünleri müşteri menüsünde gizle; boş kategoriyi atla.
  const visibleCats = categories
    .map((c) => ({ ...c, items: (c.items || []).filter((i) => i.available !== false) }))
    .filter((c) => c.items.length > 0);

  clearStatus();
  els.nav.innerHTML = '';
  els.root.innerHTML = '';

  if (visibleCats.length === 0) {
    showError('Menüde gösterilecek ürün bulunamadı.');
    return;
  }

  const sections = [];

  visibleCats.forEach((cat) => {
    const secId = `cat-${cat.id}`;

    // Sol dikey şerit öğesi
    const tab = document.createElement('button');
    tab.className = 'cat-item';
    tab.type = 'button';
    tab.dataset.target = secId;
    const ic = document.createElement('span');
    ic.className = 'cat-ic';
    ic.textContent = cat.icon || '🍽️';
    const lbl = document.createElement('span');
    lbl.className = 'cat-lbl';
    lbl.textContent = cat.name || '';
    tab.append(ic, lbl);
    tab.addEventListener('click', () => {
      document.getElementById(secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.nav.appendChild(tab);

    // İçerik bölümü
    const section = document.createElement('section');
    section.className = 'category';
    section.id = secId;

    const h2 = document.createElement('h2');
    h2.className = 'category-title';
    const emoji = document.createElement('span');
    emoji.className = 'cat-emoji';
    emoji.textContent = cat.icon || '🍽️';
    h2.append(emoji, document.createTextNode(cat.name || ''));
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'items';
    cat.items.forEach((item) => grid.appendChild(buildCard(item, currency, cat.icon)));
    section.appendChild(grid);

    els.root.appendChild(section);
    sections.push({ id: secId, tab, section });
  });

  els.footer.innerHTML = '';
  const lf = document.createElement('span'); lf.className = 'leaf'; lf.textContent = '🌿';
  els.footer.append(`${name} · Dijital Menü `, lf);

  setupScrollSpy(sections);
}

// Scroll-spy: görünen bölüme göre sol şeritte aktif kategoriyi vurgula.
function setupScrollSpy(sections) {
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
  if (activeOnScroll) { window.removeEventListener('scroll', activeOnScroll); activeOnScroll = null; }

  function setActive(id) {
    sections.forEach((s) => {
      const on = s.id === id;
      s.tab.classList.toggle('active', on);
      if (on) {
        s.tab.setAttribute('aria-current', 'true');
        s.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        s.tab.removeAttribute('aria-current');
      }
    });
  }

  if (sections.length) setActive(sections[0].id);
  if (!('IntersectionObserver' in window)) return;

  activeObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    },
    { rootMargin: '-12% 0px -72% 0px', threshold: 0 }
  );
  sections.forEach((s) => activeObserver.observe(s.section));

  // Sayfanın en altına gelince son kategoriyi aktif yap (kısa son bölüm sorunu).
  activeOnScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      setActive(sections[sections.length - 1].id);
    }
  };
  window.addEventListener('scroll', activeOnScroll, { passive: true });
}

// Gömülü (bootstrap) veriden anında render et — file:// çift tıklamada da çalışır.
function renderFromEmbedded() {
  const node = document.getElementById('menu-data');
  if (!node || !node.textContent.trim()) return false;
  try {
    render(JSON.parse(node.textContent));
    return true;
  } catch (err) {
    console.error('Gömülü menü verisi okunamadı:', err);
    return false;
  }
}

// Stale-while-revalidate: önce gömülü veriyle çiz, sonra ağdan taze menu.json ile tazele.
async function load() {
  els.error.hidden = true;

  const renderedFromEmbedded = renderFromEmbedded();

  if (!renderedFromEmbedded && !document.getElementById('loading')) {
    const p = document.createElement('p');
    p.className = 'loading';
    p.id = 'loading';
    p.setAttribute('role', 'status');
    p.setAttribute('aria-live', 'polite');
    p.textContent = 'Menü yükleniyor…';
    els.root.innerHTML = '';
    els.root.appendChild(p);
    els.loading = p;
  }

  try {
    const res = await fetch(`menu.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data); // taze veriyle üzerine yaz (deploy sonrası güncellik)
  } catch (err) {
    console.error('Menü tazeleme hatası:', err);
    if (renderedFromEmbedded) return; // gömülü veriyle zaten çizildi (file:// önizleme)
    if (location.protocol === 'file:') {
      showError(
        'Menü görüntülenemedi. Yayınlanan adresten (örn. .pages.dev) açın ' +
        'ya da küçük bir yerel sunucu kullanın.'
      );
    } else {
      showError('Menü yüklenemedi, bağlantını kontrol et.', { retry: true });
    }
  }
}

load();
