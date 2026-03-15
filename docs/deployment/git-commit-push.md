# Git: How to Commit & Push

## 1. Check Changes

```bash
git status
```

Shows which files have changed.

```bash
git diff
```

Shows the content of the changes.

---

## 2. Stage Files

Specific files:

```bash
git add src/AdminPanel.jsx src/App.jsx
```

All changes (use carefully):

```bash
git add .
```

---

## 3. Create a Commit

```bash
git commit -m "fix: settings tab visible in demo mode"
```

### Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
| --- | --- |
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Build, config, dependency updates |
| `refactor:` | Code restructuring without behavior change |
| `test:` | Adding or updating tests |
| `docs:` | Documentation only |

For multi-line messages use HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
fix: settings tab visible in demo mode

- removed isDemoMode condition
- updated SettingsPage render condition

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## 4. Push to Remote

```bash
git push origin main
```

First time pushing (set upstream):

```bash
git push -u origin main
```

---

## 5. Verify

```bash
git log --oneline -5
```

Lists the last 5 commits. You can also verify on GitHub that the latest commit has been pushed.

---

## Common Shortcuts

```bash
# Stage + commit in one step (tracked files only)
git commit -am "fix: minor correction"

# Undo last commit if not pushed yet
git reset --soft HEAD~1

# Which commits have not been pushed?
git log origin/main..HEAD --oneline
```
