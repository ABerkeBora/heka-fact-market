# Fact Market — teslim kararı ve native kurtarma

**31 Ekim 2026, 12:51:55 Europe/Berlin: ana sunum API3 V2 `/next`.** Kayıtlı canlı ETH/BTC yaşam döngüleri ve public chain audit PASS. `/` baseline'ı korunuyor. Native `/bsv/fast` deneysel kalıyor; `nativeReady=false`. 45 dakikalık yeni-fonlama sınırı 12:33:40 Berlin'de kapandı. Yetkili iki havuz fonlandı; üçüncü havuz yok. Video kaydı/yükleme ve Devfolio gönderimi yapılmadı.

## Güncel gerçek ağ kanıtı — 12:51:55 Berlin

| İşlem | Son gözlenen durum | Kanıt |
|---|---|---|
| İlk optimize fonlama, 2,000 sat | MINED, blok 1766139 | [42926a86…](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) |
| İlk native sonuç, tam 2,000 sat | Full-node UTXO doğrulaması PASS; UNCONFIRMED | [486b0e71…](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) |
| İkinci optimize fonlama, 2,000 sat | MINED, blok 1766140 | [00e13304…](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) |
| İkinci sabit iade | Önceden imzalı; ödeme henüz yok | `114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab` |

`docs/evidence/bsv/fast-node-utxo-validation-final.json` son 12:51:55 Berlin gözleminde gerçek girdilerin canonical tx tarafından harcandığını ve beklenen çıktıların oluşturulduğunu gösterir. Sonuç işleminin ücreti 100 sat, ayrı 900 sat CP girdisinden; korunan 2,000 satın tamamı sabit CP kazananına gider. 800 sat CP fee-change ayrı çıktıdır. İlk buyer kaybetti; bu sonuç için buyer wallet import beklenmesi gerekmez. Düğüm doğrulaması blok onayı/finality demek değildir.

## Ön-fonlama iddiasının düzeltmesi

Güçlü UTXO doğrulaması ilk kez 11:29:52 UTC'de, iki gözlem penceresinden sonra kaydedildi. İlk 10:56 ve ikinci 11:15 HTTP 200/ham işlem gözlemleri yalnız transport/public commitment kanıtıdır. Teranode `/tx` yayını Kafka üzerinden asenkron doğrulamaya gidebilir; raw-store GET veya WhatsOnChain'in unconfirmed tx lookup'ı tek başına doğrulanmış mempool üyeliğini kanıtlamaz. Bu, işlemler gerçekten o saate kadar geçersizdi demek değildir; **pencere öncesi validation kanıtımız yoktur**.

Public funded/completed/HTTP kayıtlarında `evidenceCorrection` ve legacy transport alanları önceki yanıtı korur; ilk ve son UTXO doğrulaması gerçek gözlem zamanıyla ayrı bağlanır. Eski bir kabul etiketi pencere öncesi validation'a geri tarihlenmez.

Bu nedenle mevcut çalıştırma, iade ileride gerçekleşse bile tamamlanmış adil bir prefunded market sunumu diye yükseltilmez. Uygulama artık transport/validation/mining ayrımını tutar; yeni bir fonlamada validation gözlem başlangıcından önce kanıtlanmazsa sonuç ödemesini başlatmak yerine sabit iadeye gider. Tarihsel ilk native ödeme bu kontrol düzeltmesinden önceki ayrı teknik yürütme kanıtıdır.

## İkinci havuzun kurtarılması

İkinci pencere 11:17:10–11:22:10 UTC; sabit iade kilidi 11:24:10 UTC. Zincir median zamanı bu değeri **geçince**, önceden imzalanmış `114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab` aynı bytes/hash ile uzlaştırılır. Agent'ın ilk yetkisi 11:37:10 UTC'de dolar; bu, hazır iadeyi iptal etmez ve yeni imza yetkisi gerektirmez. Hazır işlem 1,000 buyer + 1,000 CP + 800 CP change çıktıları içerir; 100 sat ücret ayrı 900 sat CP girdisinden gelir. Henüz kabul edilmiş iade veya blok onayı iddiası yoktur.

Bu ikinci döngü, gözlemler kasıtlı toplanmadan iade yolunu denemek için kuruldu; upstream kesintisi kanıtı değildir. Yeni piyasa, top-up, model çağrısı veya yeni harcama yetkisi oluşturulmayacak. UI mevcut iade durumunu ve önceki sonucun receipt bağlantısını ayrı tutar; read-only checker önceki uygun imzalı gözlemle açıkça o eski policy'yi kontrol eder.

## Kontroller ve teslim

- Gerçek ilk policy ve orijinal yanıtlarla 7 native Script VM kontrolü PASS: valid, edited, stale, wrong-request, wrong-signer, yanlış alıcı ve azaltılmış ödeme. `fast-live-tamper.json`; tarihsel replay `fast-check-replay.json`. Bunlar read-only VM kanıtıdır, mined başarısız işlemler değildir.
- Son teslim recheck: Source/SDK/node uygulama testleri 48/48 PASS. Runtime yeniden başlatma/duplicate intent ve erken iade preflight kayıtları ayrı; bu kontroller yeni para hareketi yaratmadı.
- API3 V2 public audit `docs/evidence/v2/verification-public.json` PASS; `npx tsx scripts/next-verify.ts --public` private cüzdan olmadan replay eder.
- Çalıştırma ve fee sponsor komutları [native runbook](docs/BSV_FAST_RUNBOOK.md),150 s API3 ana sunum taslağı [SUBMISSION.md](SUBMISSION.md). Native public kaynak kendi artifact/SDK'sıyla çalışır; koordinatörün özel cüzdanına veya parent path'lerine bağımlı değildir.
- Eski 5 MB `/bsv/native`2,000 sat havuzu hâlâ resource BLOCKED. Son kayıtlı aynı-imzalı iade denemesi 10:54:43 UTC `too-long-validation-time`; bu teslimde ek deneme yapılmadı. Relayer geçmişi iki backend anahtarı nedeniyle non-custodial qualification kanıtı değildir.

