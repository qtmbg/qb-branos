import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const config=JSON.parse(readFileSync('vercel.json','utf8'));
assert.notEqual(config.outputDirectory,'.','Repository root must never be the public output');
assert(existsSync(`${config.outputDirectory}/index.html`),'Public homepage must ship');
for(const path of ['docs/clients','docs','_archive','tests','supabase','CLAUDE.md','package.json']) {
 assert(!existsSync(`${config.outputDirectory}/${path}`),`${path} must not ship`);
}
console.log('Deployment boundary passed');

// Exercise the real builder against a small isolated repository, including
// unpublished client material and deliberately unsafe manifest entries.
const {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync,symlinkSync}=await import('node:fs');
const {tmpdir}=await import('node:os');
const {join}=await import('node:path');
const {spawnSync}=await import('node:child_process');
const fixture=mkdtempSync(join(tmpdir(),'public-boundary-'));
try {
 mkdirSync(join(fixture,'scripts'));
 mkdirSync(join(fixture,'docs/clients'),{recursive:true});
 copyFileSync('scripts/build-public.mjs',join(fixture,'scripts/build-public.mjs'));
 writeFileSync(join(fixture,'index.html'),'public-home');
 writeFileSync(join(fixture,'404.html'),'not-found');
 writeFileSync(join(fixture,'docs/clients/private.html'),'confidential sentinel');
 const manifest=files=>writeFileSync(join(fixture,'scripts/public-files.json'),JSON.stringify(files));
 const run=()=>spawnSync(process.execPath,[join(fixture,'scripts/build-public.mjs')],{encoding:'utf8'});
 manifest(['index.html','404.html']);
 assert.equal(run().status,0);
 assert.equal(readFileSync(join(fixture,'public-dist/index.html'),'utf8'),'public-home');
 assert(!existsSync(join(fixture,'public-dist/docs')),'Unlisted private files must stay private');
 manifest(['index.html','404.html','docs/clients/private.html']);
 let result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Forbidden public path/);
 manifest(['index.html','404.html','../private.html']);
 assert.notEqual(run().status,0);
 symlinkSync(join(fixture,'docs/clients/private.html'),join(fixture,'leak.html'));
 manifest(['index.html','404.html','leak.html']);
 result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Symlink cannot ship/);
 console.log('Negative controls passed: unlisted file, private manifest, traversal, symlink');
} finally {rmSync(fixture,{recursive:true,force:true});}
