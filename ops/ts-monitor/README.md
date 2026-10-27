# TS sessions — read-only monitor

Target: TS-VM / 192.168.2.100. Windows policy is owned by Windows, never by this collector.

## Runtime

- Run `python -m venv ~/.hermes/venvs/ts-monitor` and install `requirements.txt` there.
- Run `~/.hermes/venvs/ts-monitor/bin/python /opt/apps/nexusit/ops/ts-monitor/ts_collector.py` as the existing Docker-authorized collector user.
- Credentials come from the NexusIT cofre record titled TS; `ts_access.py` pins its UUID to avoid accidentally selecting another host. No credentials in the repository, process argv or logs. Decryption occurs only in memory. Rotating the existing cofre password is picked up on the next poll.
- WinRM uses NTLM with message encryption required. No Basic auth, unencrypted WinRM, new firewall ports, unrestricted Zabbix system.run, scheduled tasks or Windows policy changes.
- The remote PowerShell script executes in memory. Gzip transport avoids Windows command-length limits; direct `-Command` with UTF-8 output avoids the expansion from `-EncodedCommand` and codepage errors.
- Wrapper `~/.hermes/scripts/ts_sessions_watchdog.sh` scheduled every minute by Hermes script-only cron. Healthy output is silent; violation/recovery/collection-failure transitions are messages. A local flock prevents overlap.

## Data contract

`~/.hermes/state/ts_sessions.json` is atomically replaced; the backend already mounts this directory. Snapshot keeps last successful data on failure with `status=ERROR`. Missing/stale data must not be interpreted as zero users or compliant policy. Frontend polls read-only `/api/monitoring/ts-sessions`.

WTSINFO `DisconnectTime`/`CurrentTime` supply **elapsed disconnected time**, not idle time. Sessions contain original logon time to distinguish ID reuse. Only known non-admin disconnected sessions past 30 minutes plus 120 seconds collection tolerance are OVERDUE. Unknown group membership/time is UNKNOWN. Local Administrators are identified by SID S-1-5-32-544, direct members and resolved authorization-group SIDs. Domain lookup failures remain unknown. Exemption represents administrator membership, not proof of effective GPO exclusion.

History contains actual Windows TerminalServices LocalSessionManager events 21/23/24/25, not inferred disappearance. Up to 500 events from the last 24h are read each poll, deduplicated by server/record ID in `ts_sessions_history.sqlite`, retained 30 days; API snapshot includes latest 1000. Event 23 confirms logoff but does not by itself prove its cause was the timeout policy.

Observed registry values are contextual, **not complete RSOP evidence**. Each session also includes `userMaxDisconnectionTimeMs` read from its loaded HKU policy hive when available. Null means no value observed in that specific location, not proof of no policy. Machine and RDP listener settings may differ from per-user effective policy. Validate effective GPO/user settings separately. Never disconnect a real session just to test.

## On-demand collection

`POST /api/monitoring/ts-sessions/refresh` (authenticated) creates/coalesces a fixed-host read-only collection request in the mounted state directory. `GET /api/monitoring/ts-sessions/refresh/{id}` returns QUEUED/RUNNING/SUCCEEDED/FAILED; the frontend polls once per second and loads the snapshot only after success. Missing worker/expired request fails explicitly; old data is retained but not reported as refreshed.

Install the repository `nexusit-ts-refresh.service` into `~/.config/systemd/user/`, then `systemctl --user daemon-reload && systemctl --user enable --now nexusit-ts-refresh.service`. Confirm user linger and service health. This is a **Linux** worker only, no Windows service/task installation and no new network listener or Docker socket mount in the backend. The queue only accepts a request ID; no arbitrary command or host is supplied by HTTP. The worker uses the existing cofre-backed WinRM collector, with a blocking file lock and bounded subprocess timeout; periodic collection skips overlap. Manual collection notifications are spooled under a separate lock and emitted by the existing periodic watchdog, preserving silent/transition-only WhatsApp behavior.

The backend request file is non-secret and readable by the host worker; credential material never enters queue/result files. The worker rejects unchanged/error snapshots as success. For rollback, disable this user service and restore previous backend/frontend images; keep periodic collection enabled.

Verification: `python -m unittest discover -s ops/ts-monitor -p 'test_*.py' -v`, backend Maven suite, and `node frontend/src/utils/tsRefresh.test.mjs`. Test actual POST/coalescing/new timestamps and browser click pending/success behavior against Windows; test failures using explicitly labelled fixtures, never fabricated production snapshots.

## Tests

`python -m unittest test_ts_collector -v` in this directory, plus backend `TsSessionsServiceTest` and frontend `node src/utils/tsSessions.test.mjs`.

## Rollback

Pause/remove only the TS collector job using Hermes cron (list IDs first); no Windows cleanup is needed because nothing was installed there. Restore prior NexusIT backend/frontend images to remove UI/API. Keep snapshot/event DB if an audit trail is required.
