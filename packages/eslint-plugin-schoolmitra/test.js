const assert = require("assert");
const plugin = require("./index");

console.log("Testing eslint-plugin-schoolmitra...");
assert(plugin.rules["require-server-auth"], "require-server-auth rule should exist");

console.log("✅ eslint-plugin-schoolmitra sanity checks passed.");
