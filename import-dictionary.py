"""Build the two-syllable game lexicon from an official Urimalsaem JSON ZIP."""
import hashlib, json, pathlib, re, sys, unicodedata, zipfile
source = pathlib.Path(sys.argv[1])
output = pathlib.Path(__file__).resolve().parent / 'dictionary-data.json'
words, entries, files = set(), 0, 0
with zipfile.ZipFile(source) as archive:
    for name in archive.namelist():
        if not name.endswith('.json'):
            continue
        data = json.loads(archive.read(name))
        items = data['channel']['item']
        if len(items) != int(data['channel']['total']):
            raise ValueError('Incomplete source: ' + name)
        files += 1
        entries += len(items)
        for item in items:
            word = unicodedata.normalize('NFC', item['wordinfo']['word'])
            word = re.sub(r'[-^]', '', word)
            if re.fullmatch('[가-힣]{2}', word):
                words.add(word)
metadata = dict(source='국립국어원 우리말샘', sourceUrl='https://opendict.korean.go.kr/',
    snapshot='2026-10-04', archiveSha256=hashlib.file_digest(source.open('rb'), 'sha256').hexdigest(),
    sourceFiles=files, sourceEntries=entries, wordCount=len(words), words=sorted(words))
output.write_text(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + '\n')
print(json.dumps({k:v for k,v in metadata.items() if k!='words'},ensure_ascii=False))
