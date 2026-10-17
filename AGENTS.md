# Edu_core Agent Instructions & Guidelines

## Active UI/UX & Module Specification
The repository follows the authoritative UI/UX, workflow, design feel, and architecture specification defined in:
- [docs/uiux-spec.json](file:///v:/Cascade/2026/Edu_core/docs/uiux-spec.json) (Specification v1.2)

### Execution Rules for Agents:
1. **Spec Compliance**: All modifications to Academic Management (AMS), ClassHub, Student 360, HR Staff Onboarding, Admissions, and the Onboarding Wizard must adhere to the rules, click budgets, and component specifications defined in `docs/uiux-spec.json`.
2. **Phase Boundaries**: Work one surface per agent task using the `implementation_order` phases as strict task boundaries. Never mix phases in a single session.
3. **Pre-edit Verification**: Before modifying any file listed in `files_in_scope`, read it in full to verify anchors and existing state.
4. **Design Feel & Anti-Excel Principles (Revision 1.2)**:
   - **Law L11**: The default tab of every 360 surface (ClassHub, Student 360, Staff 360) is a story, never a table. Renders a "Today" strip, vertical chronological activity feed with relative timestamps (`date-fns formatDistance`), colored actor chips, and needs-attention cards. Raw tables live only in scanning tabs (Roster, Directory, Exams).
   - **Law L12**: People render as people. Every student, teacher, and staff record shows an avatar (`@radix-ui/react-avatar`, already installed) with initials on a deterministic color derived from a name hash, the person's name as the loudest element, and any ID de-emphasized to `text-[11px] text-gray-400`.
   - **Laws F1-F10 & AC20**: Visual progress (sparklines, rings, SetupProgressBar), fixed semantic color palette, motion budget with existing tailwindcss-animate keyframes, human microcopy, and emotional milestones.
5. **Approved Existing Dependencies**:
   - Do NOT add new npm dependencies.
   - Use already-installed packages: `@radix-ui` primitives (dialog, tabs, select, avatar, popover, tooltip, switch, toast), `cmdk` for CommandPalette, `sonner` for toasts, `recharts` for sparklines, `tailwindcss-animate` for motion, `class-variance-authority`, `date-fns`, and `react-hook-form`.
6. **Security & DPDP Integrity**:
   - RBAC, tenant isolation, and DPDP constraints strictly take precedence over UI convenience.
   - Street-level addresses remain encrypted in `addressEncrypted`.
   - Plaintext `state`, `district`, and `pincode` columns are non-PII and used for autofill and fast filtering.
7. **School Provisioning & Tax State Migration**:
   - In Phase 10, seed default departments and designations (Teaching and Non-Teaching tracks with `isTeaching` flag set) on school registration.
   - Run a dedicated migration commit to normalize legacy `professionalTaxState` values ("DL", "KARNATAKA", etc.) into canonical state codes, nulling unmatched values for re-pick.
