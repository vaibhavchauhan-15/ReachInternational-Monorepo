# Antigravity Agent Behavioral & Cross-Platform Rules — `.agents/rules/`

This directory contains workspace-level customization rules for AI agents operating in the ReachInternational monorepo. These rules govern agent behavior, cross-platform parity, responsive layout enforcement, and multi-agent coordination.

## Rules Index

| Rule File | Focus Area | Key Mandates |
|---|---|---|
| [`mandatory_rules_reading_and_enforcement.md`](./mandatory_rules_reading_and_enforcement.md) | Agent Entrypoint | Mandatory 8-step rule reading protocol required at the start of every session |
| [`multi_agent_engineering_team.md`](./multi_agent_engineering_team.md) | Multi-Agent Team | 5 specialized agent personas (Lead Architect, Web, Mobile, Database, QA) and coordination protocols |
| [`web_mobile_parity.md`](./web_mobile_parity.md) | Cross-Platform Parity | Zero-drift policy across all 8 parity dimensions (UI/UX, Behavior, Responsiveness, Design, Layout, Color, Theme, Typography) |
| [`web_mobile_ui_consistency.md`](./web_mobile_ui_consistency.md) | Visual Consistency | Strict Vercel Geist design tokens, 1px hairline borders, `#0284c7` sky blue, and bimodal border radius |
| [`global_responsive_design.md`](./global_responsive_design.md) | 3-Tier Viewports | Mobile (≤640px touch cards), Tablet (641–1023px 2-col grids), Desktop (≥1024px high-density tables) |
| [`responsive_cross_platform_design.md`](./responsive_cross_platform_design.md) | Responsive Design | Fluid typography, container constraints, touch targets (≥44px), and adaptive component trees |
| [`native_backend_architecture.md`](./native_backend_architecture.md) | Native Mobile Backend | TanStack Query server caching, hardware SecureStore tokens, offline mutation queue, and haptics |
| [`testing_standards_and_enforcement.md`](./testing_standards_and_enforcement.md) | QA Quality Gates | Mandatory adherence to centralized testing standards in `rules/testing/` |

## Relationship to Monorepo Architecture

```text
AGENTS.md (Root Engineering Rules)
│
├── AI/RULES/                               ← 15 Authoritative System Rules (Architecture, Security, Performance)
├── rules/testing/                          ← 15 Centralized Monorepo Testing Standards (00–14)
├── security/                               ← 11 Security Baseline Documents
└── .agents/rules/                          ← YOU ARE HERE (Agent Behavioral & Cross-Platform Guidelines)
    └── .agents/skills/                     ← 44 Specialized Agent Skills
```
