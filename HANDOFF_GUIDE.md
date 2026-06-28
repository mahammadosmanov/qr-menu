# QR Menü Devir ve Kurulum Rehberi

Bu rehber, `qr-menu` uygulamasını başka bir kişiye tamamen devretmek ve Cloudflare Pages üzerinde ücretsiz yayınlatmak içindir.

## 0) Sistem Özeti

- Uygulama: Statik QR menü
- Teknoloji: HTML + CSS + vanilla JS
- Backend: Yok
- Build: Yok
- Veriler: `menu.json`
- Görseller: `images/`
- Müşteri menüsü: `/`
- Admin paneli: `/admin.html`
- Hosting: Cloudflare Pages ücretsiz plan
- Admin kayıt yöntemi: GitHub Contents API ile repo'ya commit

> Müşteri menüsü token istemez. Token sadece admin panelinden menü düzenlemek için gerekir.

---

## 1) Devralacak Kişide Olması Gerekenler

Devralacak kişide şunlar olmalı:

1. GitHub hesabı
2. Cloudflare hesabı
3. Menü yönetimi için GitHub fine-grained Personal Access Token
4. Kalıcı yayın URL'i: `https://PROJE_ADI.pages.dev/`

Öneri:

- Repo public kalsın.
- Cloudflare Pages proje adı QR basılmadan önce kesinleşsin.
- QR sadece müşteri menüsüne gitsin: `/`
- QR kesinlikle `/admin.html` adresine gitmesin.

---

## 2) GitHub Repo Devri

### Mevcut Sahip Yapacak

1. GitHub'da repo'yu aç:
   `https://github.com/mahammadosmanov/qr-menu`
2. `Settings` sekmesine gir.
3. En alta in: `Danger Zone`.
4. `Transfer ownership` seç.
5. Yeni sahibin GitHub kullanıcı adını veya org adını yaz.
6. Repo adını onay için tekrar yaz: `qr-menu`
7. Transferi başlat.

### Yeni Sahip Yapacak

1. GitHub bildirimi veya e-postadan transferi kabul et.
2. Repo artık şu formatta olur:

```txt
https://github.com/YENI_OWNER/qr-menu
```

3. Repo `public` değilse public yapması önerilir:
   `Settings` → `General` → `Danger Zone` → `Change visibility`

> Not: GitHub repo devri Cloudflare Pages projesini otomatik devretmez. Cloudflare tarafı ayrıca kurulmalıdır.

---

## 3) Cloudflare Pages Kurulumu

Yeni sahip kendi Cloudflare hesabında yapacak.

1. Cloudflare hesabına gir:
   `https://dash.cloudflare.com/`
2. Sol menüden:
   `Workers & Pages`
3. `Create application`
4. `Pages`
5. `Connect to Git`
6. GitHub bağlantısı isteyince izin ver.
7. Repo seç:

```txt
YENI_OWNER/qr-menu
```

8. Proje ayarları:

```txt
Project name: ada-cafe-menu   # örnek; QR basmadan önce kesin seç
Production branch: main
Framework preset: None
Build command: boş bırak
Build output directory: /
Root directory: boş bırak
```

9. `Save and Deploy` tıkla.
10. Deploy bitince Cloudflare şu şekilde URL verir:

```txt
https://PROJE_ADI.pages.dev/
```

Bu URL müşteri menüsüdür.

---

## 4) Yayın Testi

Cloudflare deploy bittikten sonra şu adresleri aç:

```txt
https://PROJE_ADI.pages.dev/
https://PROJE_ADI.pages.dev/menu.json
https://PROJE_ADI.pages.dev/admin.html
```

Beklenen:

- `/` menüyü gösterir.
- `/menu.json` JSON veri gösterir.
- `/admin.html` admin giriş ekranını gösterir.

---

## 5) Admin Token Oluşturma

Yeni sahip kendi GitHub hesabından oluşturacak.

1. GitHub'a gir.
2. Sağ üst profil → `Settings`
3. Sol menü en alt: `Developer settings`
4. `Personal access tokens`
5. `Fine-grained tokens`
6. `Generate new token`
7. Ayarlar:

```txt
Token name: QR Menü Admin
Expiration: maksimum süre
Resource owner: yeni repo sahibi
Repository access: Only select repositories
Selected repository: qr-menu
Permissions:
  Contents: Read and write
```

8. Token oluştur.
9. Token'ı kopyala.

> Token sadece bu cihaz/tarayıcıda admin panelinde saklanır. Repo'ya yazılmaz. Kimseyle paylaşılmamalıdır.

