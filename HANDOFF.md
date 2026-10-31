# Fact Market — güncel uygulama handoff'u

## Yetki ve teslim kapsamı

Fact Market kullanıcı tarafından uygulama için seçildi. Önceki “yalnız handoff hazırlanıyor” durumu, 31 Ekim 2026 tarihli uygulama yetkisiyle aşılmıştır. Yetkili kapsam: yerelde çalışan ürün, gerçek test ağı/agent ödeme kanıtı, uygun test ve gerçek browser QA, ayrı public kaynak deposu ve dürüst sabah teslimi. İnceleme hedefi 31 Ekim 2026 08.00–09.00 Europe/Berlin; erken biten iş beklemez.

- Ürün: **Fact Market**; yerel adres `http://localhost:3102`.
- Repo hedefi: `ABerkeBora/heka-fact-market`.
- Seçili track: **API3 — Any API in your contract**.
- BSV: koşullu kapı geçilmedi, uygunluk iddiası yok. Cardano kapsam dışı.
- UI İngilizce, koordinasyon/handoff Türkçe. Hosted yayın ve yarışma başvurusu bu teslimin kapsamında değil.

Bu repo parent çalışma alanına bağımlı değildir. Kurulum ve güncel çalıştırma için [README](README.md), resmi gereksinim eşlemesi için [TRACK_REQUIREMENTS](TRACK_REQUIREMENTS.md), son teslim/eksikler için [MORNING_HANDOFF](MORNING_HANDOFF.md), 2,5 dakikalık sunum ve başvuru metni için [SUBMISSION](SUBMISSION.md) kullanılır. Son iki belgeyi gerçek video veya gönderilmiş başvuru sanmayın; durumları kendi içlerinde açıkça belirtilmelidir.

## Çalışan dar ürün

Agent gerçek Nodary verisini alır; yerel Ollama `qwen3:4b`, yalnız izinli ETH/USD şablonu içinden yapılandırılmış taraf/eşik adımı önerir. Bağımsız strict validator -25/0/+25 bps adımını, sabit alan/birim ve zaman politikasını deterministik executable kurala çevirir. Modelin kısa açıklaması settlement otoritesi değildir; sözleşme parametreleri ve resolution card aynı doğrulanmış policy'den çıkar.

Kullanıcı resolution card ve bounded mandate'i bir kez onaylar. Executor kendi izole buyer test rolü adına tam stake kadar FMCT approval yapar ve gerçek pozisyon fonlamasını başlatır. Ayrı counterparty test rolü eşit karşı pozisyonu kendi transaction'ıyla fonlar. Gözlem penceresinde uygun imzalı veri sözleşmeye gider; kazanan tarafın sabit beneficiary'sine sözleşme ödemesi agent tarafından tetiklenir. Her ekonomik adım için yeni manuel ödeme tıklaması gerekmez.

Kapsam bir **tam teminatlı, iki taraflı sabit eşit stake** piyasasıdır. AMM, kaldıraç, gerçek değer teminatı, serbest endpoint/predicate, native Polymarket işlemi, bridge veya üretim bahis hizmeti yoktur. Birinci çalışan şablon tamamlanmadan ikinci şablonun görsel genişliği artırılmadı.

## Sabit resolution kuralı

- Kaynak/operation: Nodary `latestFeeds`; `name: ETH/USD`.
- Projection: `price: /ETH~1USD/value`, `updatedAt: /ETH~1USD/timestamp`.
- Beklenen signer: `0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0`.
- Exact request hash: `0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66`.
- Predicate: `price > threshold`; eşitlik NO.
- Trading kapanışından sonraki sabit kısa pencerede, kaynak zamanı da pencereye uyan **zincirde ilk kabul edilen** gözlem sonucu belirler.
- Envelope ve kaynak yaşı ayrı ayrı en fazla 120 saniye; gelecek zaman toleransı 5 saniye. Kaynak milisaniyesi açıkça saniyeye normalize edilir.
- Pencere sonuna kadar uygun veri yoksa void/refund. Karşı tarafı oluşmayan piyasa trading kapanışından sonra void olabilir.
- Policy teminattan önce değişmez biçimde saklanır. Settlement, claim ve refund tekrar çalıştırılarak yeni hak üretilemez. Her piyasanın reserve muhasebesi ayrıdır; yönetici fon çekme veya policy düzenleme işlevi yoktur.

