# Single Changelog Fixture

Repository whose committed `.simple-changelogs.json` records
`developerChangelog: "optional"` and `signatures: "none"`. Changelog work must
respect both recorded choices: keep customer history in `CHANGELOG.md`, do not
create `DEVELOPER_CHANGELOG.md` unless explicitly asked, and do not write
signature comments.

Technical context that would otherwise go to the developer changelog belongs in
commit, pull, or merge request descriptions for this repository.