## Korunan eski kayıtların okunması

Aşağıdaki tarihsel snapshot'lar önceki durumu korur. İçlerindeki HTTP 200/“node-accepted” sınıflandırması **transport-only** olarak supersede edildi; güncel karar ve kanıt tablosu yukarıdadır. Eski tarihli test/ekran görüntüleri final delivery'de yeniden çalıştırılmış gibi sayılmaz.

<details>
<summary>Tarihsel12:00Berlin snapshot ve daha eski native/relay geçmişi</summary>

## Tarihsel12:00Berlin kaydı — eski transport sınıflandırması

**31 Ekim2026,12:00Europe/Berlin:** Yeni optimize native akış `/bsv/fast`; sunum yedeği çalışan API3 V2 `/next`. Ana native sunum için **gerçek sonuç ödemesi + ayrı gerçek iade döngüsü** gerekir. Şu an fonlama kabul edildi, bu iki yaşam döngüsü PENDING. Kaynak: güncel API `presentation.nativeReady`, public işlem kanıtları ve [native runbook](docs/BSV_FAST_RUNBOOK.md). Video kaydı ve Devfolio gönderimi yapılmadı.

## Yeni optimize havuz

- Gerçek `qwen3:4b` çağrısı NO/−25bps önerdi; deterministik eşik$2238.81. Model açıklamasındaki aritmetik metin otorite değildir. Kaynak, zamanlar ve alıcılar fonlamadan önce sabitlendi.
- Fonlama [42926a86…](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9), korunan teminat2000sat.10:56:44UTC düğümHTTP200 kabulü,11:04:33–11:09:33UTC gözlem penceresinden önce. Blok onayı ayrı; fonlama tek başına başarılı sonuç ödemesi değildir.
- Girdiler1000buyer+1900CP+6000sponsor; çıktılar2000native+900CP+4000sponsor.2000sat deployment ücreti ayrı sponsordan; sonuç/iade ücreti<=100sat ayrı CP girdisinden. Nodary ücretsiz.
- Sabit iade **ea4382680f5c2c1cbfdb71094c062db8c78cbf23bf1ff8386efca32607f088bd**,10:56:40UTC'de, fonlama yayınından önce imzalandı. Bu hash kabul edilmiş iade demek değildir. İade kilidi11:11:33UTC; zincir median zamanı geçmelidir. Agent yetkisi dolsa da aynı önceden imzalı işlem uzlaştırılabilir.
- Yeni artifact `native/fast/`, SHA256`bd453a9cd9e9fff72ad98422d23af94407506ae8be584e95640339b1b0e85591`; yaklaşık1.018MB/281400non-push opcode. Orijinal API3 imzası BSV Script içinde doğrulanır; model/attestor sonucu belirlemez.
- En fazla iki yeni havuz ve45dakikalık yeni-fonlama sınırı var. İkinci havuz, ilk gerçek native sonuç ödemesi doğrulanmadan fonlanmaz. Belirsiz işlem varken yeni ödeme oluşturulmaz; eski draft ve journal'lar silinmez.

Repo-local `bsv:fast:sponsor` seed/co-sign/reuse-change ve `bsv:fast:check` kaynakları parent workspace'e veya koordinatörün özel anahtarlarına bağlı değildir. Mevcut pilot ayrı koordinatör fee owner ile yapılmıştır; yeni operatörün wallet yetkileri ve fonları hazır varsayılmaz. Detaylı komutlar runbook'tadır.

## Sunum kararı

Native ödeme ve ayrı iade gerçek ağ kanıtları tamamlanırsa `/bsv/fast`. Tamamlanmazsa `/next`; BSV hazır/qualified denmez. Dört yanlış yanıt ve alıcı/tutar değişimi kontrolü native Script VM'de read-only'dir; gerçek ağda başarısız işlem diye gösterilmez. Ödeme/iade explorer kanıtı ayrı gösterilir. İlk kabul edilen geçerli pencere verisi kullanılır; exact-T ve upstream-doğruluk garantisi yoktur.

## Eski native kurtarma güncellemesi

Eski5MB kontratın aynı imzalı iadesi, median zaman geçtikten sonra10:54:43UTC'de tek sınırlı P2P denemesinde yine **too-long-validation-time** ile reddedildi. Kanıt `docs/evidence/bsv/native-recovery-optimized-run.json`; yeni imza/fonlama yapılmadı. Eski2000sat teminatın kurtarılması hâlâ BLOCKED. Aşağıdaki önceki kayıtların saat-bekleme ifadeleri tarihsel son kontroldür; yeni optimize havuzla karıştırılmamalıdır.

---

## Korunan önceki native/relay kaydı

### Önceki kayıt — 31 Ekim2026

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

</details>
