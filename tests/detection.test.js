import test from "node:test";
import assert from "node:assert/strict";
import {
  disposal,
  suppress,
  calibratedScore,
  roundConfidence,
} from "../src/detection-domain.js";
test("battery, electronics, pressure and sharp objects never receive ordinary recycling rewards", () => {
  for (const label of [
    "battery",
    "electronics",
    "bulb",
    "pressurised",
    "broken_glass",
  ])
    for (const state of ["", "clean", "dirty", "hazardous", "damaged"])
      assert.equal(disposal(label, state).eligible, false);
  assert.match(disposal("battery", "damaged").action, /ไม่ชาร์จ/);
  assert.equal(disposal("plastic", "infectious").group, "infectious");
  assert.equal(disposal("plastic", "hazardous", "four").color, "red");
  assert.equal(disposal("plastic", "hazardous", "five").color, "orange");
  assert.equal(disposal("unknown", "clean").eligible, false);
});
test("overlapping duplicate boxes are counted once and distinct objects remain", () => {
  const x = [
    { box: [0, 0, 0.4, 0.4], rawConfidence: 0.9 },
    { box: [0.01, 0.01, 0.39, 0.39], rawConfidence: 0.8 },
    { box: [0.6, 0.6, 0.9, 0.9], rawConfidence: 0.7 },
  ];
  assert.equal(suppress(x).length, 2);
  assert.equal(
    suppress([...x, { box: [0, 0, 0, 1], rawConfidence: 1 }]).length,
    2,
  );
});
test("calibration and round score do not invent a confidence for zero detections", () => {
  assert.equal(roundConfidence([]), null);
  assert.equal(
    roundConfidence([{ confidence: 0.4 }, { confidence: 0.8 }]),
    0.6000000000000001,
  );
  assert.equal(calibratedScore(0.5, { x: [0.2, 0.8], y: [0.3, 0.9] }), 0.6);
});
