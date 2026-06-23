# BookGrok Data Model v8.4

The underlying data model for BookGrok. This is the conceptual schema the whole product rests on. In v8.4 it is implemented as two flat CSV tables (Google Sheets). The model is designed so that the same entities carry forward unchanged when the backend later becomes a real database (Supabase + Postgres).

---

## 1. Core entities

```
TRACK ──< SESSION
  │
  ├──< REGISTRATION (member ↔ track)
  │
  └── HOST (denormalized into track for v8.4)
```

Five conceptual entities. In v8.4 only two are physical tables (Track, Session). Registration lives in Google Form responses. Host is denormalized into Track. Member exists only as a Form response row.

---

## 2. Entity: TRACK

A single complete book offered as a structured reading cohort. The central object in the product.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | slug | yes | Stable identifier. Lowercase, hyphens. Used in access URL. |
| status | enum | yes | `published` / `draft` / `archived`. Only `published` shows publicly. |
| sortOrder | integer | yes | Display order on homepage. |
| title | string | yes | Book title. |
| author | string | yes | Book author(s). |
| category | string | yes | Thematic shelf (e.g. Technology & Society, Philosophy). |
| host | string | yes | Host display name. |
| hostRole | string | yes | One-line host credential. |
| hostLinkedIn | url | no | Host LinkedIn profile. Stored now, not linked in v8.4 (feature-flagged for later). |
| spotsLeft | integer | yes | Remaining capacity. Manually maintained. |
| spotsTotal | integer | yes | Cohort cap (typically 8). |
| sessionCount | integer | yes | Number of sessions in the track. |
| cadence | string | yes | Human-readable schedule (e.g. "Weekly, Mondays"). |
| price | string | yes | Mock price. v8.4 flat `$9`. |
| bookCoverUrl | url | no | Public image. Fallback to initials if blank/invalid. |
| hostPhotoUrl | url | no | Public image. Fallback to initials if blank/invalid. |
| buyBookUrl | url | no | Purchase link. Access page only. Hidden if blank. |
| formUrl | url | yes | Google Form registration. |
| homeworkFormUrl | url | no | Google Form homework upload. Hidden if blank. |
| communityPlatform | string | no | e.g. "Slack". Hidden if blank. |
| communityChannelName | string | no | e.g. "#nexus-cohort". |
| communityUrl | url | no | Direct invite. If blank, show instructions instead. |
| communityInstructions | string | no | Shown when communityUrl blank. |

**Derived (not stored):**
- `startDate` — computed from the earliest published session's `datetimeUTC`.
- `spotsPercent` — computed from `(spotsTotal - spotsLeft) / spotsTotal`.

---

## 3. Entity: SESSION

A single meeting within a track — one chapter or reading block discussed live.

| Field | Type | Required | Notes |
|---|---|---|---|
| trackId | slug (FK) | yes | Must match a Track `id`. |
| number | integer | yes | Session order within the track. |
| chapters | string | yes | Reading assignment / description. |
| datetimeUTC | ISO UTC | yes | Always ends in `Z`. Converted to local time client-side. |
| durationMins | integer | yes | Used to compute calendar end time. |
| meetLink | url | yes | Google Meet. Access page only — never public. |
| calTitle | string | yes | Calendar event title. |
| calDescription | string | yes | Calendar event body. |
| status | enum | yes | `published` / `draft` / `cancelled`. Only `published` shows. |

**Relationship:** Track 1 ──< many Session. Join key is `trackId` → `id`.

---

## 4. Entity: REGISTRATION (logical only in v8.4)

A member's commitment to a track. In v8.4 this is a Google Form response row, not a table the site reads.

| Field | Type | Source |
|---|---|---|
| firstName | string | Form Q1 |
| email | email | Form Q2 |
| motivation | string | Form Q3 ("What have you tried before that didn't work?") |
| trackId | implicit | One form per track |
| timestamp | datetime | Form auto |

The site does not read registrations. The host reads them in the Google Sheet. This is the boundary where v8.4 stays no-backend.

---

## 5. Entity: HOST (denormalized in v8.4)

