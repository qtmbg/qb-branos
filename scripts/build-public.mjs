// Only explicitly reviewed static assets may enter the public deployment.
// Serverless functions remain in api/ and are packaged separately by Vercel.
import { readFileSync, lstatSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output=resolve(root,'public-dist');
const files=JSON.parse(readFileSync(resolve(root,'scripts/public-files.json'),'utf8'));
if(!Array.isArray(files)||!files.includes('index.html')||!files.includes('404.html')) throw Error('Invalid public manifest');
for(const file of files){
 if(typeof file!=='string'||file.split('/').some(p => p === '..' || p === '.')||file.includes('\\')||file.startsWith('/')||/(^|\/)(docs|clients?|private|confidential|_archive|_drafts|tests|supabase)(\/|$)/i.test(file)) throw Error(`Forbidden public path: ${file}`);
 if(!/^(?:[a-z0-9][a-z0-9._-]*\.(?:html|css|js|ico|txt|xml)|(?:blog|css|js|img)\/.+\.(?:html|css|js|json|png|jpe?g|webp|svg|gif|ico|woff2?|avif|mp4|mov|webmanifest))$/i.test(file)) throw Error(`Unapproved public asset type: ${file}`);
 let part=root;
 for(const segment of file.split('/')) {part=resolve(part,segment);if(lstatSync(part).isSymbolicLink()) throw Error(`Symlink cannot ship: ${file}`);}
 if(!lstatSync(part).isFile()||relative(root,part).startsWith('..'+sep)) throw Error(`Invalid asset: ${file}`);
}
// Deletion is limited to the fixed, generated output directory.
rmSync(output,{recursive:true,force:true});
for(const file of files){const target=resolve(output,file);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(root,file),target);}
console.log(`Public deployment contains ${files.length} reviewed assets; source folders excluded.`);
