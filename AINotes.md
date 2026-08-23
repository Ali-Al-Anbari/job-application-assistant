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
Make the dashboard more visually pleasing and in tune with popup. Also makethe information more accessible.

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

---

## Email Auth

### Task
Connect the dashboard to Gmail using Google OAuth and verify that the connection works.

### AI Usage
AI helped plan the dashboard redesign and identify layout issues as I tested the UI.

### Changes
- Used chrome.identity.getAuthToken() for authentication.
- Used the gmail.metadata scope instead of broader Gmail permissions.
- Used GET /gmail/v1/users/me/profile as the first verification request.
- Kept OAuth tokens in memory and relied on Chrome to manage the cached token.
- Did not store access tokens in chrome.storage.local.
- Did not add a backend for the initial Gmail connection.
- Added a non-interactive authentication check when the dashboard loads so an existing Gmail connection is restored automatically.

### Issue Found
The first implementation only stored the Gmail connection state in React state.

After refreshing the dashboard, the UI returned to "Connect Gmail" even though Chrome still had a valid cached OAuth token.

### Fix
Called chrome.identity.getAuthToken({ interactive: false }) when the dashboard loads and verified the cached token with the Gmail profile endpoint.

### Testing
Connected Gmail through the Google OAuth flow. 
Verified the Gmail profile request succeeds.
Confirmed the connected Gmail address is displayed.
Confirmed refreshing the dashboard restores the Gmail connected state without opening another login prompt.
Confirmed existing job tracking features still work.

---

## Gmail Email Detection

### Task

Check recent Gmail messages and identify emails that may be related to job applications.

### AI Usage

AI helped plan the Gmail API requests, decide what email data to retrieve, and create a simple method for identifying potentially job-related emails.

### Changes

- Added a user-controlled Check Gmail button instead of scanning Gmail automatically.
- Limited each check to the 15 most recent emails.
- Used the existing gmail.metadata scope.
- Retrieved only the Subject, From, and Date metadata.
- Used simple keyword matching to identify potentially job-related emails.
- Used Promise.allSettled() so one failed email request does not stop the entire scan.
- Kept retrieved Gmail data in React state instead of saving it to chrome.storage.local.
- Did not retrieve email bodies or attachments.
- Did not automatically change any job application statuses.

### Issue Found

The Check Gmail button was displayed underneath the Gmail connection information, which made the dashboard header look awkward.

### Fix

Grouped the Gmail account information separately and changed the connected Gmail layout to use a horizontal flex direction so the Check Gmail button appears next to the connection information.

### Testing

Confirmed Check Gmail retrieves recent message metadata.
Confirmed likely job-related emails are displayed in the dashboard.
Confirmed individual message failures do not stop the entire scan.
Confirmed Gmail message data is not saved to chrome.storage.local.
Confirmed checking Gmail does not modify existing applications.
Confirmed the Gmail connection information and Check Gmail button display correctly together.