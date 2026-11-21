"""Fast CI contract check; no training/data download needed."""
import hashlib
import json
from pathlib import Path
import onnx

root = Path(__file__).resolve().parents[1]
folder = root/'public'/'model'
metadata = json.loads((folder/'metadata.json').read_text())
path = folder/'wastevision.onnx'
assert metadata['labels'] == ['plastic','metal','paper','cardboard','food_organics']
assert 0 < metadata['threshold'] < 1
assert hashlib.file_digest(path.open('rb'),'sha256').hexdigest() == metadata['model_sha256']
assert metadata == json.loads((root/'ml'/'results'/'evaluation.json').read_text())
model = onnx.load(str(path)); onnx.checker.check_model(model)
assert model.graph.input[0].name == 'image'
assert [d.dim_value for d in model.graph.input[0].type.tensor_type.shape.dim] == [1,3,224,224]
assert model.graph.output[0].name == 'probabilities'
assert [d.dim_value for d in model.graph.output[0].type.tensor_type.shape.dim] == [1,5]
print('Model hash, ONNX structure, labels, input/output and report contract verified.')
