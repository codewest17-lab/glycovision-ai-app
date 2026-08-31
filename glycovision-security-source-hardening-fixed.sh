#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$(pwd)"
if [ ! -f "$ROOT/src/App.jsx" ]; then
  echo "Run this from the glycovision-ai-app project root."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app = Path("src/App.jsx")
s = app.read_text()

old = '<Route path="/admin" element={<Admin/>}/>'
new = '<Route path="/admin" element={profile?.is_admin?<Admin/>:<Navigate to="/dashboard" replace/>}/>'

if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    print("Admin route pattern not found; leaving src/App.jsx unchanged.")

app.write_text(s)

netlify = Path("netlify.toml")
s = netlify.read_text() if netlify.exists() else ""

headers = '''
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(self), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=63072000; includeSubDomains"
'''

if "[[headers]]" not in s:
    netlify.write_text(s.rstrip() + "\n" + headers)
    print("Security headers added to netlify.toml")
else:
    print("Security headers already present in netlify.toml")
PY

git add src/App.jsx netlify.toml

if git diff --cached --quiet; then
  echo "No new source changes to commit."
else
  git commit -m "Harden admin route and security headers"
fi

git push origin main

echo
echo "Security hardening pushed successfully. Netlify should redeploy from main."
