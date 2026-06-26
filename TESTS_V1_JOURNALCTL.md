# Melonela V1 - Tests manuels journalctl

## Lancer les services

Depuis la racine du projet :

```bash
docker compose up -d database
```

Backend :

```bash
cd backend
npm run dev
```

Frontend :

```bash
cd frontend
npm run dev
```

Si Vite échoue à cause des watchers Linux, utiliser temporairement :

```bash
npm run preview
```

## Démarrer le live journalctl

Se connecter dans Melonela avec un compte `admin` ou `super_admin`, récupérer le JWT, puis appeler :

```bash
curl -X POST "http://localhost:5000/api/ingest/journalctl/start" \
  -H "Authorization: Bearer <TOKEN>"
```

Réponse attendue :

```json
{
  "message": "Suivi journalctl -f démarré",
  "started": true,
  "status": {
    "running": true,
    "startedAt": "2026-06-26T20:00:00.000Z",
    "processedCount": 0,
    "rejectedCount": 0,
    "lastError": null
  }
}
```

Le backend garde alors un processus `journalctl -f --no-pager -o json` ouvert. Chaque nouveau log est normalisé, stocké dans PostgreSQL, puis diffusé par Socket.io.

Alias conservé :

```bash
curl -X POST "http://localhost:5000/api/ingest/journalctl/collect" \
  -H "Authorization: Bearer <TOKEN>"
```

## Vérifier ou arrêter le live

```bash
curl "http://localhost:5000/api/ingest/journalctl/status" \
  -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -X POST "http://localhost:5000/api/ingest/journalctl/stop" \
  -H "Authorization: Bearer <TOKEN>"
```

## Lire les logs système

```bash
curl "http://localhost:5000/api/audit-logs?page=1&limit=20&severity=high&search=ssh" \
  -H "Authorization: Bearer <TOKEN>"
```

Cette route lit uniquement `system_event_logs`.

## Vérifier PostgreSQL

```bash
docker exec -it melonela_postgres psql -U melonela_user -d melonela_db \
  -c "SELECT id, source_type, event_type, severity, message FROM system_event_logs ORDER BY id DESC LIMIT 10;"
```

## Tester WebSocket

Ouvrir le dashboard React, section **Historique Live**, puis cliquer sur **Démarrer journalctl live**.

Chaque log inséré doit apparaître via l'événement Socket.io :

```text
system_event_created
```

## Séparation des journaux

- **Historique Live** : logs système stockés dans `system_event_logs`, route `/api/audit-logs`.
- **Journal d'actions** : actions des utilisateurs Melonela stockées dans `user_action_logs`, route `/api/user-actions`.
