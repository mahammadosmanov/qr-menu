# Claude Design Brief — QR Menü görseli

Bağlam: Müşteri QR okutup **telefonda** açar. Mobile-first tasarla. Ekran masaüstünde de düzgün görünsün (kart grid'i genişlesin) ama öncelik dar ekran.

Not: Bu adım opsiyonel. Menü arayüzü standart olduğu için doğrudan Claude Code da üretebilir. Görseli önce elle iterasyonla görmek istersen burayı kullan, sonra çıktıyı Claude Code'a aktar.

## Palet (turuncu/sarı/yeşil — sıcak, iştah açıcı)
```
--bg:        #FFFBEB   (sıcak kırık beyaz arka plan)
--surface:   #FFFFFF   (kart yüzeyi)
--primary:   #F97316   (turuncu — başlık/aksan/aktif sekme)
--accent:    #FACC15   (sarı — vurgu, ince detay)
--price:     #16A34A   (yeşil — fiyat rozeti)
--text:      #1C1917   (koyu metin)
--muted:     #78716C   (not/ikincil metin)
--border:    #F5E9C8   (yumuşak ayraç)
```
Kullanım dengesi: turuncu hâkim aksan, sarı küçük dozda (rozet kenarı/ikon arkası), yeşil sadece fiyatta. Çok renk çığırtkanlığından kaçın; arka plan sıcak-nötr kalsın.

## Tipografi
- Başlık: kalın, yuvarlak hatlı, iştah açıcı (örn. Poppins/Nunito ağırlıkları). Ürün adı: medium/semibold. Not: küçük, muted.
- Fiyat: belirgin, yeşil rozet içinde, okunaklı.
- Sistem fontu fallback'i olsun (harici font dosyası şart değil; varsa CSS değişkeniyle kolay değişsin).

## Düzen
1. **Header:** kafe adı ortada/solda, üstte ince turuncu şerit veya yumuşak turuncu→sarı gradient. Logo için kare alan (opsiyonel, boş bırakılabilir).
2. **Sticky kategori navigasyonu:** header altında yatay kaydırılabilir sekme şeridi (Kahvaltılar / Fast Food / Sıcak İçecekler / Soğuk İçecekler / Milkshake). Aktif sekme turuncu dolgu/alt çizgi. Tıklayınca bölüme kayar.
3. **Kategori bölümü:** kategori başlığı (emoji ikon + ad), altında ürün kartları.
4. **Ürün kartı (iki durum):**
   - *Görselli:* solda/üstte küçük yuvarlatılmış görsel, yanında ad + (varsa) not + sağda yeşil fiyat rozeti.
   - *Görselsiz:* kompakt satır — ad solda, fiyat rozeti sağda, not adın altında küçük. **Boş görsel kutusu/placeholder gösterme.**
   - Kartlar yumuşak gölge, ~16px köşe yarıçapı, rahat iç boşluk.
5. Mobilde 1 sütun; ≥640px 2 sütun; ≥1024px 3 sütun grid.

## Mikro-etkileşim
- Minimal: sekme geçişinde yumuşak scroll, karta hafif hover (masaüstü). Abartılı animasyon yok.

## Erişilebilirlik / dokunma
- Sekme ve kartlarda dokunma hedefi ≥44px.
- Metin/arka plan kontrastı yeterli (özellikle sarı üzeri metin kullanma — sarıyı sadece dolgu/kenar olarak kullan, metni koyu tut).

## Çıktı
- Tek responsive sayfa düzeni. Renkler CSS custom property olarak (yukarıdaki isimlerle) tanımlı ki sonradan tek yerden değişsin.
- Görselsiz durum varsayılan kabul edilsin (çoğu ürünün fotosu yok); görselli kart "bonus" hâli.
