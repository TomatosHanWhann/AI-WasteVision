# Model card: wastevision-ssdlite-v3

## Scope

Experimental on-device, multi-object material and waste-group detection. Fifteen outputs include an unknown/litter group. Maximum ten displayed objects; not proof that no additional objects exist. Not a brand recognizer, chemical identifier, infection diagnosis, battery safety assessment or confirmation of disposal.

## Data and training

3,652 usable images, 6,941 annotated objects and 2,654 source-image groups. Sources: TACO by Pedro F. Proenca and Pedro Simoes, DOI https://doi.org/10.5281/zenodo.3587843 (CC BY 4.0 release); Custom Bangladeshi E-Waste Image Dataset by Tanzila Afrin and Azizul Abedin Azmi, DOI https://doi.org/10.17632/77383kmdnw.1 (CC BY 4.0). TACO thumbnails retain original coordinate scaling; e-waste polygons become enclosing bounding boxes. Some e-waste training images are supplied augmentations, so 3,652 is not 3,652 independent physical objects.

Training/validation/test: 2541/563/548. TACO split uses deterministic source-image ID hashing. E-waste supplied partitions are checked for shared original filenames and SHA256 overlap; lower-priority overlapping rows are removed. Neither source supplies verified physical-item identifiers. Similar photos of the same physical object may remain across groups. This is not a Thai physical-item holdout or Thai-brand benchmark. The earlier 23 Thai product photographs are still gallery examples and legacy-classifier data; they are not used as fabricated box annotations here.

Torchvision COCO-pretrained SSDLite320 MobileNetV3 Large, frozen backbone, trained classification and regression heads for 40 epochs. Best epoch 30 selected by validation mAP50. No test-based checkpoint/threshold selection. Input RGB bilinear stretch to 320×320, /127.5−1, NCHW. Browser canvas and Pillow resampling differ slightly. Raw boxes and class probabilities are exported to ONNX opset17; class-agnostic NMS IoU .45, top150 candidates, ten output objects. Final metrics use the exact exported ONNX and this ten-object contract. Epoch-selection history used a 30-candidate output limit, recorded in metadata.

## Measured test results

| Measure | Value |
| --- | --- |
| Test images / true objects | 548 / 960 |
| Precision, class match and IoU ≥ .50 | 60.4348% |
| Recall | 28.9583% |
| mAP50 | 30.8873% |
| mAP50–95 | 21.1620% |
| Exact count per image | 57.1168% |
| Count mean absolute error | 1.0584 items |
| Calibration ECE / Brier | 0.03982 / 0.14266 |

The model misses many objects. Battery recall is 50% on only 24 held-out battery objects. Pressurised containers and broken glass have zero measured recall on two test objects each; automatic detection of these categories is not ready for reliance. A 100% bulb result uses only six test objects and must not be presented as a general guarantee. Per-class metrics and all test predictions are in ml/results/detection-evaluation.json and detection-predictions.csv.

## Confidence and safe presentation

A monotone isotonic calibration maps raw detection scores to observed validation correctness (same class and IoU ≥ .50). A score of 89/100 is an estimate based on that validation distribution, not proof this object is correct. The frame summary is the arithmetic mean of detected-object confidence only; missing objects are excluded. Zero detections produce no invented confidence. Ordinary disposal recommendations and rewards are withheld below 50/100; special-category precautions remain visible. No hazardous/special-category rewards are granted even for high scores. Exact raw-threshold metrics above include uncertain predictions and are disclosed separately from this conservative UI rule.

## Feedback and iteration

No images or evaluation telemetry leave the browser by default. Voluntary metadata consent is separate from image consent. User-reported labels and counts are provisional; only privately reviewed images with corrected boxes enter exported training data. No automatic self-training, model replacement or score inflation. See CONTINUOUS_IMPROVEMENT.md for owner-only export and candidate retraining. Every candidate needs a new model_version and independent evaluation before deployment.
