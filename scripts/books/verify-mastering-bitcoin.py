"""Independent publishing QA. Requires PyMuPDF 1.26.7 and pypdf 6.2.0.

Run after generate-mastering-bitcoin.mjs; outputs audit and visual contact sheets.
This checks rendered content, not byte equivalence with AsciiDoc source.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path('.superpowers/pdf-tools').resolve()))
import fitz
from pypdf import PdfReader

work = Path('.superpowers/pdf-generation')
pdf = work / 'mastering-bitcoin-en-3rd-edition.pdf'
doc = fitz.open(pdf)
metadata = doc.metadata
expected_metadata = dict(author='Andreas M. Antonopoulos; David A. Harding',
                         subject='Third edition; generated from official open-source revision 275c4eb8eab8800c6adc39f8def8e8f8fa356a57; CC BY-SA 4.0',
                         keywords='Bitcoin, third edition, CC BY-SA 4.0, generated open-source edition')
if any(metadata.get(key) != value for key,value in expected_metadata.items()):
    metadata.update(expected_metadata)
    doc.set_metadata(metadata)
    doc.saveIncr()  # Repeated verification preserves the checksum; no image resampling.
doc.close()
doc = fitz.open(pdf)
print('Metadata recorded; checking pages',flush=True)
reader = PdfReader(pdf)
html = json.loads((work / 'html-audit.json').read_text(encoding='utf8'))
norm = lambda text: re.sub(r'\s+', '', text)
texts = []
blank, clipped, invalid_links, unsafe_actions = [], [], [], []
fonts, image_count, links = set(), 0, 0
for page in doc:
    if page.number % 100 == 0:
        print('Checking page',page.number+1,flush=True)
    # CSS page counter occupies the bottom margin, not the book's text stream.
    blocks = page.get_text('dict')['blocks']
    lines = []
    for block in blocks:
        if 'lines' not in block:
            continue
        for line in block['lines']:
            if line['bbox'][1] > page.rect.height - 38:
                continue
            lines.append(''.join(s['text'] for s in line['spans']))
            x0,y0,x1,y1 = line['bbox']
            if x0 < 0 or y0 < 0 or x1 > page.rect.width+1 or y1 > page.rect.height+1:
                clipped.append([page.number+1,line['bbox'],lines[-1][:80]])
    text = '\n'.join(lines)
    texts.append(text)
    images = page.get_image_info()
    image_count += len(images)
    if not text.strip() and not images and not page.get_drawings():
        blank.append(page.number+1)
    fonts.update(f[3] for f in page.get_fonts())
    for link in page.get_links():
        links += 1
        if link['kind'] in (fitz.LINK_GOTO,fitz.LINK_NAMED) and not 0 <= link.get('page',-1) < len(doc):
            invalid_links.append([page.number+1,link])
        if link['kind'] == fitz.LINK_LAUNCH or str(link.get('uri','')).lower().startswith(('javascript:','file:','data:')):
            unsafe_actions.append([page.number+1,link])
rendered = norm('\n'.join(texts))
expected = norm(html['text'])
# Dense overlapping windows detect missing prose. Reordering across table cells or
# wrapping around a float is investigated separately rather than ignored.
samples = [expected[i:i+48] for i in range(0,len(expected)-48,120)]
missing = [s for s in samples if s not in rendered]
headings = [{**h,'present': norm(h['text']) in rendered} for h in html['headings']]
audit = dict(bytes=pdf.stat().st_size,sha256=hashlib.sha256(pdf.read_bytes()).hexdigest(),pages=len(doc),
             bookmarks=len(doc.get_toc()),links=links,imageOccurrences=image_count,fonts=sorted(fonts),
             blankPages=blank,clippedText=clipped,invalidLinks=invalid_links,headings=headings,
             htmlImages=len(html['images']),tables=html['tables'],codeBlocks=html['codeBlocks'],
             mathML=html['math'],coverageWindows=len(samples),missingWindows=missing,
             tagged='/StructTreeRoot' in reader.trailer['/Root'],encrypted=reader.is_encrypted,
             javascript='/JavaScript' in str(reader.trailer['/Root'].get('/Names',{})))
audit['paragraphs'] = len(html.get('paragraphs',[]))
audit['missingParagraphs'] = [p for p in html.get('paragraphs',[]) if norm(p) not in rendered]
audit['listingBlocks'] = len(html.get('code',[]))
audit['missingListings'] = [c for c in html.get('code',[]) if norm(c) not in rendered]
audit['vectorEquations'] = html.get('vectorEquations',0)
audit['tableCells'] = len(html.get('cells',[]))
audit['missingTableCells'] = [c for c in html.get('cells',[]) if norm(c) and norm(c) not in rendered]
audit['equations'] = html.get('equations',[])
destinations = reader.named_destinations
audit['namedDestinations'] = len(destinations)
audit['unsafeActions'] = unsafe_actions
outline = {norm(title): page for _,title,page in doc.get_toc()}
audit['chapterPages'] = [outline[norm(h['text'])] for h in html['headings']]
(work / 'pdf-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
(work / 'pdf-text.txt').write_text('\n\n'.join(texts),encoding='utf8')
assert len(reader.pages)==len(doc) and not reader.is_encrypted
assert not blank and not clipped and not invalid_links
assert not unsafe_actions
assert all(0 <= reader.get_destination_page_number(dest) < len(doc) for dest in destinations.values())
assert all(1 <= page <= len(doc) for _,_,page in doc.get_toc())
assert all(h['present'] for h in headings)
assert image_count == len(html['images'])
assert not audit['missingParagraphs'] and not audit['missingListings']
assert not audit['missingTableCells']
assert audit['chapterPages'] == sorted(set(audit['chapterPages']))
assert '/OpenAction' not in reader.trailer['/Root'] and not audit['javascript']
# Every page is rasterized, to be reviewed in contact sheets, with page numbers.
for start in range(0,len(doc),48):
    print('Rendering sheet',start+1,flush=True)
    sheet = fitz.open()
    canvas = sheet.new_page(width=1200,height=1660)
    for index in range(start,min(start+48,len(doc))):
        p=doc[index]
        pix=p.get_pixmap(matrix=fitz.Matrix(.4,.4),alpha=False)
        cell=index-start
        x=(cell%6)*200; y=(cell//6)*207
        canvas.insert_image(fitz.Rect(x,y,x+193,y+190),pixmap=pix,keep_proportion=True)
        canvas.insert_text((x+5,y+202),str(index+1),fontsize=9)
    canvas.get_pixmap().save(work / f'contact-{start+1:03}.png')
    sheet.close()
for index in [0,1,2,3,14,65,93,94,95,96,100,103,145,180,235,310,355,385,407,412]:
    if index<len(doc):
        doc[index].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(work / f'page-{index+1:03}.png')
print(json.dumps({k:audit[k] for k in ['bytes','sha256','pages','bookmarks','links','imageOccurrences','tagged','coverageWindows']}))
print('Windows needing manual review:',len(missing))
