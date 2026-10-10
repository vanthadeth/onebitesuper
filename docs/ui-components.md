# Reusable OneBite UI

Import shared components from `@onebite/ui`. They use DaisyUI and the existing OneBite styles, language provider, motion and haptic system. They contain presentation and interaction behavior; pages own data, authorization and saves.

## Components

| Component | Use | Current consumers |
| --- | --- | --- |
| `NewAction` | Responsive New button, icon on mobile and label on larger screens | Sites, Users, Roles page headings |
| `ActiveStatusBadge` | Localized Active/Inactive badge with optional status dot | Site cards, user list, user details and assigned sites |
| `DirectoryTools` | Transparent search and filter controls that scroll with the page | Sites, Users, Roles |
| `DirectorySearch` | Search input and clear action | Sites, Users, Roles |
| `DirectoryStatusFilter` | Localized Active/Inactive/All buttons | Sites, Users |
| `DirectorySegments` | Generic exclusive filter buttons | Role types; implementation of status filters |
| `CardHeading` | Icon, h2, description and optional trailing action/badge | Profile cards and role cards |
| `IdentitySummary` | Avatar, account name and supporting information | Account edit, assignment and PIN-reset dialogs |
| `InlineError` | Error live region with optional recovery action | Auth, account, site, role and settings forms |
| `PinInput` | Masked six-digit entry with app keypad and physical-keyboard support | Sign-in, Owner setup and mandatory PIN change |
| `GeneratedPinField` | Read-only generated PIN, regenerate, copy and feedback | Account creation and PIN reset |
| `UserAvatar` | Image cropping and initials fallback, including failed-image fallback | Profile, account menu and account avatars |
| `PageHeading` | Pinned title/subtitle and action; compacts while scrolling | All Admin pages |
| `AppDialog` | Modal/sheet with fixed heading/footer and focus restoration | All editors |
| `EmptyState` | Illustration, explanation and optional creation/recovery actions | Directories, logs and Hub |
| `SelectField`, `SwitchField`, `CheckField` | Accessible Radix controls | Forms and permissions |

## Directory pattern

```tsx
const [status, setStatus] = useState<DirectoryStatus>('active');
const [query, setQuery] = useState('');

<PageHeading
  title={t('សាខា', 'Site')}
  subtitle={t('គ្រប់គ្រងសាខា។', 'Manage sites.')}
  action={canCreate ? <NewAction label="New Site" disabled={!online} onClick={createSite}/> : undefined}
/>
<DirectoryTools>
  <DirectorySearch label="Search sites" placeholder="Search name or location…" value={query} onChange={setQuery}/>
  <DirectoryStatusFilter label="Site status" value={status} onChange={setStatus}/>
</DirectoryTools>
```

Use the language provider to translate labels. Page headings sit flush below the measured app bar and compact after scrolling: the title shrinks, the subtitle collapses and actions retain a 44-pixel touch target. They expand again at the top. Search and filter controls follow normal page scrolling. Callers filter only the data they are authorized to view. Roles use All/Built-in/Custom segments because roles do not have an active status.

## Actions, cards and feedback

```tsx
<NewAction label="Create new user" visibleLabel="New User" onClick={createUser}/>
<ActiveStatusBadge active={account.active}/>
<CardHeading title="Account security" icon={<ShieldCheck/>} description="Keep your account secure."/>
<IdentitySummary name={account.name} detail={`@${account.username}`} avatar={<AccountAvatar id={account.id} name={account.name}/>}/>
<InlineError message={error} recovery={retryButton}/>
```

`CardHeading` accepts `className`, `iconClassName` and `copyClassName` for existing card variants. Its base CSS has low specificity so feature styles win. Supply an `id` when the card uses `aria-labelledby`.

## PIN boundary

```tsx
const [pin, setPin] = useState(generateTemporaryPin);
<GeneratedPinField
  label="Temporary 6-digit PIN"
  value={pin}
  disabled={saving}
  onRegenerate={() => setPin(generateTemporaryPin(pin))}
/>
```

`GeneratedPinField` never generates, saves or stores a PIN. The Admin helper `apps/admin/src/temporary-pin.ts` uses Web Crypto, rejection sampling and the existing `validStaffPin` policy. Forms own the PIN in memory and pass it to their existing authorized save actions. Clipboard feedback is tied to the copied value so a late clipboard result cannot mark a regenerated PIN as copied.

Private photo loading stays in Admin's `AccountAvatar`/`UserPhotoProvider`; the shared UI does not know session tokens, API routes or Supabase paths. New and recovery actions are supplied only when authorized. UI components are not permission enforcement.

## Review notes

The review found repeated markup and interaction state for these patterns, particularly duplicate PIN-copy handling and responsive New buttons inside `AccessApp`. These are now shared and adopted by the existing pages. Existing directory controls, avatar loading, dialogs and empty states were reused rather than duplicated.

`AccessApp` still coordinates authentication, authorization, editor state and page selection. Splitting that coordinator into page controllers is a separate architectural change; this refactor keeps its security-sensitive behavior intact. The full Admin browser suite and Pages tests remain the integration checks for these components.

## PIN entry

```tsx
<PinInput label="6-digit PIN" value={pin} onChange={setPin} disabled={busy}/>
```

The masked input uses `inputMode="none"` to suppress the device keyboard while retaining ordinary physical typing, Backspace, paste, password-manager fill and Enter submission. The app keypad provides digits, clear and delete without submitting the form. Values stay in the parent and are limited to six ASCII digits. No auto-submit, logging or persistence is added. In forms with multiple PIN fields, pass `active` and `onActivate` so only the selected field shows its keypad. Authentication and PIN-policy validation remain in the form and backend.


## Shared workspace and account entry

`@onebite/ui/workspace.css` and `workspace-framework.css` provide the same workspace, sidebar, mobile navigation, form and card foundations for Admin and Inventory. Import them in the same order as Admin, with controls, polish and motion. `@onebite/accounts` exports the shared seven-day session API, app PIN `AuthForm`, and Owner-only `MfaChallenge`. Callers still authorize their own module actions. `AppTitleBar` accepts `offlineWrites` for apps that persist an outbox; Admin keeps its read-only offline status wording.

`useScrollHidden(page)` shares the mobile navigation scroll behavior across Admin and Inventory. Apply its result to the nav class, `inert`, and `aria-hidden`, and retain `access-bottom-nav-region` so the page does not shift.
