# Skill-Package Verification

Run repository-native checks and inspect the final diff. At minimum verify:

- each installable skill directory has one root `SKILL.md` and no nested copy;
- frontmatter name matches the directory and has a bounded trigger description;
- every routed local reference or script exists inside that distribution;
- installable directories contain no `EVAL.md`, fixtures, test suites, model
  adapters, contributor harnesses, or symlinks;
- maintainer tooling contains no discoverable `SKILL.md`;
- public and developer changelog entries are classified by audience;
- a nonempty `Unreleased` section exists only while pending work remains;
- released public and developer headings, package versions, and packaged
  read-only notes agree for the intended release;
- raw signature comments stay out of rendered or CLI release notes;
- README selection names and exact Skills CLI commands match real directories;
- forks retain an honest provenance pin and intentional deltas.

Use the repository's package-shape test and create a real temporary consumer
install when that workflow exists. A source-tree pass alone does not prove that
the Skills CLI copied the intended boundary.

Report checks as passed, failed, blocked, skipped with reason, or unavailable.
Do not claim publication or remote merge from local package evidence.
