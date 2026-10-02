# Skill-Package Verification

Report the effective `publicVersioning` source and values. Missing fields are
safe ask/ask/ask with suggestions on. For delegated releases validate
capability and schema digests, phase/scope, exact revision lineage, approval
binding, closed reason/action codes, and one receipt per train. Only read-only
`verify` on the refreshed target proves integration; publication remains
separate.

Run repository-native checks and inspect the final diff. At minimum verify:

- each installable skill directory has one root `SKILL.md` and no nested copy;
- frontmatter name matches the directory and has a bounded trigger description;
- every routed local reference or script exists inside that distribution;
- installable directories contain no `EVAL.md`, fixtures, test suites, model
  adapters, contributor harnesses, or symlinks;
- maintainer tooling contains no discoverable `SKILL.md`;
- public and developer changelog entries are classified by audience;
- exactly one `Unreleased` section exists, empty when no work is pending;
- released public and developer headings, package versions, and packaged
  read-only notes agree for the intended release;
- raw signature comments stay out of rendered or CLI release notes;
- README selection names and exact Skills CLI commands match real directories;
- forks retain an honest provenance pin and intentional deltas;
- an initial backfill reaches the oldest trustworthy evidence, covers every
  intervening range through setup, accounts for intentional omissions, and
  leaves incomplete evidence gaps resumable instead of recording `completed`.

Use the repository's package-shape test and create a real temporary consumer
install when that workflow exists. A source-tree pass alone does not prove that
the Skills CLI copied the intended boundary.

When a check fails, fix what it reports and rerun it until it passes or the
failure becomes a reported blocker. Report checks as passed, failed, blocked,
skipped with reason, or unavailable. Do not claim publication or remote merge
from local package evidence.
