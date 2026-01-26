# Cost-to-Crack Research Report

Research compiled: January 2026

## Executive Summary

The current cost-to-crack model in Password Game uses rough estimates that are **not conservative** - they overestimate the cost to attackers by 10-100x in some cases. This report documents real-world benchmarks and proposes more accurate, conservative estimates.

---

## 1. Hardware Benchmark Data

### 1.1 SHA-256 Performance

| Hardware | Hashrate | Hardware Cost | Power | Source |
|----------|----------|---------------|-------|--------|
| RTX 4090 | ~265 GH/s | ~$1,600 | 450W | [Bitwarden Community][1] |
| RX 7900 XTX | ~150 GH/s | ~$900 | 355W | [Bitwarden Community][1] |
| Antminer S21 Pro (ASIC) | ~300-350 TH/s* | ~$5,000 | 3200W | [Bitwarden Community][1] |

*Note: Bitcoin ASICs do double-SHA256, not directly comparable but shows attacker capability.

### 1.2 Argon2id Performance (64MB, t=3, p=4)

| Hardware | Hashrate | Hardware Cost | Power | Source |
|----------|----------|---------------|-------|--------|
| Nvidia A100 | ~80-100 H/s | ~$11,000 | 400W | [Bitwarden Community][1] |
| Nvidia H100 | ~100-150 H/s | ~$35,000 | 700W | [Bitwarden Community][1] |
| RTX 4090 | ~60-100 H/s | ~$1,600 | 450W | [Bitwarden Community][1] |
| RX 7900 XTX | ~50-80 H/s | ~$900 | 355W | [Bitwarden Community][1] |
| FPGA (Virtex UltraScale+) | ~10-25 H/s | ~$25,000 | 300W | [Bitwarden Community][1] |
| ASIC (custom) | ~50-100 H/s | ~$30,000+ | 6000W | [Bitwarden Community][1] |

**Key insight**: Argon2id's memory-hardness means GPUs get ~60-100 H/s vs 265 billion H/s for SHA-256 - a ~2.6 billion times slowdown.

### 1.3 PBKDF2-SHA256 (600,000 iterations)

| Hardware | Hashrate | Source |
|----------|----------|--------|
| RTX 4090 | ~2,000-2,500 H/s | [Bitwarden Community][1] |

### 1.4 bcrypt (cost=12)

| Hardware | Hashrate | Source |
|----------|----------|--------|
| RTX 4090 | ~30-100 kH/s* | Estimated from hashcat benchmarks |

*bcrypt cost=12 means 2^12 = 4096 iterations

---

## 2. Hardware Cost Models

### 2.1 GPU Rental Pricing (2025)

| Provider | Hardware | Price/Hour | Source |
|----------|----------|------------|--------|
| Vast.ai | RTX 4090 | ~$0.30-0.50 | Market rates |
| Lambda Labs | A100 | ~$1.10-2.00 | Published pricing |
| AWS | A100 (p4d) | ~$3-4 | Published pricing |

### 2.2 Owned Hardware Model

For owned hardware, use 3-year amortization + electricity:

```
Cost/hour = (Hardware Cost / (3 × 8760 hours)) + (Watts × $0.10/kWh)
```

**RTX 4090 example:**
- Hardware: $1,600 / 26,280 hours = $0.061/hour
- Electricity: 0.45 kW × $0.10 = $0.045/hour  
- **Total: ~$0.106/hour**

**Conservative approach**: Use rental pricing (cheaper for attackers).

---

## 3. Cost Per Hash Calculations

### 3.1 SHA-256 (Conservative)

Using RTX 4090 at $0.40/hour rental:
```
Rate: 265 GH/s = 265 × 10^9 H/s
Hashes/hour: 265 × 10^9 × 3600 = 9.54 × 10^14
Cost/hash: $0.40 / 9.54 × 10^14 = $4.2 × 10^-16
```

**Conservative estimate: $1 × 10^-15 per hash** (rounding up for attacker)

Current model uses $1 × 10^-13 - this is **100x too high** (defender-favorable).

### 3.2 Argon2id (64MB, t=3, p=1)

Using RTX 4090 at $0.40/hour rental, ~80 H/s:
```
Hashes/hour: 80 × 3600 = 288,000
Cost/hash: $0.40 / 288,000 = $1.39 × 10^-6
```

**Conservative estimate: $1 × 10^-6 per hash**

Current model uses $1 × 10^-4 - this is **100x too high** (defender-favorable).

### 3.3 bcrypt (cost=12)

Estimated ~50 kH/s on RTX 4090 at $0.40/hour:
```
Hashes/hour: 50,000 × 3600 = 1.8 × 10^8
Cost/hash: $0.40 / 1.8 × 10^8 = $2.2 × 10^-9
```

**Conservative estimate: $1 × 10^-9 per hash**

Current model uses $1 × 10^-6 - this is **1000x too high** (defender-favorable).

### 3.4 PBKDF2-SHA256 (600k iterations)

Using 2,500 H/s on RTX 4090:
```
Hashes/hour: 2,500 × 3600 = 9 × 10^6
Cost/hash: $0.40 / 9 × 10^6 = $4.4 × 10^-8
```

**Conservative estimate: $1 × 10^-8 per hash**

Current model uses $1 × 10^-7 - this is **10x too high** (defender-favorable).

