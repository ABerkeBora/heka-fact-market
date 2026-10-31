// Read-only public peer query. This CLI cannot send a transaction or sign.
const fs=require('node:fs'),{transportCanonical}=require('../native/transport/testnet-p2p.cjs');
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/bsv-testnet-query.cjs <already-signed-public-journal>');const j=JSON.parse(fs.readFileSync(file,'utf8'));if(!j.raw||!j.txid)throw Error('A frozen raw/txid journal is required');transportCanonical({network:'testnet',mode:'query',expectedTxid:j.txid,rawHex:j.raw}).then(r=>console.log(JSON.stringify(r,null,2)));
