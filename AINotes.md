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

---

## Gmail Application Review Workflow

### Task

Improve the Gmail workflow so application emails can be reviewed one at a time, acted on safely, and not repeatedly shown after they have already been handled.

### AI Usage

AI helped redesign the Gmail review flow, simplify the status-update rules, identify persistence issues with repeated emails, and plan a safer confirmation and undo process.

### Changes

- Removed the strict status progression rule so confirmed updates can move between statuses in either direction.
- Allowed updates such as Interview to Assessment when the user explicitly confirms the change.
- Added an Add Application option for unmatched Application Received emails.
- Reused the existing application form instead of creating a separate job-creation flow.
- Added automatic dateApplied handling for newly added Applied jobs when no date is provided.
- Fixed the dashboard add/edit flow so the calculated dateApplied value is actually saved.
- Added processed Gmail message ID storage so handled emails do not appear again on later Gmail checks.
- Stored only Gmail message IDs and did not persist email subjects, senders, bodies, or classifications.
- Added a Skip for now option that removes an email from the current review queue without permanently marking it as handled.
- Changed the Gmail review area to show one email suggestion at a time instead of displaying every suggestion at once.
- Added Ignore behavior that permanently marks the current Gmail message as handled.
- Added Confirm Update behavior that updates the selected job and permanently marks the email as handled.
- Added a temporary Undo option for the most recent confirmed update.
- Kept Undo state in React only so it disappears when the page is refreshed.
- Restored the previous job data and Gmail suggestion when Undo is used.

### Issue Found

Handled Gmail messages were appearing again every time Check Gmail was clicked because suggestion state only existed in memory.
The dashboard also became crowded when several Gmail suggestions were displayed at the same time.
The existing status-order protection was too restrictive because real hiring processes do not always follow a fixed progression.
The manual Add Application flow also calculated a default application date but did not always save that calculated value.

### Fix

Persisted only processed Gmail message IDs in chrome.storage.local and filtered those messages out during future Gmail scans.
Changed the Gmail suggestion interface into a one-at-a-time review queue with Confirm Update, Skip for now, and Ignore actions.
Removed the strict status-ranking restriction and relied on explicit user confirmation before changing a tracked job.
Updated the application submit flow to use the calculated dateApplied value when creating or editing an application.
Added temporary Undo state that restores the previous job data, removes the Gmail message from processed IDs, and returns the suggestion to the review queue.

### Testing

Confirmed Interview to Assessment updates can be manually approved.
Confirmed Assessment to Interview updates can be manually approved.
Confirmed unmatched Application Received emails can open the Add Application flow.
Confirmed newly created Applied applications receive an application date when no date is entered.
Confirmed existing application dates are not overwritten.
Confirmed handled Gmail messages do not return on later scans.
Confirmed Skip for now advances to the next email without permanently hiding the skipped message.
Confirmed only one Gmail suggestion is displayed at a time.
Confirmed Ignore permanently removes the email from future review.
Confirmed Confirm Update changes only the selected application.
Confirmed Undo restores the previous application state and returns the email to the current review queue.
Confirmed refreshing the dashboard clears the temporary Undo option.

---

## Gmail Email Body Reading

### Task

Expand the Gmail integration so the dashboard can read the actual body of a likely application email and use that information to improve application-status classification and job matching.

### AI Usage

AI helped plan the Gmail OAuth scope change, MIME email parsing, safe body decoding, lazy email-body loading, classification improvements, and debugging of the body-loading pipeline.

### Changes

- Changed the Gmail OAuth scope from gmail.metadata to gmail.readonly so the extension can read message bodies.
- Kept Gmail access read-only and did not request permission to modify, delete, or send emails.
- Continued using metadata-only scanning first so full email bodies are not fetched for every recent email.
- Added lazy body loading so the full email is fetched only for the currently reviewed Gmail suggestion.
- Added support for Gmail multipart MIME messages.
- Added recursive MIME traversal for nested message parts.
- Preferred text/plain email content when available.
- Added a safe text/html fallback that converts HTML email content into readable plain text.
- Did not render arbitrary email HTML directly.
- Added Gmail base64url decoding and UTF-8 decoding using TextDecoder.
- Ignored attachment parts and did not retrieve email attachments.
- Kept full email bodies in React state only and did not save them to chrome.storage.local.
- Updated deterministic email classification to use the email body as additional evidence.
- Updated job matching so body text can provide additional company and role evidence.
- Added a readable email-body section to the Gmail review card.
- Added Show more and Show less controls for long emails.
- Preserved the existing Confirm Update, Ignore, Skip for now, Add Application, processed-message, and Undo workflows.

