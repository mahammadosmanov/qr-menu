# Deploy & Bakım — "yıllarca ücretsiz" nasıl garanti edilir

## Kurulum (tek seferlik, ~20 dk)
1. **GitHub repo (public) oluştur.** Claude Code çıktısını (index.html, admin.html, css/, js/, menu.json, images/) içine koy. Public olması müşteri tarafının token'sız okunması için yeterli ve güvenli (içerik zaten herkese açık bir menü).
2. **Cloudflare Pages'e bağla** → "Connect to Git" → repo'yu seç → **Build command: boş**, **Build output: `/` (kök)**, framework preset: None. Yayınlanınca `https://<proje>.pages.dev` adresini verir. (Alternatif: GitHub Pages → Settings → Pages → "Deploy from branch", kök. İkisi de ücretsiz, ikisi de inaktiflikte durmaz.)
3. **QR üret.** Adresi (`.pages.dev` linki) herhangi bir ücretsiz QR üreticide PNG yap, bas. QR statiktir; adres değişmedikçe sonsuza dek geçerli. (URL'i sabit tutmak için kendi `.pages.dev` alt alan adında kal; alan adı satın alırsan yenileme/ücret derdi başlar — gerekmedikçe alma.)

## Admin kullanımı (ürün ekle/çıkar/fiyat/foto)
1. GitHub → Settings → Developer settings → **Fine-grained personal access token** → sadece bu repo'ya erişim → **Repository permissions: Contents = Read and write** → oluştur, kopyala.
2. `https://<proje>.pages.dev/admin.html`'i aç, token'ı gir (cihazda yerel saklanır).
3. Düzenle → Kaydet. Bu bir commit oluşturur → Pages otomatik yeniden yayınlar → ~1 dk içinde müşteri menüsünde görünür.

## Neden yıllarca bakımsız çalışır (mekanizma)
- **Sunucu yok** → çökecek/durdurulacak bir şey yok. Statik dosyalar CDN'den servis edilir.
- **Veri git'te** → uyutulan/silinen veritabanı yok (Supabase/Firebase'in aksine).
- **Okuma token gerektirmez** → token süresi dolsa bile **menü çalışmaya devam eder**; sadece *düzenleme* durur. Yani müşteri hiçbir zaman bozuk menü görmez.
- **Build yok** → bağımlılık çürümesi yok; düz HTML 5 yıl sonra da açılır.
- **TLS/sertifika** → Cloudflare/GitHub otomatik yönetir, dokunmazsın.

## Tek periyodik iş
- **PAT yenileme:** fine-grained token en fazla 1 yıl. Süresi dolunca yeni token üretip admin'e girersin (5 dk). *Menüyü etkilemez, sadece editörü.* Bunu da istemiyorsan → aşağıdaki yükseltme.

## Maliyet
| Kalem | Ücret |
|---|---|
| Hosting (Cloudflare/GitHub Pages) | 0 |
| Depolama (git repo + görseller) | 0 |
| TLS sertifikası | 0 |
| `.pages.dev` / `.github.io` adresi | 0 |
| QR | 0 |
| **Toplam / yıl** | **0** |

## Yükseltme yolu (gerekirse)
- **Admin teknik değilse veya PAT yenilemekten kurtulmak istersen:** **Sveltia CMS** (veya Decap CMS) kur — git tabanlı, hazır admin arayüzü + medya kütüphanesi. Auth için tek seferlik bir GitHub OAuth app + ücretsiz Cloudflare Worker token-proxy gerekir (~15 dk). OAuth kimlik bilgileri süresiz; yıllık PAT derdi biter. Mimari aynı kalır (içerik yine git'te), sadece admin katmanı değişir.
- Görseller çok artarsa: commit öncesi resize (800px/0.8) zaten repo'yu küçük tutar; 50–80 ürün × ~100KB ≈ birkaç MB, git için önemsiz.
