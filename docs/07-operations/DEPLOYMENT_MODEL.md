# Deployment Model

## Portability

Applications are built as OCI/Docker containers.

Target architecture must be runnable on common cloud/container platforms without rewriting domain code.

## Deployables

Planned:
- web
- api
- webhook-ingress
- worker
- realtime

## Orchestration

Applications are Kubernetes-ready.

Initial production may use a simpler container orchestrator if operationally appropriate. This is a deployment decision, not an application architecture rewrite.

## Network

Databases, NATS, Valkey and internal admin infrastructure should be private wherever feasible.
