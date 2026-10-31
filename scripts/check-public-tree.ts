import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
let failures=[] as string[];for(const p of paths){if(p.startsWith('.git/'))continue;const st=fs.statSync(p);if(!st.isFile())continue;const s=fs.readFileSync(p,'utf8');if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(s))failures.push(p+': private key block');if(/"privateKey"\s*:\s*"0x[\da-fA-F]{64}"/.test(s)||/PRIVATE_KEY\s*=\s*0x[\da-fA-F]{64}/.test(s))failures.push(p+': literal wallet key');if(/PAYMENT-SIGNATURE["']?\s*:\s*["'][A-Za-z0-9+/=]{80,}/i.test(s))failures.push(p+': payment authorization');}
if(failures.length)throw Error(failures.join('\n'));console.log(`Secret-pattern inspection passed for ${paths.length} publishable files; private local paths remain ignored.`);
