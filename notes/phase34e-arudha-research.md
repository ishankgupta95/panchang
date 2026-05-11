# Phase 34e item 2 — Arudha lord-in-6/8/12 strength reduction (DEFERRED)

Research date: 2026-05-11. Reference order: **drik panchang published
output** (primary), **multi-pandit consensus** (secondary), **classical
BPHS Ch.13 + Jaimini Upadesa Sutras Ch.1** (tertiary).

Sub-phase scope (Phase 34e item 2 of 5 remaining): the audit baseline
flagged `computeArudhaPadas` (`src/jyotish/arudha.ts`) as carrying the
two cardinal D=1 / D=7 exceptions but missing a "lord-in-6/8/12
strength reduction" annotation. The user-supplied scope said:
> classical BPHS Ch.13 + Sanjay Rath *Upadesa Sutras* Ch.1 with ≥2-source
> pandit confirmation required. Output additive — Arudha entries gain
> optional `bhanga?: { applies, reasons }` annotation following the
> Phase 34c yoga-bhanga pattern exactly.

## TL;DR — deferral decision (2026-05-11, user-confirmed)

**Decision**: Defer item 2 entirely. Mirrors the Phase 34c Raja-Yoga
bhanga deferral (when classical sources contradict each other → ship
nothing).

**Reasoning**: The ≥2-source pandit-confirmation bar the user set as a
precondition is not met. Specifically:

1. **Sanjay Rath's own canonical Arudha article** —
   <https://srath.com/jyoti%E1%B9%A3a/amateur/arudha-pada-images-of-world/>
   — lists ONLY the 4 calculation rules + the two D=1/D=7 exceptions
   (already in `arudha.ts`). It contains **no lord-in-dusthana
   strength-reduction rule**. This is the most-cited modern Sanjay-Rath
   text on Arudha calculation; its exclusion of the rule is significant.
2. **Drik panchang** publishes nothing on Arudha — verified again
   against the 18-calculator inventory captured in
   `notes/phase34e-jaimini-research.md` §1; no calculator added since.
3. **Only well-cited related rule** is **Upapada-Lagna-specific**:
   "The lord of UL positioned 6th, 8th, or 12th from the UL is not
   good and weakens its significations" (shrifreedom.org Upapada
   article). This is one source, no classical citation, and applies
   only to bhava 12's Arudha. Generalizing it to all 12 Arudha padas
   is the move the user prompt asked for — but the generalization is
   not attested in writing in any source I could surface.
4. **Generic principle** "6th/8th/12th from any Arudha represent loss,
   obstacles, and weakness of that Arudha's significations" — true,
   but this is about *external planets / aspects landing on those
   houses*, not about the bhava-lord's placement reducing the strength
   of the Arudha calculation itself. The two are different rule shapes
   and the user's framing was explicitly the latter.
5. **BPHS Ch.13 Saptarishis commentary**
   (`saptarishisastrology.com/the-arudha-chapter-of-bphs-by-madura-krishnamurthi-sastri/`)
   — empirically HTTP 403 Forbidden (2026-05-11); cannot verify the
   classical verses directly. A second Saptarishis article
   (`/some-arudha-rules-incorporated-in-bphs-by-jagdish-raj-ratra/`)
   is also 403.

Per the locked Phase 34c precedent (Raja Yoga bhanga deferred entirely
when classical sources couldn't be reconciled), and the locked Phase 34
principle that **"more rules is NOT automatically better"**, the
principled outcome is to **ship nothing** rather than ship a half-
attested or contested rule.

## Audit-baseline status

Phase 34e item 2 is moved from `⏳ not started` to `❌ deferred`. The
audit-baseline "Arudha" line in PLAN.md remains `⚠️` (intentionally
not modelled, drik silent, ≥2-source bar unmet) — same status as the
pre-34a `intentionally not modelled` items elsewhere in the audit.

## Sources surveyed (no rule found / single-source only)

| # | Source | URL | Surfaced rule? |
|---|---|---|---|
| 1 | Sanjay Rath — Arudha Pada: Images of World | <https://srath.com/jyoti%E1%B9%A3a/amateur/arudha-pada-images-of-world/> | **No** — only 4 calc rules + D=1/D=7 exceptions |
| 2 | Drik Panchang utilities | <https://www.drikpanchang.com/utilities/astrology-utilities.html> | **No** — no Arudha calculator anywhere |
| 3 | Freedom Vidya — Upapada Lagna | <https://shrifreedom.org/vedic-astrology/upapada-lagna/> | UL-specific only, no general-Arudha generalization |
| 4 | Freedom Vidya — Arudha Lagna Houses | <https://shrifreedom.org/vedic-astrology/arudha-lagna-houses/> | Talks about planets/aspects in AL6/AL8/AL12, not lord placement |
| 5 | Sarvatobhadra — Arudha Lagna Bhav Padas | <https://www.sarvatobhadra.com/arudha-lagna-bhav-padas/> | General principles, no lord-in-dusthana rule attributed |
| 6 | parijaata.wordpress — Arudha Lagna & Arudha Pada | <https://parijaata.wordpress.com/2011/08/14/arudha-lagna-arudha-pada/> | Only the D=1/D=7 same-bhava/7th exceptions, no dusthana rule |
| 7 | Saptarishis — Arudha Chapter of BPHS (Madura Krishnamurthi Sastri) | <https://saptarishisastrology.com/the-arudha-chapter-of-bphs-by-madura-krishnamurthi-sastri/> | HTTP 403 — could not verify |
| 8 | Saptarishis — Some Arudha Rules Incorporated in BPHS (Jagdish Raj Ratra) | <https://saptarishisastrology.com/some-arudha-rules-incorporated-in-bphs-by-jagdish-raj-ratra/> | HTTP 403 — could not verify |

## Re-open path

If the user wants to revisit item 2 later:

- **Single-source UL-only variant**: implement bhanga annotation
  ONLY for the bhava-12 Arudha (UL) when its lord falls in
  AL6/AL8/AL12 from UL. Single-source attribution (Freedom Vidya).
  Output stays additive; existing 11 Arudhas unaffected. Lower-
  value than the generic rule.
- **Two-source generic variant**: requires both (a) Sanjay Rath's
  print *Jaimini Maharishi's Upadesa Sutras* (Sagar Publications,
  print edition — not on the open web) **and** (b) the Saptarishis
  BPHS Ch.13 commentary article being accessible. Both are gated on
  user-provided text or alternate-access (Internet Archive Wayback,
  user-uploaded PDF, etc.).

## Locked workflow alignment

This deferral follows the locked Phase 34 workflow exactly:

> RESEARCH FIRST. … if drik publishes nothing, fall back to ≥2-source
> pandit consensus + classical attribution

> Implementation only starts after the divergence list is pinned.

The "divergence list" here is: there is no canonical divergence to
correct — Sanjay Rath's own published Arudha article matches the
library's current behavior (4 calc rules + D=1/D=7 exceptions). The
audit-baseline ⚠️ note assumed a rule exists; research surfaced that
the rule isn't well-attested. Surface the finding to the user, get
explicit confirmation, defer.

User decision pin: 2026-05-11 — user chose "Defer item 2 entirely
(Phase 34c Raja-Yoga precedent)" from a 4-option ask. Choice recorded
in conversation context; pre-existing `feedback_no_commit.md` rule
means the deferral does not commit/tag/push anything.
