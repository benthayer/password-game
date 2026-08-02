# ent binary is unreachable — key randomness check fails open

Found: 2026-08-02, during a conversation reviewing the night's commits.
Attribution: found by AI, prompted by Ben asking "Ent?"

## Summary

`verifyKeyRandomness()` in `packages/backend/src/services/encryption-validation.ts`
shells out to the Fourmilab `ent` binary to validate the client-supplied
32-byte secondary encryption key. The binary is almost certainly never
found at runtime, and the failure path **fails open**.

## Evidence

Path is computed as:

    const ENT_BINARY = join(__dirname, '..', 'bin', 'ent');

The binary is committed at `packages/backend/bin/ent` (added in 6beea93).

- **Prod**: module resolves to `dist/services/`, so the lookup is
  `dist/bin/ent`. `tsconfig.json` has `rootDir: src` / `outDir: dist` and
  `tsc` emits only JS — it does not copy binaries. `Dockerfile.backend`
  copies only `--from=builder /app/packages/backend/dist`. So `dist/bin/ent`
  never exists.
- **Dev**: under `tsx`, module resolves to `src/services/`, so the lookup is
  `src/bin/ent`. Verified: no `src/bin` directory exists.
- **Independent second failure**: prod image is `node:20-alpine` (musl). The
  committed binary is a dynamically-linked glibc ELF requiring `GLIBC_2.34`.
  Executing it produces:
  `./bin/ent: /lib/x86_64-linux-gnu/libc.so.6: version 'GLIBC_2.34' not found`.
  Even with a correct path, Alpine could not run it.

## Impact

`runEnt()` returns `null` on failure. The fallback in `verifyKeyRandomness()`
checks only whether all bytes are identical, then returns
`{ valid: true, looksRandom: true, entropy: -1 }` with the comment
"better to accept than block legitimate users".

Net effect: every secondary key is accepted except 32 identical bytes.
All-ASCII keys, counters, repeated words all pass.

Severity is moderate, not critical — this is defense-in-depth. An actual
adversary controls the client and can always send a genuinely random key.
The real cost is (a) a user with a broken client silently gets weaker
protection than advertised, and (b) the README implies server-side
verification that is not in fact happening. The doc/reality gap on a
security claim is the main issue.

Note the contrast with 9d12d27 ("Fail closed when ADMIN_SECRET is unset"),
committed the same evening. Same principle, opposite outcome — because this
failure is silent, nothing ever surfaced that the fallback branch was live.
The `entropy: -1` sentinel is the tell, and nobody inspects the validation
result of a successful upload.

## Options

1. **Preferred: drop `ent`, port the three statistics to JS.** Entropy,
   chi-squared and serial correlation over 32 bytes is ~40 lines, and
   `StreamingStats` already has most of the pieces. Removes the subprocess,
   the temp-file write, the committed binary, the glibc dependency, and the
   entire "is the binary where we think it is" failure class. Also makes the
   check unit-testable, which it currently is not.
2. Keep `ent`: `apk add` it in `Dockerfile.backend` rather than committing a
   binary, and resolve the path from the package root so dev and prod agree.

In both cases: **flip the fallback to fail closed.** If the validator cannot
run, that should be a 500, not a silent pass — same call already made for
`ADMIN_SECRET`.

## Test-shaped hole

Nothing currently exercises `verifyKeyRandomness()`. A single test feeding it
32 bytes of `0x41` and asserting rejection would have caught this the moment
it broke.
