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