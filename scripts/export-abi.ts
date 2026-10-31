import fs from 'node:fs';
for(const name of ['FactMarket','TestCollateral']) {const a=JSON.parse(fs.readFileSync(`out/${name}.sol/${name}.json`,'utf8'));fs.writeFileSync(`docs/${name}.abi.json`,JSON.stringify(a.abi,null,2)+'\n');}
