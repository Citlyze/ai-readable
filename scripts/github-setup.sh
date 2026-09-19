#!/usr/bin/env bash
# Apply every repository setting that would otherwise be clicked in the GitHub
# UI. Idempotent: safe to re-run. Needs the gh CLI authenticated as an owner of
# the organisation (repo settings), and for the --issues step a token of the
# account that should appear as the author of the starter issues.
#
#   scripts/github-setup.sh              # create/update repo settings, Pages, labels, protection
#   scripts/github-setup.sh --issues     # also open the starter issues (run as the org bot account)
#
# Not automatable through the API, still done by hand:
#   - the social preview image (Settings > General > Social preview): docs/assets/social-preview.png
#   - ticking "Publish this Action to the GitHub Marketplace" on the first release
#   - NPM_TOKEN secret value (pass NPM_TOKEN in the environment to set it here)
set -euo pipefail

OWNER="${OWNER:-Citlyze}"
REPO="${REPO:-ai-readable}"
FULL="$OWNER/$REPO"
DESCRIPTION="See what each AI crawler actually gets from your pages. Fail CI when a deploy makes a page unreadable to AI search."
HOMEPAGE="https://citlyze.github.io/ai-readable"
TOPICS='["ai-search","aeo","geo","seo","robots-txt","ai-crawlers","github-action","ci","cli","chatgpt","perplexity","claude","llm","generative-engine-optimization","answer-engine-optimization","agent-skills","claude-code","codex","cursor","typescript"]'

say() { printf '\033[32m%s\033[0m %s\n' "==>" "$*"; }

# 1. Repository: create if missing, then settings.
if ! gh api "repos/$FULL" --silent 2>/dev/null; then
  say "creating $FULL"
  gh api -X POST "orgs/$OWNER/repos" \
    -f name="$REPO" -f description="$DESCRIPTION" -f homepage="$HOMEPAGE" \
    -F private=false -F has_issues=true -F has_wiki=false -F has_projects=false -F has_discussions=true \
    -F auto_init=false >/dev/null
else
  say "$FULL exists, updating settings"
fi
gh api -X PATCH "repos/$FULL" \
  -f description="$DESCRIPTION" -f homepage="$HOMEPAGE" \
  -F has_issues=true -F has_wiki=false -F has_projects=false -F has_discussions=true \
  -F delete_branch_on_merge=true -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=true \
  -F allow_update_branch=true -F web_commit_signoff_required=false >/dev/null

# 2. Topics (replaces the whole set).
say "topics"
gh api -X PUT "repos/$FULL/topics" -H "Accept: application/vnd.github+json" --input - <<EOF >/dev/null
{"names": $TOPICS}
EOF

# 3. Actions enabled for this repository (the org may default to disabled).
say "actions"
if gh api -X PUT "repos/$FULL/actions/permissions" -F enabled=true -f allowed_actions=all >/dev/null 2>&1; then
  gh api -X PUT "repos/$FULL/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false >/dev/null || true
else
  echo "   WARNING: could not enable Actions for $FULL. The organisation policy probably disables Actions or limits it to selected repositories."
  echo "   Fix in the org UI: Settings > Actions > General > allow for selected repositories, add $REPO. CI, Pages and the self-check need it."
fi

# 4. Security features.
say "security features"
gh api -X PUT "repos/$FULL/private-vulnerability-reporting" >/dev/null || true
gh api -X PATCH "repos/$FULL" --input - <<'EOF' >/dev/null || true
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"},"dependabot_security_updates":{"status":"enabled"}}}
EOF
gh api -X PUT "repos/$FULL/vulnerability-alerts" >/dev/null || true

# 5. Pages: build from the pages.yml workflow (requires the branch to exist).
say "pages"
if ! gh api "repos/$FULL/pages" --silent 2>/dev/null; then
  gh api -X POST "repos/$FULL/pages" -f build_type=workflow >/dev/null || echo "   pages: push main first, then re-run"
else
  gh api -X PUT "repos/$FULL/pages" -f build_type=workflow >/dev/null || true
fi

# 6. Labels.
say "labels"
label() { gh label create "$1" --repo "$FULL" --color "$2" --description "$3" --force >/dev/null; }
label "wrong-result" "d73a4a" "A check passed or failed when it should not have"
label "bot-registry" "0e8a16" "Add or change an AI crawler entry"
label "recipe" "1d76db" "Framework or hosting fix recipe"
label "good first issue" "7057ff" "Small, well-scoped, a good way in"
label "help wanted" "008672" "Maintainers would welcome a pull request"

# 7. Branch protection on main (requires the branch to exist).
say "branch protection"
gh api -X PUT "repos/$FULL/branches/main/protection" --input - <<'EOF' >/dev/null 2>&1 || echo "   protection: push main first, then re-run"
{
  "required_status_checks": {"strict": false, "contexts": ["test (20)", "test (22)"]},
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF

# 8. Secrets (only when provided).
if [ -n "${NPM_TOKEN:-}" ]; then
  say "NPM_TOKEN secret"
  gh secret set NPM_TOKEN --repo "$FULL" --body "$NPM_TOKEN"
fi

# 9. Starter issues. Run this step as the org bot account so the author is not a personal handle.
if [ "${1:-}" = "--issues" ]; then
  say "starter issues (author: $(gh api user --jq .login))"
  issue() { # issue <title> <labels> <body>
    if gh issue list --repo "$FULL" --search "in:title \"$1\"" --state all --json number --jq 'length' | grep -qv '^0$'; then
      echo "   exists: $1"; return
    fi
    gh issue create --repo "$FULL" --title "$1" --label "$2" --body "$3" >/dev/null && echo "   opened: $1"
  }
  issue "Recipe: SvelteKit" "recipe,good first issue" "Add \`docs/recipes/sveltekit.md\` following the structure of the Astro recipe: one section per check id, the smallest change that makes it pass, and a snippet the reader can paste. Cover \`prerender\`, \`+page.server.ts\` loads for content that must be in the HTML, and \`app.html\` metadata. Link it from README.md and SKILL.md."
  issue "Recipe: Nuxt" "recipe,good first issue" "Add \`docs/recipes/nuxt.md\`: \`useSeoMeta\`/\`useHead\` for titles and descriptions, server routes for content that must be in the initial HTML, \`nuxt generate\` versus SSR, and \`robots.txt\` via \`public/\` or a module. Same structure as the Astro recipe."
  issue "Recipe: Webflow and Framer exports" "recipe,help wanted" "Both platforms publish server-rendered HTML but make it easy to end up with several H1s, no JSON-LD and no question-shaped headings. Document where each setting lives in the editor and what the exported HTML looks like."
  issue "Bots: xAI and You.com once their documentation names the tokens" "bot-registry,help wanted" "Both vendors run crawlers, but the registry only accepts bots with a vendor documentation page that names the robots.txt token. Track their docs and open a pull request against \`src/engine/bots.ts\` when one appears. See CONTRIBUTING.md for the category rules."
  issue "JUnit output for ci" "good first issue" "Add \`--format junit\` to \`ai-readable ci\` so CI systems that ingest test reports (GitLab, Jenkins, Buildkite) show each page as a test case with the regression messages as failures. One file per run, path via \`--output\`."
  issue "Netlify preview deployment example" "recipe,good first issue" "docs/ci-setup.md has a full example for one hosting provider's preview deployments. Add the equivalent for Netlify: how to get the deploy preview URL into \`base-url\` and how to handle password-protected previews."
fi

say "done. Manual steps left: social preview upload, Marketplace checkbox on the first release."
