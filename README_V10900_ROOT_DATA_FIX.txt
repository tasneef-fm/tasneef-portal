TASNEEF V10900 — ROOT DATA / SERVER STABILITY FIX

What changed:
1) One final data kernel owns first-open loading and active-section refresh.
2) No periodic polling or refresh on focus/visibility.
3) In-flight requests are deduplicated so the same dataset is not requested twice.
4) Master admin data and supervisor-scoped data are separated; one can no longer overwrite the other.
5) Failed requests preserve the last good in-memory data instead of replacing it with [] or a partial result.
6) Supervisor projects use projects.supervisor_id as the canonical owner. Current-month distribution is fallback only when a project has no direct owner.
7) No allowed_project_ids expansion and no Fahd/project-name hardcoding.
8) Ticket loading is centralized and supervisor tickets are scoped only after the full ticket snapshot is obtained.
9) Project saving is schema-safe: an unsupported optional legacy column cannot cancel the whole project save.
10) Project-to-supervisor sync writes supervisor_id independently so optional legacy columns cannot cancel the assignment.
11) Legacy canonical logs renderer no longer performs a server request every time renderTimeLogs() is called.
12) V10872 section loader / supervisor scope / Fahd hardcoded scripts were removed from page load to eliminate competing writers.

Refresh policy remains:
- First time a section is opened.
- Immediately after add/update/delete via the existing refreshAll path.
- Explicit date/month filter changes.
- No interval/focus polling.

Server:
Run SERVER_OPTIMIZATION_V10900.sql once in Supabase SQL Editor. It only creates safe indexes when the referenced table/columns exist and runs ANALYZE. It does not delete business data.

Recommended deployment:
1) Replace the web files with this build.
2) Run SERVER_OPTIMIZATION_V10900.sql once.
3) Open reset-cache.html once.
4) Sign out/in for admin and supervisor sessions.
