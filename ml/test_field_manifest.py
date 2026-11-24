import csv
import tempfile
import unittest
from pathlib import Path
from validate_field_manifest import validate

class ManifestTests(unittest.TestCase):
    def run_case(self, change=None):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); rows=[]
            for i,s in enumerate(['train','validation','test']):
                (root/f'{i}.jpg').write_bytes(f'image-{i}'.encode())
                rows.append({'path':f'{i}.jpg','label':'plastic','split':s,'physical_item_id':f'item-{i}','session_id':f'session-{i}','consent':'yes','license':'team-owned'})
            if change: change(rows,root)
            path=root/'manifest.csv'
            with path.open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
            return validate(path)
    def test_valid_groups(self): self.assertEqual(self.run_case()['images'],3)
    def test_item_leak(self):
        with self.assertRaises(ValueError): self.run_case(lambda r,p:r[1].update(physical_item_id='item-0'))
    def test_session_leak(self):
        with self.assertRaises(ValueError): self.run_case(lambda r,p:r[1].update(session_id='session-0'))
    def test_duplicate_content(self):
        with self.assertRaises(ValueError): self.run_case(lambda r,p:(p/'1.jpg').write_bytes((p/'0.jpg').read_bytes()))
    def test_no_consent(self):
        with self.assertRaises(ValueError): self.run_case(lambda r,p:r[0].update(consent='no'))
    def test_path_escape(self):
        with self.assertRaises(ValueError): self.run_case(lambda r,p:r[0].update(path='../outside.jpg'))
if __name__=='__main__': unittest.main()