### Issue Found

The first email-body implementation successfully identified likely application emails, but the dashboard remained stuck on "Loading email body..." and the classification stayed Unknown.
A real rejection test email from Epic contained:
"We've decided to move forward with other candidates"
The rejection classifier correctly returned Rejected when tested directly, which showed that the classification rules themselves were working.
The Gmail API request was then traced through the live Chrome extension using temporary development logs.
The debugging process confirmed that:

- The Gmail suggestion existed and had a valid message ID.
- The React body-loading effect executed.
- The duplicate-fetch guard passed correctly for the initial request.
- getMessageBody() was called.
- The Gmail full-message request returned HTTP 200.
- Gmail returned a multipart/alternative payload.
- JSON parsing succeeded.
- MIME extraction succeeded.
- 485 characters of email body text were successfully decoded.
- The body result successfully returned from gmail.js into Dashboard.jsx.
However, execution stopped after Dashboard.jsx received the body result and before the suggestion was reclassified or the body state was changed from loading.
This isolated the problem to the Dashboard body-processing flow rather than OAuth, Gmail permissions, the Gmail API, MIME parsing, decoding, or classification.

### Fix

The Gmail body-loading pipeline was traced one checkpoint at a time instead of continuing to make speculative changes.

Temporary logs were added around:

- the React body-loading effect
- the fetch guard
- getMessageBody()
- the Gmail HTTP request
- response.json()
- MIME extraction
- extracted text length
- the return from gmail.js
- Dashboard receipt of the body result
- reclassification
- the final loaded body state.

This confirmed that the Gmail API and MIME parser were working correctly and narrowed the remaining failure to the code immediately after Dashboard.jsx received the successful body result.
The post-response Dashboard logic was corrected so the returned body text continues into:

1. suggestion reclassification
2. job matching
3. gmailBody loaded state
4. React rendering

After the fix, the real Epic test email loaded correctly and changed from Unknown to Rejected based on the message body.
The temporary debugging logs were removed after verification.

### Testing

Confirmed Gmail reconnects with the gmail.readonly permission.
Confirmed metadata scanning still runs before body access.
Confirmed only the currently reviewed email body is fetched.
Confirmed Gmail full-message requests return successfully.
Confirmed multipart/alternative email bodies are parsed correctly.
Confirmed plain-text email content can be decoded and displayed.
Confirmed full email bodies are not stored in chrome.storage.local.
Confirmed attachment parts are not downloaded.
Confirmed the Epic rejection test email loads its full body.
Confirmed the Epic rejection email changes from Unknown to Rejected after the body is analyzed.
Confirmed long emails can be expanded with Show more and collapsed with Show less.
Confirmed Confirm Update still works.
Confirmed Ignore still works.
Confirmed Skip for now still works.
Confirmed processed emails remain excluded from later Gmail checks.
Confirmed Undo still restores the previous application state.
Confirmed lint and build pass.

---

## Final UX and Reliability Polish

### Task

Complete the final stabilization and polish pass for the Job Application Assistant before ending feature development.

### AI Usage

AI helped review the completed application for usability issues, extraction false positives, dashboard editing problems, Gmail workflow improvements, accessibility, error handling, and final code cleanup.

### Changes

