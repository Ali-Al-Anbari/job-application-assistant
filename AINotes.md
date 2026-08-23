# AI-Assisted Development Notes

## Chrome Extension Setup

### Task
Turn the React + Vite project into a basic Chrome extension.

### What I asked AI
I asked Copilot to plan the smallest way to make the React app open as a Chrome extension popup.

I told it not to add:
- extra permissions
- background scripts
- content scripts
- new dependencies

### What AI suggested
Copilot suggested adding only:

`public/manifest.json`

### What I accepted
I accepted the simple approach.

### What I changed or rejected
Nothing needed to be changed.

### Testing
- `npm run lint`
- `npm run build`
- Loaded the `dist` folder in Chrome
- Confirmed the React app opened correctly

---

## Popup + Dashboard Setup

### Task
Create separate popup and dashboard pages.

### AI Usage
Copilot helped plan and create the two-page Vite setup.

### Decision
Used separate `index.html` and `dashboard.html` pages instead of React Router.

### Why
The popup and dashboard are separate interfaces, so routing was unnecessary.

### Testing
- Ran `npm run lint`
- Ran `npm run build`
- Confirmed both pages were generated
- Confirmed the popup worked in Chrome
- Confirmed the dashboard worked in Chrome

---

## Open Dashboard Button

### Task
Add a button to the popup that opens the dashboard in a new tab.

### AI Usage
Copilot planned and implemented the simplest Chrome API approach.

### Decision
Used the Chrome tabs API to open `dashboard.html`.

### Testing
- Confirmed the popup still opens
- Confirmed the button opens the dashboard in a new tab

## Job Table Setup

### Task
Create the first dashboard table using sample job data.

### AI Usage
Copilot helped plan and implement the basic table structure.

### Decision
Kept the sample data and table directly in `Dashboard.jsx`.

### Why
The table is still simple, so splitting it up would add unnecessary complexity.

### Testing
- Dashboard displays 5 sample jobs
- `npm run lint` passed
- `npm run build` passed

---

## Persistent Job Storage

### Task
Store job applications using Chrome extension storage.

### AI Usage
Copilot planned the storage setup using `chrome.storage.local`.

### Change I made
Copilot originally suggested seeding sample jobs whenever the stored array was empty.

I changed that logic so sample jobs are only added if the `jobs` key does not exist. An empty array could mean the user intentionally deleted all jobs, so the sample jobs should not automatically come back.

### Testing
- Extension builds and lints successfully
- Sample jobs remain after reloading the dashboard

---

## Manual Job Creation

### Task
Allow users to manually add job applications through dashboard.

### AI Usage
Copilot planned and implemented the form and Chrome storage update.

### Change I made
Made sure existing jobs safely default to an empty array if the storage key is missing.

### Decision
Kept the form inside `Dashboard.jsx` instead of creating another component.

### Testing
- Added a new application
- New job appeared immediately in the table
- Job remained after refreshing
- Required fields prevent invalid submissions
- Lint and build passed

---

## Edit and Delete Jobs

### Task
Allow users to edit and delete saved job applications.

### AI Usage
Copilot planned and implemented the update and delete logic.

### Decision
Reused the existing form for both adding and editing instead of creating a second form.

### Testing
- Edited a job and confirmed the changes persisted
- Confirmed canceling a delete keeps the job
- Deleted a job and confirmed it stayed deleted after refresh
- Confirmed adding jobs still works

---

## Search and Status Filtering

### Task
Add search and status filtering to the dashboard.

### AI Usage
Copilot planned and implemented the filtering logic.

### Decision
Filtered the existing `jobs` array during render.

### Change I made
Made the location search handle missing values safely.

### Testing
- Search works for company, role, and location
- Search is case-insensitive
- Status filtering works
- Search and status filtering work together
- Lint and build passed

---

## Job Page Extraction

### Task
Extract job information directly from the current webpage.

### AI Usage
Copilot helped design and implement JSON-LD extraction and a LinkedIn-specific fallback.

### What I changed
The original generic LinkedIn selectors were unreliable. I inspected LinkedIn's DOM using DevTools and found the selected job pane using the current job ID and its closest `lazy-column` container.

### Decision
Use this extraction priority:
1. JobPosting JSON-LD
2. LinkedIn-specific extraction
3. Generic fallback

### Testing
- Structured job page extracted correctly
- LinkedIn extracted role, company, location, description, and clean URL
- Description formatting and location cleanup were improved
- Lint and build passed

---

## Popup UI Redesign

### Task
Make the extension popup smaller and easier to use.

### AI Usage
Copilot helped redesign the popup and inline editing UI.

### Changes
- Removed duplicate editable fields
- Added inline editing
- Removed URL and date from the popup
- Made the popup more compact
- Improved description and notes display

### Issue Found
The first CSS cleanup caused the Chrome popup height to collapse.

### Fix
Removed fixed viewport sizing and allowed the popup height to follow its content naturally.

### Testing
Confirmed extraction, editing, saving, and popup sizing still work.

---

## Dashboard UI Redesign

### Task
Make the dashboard more visually pleasing and in tune with popup. Also make
the information more accessible.

### AI Usage
AI helped plan the dashboard redesign and identify layout issues as I tested the UI.

### Changes
- Kept the dark theme with purple accents.
- Replaced Edit and Delete text buttons with SVG icons.
- Added an external-link icon for opening the original job posting.
- Added status badges for easier scanning.
- Displayed notes directly in the table.
- Allowed locations to wrap instead of truncating important information.
- Show up to two lines of a note in the table.
- Added a note viewer for reading the full note.
- Kept action icons together in a fixed Actions column.

### Issue Found
Long notes made table rows taller, which caused the Actions column divider to become misaligned.

### Fix
keep the table cell as a normal table cell and place the action icons inside a separate flex wrapper.

### Testing
Confirmed editing, deletion, notes, and urls worked as intended.