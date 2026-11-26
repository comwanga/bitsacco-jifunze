// Publishing tooling only: Kiswahili translation AsciiDoc -> complete HTML -> Chromium PDF.
// Same pipeline as generate-mastering-bitcoin.mjs. See docs/deployment/kujifunza-bitcoin-generated.md.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// The translation, pinned. Its chapters translate the upstream tag third_edition_print1; the upstream
// revision below is that tag plus the two commits that changed only LICENSE and README (the CC BY-SA grant).
const revision = process.env.KUJIFUNZA_REVISION || '5da7e1705b29c153ef2d7ed040df8a8b6a6eed53';
const upstreamRevision = '275c4eb8eab8800c6adc39f8def8e8f8fa356a57';
const image = 'asciidoctor/docker-asciidoctor@sha256:b0c0ebff6e2d6f5cd66a075310ca7f076921d8acb293d8f4ae8fcae0d7fea30c';
const source = path.resolve('.superpowers/bitcoinbook-swahili');
const upstream = path.resolve('.superpowers/mastering-bitcoin-upstream');
const work = path.resolve('.superpowers/pdf-generation-sw');
const output = 'kujifunza-bitcoin-sw-3rd-edition.pdf';
const mathjax = path.resolve('.superpowers/pdf-generation/tex-svg.js');
// comwanga's cover, CC BY-SA 4.0, with the publisher logo removed; pinned so a replaced image fails the build.
const coverFile = path.resolve('scripts/books/kujifunza-bitcoin-cover.png');
const coverData = fs.readFileSync(coverFile);
if(createHash('sha256').update(coverData).digest('hex')!=='59ad299f25910e2653dcde73b9d1dda969e16d4404d27dc1dbe497fdd80cdb62')throw Error('Cover image mismatch');
if(createHash('sha256').update(fs.readFileSync(mathjax)).digest('hex')!=='d4295dc33744836935c1399feece5159577b34c5c8ffb9f1c6324cd82e03a882')throw Error('MathJax 3.2.2 publishing tool integrity mismatch');
const run = (cmd,args) => execFileSync(cmd,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','inherit']}).trim();
if (run('git',['-C',source,'rev-parse','HEAD']) !== revision) throw Error('Wrong translation revision');
if (run('git',['-C',source,'status','--porcelain'])) throw Error('Translation source must be unmodified');
if (run('git',['-C',upstream,'rev-parse','HEAD']) !== upstreamRevision) throw Error('Wrong upstream revision');
if (run('git',['-C',upstream,'status','--porcelain'])) throw Error('Upstream source must be unmodified');
const licence = fs.readFileSync(path.join(source,'LICENSE'),'utf8');
const upstreamLicence = fs.readFileSync(path.join(upstream,'LICENSE'),'utf8');
if (!licence.includes('Creative Commons Attribution-ShareAlike 4.0') || !upstreamLicence.includes('(3rd Edition)') || !upstreamLicence.includes('Creative Commons Attribution-ShareAlike 4.0')) throw Error('Licence mismatch');
const title = fs.readFileSync(path.join(source,'swahili/book.adoc'),'utf8').split('\n')[0];
if (title.trim() !== '= Kujifunza Bitcoin: Kuprogramu Blockchain Huria (Toleo la 3)') throw Error(`Unexpected book title: ${title}`);
fs.mkdirSync(work,{recursive:true});
const mount = (s,t,readonly=true) => ['--mount',`type=bind,source=${s},target=${t}${readonly?',readonly':''}`];
run('docker',['run','--rm','--network','none',...mount(work,'/output',false),image,'sh','-c','mkdir -p /output/fonts && cp /usr/share/fonts/dejavu/*.ttf /output/fonts/']);
// book.adoc sets :imagesdir: ../bitcoinbook-third_edition_print1, so the upstream images sit beside the translation.
const args = ['run','--rm','--network','none','--memory=768m','--cpus=2',...mount(path.join(source,'swahili'),'/book/swahili'),...mount(upstream,'/book/bitcoinbook-third_edition_print1'),...mount(work,'/output',false),...mount(path.resolve('scripts/books/index-anchors.rb'),'/index-anchors.rb'),'-w','/book/swahili',image,'asciidoctor','-r','/index-anchors.rb','-a','stem=latexmath','-b','html5','-d','book','-a','toc','-a','toclevels=2','-a','sectnums','-a','reproducible','-a','data-uri','-a','webfonts!','-a','stylesheet!','-o','/output/book.html','book.adoc'];
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
  // Original edition notices, kept as in the English generated edition (the English title and praise pages are replaced).
  const front = ['copyright.html','dedication.html'].map(f=>fs.readFileSync(path.join(upstream,f),'utf8'));
  const back = ['author_bio.html','colo.html'].map(f=>fs.readFileSync(path.join(upstream,f),'utf8'));
  const fontNotices = fs.readFileSync('scripts/books/font-notices.txt','utf8')+'\n\nMathJax 3.2.2 equation glyphs: Copyright 2009–2022 The MathJax Consortium.\n'+fs.readFileSync('scripts/books/mathjax-LICENSE.txt','utf8');
  const index = JSON.parse(fs.readFileSync(path.join(work,'index.json'),'utf8'));
  const notice = `Toleo hili la PDF limetengenezwa kwa ajili ya Bitsacco Jifunze kutoka maandishi ya chanzo huria ya tafsiri. Si PDF rasmi ya mchapishaji.
Leseni: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
Generated edition for Bitsacco Jifunze from the open-source translation. This is not the publisher's official PDF.
Translation: Kujifunza Bitcoin: Kuprogramu Blockchain Huria (Toleo la 3), Kiswahili translation by comwanga.
Translation source: https://github.com/comwanga/bitcoinbook-swahili
Translation revision: ${revision}
Original work: Mastering Bitcoin: Programming the Open Blockchain, Third Edition, by Andreas M. Antonopoulos and David A. Harding. Original publication: O'Reilly Media, November/December 2023; print ISBN 978-1-098-15009-9.
Original source: https://github.com/bitcoinbook/bitcoinbook
Original revision: ${upstreamRevision} (tag third_edition_print1 plus the licence grant). Illustrations are used unchanged from this revision.
Licence: Creative Commons Attribution-ShareAlike 4.0 International for both the original third edition and this translation.
https://creativecommons.org/licenses/by-sa/4.0/
Grant: https://github.com/bitcoinbook/bitcoinbook/commit/94c9ba64b454eb79ca77904a48251bd4efab73cf
Changes: the text was translated into Kiswahili by comwanga. This PDF adds typesetting, open fonts, generated links/index/bookmarks, the Kiswahili cover and title page, and this notice. Code, illustrations and index terms are kept from the original. Publisher cover, logo and trade dress are not reproduced.
Cover: illustration and design by comwanga, licensed CC BY-SA 4.0. The publisher logo on an earlier version of this cover was removed; no publisher endorsement is implied. The original publisher notices and colophon in English describe the original edition.
Separate notices are retained: Bitcoin Design Guide images (CC BY 4.0), Satoshi Nakamoto's whitepaper (MIT), and the whitepaper errata (CC0). Figure source credits remain with their original captions/alternative text.
Fonts: DejaVu / Bitstream Vera; DejaVu Math TeX Gyre. See font notices included below.`;
  const cover = 'data:image/png;base64,'+coverData.toString('base64');
  await page.evaluate(({front,back,index,notice,licence,upstreamLicence,fontNotices,cover})=>{
    document.documentElement.lang='sw';
    document.title='Kujifunza Bitcoin: Kuprogramu Blockchain Huria (Toleo la 3)';
    const header=document.querySelector('#header');
    const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
    const coverPage=el('section','front-page cover-page');const img=el('img');img.src=cover;img.alt='Jalada: Kujifunza Bitcoin, Kuprogramu Blockchain Huria, Toleo la Tatu';coverPage.append(img);header.before(coverPage);
    const titlePage=el('section','front-page title-page');
    titlePage.append(el('p','edition-label','Toleo lililotengenezwa kutoka maandishi ya chanzo huria'),el('h1',null,'Kujifunza Bitcoin'),el('p','subtitle','Kuprogramu Blockchain Huria'),el('p','subtitle','Toleo la 3'),el('p','byline','Andreas M. Antonopoulos na David A. Harding'),el('p','byline','Tafsiri ya Kiswahili: comwanga'));
    header.before(titlePage);
    const p=el('section','front-page provenance');p.append(el('h1',null,'Chanzo, sifa na ruhusa / Source, attribution and permissions'));
    for(const text of notice.split('\n'))p.append(el('p',null,text));
    for(const [heading,text] of [['Leseni ya tafsiri / Translation licence',licence],['Leseni ya kazi asili / Upstream licence notice',upstreamLicence]]){const ls=el('section','source-licence');ls.append(el('h2',null,heading),el('pre',null,text));p.append(ls);}
    header.before(p);
    for(const html of front){const s=el('section','front-page');s.innerHTML=html;header.before(s);}
    // Asciidoctor nests the TOC inside its generated header; keep it, the header title is hidden by the print CSS.
    const toc=document.querySelector('#toc');
    if(toc)header.before(toc);
    const sect=[...document.querySelectorAll('.sect1')].find(s=>s.querySelector('h2')?.textContent.replace(/^\d+\.\s*/,'').trim()==='Faharasa');
    if(!sect)throw Error('Index section not found');
    const grouped=new Map();for(const entry of index){const key=entry.terms.join(' > ');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(entry.id);}
    const ul=el('ul','index-entries');
    for(const [term,ids] of [...grouped].sort((a,b)=>a[0].localeCompare(b[0],'sw'))){const li=el('li');li.append(term+' ');ids.forEach((id,i)=>{const a=el('a',null,String(i+1));a.href='#'+id;a.setAttribute('aria-label',term+', mara ya '+(i+1));li.append(a,' ');});ul.append(li);}
    sect.append(ul);
    const fonts=el('section','back-page provenance');fonts.append(el('h1',null,'Font redistribution notices'),el('pre',null,fontNotices));document.querySelector('#content').append(fonts);
    for(const html of back){const s=el('section','back-page');s.innerHTML=html;document.querySelector('#content').append(s);}
  },{front,back,index,notice,licence,upstreamLicence,fontNotices,cover});
  await page.addStyleTag({content:fs.readFileSync('scripts/books/mastering-bitcoin.css','utf8')+`
.cover-page { text-align: center; }
.cover-page img { max-width: 100%; max-height: 7.9in; object-fit: contain; }
.title-page h1 { font-size: 30pt; margin: 18pt 0 6pt; }
.title-page .subtitle { font-size: 14pt; font-style: italic; }
.title-page .byline { font-size: 12pt; margin-top: 18pt; }`});
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
  await page.addScriptTag({path:mathjax});
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
    // Markup that should have been rendered but leaked into the text (the defect in the earlier PDF).
    leakedMarkup:[...document.querySelectorAll('.sect1 p,.sect1 td,.sect1 th,.sect1 li')].map(el=>el.textContent).filter(t=>/<\/?(?:td|tr|th|table|tbody|thead|p|li|ul|a|math|mi|mo|mn|mrow)\b[^>]*>/.test(t)).slice(0,40),
    text:document.body.innerText,
  }));
  fs.writeFileSync(path.join(work,'html-audit.json'),JSON.stringify(audit,null,2));
  if(audit.images.some(img=>!img.width||!img.height))throw Error('Missing image');
  if(audit.equations.some(eq=>eq.error))throw Error('Equation rendering failed');
  if(audit.missingLinks.length)console.warn('Unresolved source references:',[...new Set(audit.missingLinks)]);
  if(audit.leakedMarkup.length)console.warn('Markup visible as text:',audit.leakedMarkup.length,audit.leakedMarkup.slice(0,5));
  await page.emulateMedia({media:'print'});
  await page.pdf({path:path.join(work,output),width:'7in',height:'9.1875in',preferCSSPageSize:true,printBackground:true,outline:true,tagged:true,displayHeaderFooter:false,margin:{top:'.55in',bottom:'.65in',left:'.55in',right:'.55in'},timeout:180000});
  fs.writeFileSync(path.join(work,'generator.json'),JSON.stringify({revision,upstreamRevision,image,chromium:browser.version(),mathjax:'3.2.2',indexEntries:index.length},null,2));
  console.log(JSON.stringify({headings:audit.headings.length,images:audit.images.length,tables:audit.tables,codeBlocks:audit.codeBlocks,math:audit.math,indexEntries:index.length,leakedMarkup:audit.leakedMarkup.length}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
