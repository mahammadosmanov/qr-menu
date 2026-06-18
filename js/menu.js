// ============================================================
// QR Menü — müşteri tarafı render mantığı
// Bağımlılık yok, build yok. Sadece menu.json'ı okur.
// ============================================================

const els = {
  title: document.getElementById('siteTitle'),
  logoBox: document.getElementById('logoBox'),
  navWrap: document.getElementById('catNavWrap'),
  nav: document.getElementById('catNav'),
  root: document.getElementById('menuRoot'),
  loading: document.getElementById('loading'),
  error: document.getElementById('errorState'),
  footer: document.getElementById('footerNote'),
};

// Scroll-spy kaynakları — her render'da temizlenip yeniden kurulur (sızıntı önleme).
let activeObserver = null;
let activeOnScroll = null;

// Fiyatı "650 TL" biçiminde göster (Türkçe binlik ayracı ile).
function formatPrice(price, currency) {
  const num = Number(price);
  const shown = Number.isFinite(num) ? num.toLocaleString('tr-TR') : price;
  return `${shown} ${currency}`.trim();
}

// Yükleme/hata durumlarını temizle.
function clearStatus() {
  if (els.loading) els.loading.remove();
  els.error.hidden = true;
}

// Nazik hata ekranı.
function showError(message, { retry = false } = {}) {
  if (els.loading) els.loading.remove();
  els.root.innerHTML = '';
  els.navWrap.hidden = true;
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

// Tek ürün kartı oluştur (DOM ile — Türkçe/özel karakter güvenli).
function buildCard(item, currency) {
  const card = document.createElement('article');
  card.className = 'item-card';

  // Görsel sadece doluysa; boşsa placeholder gösterme.
  if (item.image) {
    const img = document.createElement('img');
    img.className = 'item-thumb';
    img.src = item.image;
    img.alt = item.name || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    // Görsel yüklenemezse kartı metinli kompakt biçime düşür.
    img.addEventListener('error', () => img.remove());
    card.appendChild(img);
  }

  const main = document.createElement('div');
  main.className = 'item-main';

  const textWrap = document.createElement('div');
  textWrap.className = 'item-text';

  const name = document.createElement('h3');
  name.className = 'item-name';
  name.textContent = item.name || '';
  textWrap.appendChild(name);

  if (item.note) {
    const note = document.createElement('p');
    note.className = 'item-note';
    note.textContent = item.note;
    textWrap.appendChild(note);
  }

  const price = document.createElement('span');
  price.className = 'price-badge';
  price.textContent = formatPrice(item.price, currency);

  main.append(textWrap, price);
  card.appendChild(main);
  return card;
}

// Tüm menüyü çiz.
function render(data) {
  const restaurant = data.restaurant || {};
  const currency = restaurant.currency || '';
  const name = restaurant.name || 'Menü';

  els.title.textContent = name;
  document.title = name;

  const categories = Array.isArray(data.categories) ? data.categories : [];
  // available:false ürünleri müşteri menüsünde gizle.
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

    // Sticky nav sekmesi
    const tab = document.createElement('button');
    tab.className = 'cat-tab';
    tab.type = 'button';
    tab.dataset.target = secId;
    if (cat.icon) {
      const ic = document.createElement('span');
      ic.className = 'tab-icon';
      ic.textContent = cat.icon;
      tab.appendChild(ic);
    }
    tab.appendChild(document.createTextNode(cat.name || ''));
    tab.addEventListener('click', () => {
      document.getElementById(secId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    els.nav.appendChild(tab);

    // Kategori bölümü
    const section = document.createElement('section');
    section.className = 'category';
    section.id = secId;

    const h2 = document.createElement('h2');
    h2.className = 'category-title';
    if (cat.icon) {
      const ic = document.createElement('span');
      ic.className = 'cat-icon';
      ic.textContent = cat.icon;
      h2.appendChild(ic);
    }
    h2.appendChild(document.createTextNode(cat.name || ''));
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'items-grid';
    cat.items.forEach((item) => grid.appendChild(buildCard(item, currency)));
    section.appendChild(grid);

    els.root.appendChild(section);
    sections.push({ id: secId, tab, section });
  });

  els.navWrap.hidden = false;
  els.footer.textContent = `${name} · Dijital Menü`;

  setupScrollSpy(sections);
}

// Sticky nav yüksekliğini ölçüp scroll-margin için CSS değişkenine yaz.
function syncNavHeight() {
  const h = els.navWrap.offsetHeight || 60;
  document.documentElement.style.setProperty('--nav-h', `${h}px`);
  return h;
}

// Scroll-spy: görünen bölüme göre aktif sekmeyi vurgula.
function setupScrollSpy(sections) {
  // Önceki render'dan kalan observer/listener'ı temizle (birikmeyi önle).
  if (activeObserver) { activeObserver.disconnect(); activeObserver = null; }
  if (activeOnScroll) { window.removeEventListener('scroll', activeOnScroll); activeOnScroll = null; }

  const navH = syncNavHeight();
  const byId = new Map(sections.map((s) => [s.id, s]));

  function setActive(id) {
    sections.forEach((s) => {
      const on = s.id === id;
      s.tab.classList.toggle('active', on);
      if (on) {
        s.tab.setAttribute('aria-current', 'true');
        // Aktif sekme yatay şeritte görünür kalsın.
        s.tab.scrollIntoView({ block: 'nearest', inline: 'center' });
      } else {
        s.tab.removeAttribute('aria-current');
      }
    });
  }

  // İlk sekmeyi baştan aktif yap.
  if (sections.length) setActive(sections[0].id);

  if (!('IntersectionObserver' in window)) return;

  activeObserver = new IntersectionObserver(
    (entries) => {
      // Nav altındaki ince bantta görünen bölümü aktif kabul et.
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    },
    { rootMargin: `-${navH}px 0px -72% 0px`, threshold: 0 }
  );
  sections.forEach((s) => activeObserver.observe(s.section));

  // Sayfanın en altına gelince son sekmeyi aktif yap (kısa son bölüm sorunu).
  activeOnScroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      setActive(sections[sections.length - 1].id);
    }
  };
  window.addEventListener('scroll', activeOnScroll, { passive: true });

  // syncNavHeight adlı fonksiyon olduğundan tekrar eklemede no-op (birikmez).
  window.addEventListener('resize', syncNavHeight, { passive: true });
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
    // Gömülü veriyle zaten render edildiyse sessizce devam et (file:// önizleme).
    if (renderedFromEmbedded) return;
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
