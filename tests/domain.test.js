import test from "node:test";
import assert from "node:assert/strict";
import {
  decision,
  guidance,
  metrics,
  toCSV,
  readRecords,
} from "../src/domain.js";

test("uncertain material never becomes a confident sorting result", () => {
  assert.equal(
    decision([0.4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1], 0.95).label,
    "unknown",
  );
  assert.equal(
    decision([0.94, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01], 0.9).label,
    "plastic",
  );
  assert.equal(
    decision([0.01, 0.01, 0.01, 0.01, 0.01, 0.94, 0.01], 0.9).label,
    "glass",
  );
  assert.throws(() => decision([NaN, 0.1, 0.1, 0.1, 0.1], 0.7));
  assert.throws(() => decision([0.9, 0.9, 0.9, 0.9, 0.9], 0.7));
});
test("hazardous user condition overrides even an unknown model result", () => {
  assert.match(guidance("plastic", "hazardous"), /อันตราย/);
  assert.match(guidance("unknown", "hazardous"), /อันตราย/);
  assert.match(guidance("paper", "dirty"), /เปื้อน/);
  assert.match(guidance("metal", ""), /เลือกสภาพ/);
});
test("rejected known objects count as errors and macro F1 includes all six classes", () => {
  const m = metrics([
    { truth: "plastic", prediction: "plastic" },
    { truth: "plastic", prediction: "unknown" },
    { truth: "unknown", prediction: "plastic" },
  ]);
  assert.equal(m.accuracy, 1 / 3);
  assert.equal(m.matrix[0][6], 1);
  assert.equal(m.matrix[6][0], 1);
  assert.equal(m.macroF1, 0.5 / 6);
  assert.equal(m.coverage, 2 / 3);
});
test("export safely quotes spreadsheet formulas, commas, and newlines", () => {
  const csv = toCSV([
    { id: '=HYPERLINK("bad")', truth: "paper", condition: "a,b\nnext" },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"a,b\nnext"'));
});
test("bad or old local records cannot break metrics rendering", () => {
  assert.deepEqual(readRecords({ getItem: () => "{bad" }), []);
  assert.deepEqual(readRecords({ getItem: () => '{"wrong":true}' }), []);
  assert.deepEqual(
    readRecords({
      getItem: () =>
        '[{"truth":"<script>","prediction":"plastic","confidence":0.9}]',
    }),
    [],
  );
  assert.equal(metrics([]).n, 0);
});
