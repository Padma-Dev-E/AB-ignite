import assert from "node:assert/strict";
import test from "node:test";
import { validateArticleLink, validateExternalArticleUrl } from "../src/lib/admin/learning/url-validation";

test("external article URLs accept HTTPS and reject insecure or credentialed destinations", () => {
  assert.doesNotThrow(() => validateExternalArticleUrl("https://learning.example.org/articles/1"));
  assert.doesNotThrow(() => validateExternalArticleUrl(null));
  assert.throws(() => validateExternalArticleUrl("http://learning.example.org/article"), /HTTPS/);
  assert.throws(() => validateExternalArticleUrl("https://user:pass@learning.example.org/article"), /credentials/);
  assert.throws(() => validateExternalArticleUrl("javascript:alert(1)"), /HTTPS/);
  assert.throws(() => validateArticleLink("external", null), /require an HTTPS link/);
  assert.doesNotThrow(() => validateArticleLink("internal", null));
});
