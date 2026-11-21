import test from "node:test";
import assert from "node:assert/strict";
import { createCardController } from "../src/card-controller.js";
test("card refresh and close cannot race and restore a closed card", async () => {
  let release,
    state,
    calls = 0;
  const pending = [];
  const controller = createCardController({
    request: async (path) => {
      calls++;
      if (path === "card") return new Promise((resolve) => (release = resolve));
      return {};
    },
    onChange: (value) => (state = value),
    onMessage: () => {},
    onPending: (value) => pending.push(value),
  });
  const refreshing = controller.refresh();
  assert.equal(controller.pending, true);
  assert.deepEqual(await controller.close(), { skipped: true });
  assert.equal(calls, 1);
  release({ total: 7 });
  await refreshing;
  assert.equal(state.total, 7);
  await controller.close();
  assert.equal(state, null);
  assert.deepEqual(pending, [true, false, true, false]);
});
test("an expired session clears the card and always unlocks controls", async () => {
  let state = { total: 8 },
    locked;
  const controller = createCardController({
    request: async () => {
      throw Object.assign(new Error("expired"), { status: 401 });
    },
    onChange: (x) => (state = x),
    onMessage: () => {},
    onPending: (x) => (locked = x),
  });
  await controller.refresh(true);
  assert.equal(state, null);
  assert.equal(locked, false);
  assert.equal(controller.pending, false);
});
test("open sends explicit consent once and failed requests can be retried", async () => {
  let count = 0,
    state;
  const controller = createCardController({
    request: async (path, body) => {
      count++;
      assert.equal(path, "card");
      assert.deepEqual(body, { phone: "0990000002", consent: true });
      if (count === 1) throw new Error("offline");
      return { total: 0 };
    },
    onChange: (x) => (state = x),
    onMessage: () => {},
    onPending: () => {},
  });
  assert.equal((await controller.open("0990000002", true)).success, false);
  assert.equal((await controller.open("0990000002", true)).success, true);
  assert.equal(state.total, 0);
});
