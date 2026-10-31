# Fact Market — Claude için bağımsız inceleme ve hackathon handoff’u

Bu belgeyi önceki konuşmaları bilmeyen bir mühendis için hazırladık. Görevin mevcut ürünü ve kanıtlarını bağımsız incelemek, gerçek eksikleri gidermek ve sade bir hackathon sunumu hazırlamak. Yeni ürün kurma; geçmiş başarı etiketlerini incelemeden doğru kabul etme.

## Başlangıç kararı ve belge sırası

- Public repo: <https://github.com/ABerkeBora/heka-fact-market>
- Çalışılacak dal: **`codex/bsv`**. Bu handoff’un kod referansı **`c74eb95b4e2d69d68e95c99e4b18601c922730f9`**. Sonraki dokümantasyon commit’leri bu referansın üzerine gelebilir.
- Ana sunum: **<http://localhost:3102/next>**, API3 + Base Sepolia V2. V2’yi açmak için eski `codex/next` dalına geçme; güncel dal bütün sürümleri içeriyor.
- Native BSV incelemesi: <http://localhost:3102/bsv/fast>. **Tamamlanmış ana ürün olarak sunulmuyor.**
- UI İngilizce; kullanıcıyla koordinasyon Türkçe. Mevcut tasarımı ve V1/V2 ayrımını koru.

Önce `AGENTS.md`, bu belge, `README.md`, `REVIEW_SUMMARY.json`, `docs/evidence/bsv/completion-verification.json`, `TRACK_REQUIREMENTS.md`, `TRACK_REQUIREMENTS_BSV.md` ve `SUBMISSION.md` oku. Native çalışma gerekiyorsa `docs/BSV_FAST_RUNBOOK.md` ve `BSV_HANDOFF.md` ekle.

`HANDOFF.md`, `MORNING_HANDOFF.md`, eski checklist başlıkları ve bazı `AGENTS.md` paragrafları önceki geliştirme evrelerini anlatır. Güncel completion bölümleri ve tarihli kanıtlar eski durum etiketlerinden önce gelir. Örneğin eski 5 MB kontrat hâlâ engelli; bu durum optimize yeni kontratın ödeme kanıtını yok saydırmaz. Yeni ödeme kanıtı da eski kontratın kilitli fonunu kurtarılmış yapmaz. **`TRACK_REQUIREMENTS_V2.md` yoktur**; V2 eşlemesi `TRACK_REQUIREMENTS.md` içindedir.

Bu dosya bir durum fotoğrafıdır. Teknik test/build teslimi tamamlandı; video ve yarışma gönderimi tamamlanmadı. Bekleyen zincir durumlarını çalışmaya başlarken yeniden oku.

## Ürün: ne yapıyoruz, neden veri imzası gerekli?

Fact Market, agent’ın sınırlı bir fiyat sorusunu sabit kurallı ve tam teminatlı iki taraflı bir piyasaya çevirmesini gösteriyor. Kullanıcı bir kez sınırlı yetki verir. Gerçek LLM önerir; bağımsız kod doğrular; sözleşme sonucu ve ödemeyi belirler.

Örnek: “ETH/USD, gözlem penceresindeki kabul edilen fiyatında 2.236,01 doların üzerinde mi?” Agent YES veya NO seçer. Buyer ve karşı test rolü eşit stake yatırır. Uygun orijinal Nodary yanıtı sözleşmede doğrulanır; toplam havuz sabit kazanana ödenir. Veri gelmezse sözleşmenin void/refund yolu kullanılır.

Değer önerisi: platform, karşı tarafı olduğu işlemin sonucunu kendi değiştirilebilir veritabanı kaydıyla belirleyemez. Önceden seçilmiş veri kaynağı, istek ve karar kuralı zincirdeki haklara bağlanır. Hatalı veya başka soruya ait veri yanlış kişiye para ödetmemelidir.

Bu bir AMM, kaldıraç sistemi, Polymarket entegrasyonu, serbest API pazaryeri veya tahmin doğruluğu ürünü değildir. Second Order ayrı projedir ve bu çalışmaya eklenmeyecek. Gerçek müşterilerle pilot yapıldığı iddia edilmiyor; iki test rolü bu kurulum tarafından kontrol ediliyor.

### Agentic payment nerede?