A facilitator. In v8.4, host fields live inside the Track row. When the model becomes relational, Host becomes its own table and Track references `hostId`.

| Field | Type | v8.4 location |
|---|---|---|
| name | string | track.host |
| role | string | track.hostRole |
| linkedIn | url | track.hostLinkedIn |
| photoUrl | url | track.hostPhotoUrl |

**Why denormalized now:** one host per track in the mock, no host directory, no host login. Splitting it out adds a join with zero benefit at this stage.

---

## 6. Entity: MEMBER (logical only)

A reader. In v8.4 a member is just an email in a Form response. No member object, no login, no profile, no cross-track identity. This is deliberate — member state is the first thing the next version adds.

---

## 6b. Entity: SEARCH_QUERY (logical only — demand signal)

A not-found homepage search. When a visitor searches for a book BookGrok does not offer, the raw query is logged to a dedicated "search log" Google Form, landing in its own response Sheet. The site does not read this back — it is write-only demand capture.

| Field | Type | Source |
|---|---|---|
| query | string | Search input (raw, logged on 1.2s debounce when results = 0) |
| timestamp | datetime | Form auto |

**Why it matters:** registrations measure demand for what exists; search-not-found measures demand for what doesn't. A recurring missed title is a direct, unprompted signal for the next track to add. This is the cheapest possible product-roadmap input.

**Config dependency:** the destination is `SEARCH_LOG` in `src/search.js` (form action URL + entry ID). A separate `CONFIG.requestBookUrl` points the empty-state "request this book" link at a richer Google Form if a visitor wants to actively ask rather than just search.

---

## 7. Relationships summary

| From | To | Cardinality | Join key | Physical in v8.4? |
|---|---|---|---|---|
| Track | Session | 1 to many | track.id = session.trackId | Yes (CSV) |
| Track | Host | many to 1 | denormalized | No (inlined) |
| Member | Track | many to many | Form response | No (Form) |
| Track | Registration | 1 to many | one form per track | No (Form) |
| SearchQuery | — | standalone | none | No (Form, write-only) |

---

## 8. Field visibility rules (security-critical)

The model enforces a public/gated split. Some fields must never reach the public homepage.

| Field | Homepage (public) | Access page (gated) |
|---|---|---|
| title, author, category | ✅ | ✅ |
| host, hostRole, hostPhotoUrl | ✅ | ✅ |
| hostLinkedIn | stored, not rendered | stored, not rendered |
| sessionCount, cadence, startDate | ✅ | ✅ |
| spotsLeft, spotsTotal, price | ✅ | — |
| bookCoverUrl | ✅ | ✅ |
| formUrl (Register) | ✅ | — |
| Share button | ✅ | ✅ |
| session.chapters, session.datetimeUTC | ✅ (schedule) | ✅ |
| **session.meetLink** | ❌ NEVER | ✅ |
| **calendar links** (embed meetLink) | ❌ NEVER | ✅ |
| **homeworkFormUrl** | ❌ NEVER | ✅ |
| **communityUrl / instructions** | ❌ NEVER | ✅ |
| **access page URL** | ❌ NEVER | (is the page) |

The rule: anything that grants entry to the live cohort (Meet link, calendar with embedded Meet link, homework, Slack) is gated. Everything that helps a visitor evaluate and decide is public.

---

## 9. Lifecycle states

**Track:** draft → published → archived
**Session:** draft → published → cancelled
**Registration:** submitted (terminal in v8.4)

No state machine enforcement in v8.4 — states are just filter values. The renderer shows only `published`.

---

## 10. Forward compatibility

When this becomes a real backend, the migration is clean:

| v8.4 (CSV) | Next version (Postgres) |
|---|---|
| tracks.csv | `tracks` table |
| sessions.csv | `sessions` table |
| Form responses | `registrations` table |
| Inlined host fields | `hosts` table + `track.host_id` FK |
| Email-as-identity | `members` table + auth |
| spotsLeft manual | computed from registrations count |
| Share button (copy URL) | referral tracking with attribution |
| Search-log Form | `search_queries` table + analytics on demand |

No entity needs to be renamed or restructured. The conceptual model is stable; only the storage and the enforcement layer change.
