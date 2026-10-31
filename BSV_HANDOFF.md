# Fact Market BSV — 31 Ekim2026

**Durum: native sonuç ödemesi BLOCKED; native teminat gerçekten ağda.** Önerilen güvenilir sunum sürümü hâlâ API3 V2 `/next`. `/bsv/native` orijinal API3 imzasını doğrudan BSV Script'te doğrulayan deneysel uzantıdır; tamamlanmış native ödeme diye sunulmamalı. `/bsv` ayrı, çalışan fakat sunucusuna güvenilen relayer geçmişidir. `/` ve `/next` kaynakları, deployment'ları ve kanıtları korunuyor; `v1-baseline` etiketi taşınmadı.

Yerel: <http://localhost:3102/bsv/native> · relayer: <http://localhost:3102/bsv> · V2: <http://localhost:3102/next>. Repo: `ABerkeBora/heka-fact-market`, branch `codex/bsv`. Başlatma: `npm ci`, `.env.example`→`.env`, `forge build`, `npm run dev`; üretim build: `npm run build`, `npm start`. BSV Desktop Testnet ve Ollama `qwen3:4b` gerçek entegrasyonları kullanıldı. Mainnet harcaması yok.

## Gerçekten ne oldu?

- Gerçek runtime LLM, ETH/USD için YES ve izinli−25bps seçti. Bağımsız hesaplayıcı eşiği **$2238.33**, iki1000sat pozisyonu, kaynak/istek/imzacı/zamanlar ve alıcıları sabitledi. Modelin serbest açıklamasındaki hesaplar otorite değildir; ürün yalnız doğrulanmış kararı ve deterministik eşiği gösterir.
- Standart cüzdanın kendi türetilmiş anahtarına1000sat hazırlama işlemi: [6852f04…](https://test.whatsonchain.com/tx/6852f04f5a8ce17efcb1aa80837e2e3e2a7f0d2a903e70de4a68c9c04c381269), hazırlama ücreti57sat.
- Native kontrat fonlaması: [248baaa…](https://test.whatsonchain.com/tx/248baaa5d5f30724b6dd4e057685208f3ebab0289e20c5399ae930ed29925f58), output0 **2000sat**. Üç girdi1000+1900+12000; çıktılar native2000+CP900+sponsor6000; fonlama ücreti6000sat. Sponsor kendi girdisini bağımsız kontrol edip imzaladı; anahtarı projeye kopyalanmadı. Fonlama değişmeden standart BSV peer üzerinden yayıldı; bağımsız Gorilla tam-byte ve WhatsOnChain gözlemi var. Bu kanıt **network-visible/unconfirmed**; mined denmiyor.
- Orijinal Nodary yanıtı09:59:07UTC'de, değişmez09:57:53–10:02:53UTC penceresi içinde alındı; altı çağrılık yetkinin1çağrısı kullanıldı. Orijinal EIP-191, iki Keccak, imzacı noktası, istek, fiyat/source-time, sabit tam ödeme ve iade kontrolleri gerçek derlenmiş Script VM'de geçti. Alıcı/amount değişimi, edited/stale/wrong-request/wrong-signer reddi kanıtlandı.
- Gerçek native sonuç işlemi **bd6f64e8…18ac2ff**,2279byte, yerel tam Script doğrulaması PASS. Ancak US/EU/Gorilla HTTP `Operation limit exceeded`, US peer `too-long-validation-time` reddi verdi. **Native payout yok.** Bu imza/journal korunuyor.
- Ayrı sabit iade işlemi **fcdaf319…57e346**,2202byte,1000buyer+1000CP+800CPchange;100sat ücret CP900 girdisinden, teminattan değil. Yerel Script PASS; tek gerçek gönderim `TX_LOCK_TIME` ile reddedildi. Son kontrol11:11Berlin: zincir median zamanı09:27:54UTC, kilit10:04:53UTC. **İade henüz gerçekleşmedi.** Median zaman geçince bile atlanmış büyük dalın opcode sayısı düğüm politikası engeli yaratabilir; kabul edilmeden kurtarma garantisi yok.

İki alternatif aynı UTXO'ları harcar; yalnız biri ekonomik olarak kabul edilebilir. Yeni fonlama/top-up yok. İade otomatik tekrar gönderilmiyor. Yeni native hazırlama/fonlama, bu bilinen uyumsuz artifact için kodda kapalı. İmzalı Bitcoin işleminin expiry alanı yoktur: uygulama yetki süresi yeni imzaları durdurur; önceden sabitlenmiş canonical işlem daha sonra uzlaştırılabilir.

## Relayer geçmişi ve güven sınırı

`/bsv` gerçek iki1000sat yatırma ve [1900sat CP ödemesi](https://test.whatsonchain.com/tx/5b1f659d149fed8da69af6706cbe0b23feea503b6783ec85c3d7da9fc5383511) yaptı. Orijinal API3 yanıtı Base Sepolia guard `0x4398da4c0004af377df99f4c6bae68640adfd27e` tarafından [onaylandı](https://sepolia.basescan.org/tx/0x9c06840d3bc104a579adfe4068c7490c1e5a415a80b0f2732371fc736b666a6b). Fakat sunucu hem attestor hem test CP anahtarını tutar; uygulama kontrolünü atlayan platform kullanıcı teminatını yönlendirebilir. **Bu yol non-custodial qualification kanıtı değildir.** Native kontratta bu anahtarlar yoktur; bütün teminat sabit kazanana veya sabit iadeye gider, fakat canlı redemption şu an engellidir.

Native pilotun1900sat CP girdisi önceki relayer ödemesinden geldi. Bu yalnız mevcut pilotun finansman kaynağıdır; native kriptografinin EVM bağımlılığı yok. `native/counterparty-source.json` ile bağımsız BSV UTXO kurulumu ve repo-local sponsor CLI'sı var. Ayrıntı [docs/BSV_SETUP.md](docs/BSV_SETUP.md). Yeni profile yönelik ek bootstrap işlemleri typecheck edildi, bu pilotta çalıştırılmadı.

Test roller yereldir; dış müşteri pilotu veya iki bağımsız insan değildir. İmza veri kaynağının kimliğini/byte'larını doğrular, dünya doğruluğunu garanti etmez. İlk geçerli pencere verisi ile olgunlaşmış iade yarışabilir; BSV Script mevcut blok saatini okuyarak anlık fiyat garantisi vermez. Private journal'lar, cüzdan DB'leri ve anahtarlar ignored `.local/` içindedir. API yalnız public hash/tutar/durum sunar.

## Kanıt ve kontroller

- `docs/evidence/bsv/native-funding-{raw,p2p,explorer}-witness.json`: bağımsız ağ gözlemleri.
- `native-oracle-rejections.json`: gerçek pilot policy/alıcılarıyla5/5 compiled SDK VM kontrolü; bunlar zincire alınmış başarısız işlemler değildir.
- `native-frozen-claim.json`, `native-claim-{us,eu}-policy-rejection.json`, `native-recovery-status.json`: başarısız canlı adımlar ve açık durum.
- `native/PROVENANCE.json`, sıkıştırılmış public artifact, okunabilir kaynaklar ve bağımsız compiler/preimage/refund testleri.
- `native/transport/`: anahtarsız, yalnız Testnet, bounded public P2P adapter/provenance; CLI yalnız query yapar. Parent dizinine runtime bağımlılık yok.
- `npm test`:20/20 PASS. `forge test -q`:PASS. Production build PASS. Official SDK native fixed-output interpreter2/2; actual-policy oracle5/5. TasteSkill lint0FAIL; kicker kaynak kapsamını, monospace yalnız literal JSON'u gösterir. Gerçek Chrome desktop/tablet820/phone390 incelemesi ve screenshots var; yatay taşma yok. Son durum ekranını yeniden kaydetmek gerekir.

Sabah/en yakın adım: sadece zincir median zamanı ve frozen refund/original claim görünürlüğünü kontrol et; kabul edilmiş harcama yoksa aynı imzalı iade bytes'ını olgunluk sonrası bir kez uzlaştır. Yeni imza/fonlama gerekmez. Op/time politikası yine reddederse aynı immutable kontratı değiştirmeye çalışma; uyumlu düğüm politikası veya ayrı, gerçekten test edilmiş optimized template gerekir. Eski teminat/işlemler korunmalı. İade veya sonuç için kabul kanıtı yokken PASS'e yükseltme.

## 150s sunum taslağı ve giriş metni

Şu an API3 V2 sunumu tercih edilmeli. Native uzantı gösterilecekse:0–20s iki stake/karşı taraf problemi;20–45s agent kararı ve bounded mandate;45–65s gerçek standart-cüzdan fonlama/explorer;65–105s orijinal imza ve dört yerel tamper reddi;105–130s gerçek canlı node rejection ve pending refund'u açıkça göster;130–150s kaynak güveni, noncustodial fixed outputs ve kalan execution engeli. Başarı videosu gibi kurgulama.

Taslak: “Fact Market lets an agent fund a bounded prediction under an immutable signed-source rule. The stable API3 version resolves and pays on Base Sepolia. Our separate BSV experiment verifies the original Airnode signature and fixed outputs natively in Script, and has real testnet collateral funding; its large native outcome spend currently exceeds public-node execution policy, with fixed refund recovery pending chain time.”

Resmî BSV/API3/genel kurallar11:04Berlin tekrar okundu. [TRACK_REQUIREMENTS_BSV.md](TRACK_REQUIREMENTS_BSV.md) açık gate'leri ayırır. Video kaydı ve Devfolio gönderimi yapılmadı; deadline31 Ekim15:00Berlin.
