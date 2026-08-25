# Backup and Recovery

## PostgreSQL

Required production capabilities:
- automated backups;
- point-in-time recovery;
- retention policy;
- documented restore procedure;
- periodic restore test.

## Object storage

Use versioning/retention/lifecycle policy appropriate to product requirements.

## Events/projections

Analytical/read projections should be rebuildable from authoritative state/events where designed that way.

## Recovery principle

A backup that has never been restored is not considered proven recovery.
