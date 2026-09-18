# Release lockstep: npm and the Go module, cut from one commit

The third sync-discipline item, in full:

> **Release lockstep:** Go module versions with npm, cut from the same commit,
> by Ishank.

This document is the design. `ci/release-check.sh` is the enforceable part of
it: a read-only dry run that checks the preconditions and prints the commands.
It never tags, never pushes and never publishes. Those are yours, every time.

---

## 1. What lockstep has to mean, and what it cannot

The port's whole correctness argument is *differential*: every band in
`source/go/parity/bands.json` compares a Go dump against a TypeScript dump **produced
from the same working tree**. That makes the version relationship load-bearing
rather than cosmetic. If Go 5.1.1 were cut from a tree where `source/ts/src/` had moved on,
its published numbers would be a comparison against nothing: the gate that
justifies them would have been run against a different program.

So lockstep means exactly one thing that can be enforced:

> **One commit produces both artefacts, and every gate was green on that commit.**

It does **not** mean the two version *strings* must be equal. That is a separate
choice, and §2 says why the obvious answer is the expensive one.

---

## 2. Three shapes, and the one that applies today

One open question was "whether `go/panchang` is a supported public
library or service-only". **Answered 2026-08-24: it is a library**, and Ishank
will build any service on top of it in a separate project. That picks option A
below. The other two are kept because the trade-off is worth having written
down, not because they are still open.

### Option C: service-only (**not** chosen; kept for the record)

The Go tree is never published as a module. Consumers get a binary or an image,
not an import path. Then:

- **no Go tag exists at all**, and none of §3's mechanics apply;
- lockstep is: the image tag *is* the npm version, and both name the same commit;
- `source/go/go.mod`'s module path stays `github.com/ishankgupta95/panchang/go` and
  never needs a major-version suffix.

This is the cheapest by a wide margin and it is what the default already says.

### Option B: published module, versioned independently

`go/` is importable, tagged `go/v0.x.y` or `go/v1.x.y`, and its version tracks
*the port's* maturity rather than npm's. The npm version it corresponds to is
recorded in the tag message and the release notes.

- one commit still produces both;
- `go.mod` stays `.../panchang-ts/go` with no suffix, because v0 and v1 need
  none;
- an npm major bump costs nothing on the Go side.

### Option A: published module, version parity (Go v5.1.1 == npm 5.1.1), **CHOSEN**

Superficially the tidiest and the most expensive. Go requires a module path to
end in `/vN` for every major N ≥ 2, so parity at 5.x means the module path is
`github.com/ishankgupta95/panchang/go/v5` **today**, and every npm major bump
after that rewrites the module path and every import statement in every
consumer. `panchang-ts` went 2 → 5 inside a few months; option A pays that cost
each time, for a version string.

**SETTLED 2026-08-24: Ishank chose A, version parity.** `source/go/go.mod` declares
`module github.com/ishankgupta95/panchang/source/go/v5` and the module tracks
npm's version. The cost is stated above and accepted: every npm major bump
rewrites the module path and every consumer's imports. `release-check.sh` now
reports the path as *consistent* rather than warning about it, and it checks the
`source/go/vX.Y.Z` tag alongside the npm one.

The recommendation this section used to carry (C now, B later) is kept above for
the record, because the trade-off has not changed, only the decision.

---

## 3. The mechanics, if a Go tag is ever cut

Three rules, and the first two are the ones that surprise people:

1. **A module in a subdirectory is tagged with that subdirectory as a prefix.**
   `source/go/go.mod` means the tag is `source/go/v1.2.3`, not `v1.2.3`. A bare `v1.2.3` tag
   publishes nothing for this module: the proxy will not find it, and the
   failure looks like "unknown revision", not like a misconfiguration.
2. **The npm tag and the Go tag are different tags on the same commit.** They do
   not conflict; `v5.1.1` and `source/go/v5.1.1` can both point at one object.