---

## 4. Nonlinear Scaling Effects

### 4.1 Argon2id Memory Scaling

Research from [arXiv:2504.17121][2] shows diminishing returns at high memory:

> "Using Argon2id with 46 MiB of memory reduces compromise rates by 42.5% compared to SHA-256 at a $1 per account attack budget. However, increasing memory to 2048 MiB offers only a 23.3% additional protection despite 44.5 times greater memory demands."

**Implication**: Linear memory scaling is approximately correct up to ~256MB, but benefits plateau at very high memory settings due to:
- Memory bandwidth becoming the bottleneck
- Hardware memory limits forcing sequential processing

### 4.2 Parallelism Effects

From [CipherTools][3]:

> "While increasing parallelism can speed up legitimate hashing processes, it can also allow attackers to parallelize their efforts, potentially offsetting the benefits."

**Implication**: Parallelism should NOT linearly increase the cost to crack. The defender parallelism setting helps the defender more than it hurts the attacker, but the relationship is complex.

**Conservative approach**: Do not count parallelism as increasing cost-to-crack.

### 4.3 Time Cost (Iterations)

Time cost scales approximately linearly according to all sources. Doubling iterations approximately doubles computation time.

---

## 5. Comparative Analysis

From [Deepak Gupta's analysis][4]:

| Algorithm | Cost to crack 8-char password |
|-----------|------------------------------|
| PBKDF2 (600k iterations) | ~$5,000 |
| bcrypt (cost=12) | ~$40,000 |
| Argon2id (64MB) | ~$500,000 |

---

## 6. Recommendations for Password Game

### 6.1 Conservative Cost-Per-Hash Values

| Algorithm | Current Model | Conservative | Change Factor |
|-----------|--------------|--------------|---------------|
| SHA-256 | $1 × 10^-13 | $1 × 10^-15 | 100x lower |
| Argon2id (64MB, t=3, p=1) | $1 × 10^-4 | $1 × 10^-6 | 100x lower |
| bcrypt (cost=12) | $1 × 10^-6 | $1 × 10^-9 | 1000x lower |
| PBKDF2 (600k) | $1 × 10^-7 | $1 × 10^-8 | 10x lower |
| scrypt (N=2^20, r=8, p=1) | $1 × 10^-4 | $1 × 10^-6 | 100x lower (similar to Argon2) |

### 6.2 Scaling Formulas

**SHA-256**: No parameters, fixed cost.

**Argon2id**:
```
baseCost = 1e-6  // 64MB, t=3
memoryCostKB_base = 65536
timeCost_base = 3

// Linear scaling for memory (up to ~256MB), then sublinear
memoryMultiplier = min(memoryCostKB / memoryCostKB_base, 4) + 
                   max(0, (memoryCostKB / memoryCostKB_base - 4) * 0.5)
timeMultiplier = timeCost / timeCost_base

// Parallelism: conservative = do NOT multiply
// (defender parallelism doesn't proportionally hurt attacker)

costPerHash = baseCost * memoryMultiplier * timeMultiplier
```

**bcrypt**:
```
baseCost = 1e-9  // cost=12
costMultiplier = 2^(cost - 12)
costPerHash = baseCost * costMultiplier
```

**PBKDF2**:
```
baseCost = 1e-8  // 600k iterations
costMultiplier = iterations / 600000
costPerHash = baseCost * costMultiplier
```

**scrypt**:
```
baseCost = 1e-6  // N=2^20, r=8, p=1
baseN = 2^20
memoryMultiplier = (N * r) / (baseN * 8)
costPerHash = baseCost * memoryMultiplier
// Note: p parameter in scrypt is different from Argon2
```

---

## 7. Sources

[1]: https://community.bitwarden.com/t/evaluating-master-password-security-how-many-bits-are-enough-for-economic-safety/74957
**Bitwarden Community - Evaluating Master Password Security**
Comprehensive analysis of password cracking costs across hardware platforms.

[2]: https://arxiv.org/abs/2504.17121
**arXiv - Argon2 Adoption and Memory Parameter Analysis**
Academic study on diminishing returns of high memory settings.

[3]: https://www.ciphertools.org/blogs/how-to-choose-the-right-parameters-for-argon2
**CipherTools - How to Choose the Right Parameters for Argon2**
Practical guide to Argon2 parameter selection.

[4]: https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/
**Deepak Gupta - Complete Guide to Password Hashing**
Comparative analysis of password hashing algorithms.

[5]: https://research.redhat.com/blog/article/how-expensive-is-it-to-crack-a-password-derived-with-argon2-very/
**Red Hat Research - How Expensive Is It to Crack a Password Derived with Argon2?**
Cost modeling methodology for Argon2 attacks.

[6]: https://github.com/P-H-C/phc-winner-argon2
**Official Argon2 Repository**
Official benchmarks and implementation details.

---

## 8. Notes on Conservative Estimation

"Conservative" in security means **assuming the attacker has advantages**:
- Use cheapest available hardware (rental markets, not MSRP)
- Assume electricity is cheap ($0.05-0.10/kWh)
- Assume attackers have optimized implementations
- Do NOT assume defenders' parallelism settings hurt attackers proportionally
- Account for future hardware improvements with safety margin

The goal is to ensure that if the model says "this costs $1 trillion to crack," it would actually cost at least that much, not less.



