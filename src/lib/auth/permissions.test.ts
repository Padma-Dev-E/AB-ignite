import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, capabilitiesForProfile, profileHasCapability } from "./permissions";

test("six profiles grant only their intended server capabilities", () => {
  assert.deepEqual(capabilitiesForProfile("employee"), [CAPABILITIES.IDEAS_READ, CAPABILITIES.IDEAS_WRITE, CAPABILITIES.PROFILE_READ]);
  assert.equal(profileHasCapability("reviewer", CAPABILITIES.GOVERNANCE_MANAGE), true);
  assert.equal(profileHasCapability("business_owner", CAPABILITIES.GOVERNANCE_MANAGE), true);
  assert.equal(profileHasCapability("control", CAPABILITIES.GOVERNANCE_MANAGE), true);
  assert.equal(profileHasCapability("management", CAPABILITIES.GOVERNANCE_MANAGE), false);
  for (const profile of ["employee", "reviewer", "business_owner", "control", "management"] as const) {
    assert.equal(profileHasCapability(profile, CAPABILITIES.USERS_MANAGE), false);
    assert.equal(profileHasCapability(profile, CAPABILITIES.SETTINGS_MANAGE), false);
  }
  assert.equal(profileHasCapability("admin", CAPABILITIES.USERS_MANAGE), true);
});
