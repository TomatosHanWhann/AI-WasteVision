# Model card: realwaste-thai-mobilenetv2-v2

## Intended use

Experimental Thai educational material-sorting system. One dominant object per image. Six materials in order: plastic, metal, paper, cardboard, food_organics, glass. Seventh output is an explicitly trained unknown class. Not a brand recognizer, object counter, hazard detector, or confirmation of actual recycling.

## Architecture and preprocessing

Frozen ImageNet1K_V2 MobileNetV2 pooled features (1,280 dimensions), balanced logistic classifier and softmax exported together to float32 ONNX opset 17. Input NCHW [1,3,224,224], full-image aspect-preserving white letterbox, bilinear resizing, /255 and ImageNet mean/std. Browser canvas interpolation may differ slightly from Pillow. This is feature transfer, not full-network fine tuning.

Hyperparameters C={0.01,0.1,1,10} and Thai training sample weights={1,4,12} selected exclusively by validation score (0.8 RealWaste macro F1 + 0.2 Thai catalogue accuracy). Selected C=0.1, product weight=12.0. Threshold 0.5 selected on validation for known acceptance and unknown rejection.

## Data and splitting

4835 training/validation/test images including 60 augmented training views. RealWaste (Single, Iranmanesh, Raad 2023), CC BY 4.0, DOI https://doi.org/10.24432/C5SS4G. Miscellaneous Trash, Textile Trash and Vegetation provide the learned unknown class. RealWaste uses stratified image-level 70/15/15 split; physical object IDs are unavailable, so related views may cross partitions.

23 manually reviewed Thai-market product photographs across 9 brands, sourced from Open Food Facts contributors (photos CC BY-SA 3.0). Catalogue records source URL, checksum, material review and SKU split. Augmented views are training only. Product packaging labels describe reviewed materials, not recycling eligibility. Multilayer Tipco cartons and Mama pouches are outside supported materials. Marketing/product photographs differ from used waste in real settings.

## Measured results

| Measure | Value |
| --- | --- |
| Known test images | 532 |
| Unknown test images | 190 |
| Known accuracy before rejection | 82.1429% |
| Known macro F1 before rejection | 0.8423 |
| Known coverage after threshold | 87.2180% |
| Unknown rejection | 88.4211% |
| Thai product known holdout | 1 correct / 4 images (25%) |
| PyTorch/ONNX max difference | 0.0000011325 |

All held-out images were evaluated with the exported ONNX. Per-image predictions and seven-output confusion matrix are in ml/results. The six-class macro F1 treats unknown predictions on known items as errors. Coverage is acceptance fraction, not accepted-output accuracy. Softmax scores are uncalibrated and arbitrary out-of-domain detection remains unreliable.

**Thai product evidence is inadequate:** only four in-scope SKU-heldout images and 25% accuracy. Do not claim robust Thai-brand recognition or use overall accuracy as evidence for Thai packaging. Several gallery images belong to training and are examples, not independent tests. No physical-item field holdout or user-benefit study has been completed. Python timing is not mobile/browser timing.

## Versioning and next validation

Preserve the baseline in Git. Add used Thai packaging photographed in real environments, verify material manually, group all views by physical item, freeze a sufficiently sized holdout, then retrain without tuning on it. Commit model, metadata and results together and verify browser preprocessing. Do not override predictions with catalogue labels or lower thresholds just to make examples look correct.


The multi-object SSDLite detector is a separate model; see DETECTION_MODEL_CARD.md. Do not compare its localization metrics directly with this legacy whole-image classifier accuracy.
