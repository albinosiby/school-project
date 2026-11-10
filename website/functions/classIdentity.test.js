const { test } = require("node:test");
const assert = require("node:assert/strict");
const { clsLabel, labelToClassId, audienceClassTest } = require("./classIdentity");
test("class labels round-trip without merging senior streams", () => {
  for (const id of ["cls_10B", "cls_LKGA", "cls_11_science_A", "cls_11_commerce_A", "cls_12_humanities_H", "cls_11_course_home_science_A"]) assert.equal(labelToClassId(clsLabel(id)), id);
  assert.equal(labelToClassId("11-Sci-A"), "cls_11_science_A");
});
test("parent grade audiences include streams while stream-specific audiences stay isolated", () => {
  assert.ok(audienceClassTest("Grade 11").test("cls_11_science_A"));
  assert.ok(audienceClassTest("Grade 11").test("cls_11_commerce_A"));
  assert.ok(audienceClassTest("Grade 11").test("cls_11_course_home_science_A"));
  assert.ok(audienceClassTest("Grade 11-Home Science-A").test("cls_11_course_home_science_A"));
  assert.ok(!audienceClassTest("Grade 11-Home Science-A").test("cls_12_course_home_science_A"));
  assert.ok(!audienceClassTest("Grade 11-Home Science-A").test("cls_11_science_A"));
  assert.ok(!audienceClassTest("Grade 11").test("cls_12_science_A"));
  assert.ok(audienceClassTest("Grade 11-Science-A").test("cls_11_science_A"));
  assert.ok(!audienceClassTest("Grade 11-Science-A").test("cls_11_commerce_A"));
  assert.ok(audienceClassTest("Grade 8-A").test("cls_8A"));
  assert.ok(!audienceClassTest("Grade 8-A").test("cls_8B"));
});
