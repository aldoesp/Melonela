# Melonela RBAC

## Roles

Melonela supports four roles:

- `user`: standard account.
- `auditor`: audit operator.
- `admin`: platform administrator.
- `super_admin`: unrestricted administrator.

## Permissions

| Capability | user | auditor | admin | super_admin |
| --- | --- | --- | --- | --- |
| View own audit logs | yes | yes | yes | yes |
| View all audit logs | no | yes | yes | yes |
| Use audit filters | own logs only | yes | yes | yes |
| Export JSON/CSV/PDF reports | no | yes | yes | yes |
| View and update own profile | yes | yes | yes | yes |
| Change own password | yes | yes | yes | yes |
| List users | no | no | yes | yes |
| Update users | no | no | yes | yes |
| Disable users | no | no | yes | yes |
| Assign `user` / `auditor` roles | no | no | yes | yes |
| Assign `admin` / `super_admin` roles | no | no | no | yes |

## Backend Enforcement

Protected routes use JWT authentication first, then `requireRole([...])` where elevated permissions are required.

- `/api/profile`: authenticated users.
- `/api/audit-logs`: authenticated users; `user` is scoped to own logs, elevated roles can view all logs.
- `/api/export/json`, `/api/export/csv`, `/api/export/pdf`: `auditor`, `admin`, `super_admin`.
- `/api/users`: `admin`, `super_admin`.

All sensitive mutations are recorded in `user_action_logs`.
