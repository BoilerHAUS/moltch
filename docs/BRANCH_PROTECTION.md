# branch protection checklist (main)

apply these settings on `main`:

- require pull request before merge
- require at least 1 approval
- require code owner review
- require status check: `repo-baseline`
- require linear history
- disallow force pushes
- disallow branch deletion

## policy
- no direct pushes to `main`
- all work issue-first, fork-branch, PR-gated
