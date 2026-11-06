// Publishing tooling only: official AsciiDoc -> complete HTML -> Chromium PDF.
// See docs/deployment/mastering-bitcoin-generated.md for permissions and reproduction.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const revision = '275c4eb8eab8800c6adc39f8def8e8f8fa356a57';
const image = 'asciidoctor/docker-asciidoctor@sha256:b0c0ebff6e2d6f5cd66a075310ca7f076921d8acb293d8f4ae8fcae0d7fea30c';
const source = path.resolve('.superpowers/mastering-bitcoin-upstream');
const work = path.resolve('.superpowers/pdf-generation');
if(createHash('sha256').update(fs.readFileSync(path.join(work,'tex-svg.js'))).digest('hex')!=='d4295dc33744836935c1399feece5159577b34c5c8ffb9f1c6324cd82e03a882')throw Error('MathJax 3.2.2 publishing tool integrity mismatch');
const run = (cmd,args) => execFileSync(cmd,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
if (run('git',['-C',source,'rev-parse','HEAD']) !== revision) throw Error('Wrong upstream revision');
if (run('git',['-C',source,'status','--porcelain'])) throw Error('Upstream source must be unmodified');
const licence = fs.readFileSync(path.join(source,'LICENSE'),'utf8');
if (!licence.includes('(3rd Edition)') || !licence.includes('Creative Commons Attribution-ShareAlike 4.0')) throw Error('Licence mismatch');
fs.mkdirSync(work,{recursive:true});
const mount = (s,t,readonly=true) => ['--mount',`type=bind,source=${s},target=${t}${readonly?',readonly':''}`];
run('docker',['run','--rm','--network','none',...mount(work,'/output',false),image,'sh','-c','mkdir -p /output/fonts && cp /usr/share/fonts/dejavu/*.ttf /output/fonts/']);
const args = ['run','--rm','--network','none','--memory=768m','--cpus=2',...mount(source,'/source'),...mount(work,'/output',false),...mount(path.resolve('scripts/books/index-anchors.rb'),'/index-anchors.rb'),'-w','/source',image,'asciidoctor','-r','/index-anchors.rb','-a','stem=latexmath','-b','html5','-d','book','-a','toc','-a','toclevels=2','-a','sectnums','-a','reproducible','-a','data-uri','-a','webfonts!','-a','stylesheet!','-o','/output/book.html','book.adoc'];
try { fs.writeFileSync(path.join(work,'asciidoctor.log'),run('docker',args)); }
catch (e) { console.error(e.stderr?.toString()); throw e; }
const types={'.html':'text/html; charset=utf-8','.ttf':'font/ttf','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(work,'.'+new URL(req.url,'http://localhost').pathname);
  if (!file.startsWith(work+path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(`${origin}/book.html`,{waitUntil:'load'});
  const front = ['titlepage.html','praise.html','copyright.html','dedication.html'].map(f=>fs.readFileSync(path.join(source,f),'utf8'));
  const back = ['author_bio.html','colo.html'].map(f=>fs.readFileSync(path.join(source,f),'utf8'));
  const fontNotices = fs.readFileSync('scripts/books/font-notices.txt','utf8')+'\n\nMathJax 3.2.2 equation glyphs: Copyright 2009–2022 The MathJax Consortium.\n'+fs.readFileSync('scripts/books/mathjax-LICENSE.txt','utf8');
  const index = JSON.parse(fs.readFileSync(path.join(work,'index.json'),'utf8'));
  const notice = `Generated open-source edition for Bitsacco Jifunze. This is not the publisher's official PDF.\nSource: https://github.com/bitcoinbook/bitcoinbook\nRevision: ${revision}\nAuthors: Andreas M. Antonopoulos and David A. Harding\nBook: Mastering Bitcoin: Programming the Open Blockchain, Third Edition\nOriginal publication: O'Reilly Media, November/December 2023; print ISBN 978-1-098-15009-9.\nCurrent licence: Creative Commons Attribution-ShareAlike 4.0 International\nhttps://creativecommons.org/licenses/by-sa/4.0/\nGrant: https://github.com/bitcoinbook/bitcoinbook/commit/94c9ba64b454eb79ca77904a48251bd4efab73cf\nChanges: typesetting, open fonts, generated links/index/bookmarks and this provenance notice. Source prose, technical content, code and illustrations are not rewritten. Publisher cover, logo and trade dress are not reproduced. The original publisher notices and colophon below describe the original edition.\nSeparate notices are retained: Bitcoin Design Guide images (CC BY 4.0), Satoshi Nakamoto's whitepaper (MIT), and the whitepaper errata (CC0). Figure source credits remain with their original captions/alternative text.\nFonts: DejaVu / Bitstream Vera; DejaVu Math TeX Gyre. See font notices included below.`;
  await page.evaluate(({front,back,index,notice,licence,fontNotices})=>{
    document.documentElement.lang='en';
    document.title='Mastering Bitcoin: Programming the Open Blockchain - Third Edition (generated open-source PDF)';
    const header=document.querySelector('#header');
    for (const [i,html] of front.entries()) {
      const el=document.createElement('section');el.className='front-page'+(i===0?' title-page':'');el.innerHTML=html;
      if(i===0){const label=document.createElement('p');label.className='edition-label';label.textContent='Generated from the official open-source text';el.prepend(label);}
      header.before(el);
      if(i===0){const p=document.createElement('section');p.className='front-page provenance';const h=document.createElement('h1');h.textContent='Source, attribution and permissions';p.append(h);for(const text of notice.split('\n')){const x=document.createElement('p');x.textContent=text;p.append(x);}const pre=document.createElement('pre');pre.textContent=licence;const ls=document.createElement('section');ls.className='source-licence';const lh=document.createElement('h2');lh.textContent='Upstream licence notice';ls.append(lh,pre);p.append(ls);header.before(p);}
    }
    // Asciidoctor nests the TOC inside its generated header. Keep it while
    // suppressing only the duplicate generated title above the original titlepage.
    const toc=document.querySelector('#toc');
    if(toc)header.before(toc);
    const sect=[...document.querySelectorAll('.sect1')].find(el=>el.querySelector('h2')?.textContent.replace(/^\d+\.\s*/,'').trim()==='Index');
    if(sect){const grouped=new Map();for(const entry of index){const key=entry.terms.join(' > ');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(entry.id);}const ul=document.createElement('ul');ul.className='index-entries';for(const [term,ids] of [...grouped].sort((a,b)=>a[0].localeCompare(b[0],'en'))){const li=document.createElement('li');li.append(term+' ');ids.forEach((id,i)=>{const a=document.createElement('a');a.href='#'+id;a.textContent=String(i+1);a.setAttribute('aria-label',term+', occurrence '+(i+1));li.append(a,' ');});ul.append(li);}sect.append(ul);}
    const fonts=document.createElement('section');fonts.className='back-page provenance';const fh=document.createElement('h1');fh.textContent='Font redistribution notices';const ft=document.createElement('pre');ft.textContent=fontNotices;fonts.append(fh,ft);document.querySelector('#content').append(fonts);
    for(const html of back){const el=document.createElement('section');el.className='back-page';el.innerHTML=html;document.querySelector('#content').append(el);}
  },{front,back,index,notice,licence,fontNotices});
  await page.addStyleTag({content:fs.readFileSync('scripts/books/mastering-bitcoin.css','utf8')});
  await page.evaluate(()=>{
    // Source inline macros already contain TeX delimiters; remove only the
    // redundant wrapper added by the HTML converter, never mathematical tokens.
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(!node.parentElement.closest('pre,code,script,style'))node.textContent=node.textContent.replace(/\\\(\s*\\\(/g,'\\(').replace(/\\\)\s*\\\)/g,'\\)');
    }
    window.MathJax={tex:{inlineMath:[['\\(','\\)']],displayMath:[['\\[','\\]']]},svg:{fontCache:'local'},options:{enableAssistiveMml:false},startup:{typeset:true}};
  });
  await page.addScriptTag({path:path.join(work,'tex-svg.js')});
  await page.evaluate(async()=>{
    await window.MathJax.startup.promise;
    for(const item of window.MathJax.startup.document.math){item.typesetRoot.setAttribute('role','img');item.typesetRoot.setAttribute('aria-label',item.math);}
  });
  await page.evaluate(()=>document.fonts.ready);
  const audit=await page.evaluate(()=>({
    headings:[...document.querySelectorAll('.sect1 > h2')].map(el=>({id:el.id,text:el.textContent})),
    images:[...document.images].map(img=>({src:img.src.slice(0,40),width:img.naturalWidth,height:img.naturalHeight,alt:img.alt})),
    tables:document.querySelectorAll('table').length,
    codeBlocks:document.querySelectorAll('pre').length,
    math:[...document.querySelectorAll('math')].filter(el=>!el.closest('mjx-assistive-mml')).length,
    vectorEquations:document.querySelectorAll('mjx-container svg').length,
    equations:[...window.MathJax.startup.document.math].map(item=>({tex:item.math,error:Boolean(item.typesetRoot.querySelector('[data-mml-node="merror"]'))})),
    code:[...document.querySelectorAll('.listingblock pre')].map(el=>el.textContent),
    paragraphs:[...document.querySelectorAll('.paragraph > p')].map(el=>{const c=el.cloneNode(true);c.querySelectorAll('mjx-container').forEach(n=>n.remove());return c.textContent;}),
    cells:[...document.querySelectorAll('th,td')].filter(el=>!el.querySelector('table')).map(el=>el.textContent),
    missingLinks:[...document.querySelectorAll('a[href^="#"]')].filter(a=>a.hash&&!document.getElementById(decodeURIComponent(a.hash.slice(1)))) .map(a=>a.hash),
    text:document.body.innerText,
  }));
  fs.writeFileSync(path.join(work,'html-audit.json'),JSON.stringify(audit,null,2));
  if(audit.images.some(img=>!img.width||!img.height))throw Error('Missing image');
  if(audit.equations.some(eq=>eq.error))throw Error('Equation rendering failed');
  if(audit.missingLinks.length)console.warn('Unresolved source references:',[...new Set(audit.missingLinks)]);
  await page.emulateMedia({media:'print'});
  await page.pdf({path:path.join(work,'mastering-bitcoin-en-3rd-edition.pdf'),width:'7in',height:'9.1875in',preferCSSPageSize:true,printBackground:true,outline:true,tagged:true,displayHeaderFooter:false,margin:{top:'.55in',bottom:'.65in',left:'.55in',right:'.55in'},timeout:180000});
  fs.writeFileSync(path.join(work,'generator.json'),JSON.stringify({revision,image,chromium:browser.version(),mathjax:'3.2.2',indexEntries:index.length},null,2));
  console.log(JSON.stringify({headings:audit.headings.length,images:audit.images.length,tables:audit.tables,codeBlocks:audit.codeBlocks,math:audit.math,indexEntries:index.length}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