Bu kural tam T anının tarihsel fiyatını veya fiyatın dönem boyunca sürekli bir eşiğin üstünde kaldığını kanıtlamaz. Keeper gecikmesi ve kabul sırası ekonomik seçim riski taşır. İmza, sağlayıcının exact request'e verdiği cevabın kaynağını/bütünlüğünü doğrular; upstream gerçeğini, manipülasyonsuzluğu veya agent kârlılığını garanti etmez.

## Gerçek çalıştırma kanıtı

31 Ekim 2026 erken sabah geliştirme kaydında iki ayrı Nodary piyasası gerçek runtime LLM, on-chain fonlama, settlement ve collection yolunu tamamladı. İkinci akış gerçek browser üzerinden başlatıldı. Güncel canonical kayıt [agent-runs.json](docs/evidence/agent-runs.json); adres/deploy kayıtları [deployment.json](docs/evidence/deployment.json).

Ağ **Base Sepolia, chain ID 84532**:

- Market: `0xfbacf475b8a6729d97db83a06b07ff303a243614`.
- Değersiz 6-decimal FMCT: `0x4d317922ad3a235718ef1c5c4c71c85094df880a`.
- Market 1: [settlement](https://sepolia.basescan.org/tx/0x24dd82d6f81410ed9f6a93e0d25fce968756434ebe940b70e23199672ec3d04f), [collection](https://sepolia.basescan.org/tx/0x8b67fa836569bcb0f3ddd50e5679b9b8090b036485e8bb3b77fae09afd1793c5).
- Browser'dan başlatılan Market 2: [settlement](https://sepolia.basescan.org/tx/0x842747a27a7e02974b3702172b5e60c65eae74907673c176bd17409fd92cf8f9), [collection](https://sepolia.basescan.org/tx/0x2af040b68c3b30634a64c28d05eb6e859b4be1b9fa3a7310a4546fbcf531b291).

[chain-smoke.json](docs/evidence/chain-smoke.json), aynı protected market'te valid settlement'tan önce gerçek edited-value, stale-real-response, different-request ve wrong-signer transaction'larının reddini ve değişmeyen state/reserve kayıtlarını taşır. Tarihsel block doğrulama script'i her vakanın beklenen custom error'unu denetler. Başka bir nedenle revert olması o tamper vakasının PASS kanıtı değildir. Duplicate authority/intent kontrolleri ayrıca değerlendirilir; canonical tablodaki güncel durumu kullanın, başarısız bir ek kontrolü dört resmi oracle maddesine karıştırmayın.

Solidity doğrulamasında **29 test geçti**, bunlardan birinde 256 fuzz çalışması var: authentic fixture ile dört zorunlu oracle reddi, duplicate funding/claim, stake/action/expiry sınırları, kaynak/pencere semantiği, piyasa rezerv izolasyonu, void/refund, transfer rollback ve reentrancy. Historical fixture zamanına yerel warp kullanılan unit testler canlı testnet kanıtı diye sunulmaz. Son production build/browser/viewport ve resmi finish-gate sonuçları `MORNING_HANDOFF.md` ile `TRACK_REQUIREMENTS.md` içinde güncellenir; bu handoff bu maddelerin tamamına peşinen PASS vermez.

## Mandate, ödeme ve trust sınırı

Payer buyer rolü; recipient pinned market factory; beneficiary fonlayan buyer adresidir. Karşı rol ayrı test adresidir. Her ikisi bu yerel kurulumun kontrolündedir; iki bağımsız gerçek müşteri talebi gibi anlatılmaz. FMCT'nin parasal değeri veya USD'ye çevrilebilirliği yoktur.

On-chain mandate bir ID için caller/beneficiary, factory/token, tek stake, toplam stake, action count ve expiry sınırlarını uygular. Intent tekrar kullanımı reddedilir; approval exact stake'tir. **Bu hesap çapında session-key yetkisi değildir:** tam signing key'e sahip executor yeni mandate oluşturabilir. Genel güven sınırı küçük izole test cüzdanı, deterministik executor ve mandate başına sözleşme limitleridir. Model key, arbitrary calldata veya hedef adres seçmez.

Executor chain, deployment, beneficiary/roller, token, function allowlist ve exact intent bağını kontrol eder. İmzalı raw transaction ve hash yayınlamadan önce private journal'a yazılır. Timeout/restart sonrasında aynı hash uzlaştırılır; yeni bir ödeme imzası yaratılmaz. Pending ücret rezervleri korunur. Yeni imzalar budget/expiry'de durur; otomatik top-up yoktur. Server ve mutating CLI exclusive process lock kullanır.

L2 gas limiti/fiyatı imzalı transaction ile sınırlanır. Base'in L1 data fee'si protocol fiyatlıdır ve EIP-1559 ile kesin hard-cap edilemez; executor muhafazakâr rezerv ayırır, gerçek receipt'te L1/L2 ücretini ayrı uzlaştırır ve eksik muhasebeyi sıfır diye göstermez. Gas/tool sınırları uygulama kontrolüdür. Revert gas harcar. Geçersiz oracle cevabı market rezervini/payout hakkını değiştirmez.

## PandaScore ve BSV durumu

PandaScore için gerçek `matchesUpcoming` ve `getMatch` x402 satın alımları yapıldı: çağrı başına 10000 unit, toplam **0.02 test aUSD**. Ödeme alıcısı, token/ağ/fiyat ve request/signature bağları doğrulandı; ücret market teminatından ayrıdır. Nodary ücretsizdir, sahte 402 ücreti gösterilmez. Teknik ayrıntı ve receipt bağlantıları [provider-findings.md](docs/provider-findings.md) içindedir.

PandaScore **tam piyasa lifecycle'ı tamamlanmadı**. Initial future-match metadata, final result değildir. Gelecek uygulama create ve final observation'ı ayrı almalı; opponent kimlikleri, nullable winner/end alanları, status/finality, cancellation/draw ve void/refund kuralı exposure öncesinde pinlenmelidir. İkinci şablon bitmiş gibi sunulmaz; harcanmış API ücreti sonradan geri alınabilir diye vaat verilmez.

BSV'nin gerçek standard-wallet transaction/agent payment/yararlı DeFi çekirdeği ve native API3 verifier kapısı kurulmadı. Backend/EVM kontrolü ardından relay imzası native BSV API3 doğrulaması değildir. **BSV qualification iddiası yoktur.**

## Temiz yerel kurulum ve güvenli çalışma

README'deki `npm ci`, `.env.example`, `forge build`, `npm run chain:deploy`, `npm run dev` adımlarını kullanın. Node >=22.18, Foundry ve yerel Ollama gerekir. Fresh clone kendi test rollerini/deployment'ını kurar; public geçmiş kanıtı bir cüzdan veya kullanılabilir bakiye değildir.

Key dosyası ignored `.local/test-wallets.json` veya `WALLET_FILE` ile seçilir; mode `0600`, `testOnly: true`, chain84532 ve role key/address eşleşmesi zorunludur. Key, recovery phrase veya imzalı x402 authorization header'ı kaynak/prompt/browser/public kanıta koymayın. Private `.local/state.json` ve `.local/deployment.json` retry için korunur; reset geçmiş chain state'ini silmez. Aynı anda server ve mutating script çalıştırmayın.

Test/build komutları, judge envelope submission yolu, public ABI ve yeni örnek akış README'de bulunur. Teslimden önce secret taraması, doğru GitHub author/committer doğrulaması, public push ve resmi finish gate tamamlanır. Kaydedilmiş video/Devfolio başvurusu gibi ayrıca tamamlanmamış zorunlu submission işleri açık `PENDING` olarak kalmalıdır.

## Resmi kaynak kaydı

Başlangıçta doğru API3 sekmesi ve genel submission bölümü gerçek browser'da **31 Ekim 2026 03:39 Europe/Berlin** civarında okundu; bağlı resmi starter/guides uygulamadan önce incelendi. Son recheck zamanı ve requirement→evidence statüleri `TRACK_REQUIREMENTS.md` içindedir.

- <https://hackathon.tum-blockchain.com/prizes#api3>
- <https://hackathon.tum-blockchain.com/prizes#how-to-submit>
- <https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a>
- <https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract>
- <https://api3dao.github.io/airnodehub-hackathon/docs/integrations>
- <https://api3dao.github.io/airnodehub-hackathon/docs/projections>

Mandatory qualification, mandatory submission ve optional judging örnekleri birbirinden ayrıdır. Genel kurallarda son okunan kapanış 31 Ekim 2026 15:00 Europe/Berlin'dir; bitirişte yeniden kontrol edilir. Kaynak repo/README veya sunum taslağı tek başına tüm yarışma uygunluğu anlamına gelmez.
