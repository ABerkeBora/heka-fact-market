# Fact Market V2 — sabah teslimi

**Mühendislik ve canlı test akışı hazır.** Gerçek Goal durumu NEXT_GOAL_STATUS.md'de; kısa makine özeti REVIEW_SUMMARY.json dosyasında.

## Kısa karşılaştırma ve öneri

- **V1:** http://localhost:3102/ — sabit ETH/USD. `v1-baseline` tag'i, commit `e8fb85c79eb8104f6530c77ecc50b6509672f59c`, doğrulanmış yedek sürüm.
- **V2:** http://localhost:3102/next — model hedefe göre ETH/USD veya BTC/USD seçer; her piyasa kendi immutable veri reçetesini zincirde sabitler. Aynı repo, `codex/next` branch; doğrulanmış kod commit `8c14e8f34bb13c323c0daaab04ba6e66cf083ba7`.
- **Öneri: V2.** İki varlıkta gerçek payout ve iki yönde yanlış feed reddi var; müşteri değerini kaynak seçimi ve değiştirilemez çözüm kuralı birlikte açıklıyor. V1'in yeni regresyonu da geçti. Demo riski **orta**: yeni canlı senaryo için model/veri erişimi ve gözlem penceresi gerekir; tamamlanmış kayıtlarla başlanabilir.
- Değişenler: hedefe göre iki feed, zincirde sabit recipe/policy, ayrı V2 ödeme/state.
- Harici müşteri pilotu yapılmadı; kanıtlar yerel test rolleriyle gerçekleşti. Video kaydı ve Devfolio gönderimi bekliyor.

## Açma ve sunma

Production server3102 üzerinde açık bırakıldı. Yeniden başlatmak gerekirse `npm ci`, `forge build`, `npm run build`, `npm start`. Server ile mutating CLI aynı anda çalışamaz. Yerel roller/deployment hazır; public clone için kendi küçük test rollerini kurma ve `npm run next:setup` adımları README'de.

V2'de BTC sorusu yaz → Draft market → kaynak, request/recipe/policy hash'leri ve mandate incele → Authorize agent bir kez. Agent1FMCT pozisyonu ve karşıt test rolünü fonlar, uygun imzalı ölçümle settlement/claim yapar. Markets→BTC market2, gerçekleşmiş NO sonucu ve2FMCT counterparty payout'u gösterir: model YES seçmişti; model tahmini settlement otoritesi değildir. ETH market1 de tamamlandı. Source binding bütün exact alanları gösterir. SOL/USD denemesi model/fonlama öncesinde reddedilir.

## Gerçek kanıt ve kontroller

- Base Sepolia84532: V2 factory `0x9319e85d84beb94307e91c350209e5e429b8be34`, V2 FMCT `0xd6e4968b75422dfb13759138808a4310cec061b3`. V1 factory korunur: `0xfbacf475b8a6729d97db83a06b07ff303a243614`.
- `docs/evidence/v2/chain-smoke.json`: iki gerçek LLM/fund/settle/claim, dört zorunlu tamper ve karşı yönde wrong-feed, yeni V1 lifecycle. Her iki V2 rezerv0; her payout2FMCT.
- `verification.json`: özel workspace retention audit PASS. `verification-public.json`: private dosya gerektirmeyen zincir/kaynak audit PASS; özel journal kontrolleri açıkça not-run-public.
- `ui-no-payment.json`: gerçek UI SOL reddinde job/model-call stamp/üç rol nonce ve bakiyesi değişmedi. Fixture başarı diye sunulmadı.
-15TypeScript ve64Solidity testi PASS; her core reserve fuzz256. Productionbuild PASS; public branch temiz clone üzerinde npm ci/build/15TS+64Soliditytests de PASS; gerçek browser1440/768/390, exact recipe drawer ve V1/V2 linkleri kontrol edildi. V1 eski17source/3public evidence hash/26receipt korunur; yalnız ayrı yeni V1 regresyon job'u eklendi.
- Tekrar: `npx tsx scripts/next-verify.ts --public`. Özel journal denetimi yalnız bu korunmuş workspace'te `npx tsx scripts/next-verify.ts`.

## İzolasyon ve sınırlar

V2 `/api/next/*`, `.local/next/` ve ayrı üç signing rolü/token/factory kullanır. Setup'taki bir defalık test gas hibesi müşteri ödemesi değildir; V1 escrow'u kullanılmadı. Eski receipt/kanıtlar silinmedi. İmzalı hash broadcast öncesi kaydedilir; yabancı context job'u, yanlış rol/recipient, budget/expiry ve duplicate işlemler reddedilir. Anahtar tam signing yetkisi taşır; limits mandate ID başına, gas/tool kontrolleri uygulamadadır. L1 fiyatı muhafazakâr rezerve edilir, mutlak tavan vaat edilmez.

İlk kabul edilen taze observation kullanılır; exact-T/history veya upstream gerçeği garantisi yok. Kaynak değişimi/finality belirsizliği fon salmaz; veri yoksa void/refund. Nodary ücretsizdir. Yeni BSV/PandaScore lifecycle, hosting veya mainnet harcaması yok.

## Kalan ekip aksiyonları

150s sunum taslağından video kaydı/upload ve tek ekip Devfolio başvurusu (yaklaşık10–20dk+10–15dk). Resmi API3/genel kurallar başlangıçta ve04:47Berlin'de yeniden kontrol edildi; deadline31Ekim15:00Berlin. Tüm yarışma submission şartları tamamlandı iddiası yapılmaz. Dış müşteri pilotu ayrıca planlanabilir; yapılmış sayılmaz.
