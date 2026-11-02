import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { inspectLegacyUsers } from "./migration.js";

test("membership migration blocks duplicate global emails and preserves legacy organization roles", () => {
  const org = new mongoose.Types.ObjectId(); const first = new mongoose.Types.ObjectId(); const second = new mongoose.Types.ObjectId();
  const result = inspectLegacyUsers([
    { _id: first, email: "same@example.test", organizationId: org, role: "admin" },
    { _id: second, email: " SAME@example.test ", organizationId: new mongoose.Types.ObjectId(), role: "dispatcher" },
    { _id: new mongoose.Types.ObjectId(), email: "new@example.test" },
  ]);
  assert.equal(result.legacyUsers.length, 2);
  assert.equal(result.invalidLegacyUsers.length, 0);
  assert.equal(result.duplicateEmailGroups, 1);
});

test("membership migration detects incomplete or invalid legacy roles before applying", () => {
  const result = inspectLegacyUsers([{ _id: new mongoose.Types.ObjectId(), email: "member@example.test", organizationId: new mongoose.Types.ObjectId(), role: "owner" }]);
  assert.equal(result.invalidLegacyUsers.length, 1);
});