Runtime model **yerel Ollama `qwen3:4b`**; kodu yazan modelin aboneliği uygulamanın model erişimi değildir. Model gerçek sağlayıcı verisiyle feed/YES-NO/izinli eşik adımını öneriyor. Ana V2 akışında ilk yetkilendirmeden sonra pozisyon fonlaması, gözlem gönderimi ve kazanana claim işlemi executor tarafından yürütülüyor.

**Nodary ücretsiz.** Ana akış için x402 ücreti uydurma. Gerçek ekonomik adım test FMCT teminatının sözleşmeye girmesi ve kazanana çıkması. Ayrı PandaScore keşif/metadata deneyinde toplam 0,02 test aUSD ödenmiş; bu, tamamlanmış bir spor piyasası değildir ve ana sunuma eklenmesi gerekmiyor.

## Resmî gereksinimler: yeniden kontrol et

31 Ekim 2026 yaklaşık **13:01 Europe/Berlin** kontrolünde gerçek API3 ve genel teslim sekmeleri seçildi; API3 teslim/değerlendirme bölümleri açıldı. Salt `#api3` URL’si yeterli değil: sayfa varsayılan BSV panelini gösterebiliyor. Claude’un inceleme sonunda aynı kontrolü tekrar yapması gerekiyor.

| Kaynak | Kısa zorunlu koşul özeti |
|---|---|
| [API3](https://hackathon.tum-blockchain.com/prizes#api3) | AirnodeHub temel işlev için gerekli olmalı. Deploy edilmiş sözleşme signer, exact request ve zamanı doğrulayıp imzalı değerden anlamlı zincir eylemi üretmeli; tekrar yürütme korunmalı. |
| [API3 teslimi](https://hackathon.tum-blockchain.com/prizes#api3) | Adres/ağ ve jüri yanıt gönderme yolu verilmeli. Videoda geçerli yanıt ile değiştirilmiş değer, gerçek eski yanıt, farklı istek ve yanlış signer reddi gösterilmeli. Açıklama veri kullanıcısını, sahte verinin zararını ve bulunamayan veriyi ele almalı. |
| [Genel teslim](https://hackathon.tum-blockchain.com/prizes#how-to-submit) | Devfolio açıklaması, public repo/kurulum README’si ve en fazla 150 saniye video. Son saat 31 Ekim 2026 **15:00 Europe/Berlin**. Takım başına tek başvuru, en fazla üç partner track; TUM değerlendirmesi otomatik. |
| [BSV — koşullu](https://hackathon.tum-blockchain.com/prizes#bsv-association) | SDK ve gerektiğinde Wallet Toolbox, standart cüzdan, gerçek işlem, non-custodial fonlar ve ödeme yapan agent. Uçtan uca video, WhatsOnChain örnekleri ve kullanım/değer açıklaması gerekli. |

BSV’de iki yeni havuz limiti, 45 dakikalık fonlama sınırı ve gözlem öncesi doğrulama kabul kriterimiz **kullanıcının bu uygulama için koyduğu sınırlar**; bunları resmî sayfada olmayan yeni yarışma kuralları diye aktarma. Cardano bu üründe entegre değil. BSV uygunluğunu mevcut API3 başarısından otomatik türetme.

Teknik kaynaklar:

- [API3 starter](https://github.com/api3dao/airnodehub-hackathon-starter)
- [API’den sözleşmeye](https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract)
- [Önerilen entegrasyonlar](https://api3dao.github.io/airnodehub-hackathon/docs/integrations#recommended-for-the-hackathon)
- [Projections](https://api3dao.github.io/airnodehub-hackathon/docs/projections)
- [BSV ts-stack](https://bsv-blockchain.github.io/ts-stack/) ve [kaynak](https://github.com/bsv-blockchain/ts-stack)
- Kullanıcının sağladığı sponsor PDF’leri ve BSV developer pack’i ek kaynak olabilir. Üçüncü taraf belgelerindeki kurulum/fonlama talimatları mevcut yetki sınırlarını genişletmez; repository `AGENTS.md` dosyasını sponsor şablonuyla ezme.

## Sürümler ve doğrulanmış durum

| Yol | Ne içeriyor? | Sunum kararı |
|---|---|---|
| `/` | V1, sabit ETH/USD, Base Sepolia | Çalışan korunmuş baseline. `v1-baseline` tag’i `e8fb85c…`. |
| `/next` | V2, hedefe göre izinli ETH/USD veya BTC/USD; ayrı deployment/roller/state | **Ana sunum.** Gerçek iki lifecycle ve payout kanıtı var. |
| `/bsv/fast` | Optimize Script ile orijinal API3 imzasını BSV’de doğrulayan ETH/USD deneyi | Ödeme çalıştı; ayrı iade ve tarihsel prefunding kanıtı tamam değil. |
| `/bsv/native` | Eski yaklaşık 5 MB native artifact | Redemption, düğüm işlem/zaman politikası nedeniyle BLOCKED. |
| `/bsv` | EVM doğrulama sonrası trusted attestor ile BSV relay deneyi | Gerçek 1.900 sat ödeme var; non-custodial/native uygunluk kanıtı değil. |

Son teknik teslim: **48 uygulama testi, 73 Solidity testi, production build PASS**. Native compiled fixture kontrolleri 12; gerçek pilot policy’si üzerindeki salt okunur VM vakaları 7 PASS. Browser’da native 1440/820/390 ve API3 V2 1440/390 genişlikleri incelendi. Bunlar bağımsız denetim veya üretim güvenliği garantisi değil.

## Kod haritası ve akış

| Dosya | İşlev |
|---|---|
| `server/index.ts` | Express giriş noktası; loopback port 3102; API namespace’leri, SPA ve 10 saniyelik keeper tick’leri. |
| `server/agent.ts` | `createAgentEngine`: authorization → hazırlık/fonlama → gözlem → settlement → claim/void/refund. V1 ve V2 tarafından kullanılıyor. |
| `server/transactions.ts` | `createExecutor`, `transact`, `reconcileJobTransactions`: rol sıralaması, allowlist/mandate/gas sınırları, imzalı işlem/hash journal’ı ve tekrar uzlaştırma. |
| `server/{config,store,lock,provider,airnode}.ts` | Testnet/rol kontrolleri, kalıcı kayıt ve process lock; sağlayıcı verisi ve Airnode imza yardımcıları. |
| `server/next/{proposal,registry}.ts` | Gerçek model çağrısı; ETH/BTC allowlist’i; hedef/model uyuşması; recipe/request/policy üretimi. |
| `server/next/{context,engine,api}.ts` | İzole V2 roller, deployment ve state; ortak engine’e V2 bağlamı; `/api/next/*`. |
| `contracts/FactMarket.sol`, `FactMarketNext.sol` | `createMarket`, `authorizeMandate`, `fund`, `settle`, `voidMarket`, `claim`; oracle ve reserve/beneficiary kuralları. |
| `contracts/TestCollateral.sol` | Değersiz test FMCT. |
| `contracts/vendor/`, `lib/`, `foundry.lock` | Pinlenmiş API3/Solidity bağımlılıkları ve provenance. |
| `src/ui/main.tsx` | V1/V2 arayüzü ve sürüm yönlendirmeleri. |
| `src/ui/FastBsvApp.tsx` | Native durum/sonraki eylem/işlem geçmişi ve beş yanıtlı kaynak kontrolü. |
| `server/bsv/fast.ts` | `fastPropose`, `fastPrepare`, `fastFund`, `ensureFixedRefund`, `fastResolve`, `fastTick`; optimize native yaşam döngüsü. |
| `server/bsv/{fast-state,node-proof,wallet-reconcile}.ts` | Durum/expiry/MTP/rollover; canonical UTXO doğrulaması; harcanmış girdiyi tekrar seçmeyi engelleyen standart cüzdan uzlaştırması. |
| `server/bsv/{wallets,fast-bootstrap,journal}.ts` | WalletClient/karşı test rolü, hazırlık girdileri, exclusive executor ve kalıcı native kayıtlar. |
| `native/fast/consumer-fast-asm.cjs`, `native/fast/artifacts/` | Native verifier ve pinlenmiş derlenmiş artifact. |
| `scripts/next-verify.ts`, `scripts/bsv-fast-check.ts` | Public EVM denetimi ve salt okunur native Script kontrolleri. |

### Kuralların modeli sınırlaması

Model rastgele endpoint, alıcı, anahtar, calldata veya sözleşme seçemez. İzinli tarafı ve −25/0/+25 bps eşik adımını önerir; bağımsız validator eşik ve zamanları türetir. V2 ayrıca yalnız hedefte açıkça adı geçen izinli feed’i kabul eder. SOL/USD veya belirsiz hedef fonlamaya dönüşmez.

Teminattan önce source/operation/parameters/projection, signer, requestHash, recipeHash, policyHash, eşik, pencere, stake ve beneficiary sabitlenir. V2 request hash’i zincirde de canonical olarak türetilir. Eşitlik NO’dur: karar `price > threshold`.

Ana EVM akışında envelope yaşı ve source yaşı ayrı kontrol edilir: 120 saniye, gelecek toleransı 5 saniye. Kaynak milisaniyesi normalize edilir. “**İlk kabul edilen geçerli pencere gözlemi**” sonucudur; kesin T saniyesi, sürekli fiyat koşulu veya upstream doğruluk garantisi değildir. Keeper sırası/gecikmesi ekonomik seçim riski taşır.

Yetkiler per-mandate sınırlarıdır; account abstraction/session key ürünü değildir. Yerel test rolünün tam anahtarı yeni mandate verebilir; küçük izole rol ve deterministik executor güven sınırının parçasıdır. L2 gas sınırı, Base’in protokolce fiyatlanan L1 ücretini mutlak üst sınırla garanti etmez. Revert’ler de gas tüketir.

### İmza farkı BSV’de nasıl aşıldı?

Optimize native yol Ethereum imzasını BSV anahtarıyla yeniden imzalamıyor. Script, orijinal UTF-8 yanıt üzerinden Keccak/EIP-191 digest’ini hesaplayıp pinlenmiş Nodary public key’ine karşı secp256k1 ECDSA doğruluyor. İşlem çıktısı ve teminat covenant kontrolleri ayrıca BSV transaction preimage’ına bağlı. Verifier deneysel; native doğrulama EVM’den gelen “onaylandı” bayrağına güvenmiyor. Eski `/bsv` relay yolu bundan farklıdır.

Artifact SHA-256: `bd453a9cd9e9fff72ad98422d23af94407506ae8be584e95640339b1b0e85591`. SDK `3.2.1`, Wallet Toolbox `2.14.9`, scryptlib `2.2.6` pinli. Fonlanmış script/parametreler immutable; yeni artifact eski outpoint’i değiştiremez.

## Adresler ve kanıtların kaynağı

Ana V2 ağ **Base Sepolia, chainId 84532**:

- [FactMarketNext](https://sepolia.basescan.org/address/0x9319e85d84beb94307e91c350209e5e429b8be34): `0x9319e85d84beb94307e91c350209e5e429b8be34`
- Test FMCT: `0xd6e4968b75422dfb13759138808a4310cec061b3`
- Kaynak: `docs/evidence/v2/deployment.json`. V1’in ayrı deployment’ı `docs/evidence/deployment.json` içinde.
- Nodary signer: `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`.
- ETH request: `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66`.
- Nodary request: `latestFeeds`, `name: ETH/USD`, projection `price: /ETH~1USD/value`, `updatedAt: /ETH~1USD/timestamp`. BTC ayrı request/recipe’ye sahip; ETH yanıtı BTC piyasasını sonuçlandıramaz.

| Kanıt dosyası | Neyi ispatlıyor? |
|---|---|
| `docs/evidence/v2/verification-public.json` | 31 Ekim 11:04:29 UTC tarihli PASS: gerçek iki feed settlement/payout, beş amaçlanan oracle/wrong-feed reddi, korunmuş V1/regression ve 34 ücret receipt’inin denetimi. |
| `docs/evidence/v2/chain-smoke.json`, `agent-runs.json` | Gerçek işlem hash’leri, model kayıtları, tam lifecycle ve tamper örnekleri. |
| `docs/evidence/bsv/completion-verification.json` | 11:59:04 UTC teknik teslim özeti; test/build/browser ve açık native eksikleri. |
| `docs/evidence/bsv/fast-node-utxo-validation*.json` | İlk güçlü native doğrulama ve 11:51:55 UTC son ayrıntılı input-spend/output-create/mining fotoğrafı. |
| `docs/evidence/bsv/fast-live-tamper.json`, `fast-check-replay.json` | Gerçek immutable pilot policy’si üzerinde geçerli yanıt, dört oracle reddi, adres/teminat değişikliği reddi; **salt okunur yerel VM**. |
| `docs/evidence/bsv/fast-expired-authority-recovery.json` | Mandate süresi dolduktan sonra iki gerçek resume isteğinin aynı imzalı bytes/hash’i koruyup MTP beklemesinde kalması; başarılı refund receipt’i değil. |
| `docs/evidence/bsv/fast-screenshots/` | Son native ve API3 sunum ekranları. |

Örnek V2 [ETH settlement](https://sepolia.basescan.org/tx/0x701bb3d8904b7f603473cc5849e75b88a50858e078f7f2e03c80d590a426ea54) ve [2 FMCT payout](https://sepolia.basescan.org/tx/0xfe5fd704bbea10f24ee542f296e376827244c3e07d6d5600a9dd9e25c13e1986). BTC lifecycle hash’leri public verification dosyasında. Bunlar tarihsel gerçek test işlemleri; yeni bir canlı çalıştırma gibi anlatma.

## Native BSV: eksik olan ve nasıl takip edileceği

Son ayrıntılı ağ fotoğrafı 31 Ekim **11:51:55 UTC**. Handoff için 12:00:37 UTC API kontrolünde aktif market hâlâ `refund_not_final`, `nativeReady=false`; MTP **10:52:33 UTC**, yükseklik 1766143 idi. Gözlem yapılmaması ikinci havuzda kontrollü test seçimi; gerçek upstream kesintisi yaşandı diye anlatılmıyor.

| İşlem | Snapshot durumu |
|---|---|
| [İlk fonlama](https://test.whatsonchain.com/tx/42926a8684b7bd7d1e1643ac273266a043859cb19c0af1b36bf5653806ac8de9) | MINED, blok 1766139. |
| [İlk ödeme](https://test.whatsonchain.com/tx/486b0e718f95538e8e2881ee36ea310e8c61b3aa9fb65feb567580ee25f8603e) | Native input-spend/output-create doğrulanmış; snapshot’ta UNCONFIRMED. |
| [İkinci fonlama](https://test.whatsonchain.com/tx/00e13304fc82ed7f22f1db062afc89eb9aaf2fe22c9f39d979153a2256aa3099) | MINED, blok 1766140. |
| Sabit iade `114518d7f422662132ed9014512035b985d2320cfa378cf55701786e07e7e3ab` | Ön imzalı; MTP’nin **11:24:10 UTC’yi kesin geçmesini** bekliyor. Ödenmiş sayılmıyor. |

İlk havuzda buyer NO seçti, sonuç YES oldu; CP’ye tam **2.000 sat** principal çıktı. Ayrı CP 900 sat girdisinden 100 sat ücret, 800 sat change var. İkinci havuzun sabit iadesi buyer 1.000 + CP 1.000 sat; aynı şekilde ücret dış girdiden. Principal’dan ücret kesilmiyor.

İade 11:15:29 UTC’de, fonlama yayınlanmadan önce kaydedildi. Mandate 11:37:10 UTC’de doldu; bu yeni imzayı engeller, aynı önceden imzalı iadeyi uzlaştırmayı engellemez. Aktif keeper bu kaydı takip ediyor. Cüzdana import/bakiye dönüşü ancak gerçek refund ve import sonucu doğrulanınca söylenebilir.

**Asıl tarihsel eksik:** Güçlü fonlama validation’ı ilk kez 11:29 UTC’de gözlendi; iki gözlem penceresinden sonra. Daha erken HTTP 200/raw/WOC görünürlüğü yalnız public commitment/transport kanıtıydı. Teranode Kafka yolunda validator’dan önce HTTP 200 dönebiliyor. Bu zamanları geriye dönük validation zamanı diye değiştirme. `VALIDATED_BY_NODE_UTXO`, exact input spender/vin ve oluşmuş çıktıları kanıtlıyor; `MINED`/finality ayrı. Belirsiz geçmiş validation zamanı “kesin geç doğrulandı” anlamına da gelmez.

İade sonradan başarılı olsa bile tarihsel pre-window kanıt açığı kendiliğinden kapanmaz. Bu koşuda ana sunum **API3 V2** kalır. Düzeltilmiş executor gelecekte validation yalnız geç gözlenirse sabit iadeye gider; bu, yeni havuz kurma yetkisi değildir.

**Yeni native fonlama kesin kapalı:** iki yeni optimize havuz kullanıldı, 45 dakika sınırı 11:33:40 UTC’de doldu. Üçüncü havuz, yeni sponsor seed/sign/top-up veya budget dosyasını silip süreyi sıfırlama yok. Mevcut canonical işlemlerin kurtarılması sürdürülebilir. `/bsv/native` eski 2.000 sat outpoint’inin olgun iadesi de validation-time politikasıyla reddedildi; onu yalnız saat bekleyen yeni iade ile karıştırma.

## Mevcut çalışma alanında güvenli başlangıç

Claude Code yerel repo erişimiyle çalışıyorsa:

```sh
git status --short
git branch --show-current
git log -1 --oneline
lsof -nP -iTCP:3102 -sTCP:LISTEN
curl -s http://127.0.0.1:3102/api/bsv/fast/state
```

API çıktısı public/redacted durumdur; özel cüzdan/journal içeriğini terminal çıktısına dökme. Portta mevcut server varsa ikinci server açma. Sırf inceleme için çalışan recovery keeper’ını durdurma. CLI ile mutasyon gerekirse mevcut süreci doğrulayıp normal kapat; server ve mutating CLI aynı anda çalışmaz. `server/lock.ts` korumasını atlama, lock/state dosyalarını retry yöntemi olarak silme.

Mevcut `.env` üzerine `.env.example` kopyalama. `.local`, test cüzdanları, SQLite ve canonical journal’ları koru. V1 `.local/` ile V2 `.local/next/` ayrıdır; native optimize kayıtlar `.local/bsv/fast/` altındadır. Bunlar public repo’da yoktur ve Claude.ai’ye yüklenmez. Fonlama/ödeme anahtarları modele veya browser’a verilmez.

Claude.ai yalnız public repo/dosya görüyorsa localhost’a, Ollama’ya, BSV Desktop’a veya özel journal’lara erişemez. Public kanıt incelemesi yapabilir; erişemediği canlı akışı çalıştırdığını söylememeli. Fresh clone için README’de ayrı izole test rolü/deployment kurulumu gerekir; geçmiş receipt’ler cüzdan veya harcanabilir bakiye değildir. Mevcut kurulumda setup/deploy/smoke komutlarını “kurulum tamamlamak” için körlemesine tekrar çalıştırma.

Gereksinimler: Node >=22.18, npm, Foundry; yeni model önerisi için Ollama 11434’te `qwen3:4b`. Native cüzdan gerektiğinde BSV Desktop TESTNET ve WalletClient kullanılır. Pinned paketleri sebepsiz yükseltme; paylaşılan Ollama’yı durdurma/yeniden yapılandırma.

### Kontrol komutları

Repo kökünden, gerektiği kadar:

```sh
npm test
forge test -vv
npm run build
npx tsx scripts/next-verify.ts --public
npm run bsv:fast:check -- --api http://127.0.0.1:3102
npx tsx scripts/check-public-tree.ts
```

`next-verify --public` yeni para harcamaz/özel cüzdan kullanmaz, public raporunu günceller. Native checker yerel immutable policy üzerinden VM çalıştırır; signing/broadcast yapmaz. Rapor değişikliğini yeni zincir receipt’i diye sunma. Kaynak değişmediyse sırf ilerleme göstermek için bütün suite’leri tekrar tekrar koşturma.

Native compiled fixture scriptleri CWD’ye göre `fixture.json` okur ve sonuç JSON’larını yazar. Gerekirse scratch checkout’ta `npm --prefix native/fast ci --ignore-scripts` sonrası **`native/fast` dizini içinden** `node test-fast-asm.cjs` ve `node test-fast-sdk-asm.cjs` çalıştır. Fixture işlemlerini yayınlama. Mevcut ağ kanıtlarını overwrite etme.

`chain:deploy`, `next:setup`, `chain:smoke`, `next:smoke`, native sponsor/setup/fund ve EVM `submit/observe` salt okunur değildir; gerçek test işlemleri yapabilir. Başlangıç denetiminin parçası olarak otomatik çalıştırma. EVM’de yeni canlı döngü gerekiyorsa mevcut test bütçesi/yetki ve gelecekteki pencere kontrol edilir; sınırlar otomatik yenilenmez.

## Jürinin yanıt göndermesi: V1/V2 ayrımına dikkat

**`npm run judge:submit` yalnız V1 içindir.** `scripts/submit.ts`, V1 store/deployment ve `FactMarket` ABI’sini kullanır. V2 için `/next` Evidence UI veya **`POST /api/next/markets/:id/submit`** kullanılır. Body `{"envelope":{"timestamp":"…","data":"orijinal JSON string","signature":"0x…"}}`; `data` yeniden serialize edilmez. Bu EVM route’u gerçekten işlem gönderir ve gas harcayabilir.

Jüri, public V2 ABI ile deployed sözleşmenin `settle(marketId,timestamp,data,signature)` fonksiyonuna kendi test cüzdanından da çağrı yapabilir. Ayrıntı `server/next/api.ts`, `contracts/FactMarketNext.sol` ve public ABI’dedir. Yerel HTTP yolu mevcut bir V2 market job’ı bekler; public receipt’leri fresh clone’a kopyalamak aktif job yaratmaz.

Tarihsel settled markette yeni yanıtın reddi yalnız “zaten sonuçlandı” kontrolünü gösterebilir. Oracle güvenlik kanıtı için amaçlanan hata ve değişmeyen reserve incelenmeli. Public tarihsel verifier tam receipt bloğundaki custom error’ı doğrular: edited/different request/wrong signer için `NotSignedByAirnode`, eski gerçek yanıt için `ResponseTooOld`.

`/bsv/fast` checker ise **yerel VM**; chain payout başlatmaz. Güncel no-data havuzu aktifken pozitif örneği önceki ödenmiş marketten yükler ve o marketin ID/eşik/outpoint’ini açık gösterir. Yanlışlıkla bu yanıtı mevcut havuzun pozitif sonucu sanma.

## Claude’un öncelikli işi ve bitiş ölçütü

1. Kaynakları/kuralları ve güncel runtime’ı oku. Kısa bir PASS / PENDING / BLOCKED listesi çıkar; kendi doğruladığınla devraldığın kanıtı ayır.
2. Ana `/next` akışında gerçek blocker varsa en küçük düzeltmeyi yap. Fonlama, gözlem, ödeme/iade ve tekrar istek durumlarının dürüst gösterildiğini kontrol et. Yeni özellik, yeni chain veya geniş tasarım değişikliği ekleme.
3. Native’de yalnız mevcut kurtarma kaydını izle/uzlaştır. İade gerçekleşirse aynı hash’i, 1.000/1.000 principal’ı, ayrı ücreti, gerçek UTXO/block durumunu ve wallet import’u doğrula. Bekleyen durumdan başarı üretme.
4. `SUBMISSION.md` açıklamasını resmî listeye göre tamamla. Özellikle “kim bu veriye güveniyor / sahte veri hangi yanlış ödemeye yol açar / hangi veriyi istedik ama bulamadık” bölümleri açık olsun. Katalogda eksik veri uydurma: bir entegrasyonu yapmamış olmak bulunamadığı anlamına gelmez; MVP verisi yeterliyse bunu dürüstçe söyle.
5. En fazla 150 saniyelik akışı prova et: problem → gerçek sınırlı model önerisi → sabit policy/mandate ve fonlama → orijinal yanıt/ödeme → dört gerçek EVM tamper kanıtı → tekrar güvenliği → repo/adres. Uzun pencereyi bekleyen görüntüyü kayıtta kesebilirsin; zaman atlamasını ve tarihsel kanıtı açık etiketle.
6. Masaüstü/mobil browser kontrolü, ilgili test/build ve public secret taramasını bitir. Testler değişiklikle orantılı olsun. `REVIEW_SUMMARY.json`, track checklist ve sunum notlarına gerçek son durumu yaz.
7. Kullanıcıya sunum linki, commit, doğrulananlar, kalanlar ve önerdiğin track’i ver. Gerçek video/başvuru ayrıca tamamlanmadan “hackathona gönderildi” veya “tüm uygunluk PASS” deme.

Kullanıcı sadelik istiyor: mevcut tasarım, kısa anlaşılır akış, sahte başarı/metrik yok, her yerde “demo” etiketi yok. Rutin hata düzeltmeleri için bekleme; yeni ürün fikri gerekiyorsa öner, bu kapsamda uygulama. Hosted deployment, mainnet/gerçek değer harcaması, ücretli servis açılması, üçüncü kişilere mesaj ve yarışma gönderimi için mevcut handoff yetki vermez. Public kaynak yayınlama önceki kapsamda yetkilidir; repo-local author/committer **ABerkeBora**, bot değil. Yeni dal açarsan `codex/` prefix kullan.

**Başarı ölçütü:** Jüri projenin ne yaptığını, neden imzalı veriye ihtiyaç duyduğunu, agent’ın hangi gerçek ödeme adımlarını yetki içinde yaptığını ve hangi iddiaların henüz kanıtlanmadığını kısa sürede anlayabilmeli.
