"""Fast CI contract check; no training/data download needed."""
import hashlib
import json
from pathlib import Path
import onnx

root = Path(__file__).resolve().parents[1]
folder = root/'public'/'model'
metadata = json.loads((folder/'metadata.json').read_text())
path = folder/'wastevision.onnx'
assert metadata['labels'] == ['plastic','metal','paper','cardboard','food_organics','glass']
assert 0 < metadata['threshold'] < 1
assert hashlib.file_digest(path.open('rb'),'sha256').hexdigest() == metadata['model_sha256']
assert metadata == json.loads((root/'ml'/'results'/'evaluation.json').read_text())
model = onnx.load(str(path)); onnx.checker.check_model(model)
assert model.graph.input[0].name == 'image'
assert [d.dim_value for d in model.graph.input[0].type.tensor_type.shape.dim] == [1,3,224,224]
assert model.graph.output[0].name == 'probabilities'
assert [d.dim_value for d in model.graph.output[0].type.tensor_type.shape.dim] == [1,7]
print('Model hash, ONNX structure, labels, input/output and report contract verified.')

detector=json.loads((folder/'detector-metadata.json').read_text())
path=folder/'detector.onnx'
assert detector['task']=='object-detection'
assert len(detector['labels'])==15 and len(set(detector['labels']))==15
assert {'battery','electronics','bulb','unknown'}.issubset(detector['labels'])
assert 0<detector['threshold']<1 and detector['max_detections']==10
assert hashlib.file_digest(path.open('rb'),'sha256').hexdigest()==detector['model_sha256']
assert detector==json.loads((root/'ml/results/detection-evaluation.json').read_text())
assert detector['physical_item_holdout_verified'] is False
assert all(x<=y for x,y in zip(detector['calibration']['x'],detector['calibration']['x'][1:]))
assert all(0<=x<=1 for x in detector['calibration']['y'])
assert all(x<=y for x,y in zip(detector['calibration']['y'],detector['calibration']['y'][1:]))
model=onnx.load(str(path));onnx.checker.check_model(model)
assert [d.dim_value for d in model.graph.input[0].type.tensor_type.shape.dim]==[1,3,320,320]
assert [x.name for x in model.graph.output]==['boxes','probabilities']
assert model.graph.output[1].type.tensor_type.shape.dim[-1].dim_value==16
print('Detector hash, labels, shape, calibration and evaluation contract verified.')