Removed the original sample-job seeding behavior so a fresh installation starts with zero applications.
Added a dedicated empty dashboard state for users who have not saved any applications yet.
Preserved existing saved applications without overwriting or resetting chrome.storage.local.
Changed application editing from the separate form at the top of the dashboard to seamless inline row editing.
Kept Add Application as a separate workflow while allowing existing applications to be edited directly inside their table row.
Fixed the Date Applied field being clipped during inline editing by giving the date column sufficient usable width.
Improved table sizing so inline inputs, status controls, notes, dates, and action icons remain usable.
Strengthened generic webpage validation so normal webpages are not incorrectly treated as job postings.
Added explicit job-page confidence and validation logic.
Continued treating Schema.org JobPosting data as high-confidence job evidence.
Continued treating verified LinkedIn job-detail pages as high-confidence job evidence.
Made generic extraction require a believable role, substantial job content, a strong hiring/application signal, and evidence from multiple job-content groups.
Added structured-data negative evidence so pages identified as products, software applications, articles, and other clearly non-job content are rejected when no JobPosting schema exists.
Changed generic extraction to focus on a plausible job-content region instead of using the entire webpage as the job description.
Prevented normal pages such as ChatGPT, Gmail, product pages, search pages, and articles from displaying fake job information or the Save Application interface.
Added a compact non-job popup state explaining that the current page does not appear to be a job posting.
Improved dashboard empty, loading, and error states.
Added scoped async guards to prevent duplicate application saves and updates.
Improved keyboard focus and accessibility behavior for icon-only controls.
Removed temporary Gmail debugging logs used during development.
Added an Open in Gmail action to the Gmail review card.
Used the Gmail thread ID to open the original conversation in Gmail without changing the message or application state.
Kept the Gmail link visually secondary and reused the existing external-link icon style.

### Issue Found

The final testing pass exposed several usability and reliability issues.
The dashboard originally seeded sample applications on a fresh installation, which made the project behave like a demo instead of a real application.
Editing an existing application opened the full edit form near the top of the dashboard, forcing the user away from the row they were working with.
The Date Applied control was partially clipped because the fixed table layout did not reserve enough usable width for the native date input and its picker control.
The largest reliability issue was that the popup's generic webpage fallback was still capable of treating unrelated webpages as job postings.
For example, product and application pages could provide a title, long visible text, and incidental words such as location, experience, or benefits. The old generic validator could combine those weak signals and incorrectly allow the Save Application workflow.
This meant pages such as the Apple App Store, ChatGPT, Gmail, and other normal webpages could occasionally produce fake role, description, or company information.

### Fix

Removed sample-job initialization and changed a missing jobs storage key to behave as an empty array without immediately writing anything to storage.
Replaced the dashboard's top-form editing workflow with inline row editing so the user remains in context while modifying an application.
Adjusted table sizing and minimum widths so the Date Applied control and other edit fields remain fully visible.
Redesigned generic job-page validation around strong evidence of an actual hiring workflow instead of broad keyword matching.
Generic pages now require a believable role title, a substantial job-content region, at least one strong hiring or application signal, evidence from multiple distinct job-content groups, and no strong structured-data evidence that the page represents clearly non-job content.
The validator now uses semantic Apply actions, job-section structure, structured data, and localized job-content regions instead of allowing page-wide text and metadata alone to qualify a page.
The popup now checks the extractor's isJobPosting result before displaying any editable job information or Save Application controls.
Added Open in Gmail using the existing Gmail thread ID and a direct Gmail web link without adding permissions, API calls, or storage.

### Testing

Confirmed a fresh installation starts with zero applications.
Confirmed existing saved applications are preserved.
Confirmed Add Application still works.
Confirmed applications can be edited directly in their existing table rows.
Confirmed cancelling an inline edit preserves the original application.
Confirmed the Date Applied input is fully visible during editing.
Confirmed long locations, notes, and table actions remain usable.
Confirmed ChatGPT is rejected as a non-job page.
Confirmed Gmail is rejected as a non-job page.
Confirmed Apple App Store pages are rejected as non-job pages.
Confirmed Google Search and ordinary article pages are rejected.
Confirmed Ashby job postings continue to extract correctly.
Confirmed LinkedIn job postings continue to extract correctly.
Confirmed generic job postings with sufficient hiring evidence are accepted.
Confirmed real job pages can still be accepted when optional fields such as location are missing.
Confirmed Gmail connection, email review, body reading, classification, matching, Confirm Update, Ignore, Skip for now, Add Application, and Undo continue to work.
Confirmed Open in Gmail opens the corresponding Gmail conversation in a new tab.