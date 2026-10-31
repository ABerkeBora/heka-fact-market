import fs from 'node:fs';
import path from 'node:path';
import {local} from './config.js';
export function acquireProcessLock(label:string){
 const file=path.join(local,'executor.lock');
 if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,'utf8'));let alive=false;try{process.kill(Number(old.pid),0);alive=true;}catch{}if(alive)throw Error(`Fact Market executor already running (${old.label}, PID ${old.pid}). Stop it before starting another mutating server/CLI.`);fs.unlinkSync(file);}
 const fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,label,createdAt:new Date().toISOString()}));fs.closeSync(fd);
 const cleanup=()=>{try{const x=JSON.parse(fs.readFileSync(file,'utf8'));if(x.pid===process.pid)fs.unlinkSync(file);}catch{}};
 process.once('exit',cleanup);process.once('SIGINT',()=>process.exit(130));process.once('SIGTERM',()=>process.exit(143));
}
