# Model card: realwaste-mobilenetv2-v1

## Intended use

Experimental Thai educational waste-sorting demo. One dominant item in the center of a photo. Five material classes in this exact order: plastic, metal, paper, cardboard, food_organics. Not a detector, object counter, hazardous-material classifier, or automated disposal authority.

## Architecture and provenance

Torchvision MobileNetV2 with IMAGENET1K_V2 pretrained weights. Frozen 1,280-dimensional pooled features; balanced multinomial logistic regression head selected from C={0.01,0.1,1,10} by validation macro F1. C=0.1 selected. The head and softmax are exported with the feature extractor into one float32 ONNX opset-17 model. This is feature transfer, not end-to-end fine tuning.

Input: RGB, EXIF orientation applied by image decoder, center-square crop, bilinear resize 224×224, /255 then ImageNet mean [0.485,0.456,0.406] and std [0.229,0.224,0.225], NCHW [1,3,224,224]. Browser canvas and Pillow interpolation can have small numerical differences. Browser tests must check the final export in addition to Python parity.

Dataset: RealWaste, 2023, Single/Iranmanesh/Raad, CC BY 4.0, https://doi.org/10.24432/C5SS4G. Official archive SHA256: `1ede08b32358ee62065bcc1c8cb47a2ece04e8dff5b1fb53342bb8750895b2f3`. Selected five classes: 3,083 images. Other classes provide validation/test negatives only; they are not a learned sixth output.

## Evidence and limitations

Seed 42, per-folder stratified 70/15/15 image split. Train 2,156, validation 462 known + 250 negatives, test 465 known + 252 negatives. Exact-file duplicate checks pass. Physical-item identifiers are unavailable in this baseline; visually related images may cross splits. Results are exploratory, not the physical-item holdout promised by the final project plan.

Test accuracy before rejection: 0.8666667; macro F1: 0.8659874. Full per-class precision, recall, F1, confusion matrix and individual predictions are in `ml/results/`.

Threshold 0.95 selected on validation data to balance known acceptance and unknown rejection across candidate thresholds 0.50–0.95. Known test coverage 0.4258065; unknown test rejection 0.7896825. This trade-off is conservative: most known test images are rejected. Softmax is uncalibrated and thresholding cannot reliably detect arbitrary out-of-domain objects. The headline classification metrics exclude rejection; local web metrics count rejected known images as wrong. Do not compare the two definitions without disclosing this difference.

Export parity on one preprocessed image: max absolute PyTorch/ONNX probability difference 0.0000011325. All test examples are evaluated through the deployed ONNX file. Python CPU timing is not browser/mobile timing. Ground-truth labels are dataset labels, not proof of recyclability.

No local Thai adaptation, unseen-object field test, user-benefit study, physical-camera test or real iOS Safari timing has been collected. Model B remains future work until local samples and a frozen physical-item holdout exist.

## Replacement checklist

Keep old results on a Git branch/tag. Supply a reviewed physical-group manifest, freeze test IDs, train using train and validation only, update version, run ONNX contract/parity checks, test browser preprocessing, commit model + metadata + results together, then publish the matching source build. Do not silently lower the threshold to make a demonstration look more confident.
