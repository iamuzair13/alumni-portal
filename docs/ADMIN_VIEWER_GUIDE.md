# Admin & Viewer Guidance — Alumni Portal

## Purpose
This guide explains what **Admin Users** (not Superadmin) and **Viewers / Read-Only Users** can do inside the Alumni Portal, including key permissions and how the system behaves.

## Who this guide is for
- **Admin Users (NOT Superadmin)**
- **Viewers / Read-Only Users**

---

# Admin User Capabilities
Admins manage applications, content, and alumni records within controlled permissions.

## Application Management
Admins can:
- View all submitted applications
- Filter applications by role, type, and status
- Search applications
- Open full application details
- Approve applications
- Mark applications as **Not Approved**
- Manually send decision emails

### Important notes
- Approval / rejection actions update system state immediately
- Decision emails are **manual** (not automatic)
- Status changes are tracked by the system

## Filters & Search
Admins can refine data using:
- Leadership Type filters (Chapter / Association)
- Role filters (President / Vice President / Coordinator)
- Status filters (Pending / Approved / Not Approved)
- Search bar (name, email, registration number, etc.)

Filters affect:
- Visible data
- Excel exports

## Excel Export
Admins can export filtered datasets.

Rules:
- Export respects active filters
- Export includes visible records only
- Export includes application details

## Leadership & Badges
Admins can:
- View assigned leadership roles
- See role badges (**approved roles only**)
- Track leadership application history

Badge visibility rules:
- Only **approved** roles generate badges
- Pending / rejected roles do **not** display badges

## Distinguished Alumni Management
Admins can:
- Add distinguished alumni entries
- Edit existing entries
- Manage Story & Achievements content
- Control publishing state

Publishing rules:
- If **published**: visible externally
- If **not published**: hidden or limited display

## Manual Emails
Admins may manually send:
- Approval emails
- Rejection emails
- Credential emails (existing password only)

Important:
- The system does **not** auto-generate new passwords

## Password Handling (Important)
For alumni accounts:
- Passwords use **plain text comparison**
- No hashing is applied for alumni

Admins should avoid altering passwords unintentionally.

---

# Restrictions for Admin Users
Admins cannot:
- Modify system-level configurations
- Change core role definitions
- Alter database schema
- Override Superadmin controls

---

# Viewer / Read-Only User Capabilities
Viewers have observation-only permissions.

## Allowed Actions
Viewers can:
- View records & data
- Navigate pages & tabs
- Use filters & search
- Open details (if permitted)

## Restricted Actions
Viewers cannot:
- Approve / reject applications
- Edit data
- Export datasets (if restricted)
- Send emails
- Modify profiles or settings

---

# System Behavior & Best Practices

## Data visibility
Displayed data depends on:
- User role
- Filters applied
- Record status
- Publish state (where applicable)

## Counters & badges
Counters and badges are:
- Dynamic
- System-calculated
- Automatically updated

Manual manipulation is not required.

## Safe usage recommendations
Admins and viewers should:
- Verify filters when data seems missing
- Confirm status before actions
- Avoid duplicate approvals
- Review content before publishing

---

# Common Confusions (Quick Answers)
- **“Why is data not visible?”**
  - Check filters and status conditions.

- **“Why is the badge not shown?”**
  - Badges require **approved** leadership roles.

- **“Why is the story not shown externally?”**
  - It is likely **unpublished** or missing required HTML/content.

---

# Summary
- **Admins** manage operations and decisions.
- **Viewers** observe and review data.
- **System logic** governs counters, badges, and visibility.
