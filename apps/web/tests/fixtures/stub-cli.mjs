#!/usr/bin/env node
// Stub re-shell CLI used by the hub transport test suite.
//
// The hub spawns `[node, <this file>, ...vettedArgs]` with NO shell, so this
// process receives the vetted argv verbatim. It serves two purposes:
//
//  1. Echo the received argv as a single JSON line so tests can assert that a
//     param carrying shell metacharacters (e.g. `; touch /tmp/pwned`) arrived
//     as one literal argv element and was never shell-interpreted.
//  2. When STUB_CLI_SLEEP_MS is set, stay alive (a long-running job) so tests
//     can verify per-socket child reaping on disconnect.
//
// It deliberately writes a parseable JSON envelope to stdout so the client-side
// JsonReassembler can reassemble it into exactly one object.

const args = process.argv.slice(2);

const envelope = JSON.stringify({ ok: true, data: { argv: args } });

const sleepMs = Number.parseInt(process.env.STUB_CLI_SLEEP_MS ?? '', 10);

if (Number.isInteger(sleepMs) && sleepMs > 0) {
  // Long-running mode: announce readiness, then idle. The timer keeps the event
  // loop alive so the process only exits when the hub kills it (SIGTERM).
  process.stdout.write('STUB_READY\n');
  const timer = setTimeout(() => {
    process.stdout.write(envelope);
    process.exit(0);
  }, sleepMs);
  // Exit promptly on SIGTERM so the reaper's kill is observable in tests.
  process.on('SIGTERM', () => {
    clearTimeout(timer);
    process.exit(143);
  });
} else {
  // One-shot mode: emit the envelope as one or two chunks then exit cleanly.
  // Splitting across writes exercises the reassembler's chunk handling.
  const mid = Math.floor(envelope.length / 2);
  process.stdout.write(envelope.slice(0, mid));
  process.stdout.write(envelope.slice(mid));
  process.exit(0);
}
