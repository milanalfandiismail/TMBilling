# Full Role-Based (Admin & Kasir) Multi-Tab & Multi-Entity CRUD + Styling Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Conduct an exhaustive role-based (Admin & Kasir) audit across all tabs, execute full CRUD lifecycles for core entities (PC, Paket, Member, Grup, Menu, Catatan, Turnamen, Maintenance), audit RBAC boundaries, and refine styling to ensure zero visual defects and strict antislop compliance.

**Architecture:** 
- Playwright MCP for interactive browser automation across both Admin and Kasir authentication states.
- Codebase-Memory MCP for schema inspection and endpoint tracing.
- Python backend test suite (pytest) for regressions verification.

**Tech Stack:** Flask, Jinja2, Vanilla JS, TailwindCSS v3 (Chamber Noir Dark Theme), Playwright MCP, Codebase-Memory MCP.

---

## Tasks

### Task 1: Admin Role Comprehensive CRUD Life-Cycle Validation
- **Entities Tested**:
  1. PC (`API.pc.create`, `edit`, `delete`)
  2. Paket (`API.paket.create`, `edit`, `delete`)
  3. Member (`API.member.create`, `topup`, `delete`)
  4. Grup (`API.grup.create`, `edit`, `delete`)
  5. Menu (`API.menu.create`, `restock`, `delete`)
  6. Catatan (`API.catatan.create`, `edit`, `delete`)
  7. Turnamen (`Tournament.handleCreate`, `handleDelete`)
  8. Maintenance (`API.maintenance.createTicket`, `deleteTicket`)
- **Execution**: Run browser-driven creation, verification in DOM tables/grids, and cleanup.

### Task 2: Kasir Role Boundary & Operational Audit
- **Authentication**: Switch session / login as `kasir` (password: `kasir`).
- **Sidebar Inspection**: Confirm all admin groups (Staff, Server/Hardware, Cabang, Sistem, Pengaturan) are hidden from DOM.
- **RBAC Bypass Protection**: Try calling `App.switchTab(adminTab)` for restricted tabs; verify immediate block with Toast and redirect to Dashboard.
- **Kasir Operational Verification**:
  1. Dashboard PC Grid view and Buka Sesi / Billing initiation.
  2. Kantin / POS order entry.
  3. Member list & Topup saldo.
  4. Riwayat & Struk view.
  5. Catatan shift reading/writing.

### Task 3: Styling & Antislop Compliance Audit
- **Chamber Noir Consistency**: Background `#050505`, card container `#0c0c0c`, border `#1c1c1c`.
- **Text & Contrast**: No low-contrast grey-on-grey text, all text passes WCAG AA.
- **Copywriting Cleanliness**: Zero em dashes (`—`) across all user-facing interfaces.
- **Responsive Layout**: Verify 1280px desktop and 375px mobile viewport with zero horizontal overflow.

### Task 4: Final Test Suite & System Integrity
- **Playwright Console**: Verify 0 errors.
- **Backend Tests**: Run full pytest suite (271 specs) and ensure 100% pass rate.
