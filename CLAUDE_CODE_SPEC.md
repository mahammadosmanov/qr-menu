# Claude Code Build Spec — QR Menü (statik, backend yok, yıllarca ücretsiz)

Bunu olduğu gibi Claude Code'a ver. `menu.json` zaten hazır (aynı klasörde); şema oradan okunacak.

## Kısıtlar (bunlar pazarlık konusu değil)
- **Backend yok. Build aracı yok. Çalışma anında CDN bağımlılığı yok.** Sadece vanilla HTML + CSS + JS. `npm`, Vite, React, Tailwind-CLI, framework YOK.
- Tek sayfa açıldığında çalışmalı (`index.html`'i çift tıklayınca bile render etmeli; sadece admin için ağ gerekir).
- Müşteri tarafı **token gerektirmez**; sadece `menu.json`'ı fetch eder.
- Sebebi: sonsuza dek bakımsız çalışsın. Bağımlılık çürümesi, sunucu durması, fatura olmamalı.

## Teknoloji
- HTML5, modern CSS (custom properties, grid/flex), vanilla ES module JS.
- Görsel/ikon için harici asset yok; emoji + CSS yeterli. (`menu.json`'da `icon` emoji alanı var.)

## Dosya yapısı
```
/
├── index.html        # müşteri menüsü
├── admin.html        # menü editörü
├── menu.json         # tek veri kaynağı (hazır)
├── css/style.css     # ortak stiller (palet değişkenleri burada)
├── js/menu.js        # müşteri render mantığı
├── js/admin.js       # admin + GitHub API mantığı
├── images/           # ürün görselleri (admin buraya commit'ler)
└── images/.gitkeep
```

## Veri sözleşmesi
`menu.json` şu yapıda (alanlara sadık kal): `restaurant{name,currency}`, `categories[]{id,name,icon,items[]}`, `items[]{id,name,price(number),note(string),image(null|"images/x.jpg"),available(bool)}`. Fiyat gösterimi: `${price} ${currency}` (örn. `650 TL`).

## index.html (müşteri menüsü) gereksinimleri
1. Yüklemede `menu.json`'ı **cache-buster ile** çek: `fetch('menu.json?t=' + Date.now())`. (Deploy sonrası bayat menü görünmesini engeller.)
2. Üst kısım: kafe adı + (varsa) logo alanı. Tasarım brief'ine uy (turuncu/sarı/yeşil, mobile-first).
3. **Yapışkan (sticky) kategori navigasyonu**: kategori adlarına tıklayınca ilgili bölüme kayar (scroll-spy ile aktif sekme vurgusu opsiyonel ama tercih edilir).
4. Her kategori bir bölüm; içinde ürün kartları.
5. **Ürün kartı:** ad, varsa `note` (örn. "Kişi Başı") küçük puntoyla, fiyat rozeti, `image` doluysa görsel (`loading="lazy"`), boşsa görseli gösterme (boş kutu/placeholder yok — sadece metinli kompakt kart).
6. `available:false` olan ürünleri müşteri menüsünde **gösterme** (veya soluk + "tükendi" — varsayılan: gizle).
7. Tamamen responsive; ana hedef telefon (QR'dan açılacak). 1 sütun mobil, geniş ekranda 2–3 sütun grid.
8. Bağımsız çalışmalı; ağ yoksa nazik hata: "Menü yüklenemedi, bağlantını kontrol et."

## admin.html (editör) gereksinimleri
Amaç: teknik olmayan birinin ürün ekleyip/çıkarması, fiyat değiştirmesi, foto yüklemesi. Veri GitHub Contents API ile `menu.json`'a yazılır.

### Kimlik
- Form: GitHub **fine-grained Personal Access Token** girişi (+ owner/repo sabit kodlanabilir ya da alan olarak). Token `localStorage`'da tutulur. Ekranda uyarı: "Token bu cihaz/tarayıcıda yerel saklanır, kimseyle paylaşma."
- Token izinleri kullanıcıya not olarak: sadece bu repo, **Contents: Read and write**.

### Yükleme
- `GET https://api.github.com/repos/{owner}/{repo}/contents/menu.json`
- Header: `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`.
- Dönen `content` base64'tür. **UTF-8 GOTCHA (kritik, Türkçe karakterler için):** düz `atob` bozar. Şöyle decode et:
  ```js
  const json = new TextDecoder().decode(
    Uint8Array.from(atob(data.content.replace(/\n/g, '')), c => c.charCodeAt(0))
  );
  ```
- Dönen `sha`'yı sakla (güncellemede lazım).

### Düzenleme UI
- Kategori bazında ürün listesi. Her ürün için: ad, fiyat, not, görsel, available toggle, **sil** butonu.
- **Ürün ekle** (kategori seçip yeni satır), **kategori ekle/yeniden adlandır** (opsiyonel ama tercih edilir), sürükle-bırak ya da yukarı/aşağı ile sıralama (opsiyonel).
- Yeni ürün `id`'si: addan slug üret (Türkçe karakterleri sadeleştir: ç→c, ş→s, ı→i, ğ→g, ö→o, ü→u, boşluk→`-`, küçük harf). Çakışırsa sonuna `-2` ekle.

### Görsel yükleme (repo şişmesin)
- File input → **canvas ile client-side resize**: en uzun kenar ≤ 800px, `toDataURL('image/jpeg', 0.8)`.
- Base64'ü (data: önekini at) `PUT .../contents/images/{id}.jpg` ile commit et. Üzerine yazıyorsan o dosyanın `sha`'sını gönder.
- `menu.json`'daki ilgili item'ın `image` alanını `"images/{id}.jpg"` yap.
- Görsel silinince item'ın `image`'ını `null` yap (eski dosyayı silmek opsiyonel).

### Kaydetme
- Editör state'ini JSON'a çevir → **UTF-8 base64 encode:**
  ```js
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(jsonString)));
  ```
- `PUT https://api.github.com/repos/{owner}/{repo}/contents/menu.json` body: `{ message: "Menü güncellendi", content: b64, sha: <mevcut sha> }`.
- Başarıda dönen yeni `sha`'yı sakla (arka arkaya kayıt için).

### Hata yönetimi (kullanıcıya açık mesaj)
- `401/403`: "Token geçersiz veya yetkisiz." → token tekrar iste.
- `409` (sha conflict, başka cihazdan değişmiş): "Menü dışarıdan değişti, yeniden yüklendi." → otomatik GET + merge/yeniden yükle.
- `404`: owner/repo/dosya yolu yanlış.
- Rate limit: nadir; mesaj göster, biraz sonra dene.
- Her durumda local state'i kaybetme; kaydet başarısızsa kullanıcı tekrar deneyebilsin.

## Yapılmayacaklar
- Menüyü `localStorage`'da TUTMA (cihaza özeldir, müşteriye gitmez — sadece token saklamak için kullan).
- Harici görsel barındırma servisi kullanma (çürür); görseller repo'ya commit edilir.
- Build/transpile adımı ekleme; çalışma anında CDN'den kütüphane çekme.

## Kabul kriterleri
- [ ] `index.html` çift tıkla açılır, `menu.json`'dan tüm kategoriler/ürünler render olur, fiyatlar `X TL` formatında.
- [ ] Türkçe karakterler (Çç Şş İı Ğğ Öö Üü) hem menüde hem admin'de bozulmadan görünür/kaydedilir.
- [ ] Telefonda tek sütun, geniş ekranda çok sütun; sticky kategori navigasyonu çalışır.
- [ ] Admin'den ürün ekle → kaydet → commit oluşur → (deploy sonrası) menüde görünür.
- [ ] Foto yükle → resize edilip commit edilir → kartta lazy görünür.
- [ ] `available:false` ürün müşteri menüsünde gizli.
- [ ] Hiçbir yerde npm/framework/build yok.
