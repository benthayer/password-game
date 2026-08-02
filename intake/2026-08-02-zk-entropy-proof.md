# ZK proof of password strength — what is actually provable

Date: 2026-08-02, ~4am. Conversation between Ben and AI.
Origin: TODO.md, CYA++ section — Ben's item, unchecked:
"Zero knowledge proof that the password actually meets 'uncrackable'
security standards"

Ben asked what it was; this is the unpacking.

## The core obstacle

AI: "A password has no entropy. Entropy is a property of a probability
distribution, not of a string." Any given string is a fixed sequence of
bytes. What carries entropy is the *process* that produced it. Four words
drawn uniformly from a 7776-word corpus is ~51.7 bits; the same four words
chosen because they were memorable is a handful of bits.

Consequence: there is no function of the password that reports its strength.
Every strength meter is a heuristic for "position in an attacker's guess
ordering," which is a different question.

So the claim cannot be about the password. It has to be about the
generation process.

## What IS provable here

This system is unusually well suited, because the derivation is already
deterministic and public:
- corpus is public (7776 words)
- config is public (README has a section titled "The Config Is Public")
- grid is public
- the only secret is the path

Provable statement: "I know a preimage consisting of k word-selections from
the published corpus, under the published derivation, whose Argon2id output
(published params: 64MB, t=3, p=1) equals this public identity hash."

That is a circuit. If the derivation only accepts inputs of that shape, an
attacker's search space is at least the space of valid preimages, which is
computable.

## Entropy numbers (computed 2026-08-02)

Corpus 7776 words -> 12.9248 bits/word.

    4 words:  51.7 bits
    5 words:  64.6 bits
    6 words:  77.5 bits
    8 words: 103.4 bits
   10 words: 129.2 bits
   16 words: 206.8 bits

BUT default grid is 4x4 = 16 words. If the password is a path *through the
grid* rather than free selection from the corpus, each pick is log2(16) = 4
bits:

    k=4  ordered-distinct 15.1 bits | with repeats 16.0
    k=5  ordered-distinct 19.1 bits | with repeats 20.0
    k=6  ordered-distinct 22.5 bits | with repeats 24.0
    k=8  ordered-distinct 29.0 bits | with repeats 32.0

**OPEN QUESTION / possible real issue:** 32 bits against Argon2id-64MB is
crackable in an afternoon. Either the password is drawn from the full corpus
with the grid as a memory aid, or the grid does something not yet understood,
or there is a genuine gap between what the UI implies and the actual sampled
space. This needs pinning down regardless of ZK — it is also exactly the
number the "cost to crack in dollars/years" TODO item depends on.

## The unsolvable half

A perfect proof of "I know a k-word preimage" does NOT prove the words were
drawn uniformly. Hand-pick four memorable words -> still a valid proof. The
circuit sees a valid preimage; it cannot see the sampling distribution.

Randomness of a sample is not verifiable. Under a uniform distribution every
outcome is equally likely, so no predicate on the outcome separates "uniform"
from "adversarially chosen."

AI noted this is the same wall already hit and correctly documented in the
size-aware entropy threshold comment in encryption-validation.ts: you cannot
distinguish distributions from a single small sample. Information-theoretic,
not a tuning problem.

## Two escape hatches (both move trust, neither removes it)

1. **Verifiable randomness at generation time.** Client commits to a seed,
   server contributes a nonce, word selection is a deterministic function of
   both; neither side steers the outcome alone. Then prove the words came out
   of that coin-flipping protocol. Real and workable. Cost: only applies to
   *generated* passwords — the user can no longer bring their own. Probably
   acceptable: there is already a generation flow, using a CSPRNG as of 2108212.

2. **Attestation** — client proves it ran the official generator. Requires
   trusting hardware or a signed binary. Relocates the problem.

AI's read: (1) fits this system. It proves something narrower but real —
not "this password is uncrackable" but "this password was drawn uniformly
from a space of size N, and here is N."

## Who is the verifier? (the question that decides whether to build it)

If the verifier is the server checking the client, ZK is pointless — the
client could just send the password. ZK only matters when the prover will
not reveal the witness.

AI's argument: the real verifier is a third party, and the proof is a
non-repudiation artifact about Ben's *own* capabilities. Being able to tell
a skeptical user, or a court, or someone at DEFCON: here is a proof you can
check yourself that this material was generated with >= N bits of entropy
and that I could not have known it.

That is why it sits in CYA++ next to "LLC" and "Move server to friendly
jurisdiction" — all three are the same concern: establishing that Ben
genuinely cannot access what he stores.

Reframe: not a security feature. A non-repudiation feature about operator
capability.

## Next
- [ ] Pin down the actual sampled space (grid path vs full corpus). Blocks
      both this and the cost-to-crack display.
