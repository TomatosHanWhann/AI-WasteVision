"""Download the official RealWaste archive and extract safely. No user images uploaded."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
URL = 'https://archive.ics.uci.edu/static/public/908/realwaste.zip'

def main():
    data = ROOT / 'data'
    data.mkdir(exist_ok=True)
    archive = data / 'realwaste.zip'
    if not archive.exists():
        print('Downloading official RealWaste archive...', flush=True)
        temp = archive.with_suffix('.part')
        urllib.request.urlretrieve(URL, temp)
        temp.replace(archive)
    digest = hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            target = (data / entry.filename).resolve()
            if not target.is_relative_to(data.resolve()):
                raise ValueError('Unsafe archive path')
        z.extractall(data)
    (data / 'source.json').write_text(json.dumps({'url': URL, 'sha256': digest, 'license': 'CC BY 4.0', 'doi': '10.24432/C5SS4G'}, indent=2))
    print(f'Extracted to {data}; SHA256 {digest}', flush=True)

if __name__ == '__main__':
    main()