3. **`GOPROXY` caches immutably.** A tag moved after publication does not
   un-publish; the old content stays served under the old version forever. This
   is the reason the working tree must be clean before tagging rather than
   after: there is no amending a Go release.

**Verified on 2026-08-30, so this is no longer an open question.** The doubt was whether a
subdirectory module that *also* carries a `/vN` path suffix wants `source/go/v5.1.1` or a
`source/go/v5/` directory of its own. It wants `source/go/v5.1.1`, and the `/v5` needs no
directory: the suffix lives only in the module path.

Tested twice against a local bare repository standing in for GitHub, reached through a
`url.insteadOf` rewrite so `go get` used its real GitHub repo-root rule rather than a vanity
lookup. First with a two-file scratch module, then with this repository's actual `source/go`
tree. Both resolved, and the real one compiled and ran:

```
go: downloading github.com/ishankgupta95/panchang/source/go/v5 v5.1.1
go: added github.com/ishankgupta95/panchang/source/go/v5 v5.1.1
ok: true | tithi: Shukla Navami | nakshatra: Chitra
```

which is the same answer `getDailyPanchang` gives for that instant and location.

Two things that came out of doing it, both now fixed in the tree:

- **The module needs its own `LICENSE`.** The module root is `source/go/`, so the repository's
  root `LICENSE` is not in the module zip and `pkg.go.dev` would have reported no license.
  `source/go/LICENSE` is a copy, and it must stay in step with the root one.
- **`source/go/parity/go.mod` exists to be excluded.** A directory holding a `go.mod` is left
  out of its parent module's zip. Without it every Go consumer downloaded the parity harness,
  including a 263 KB TypeScript dump generator. There are no `.go` files under `parity/`, so
  the stub costs nothing and the zip carries only `LICENSE`, `go.mod` and Go source.

---

## 4. The procedure

1. Land everything. **The tree must be clean**: `release-check.sh` blocks on
   this, and §3's rule 3 is why.
2. Bump `package.json` **in the commit being released**, not after it.
3. Run every gate on that commit: `bash ci/prerelease.sh`, on `darwin/arm64`.
   It is a superset of CI, and the difference is what matters here: the goldens
   and the two generator reproductions are pinned to that host and no runner can
   check them.
4. `bash ci/release-check.sh` must print `preconditions OK`.
5. Run the commands it printed. It prints them rather than running them so that
   the commands you run are the ones that were checked.
6. `npm run build && npm publish --access public`.

Step 5's Go tag is omitted entirely under option C.

---

## 5. What is checkable, and what is not

`release-check.sh` checks, in this order:

| check | why it blocks |
|---|---|
| working tree clean | a release names a commit; §3 rule 3 makes it unamendable |
| `package.json` == the version being released | the two artefacts take their version from one place |
| `vX.Y.Z` does not already exist elsewhere | a moved tag is a silently different release |
| `source/go/vX.Y.Z` does not already exist elsewhere | same |
| tag continuity since the last `v*` tag | warns; an untagged published version is a freeze point nobody can find again |
| `go.mod`'s major suffix vs the version | warns; only load-bearing under option A |

It **cannot** check that the gates were green, because it takes 200 ms and they
take minutes. It prints them in order instead. If that ever needs to be
mechanical, the honest way is a CI job on the tag ref rather than a marker file
the script trusts.

---

## 6. Owed, and not by this document

**The port's freeze tag is still missing.** `package.json` has said 5.1.1 since
before the port began, no v5.1.x tag exists (the tags jump from **v5.0.1** to
v5.2.0), and both 5.1.0 and 5.1.1 were published untagged. Every measurement the port has recorded
is against `c38c606`, so the tag that would make that baseline findable is:

```bash
git tag -a v5.1.1 c38c606 -m "v5.1.1"
```

Agents never tag. This is recorded here because a differential port whose
baseline is an untagged commit is one `git gc` away from having no baseline at
all.
