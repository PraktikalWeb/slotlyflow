# Role Permissions

| Permission | OWNER | ADMIN | AGENT |
|---|---:|---:|---:|
| organization.read | yes | yes | yes |
| organization.update | yes | yes | no |
| membership.read | yes | yes | no |
| membership.invite | yes | yes | no |
| membership.update_role | yes | limited | no |
| membership.remove | yes | limited | no |
| billing.read | yes | no | no |
| billing.manage | yes | no | no |
| whatsapp.read | yes | yes | no |
| whatsapp.manage | yes | yes | no |
| automation.read | yes | yes | no |
| automation.edit | yes | yes | no |
| automation.publish | yes | yes | no |
| conversation.read | yes | yes | yes |
| conversation.reply | yes | yes | yes |
| handoff.accept | yes | yes | yes |
| handoff.complete | yes | yes | yes |
| analytics.read | yes | yes | no |

"limited" requires explicit safeguards preventing protected owner changes.

This matrix is the default MVP policy and can only change through an explicit product/security decision.