---

## 6) Admin Paneline Giriş

Şu adresi aç:

```txt
https://PROJE_ADI.pages.dev/admin.html
```

Alanları doldur:

```txt
owner: YENI_OWNER
repo: qr-menu
branch: main
Fine-grained Personal Access Token: github_pat_...
```

Sonra:

1. `Menüyü Yükle`
2. Menü gelirse bağlantı başarılı.

---

## 7) Kaydetme Testi

Canlıya almadan önce küçük test yap.

1. Admin panelde bir ürün fiyatını geçici değiştir.
2. `Kaydet` tıkla.
3. GitHub repo'da yeni commit oluştu mu kontrol et.
4. Cloudflare Pages otomatik yeni deploy başlattı mı kontrol et.
5. 1 dakika bekle.
6. Müşteri menüsünde değişiklik görünüyor mu kontrol et:

```txt
https://PROJE_ADI.pages.dev/
```

7. Test fiyatını eski haline getirip tekrar kaydet.

---

## 8) QR Kod Oluşturma

QR hedefi:

```txt
https://PROJE_ADI.pages.dev/
```

Dikkat:

- QR `/admin.html` olmamalı.
- QR basılmadan önce URL kesinleşmeli.
- `.pages.dev` adresi ücretsizdir.
- Özel alan adı kullanılmazsa yıllık domain ücreti yoktur.

---

## 9) Günlük Kullanım

Menü değiştirmek için:

1. Admin paneli aç:

```txt
https://PROJE_ADI.pages.dev/admin.html
```

2. Token kayıtlıysa direkt `Menüyü Yükle`.
3. Ürün/fiyat/foto düzenle.
4. `Kaydet`.
5. 1 dakika içinde müşteri menüsü güncellenir.

Foto eklerken:

- Admin görseli otomatik küçültür.
- Görseller repo'da `images/` içine kaydedilir.

---

## 10) Bakım ve Güvenlik

Tek düzenli bakım:

- GitHub token süresi bitince yeni token oluşturmak.

Token biterse:

- Müşteri menüsü çalışmaya devam eder.
- Sadece admin panelinden kaydetme çalışmaz.

Eski sahip yapmalı:

1. Eski GitHub token varsa revoke et.
2. Eski Cloudflare Pages projesi artık kullanılmayacaksa sil.
3. Yeni URL çalışana kadar eski URL'i silme.

Yeni sahip yapmalı:

1. GitHub hesabını kaybetmesin.
2. Cloudflare hesabını kaybetmesin.
3. Token bitiş tarihini takvime eklesin.

---

## 11) Sorun Giderme

### Menü açılmıyor

Kontrol et:

- Cloudflare deploy başarılı mı?
- `https://PROJE_ADI.pages.dev/menu.json` açılıyor mu?
- Repo'da `index.html`, `menu.json`, `css/`, `js/` kökte mi?

### Admin "Token geçersiz veya yetkisiz" diyor

Çözüm:

- Token doğru mu?
- Token yeni sahibin repo'suna erişiyor mu?
- Permission: `Contents: Read and write` mı?
- Owner/repo doğru mu?

### Kaydettim ama menü güncellenmedi

Çözüm:

1. GitHub'da commit oluştu mu bak.
2. Cloudflare Pages deploy oluştu mu bak.
3. 1 dakika bekle.
4. Sayfayı yenile.

### 404 hatası

Genelde şunlardan biri yanlış:

```txt
owner
repo
branch
menu.json yolu
```

### 409 çakışma hatası

Başka yerden menü değişmiş olabilir.

Çözüm:

1. Admin'de `Yeniden Yükle`.
2. Düzenlemeyi tekrar yap.
3. Kaydet.

---

## 12) Handoff Kontrol Listesi

Devir tamam saymak için:

- [ ] Repo yeni GitHub sahibine geçti.
- [ ] Repo yeni sahipte açılıyor.
- [ ] Cloudflare Pages yeni sahibin hesabında kuruldu.
- [ ] Ana menü URL'i açılıyor.
- [ ] `/menu.json` açılıyor.
- [ ] `/admin.html` açılıyor.
- [ ] Yeni sahip kendi token'ını oluşturdu.
- [ ] Admin panel menüyü yükledi.
- [ ] Test değişikliği kaydedildi.
- [ ] GitHub commit oluştu.
- [ ] Cloudflare deploy oluştu.
- [ ] Müşteri menüsü güncellendi.
- [ ] QR kod ana menü URL'iyle üretildi.
- [ ] Eski tokenlar revoke edildi.
