# Fact Market — sabah teslimi

**31 Ekim 2026, Europe/Berlin. Yerel ürün incelemeye hazır.** API3 teknik çekirdek canlı Base Sepolia verisi ve işlemleriyle çalışıyor. Yarışma başvurusu yapılmadı; video kaydı ve Devfolio gönderimi kullanıcı/ekip aksiyonu olarak bekliyor. BSV uygunluğu iddia edilmiyor. PandaScore yalnız ücretli discovery/getMatch kanıtı; tamamlanmış maç piyasası değil.

## Açma ve taze senaryo

Bu makinede `npm run dev`, ardından http://localhost:3102 . Üç test rolü ve deployment ignored yerel dosyalarda hazır; public repo kendi anahtarlarına bağımlı değil. Temiz kurulum, rol dosyası şeması ve deployment adımları README'de.

1. Compose ekranında ETH/USD sorusunu yaz, 1 FMCT seç, **Draft market**.
2. Gerçek qwen3:4b önerisini ve bağımsız türetilmiş resolution card'ı incele.
3. **Authorize agent** bir kez. Agent mandateleri kaydeder, iki ayrı test rolünün eşit teminatını fonlar, işlem kapanışından sonra uygun ölçümü alır ve settlement/claim yürütür. Genelde birkaç dakika.
4. Markets → market → Resolution / Evidence / Activity. Geçmiş zincir senaryoları silinmez. Aynı proposal'ı tekrar authorize etmek yeni ödeme oluşturmaz.

Tek mutating süreç çalıştırılır. CLI kullanmadan önce server'ı durdur; process lock eşzamanlı state/nonce yazımını engeller. Hata/timeout'ta **Reconcile and resume** aynı signed hash'i uzlaştırır. Journal silerek yeniden deneme yapma.

## Çalışanlar ve gerçek kanıtlar

- Runtime Ollama structured proposal, gerçek taze Nodary ETH/USD girdisi; iki tamamlanmış piyasa. LLM signer, recipient veya calldata seçemez. Ana ekranda modelin hatalı aritmetiği değil, doğrulanmış eşik ve policy gösterilir; raw öneri evidence trace'te saklıdır.
- Test collateral `0x4d317922ad3a235718ef1c5c4c71c85094df880a`; factory `0xfbacf475b8a6729d97db83a06b07ff303a243614`; chain84532. Deployment ve explorer linkleri `docs/evidence/deployment.json`.
- Market1: gerçek buyer/counterparty fonlama; dört zorunlu ret önce, sonra geçerli settlement ve 2 FMCT payout; kalan reserve0. `docs/evidence/chain-smoke.json` ve `agent-runs.json`.
- Dört ret: edited/wrong-request/wrong-signer → `NotSignedByAirnode`; gerçek eski cevap → `ResponseTooOld`. Tarihsel tx bloklarında açık observation window ve değişmeyen reserve ayrıca doğrulandı.
- Gerçek buyer'ın aynı intent'i tekrar fonlaması → `DuplicateIntent`, reverted receipt. Başlangıçtaki yanlış-role test yalnız `MarketClosed` kanıtlıyordu; nonQualifyingChecks altında açıkça korunup doğru buyer testiyle değiştirildi. `duplicate-authorize.json` ayrıca uygulama duplicate çağrısının aynı job döndürdüğünü gösterir.
- İki gerçek PandaScore x402 işlemi, toplam0.02 test aUSD; sabit payee/asset/network ve exact transfer logları/signature kontrolü. `pandascore-paid-discovery.json`, `docs/provider-findings.md`. Final sonuç çağrısı ve PandaScore market lifecycle yok.

## Yetki ve güven sınırı

On-chain: factory/token, payer=beneficiary, tek/toplam stake, action sayısı, expiry ve intent replay sınırları mandate ID başına uygulanır. Ayrı küçük test cüzdanı + yerel deterministic executor kullanılır; session key veya tüm hesap için değiştirilemez bütçe iddiası yok. Anahtarı tutan süreç yeni mandate yetkilendirebilir. Gas/tool kontrolleri uygulamada; imzalı L2 gas tavanı ve muhafazakâr L1 rezervi var, protokol L1 fiyatına mutlak tavan vaat edilmez. Revert gas'ı ve settle olmuş API ücreti gerçek giderdir.

Nodary latest, tam T tarihsel fiyat değildir. İşlem kapanışı sonrası immutable kısa pencerede zincirde kabul edilen ilk taze kaynak ölçümü kullanılır; bu sıranın/keeper gecikmesinin seçim riski vardır. İmza upstream gerçeğini veya kârı ispatlamaz. Kaynak/envelope zamanları ayrı kontrol edilir. Geçerli veri yoksa void/refund; unmatched pozisyon kapanıştan sonra iade edilebilir. Uygulama private dosya URL'lerini engeller; private .local/.env dosyaları repoya dahil değildir.

## Yapılan kontroller

- `npm run build`: TypeScript + Vite production build PASS.
- `npm test`: 8 model/request/executor/gas/role-serialization testi PASS.
- `forge test -vv`: 29 test PASS, reserve invariant için256 fuzz örneği dahil.
- Canlı create/fund/settle/claim: iki piyasa PASS; ikinci akış gerçek UI'dan başlatıldı.
- `scripts/verify-tamper.ts`: dört oracle ret nedeni ve buyer duplicate PASS.
- Private state/wallet URL HTTP404; secret-pattern publish tree taraması PASS.
- Gerçek in-app browser desktop1440, tablet768, phone390; screenshots `docs/evidence/ui-*.jpg`. TasteSkill browser inspector yerine oturumun izin verdiği cua DOM/screenshot yolu kullanıldı. Kaynak lint0 FAIL/0 WARN.

## Kalan sabah aksiyonları

1. **Video kaydı/upload, 10–20dk.** SUBMISSION.md içindeki150s akışı izle; özellikle dört tamper PASS ve agent payout'u göster. Bu kayıt henüz yok; bu nedenle tüm submission gereksinimleri tamamlandı iddiası yapılmaz.
2. **Tek ekip Devfolio girdisini hazırlama/gönderme, 10–15dk.** Hazır description + publicrepo + contract/network + video eklenir. Kullanıcı adına gönderim yapılmadı. Son resmi deadline31 Ekim15:00 Berlin; takım başına tek giriş/up to3 partner tracks kuralını yedi ürün arasında koordine et.
3. **İnceleme, 5dk.** Çalışan localhost'u ve yeni kısa senaryoyu aç; Nodary first-observation semantiğini değerlendir. Daha güçlü exact-T/history veya PandaScore finality istenirse yeni kapsam gerekir; mevcut ürüne gizli varsayım eklenmez.

Public repository ve son rule-check zamanı TRACK_REQUIREMENTS.md/BUILD_STATUS.md'de son doğrulamayla kaydedilir. Hosted deploy ve yarışma submission yapılmadı.
