# Job Application Assistant

A Chrome extension and dashboard for capturing, organizing, and updating job applications.

The extension extracts information from job-posting webpages, saves applications locally, and connects to Gmail to identify recruiting emails and suggest application status updates.

## Features

### Job Capture

Chrome extension popup for capturing job postings directly from the current webpage.

Extracts information such as:

Company
Role
Location
Job description
Job posting URL

The extractor uses multiple strategies depending on the webpage.

It supports Schema.org JobPosting structured data, LinkedIn-specific extraction, and a generic job-page detector for other career websites.

Before allowing an application to be saved, the extension validates that the current webpage appears to be an actual job posting.

Normal webpages such as product pages, articles, search pages, and other unrelated websites are rejected instead of producing fake application information.

Extracted information can be reviewed and edited before saving.

### Application Dashboard

The dashboard provides a central place to manage tracked applications.

Applications can be:

Added manually
Edited directly inside their table row
Deleted
Searched
Filtered by status

Applications are stored using chrome.storage.local so they remain available after closing or refreshing the extension.

The dashboard also supports application notes, original job-posting links, application dates, and status tracking.

### Application Statuses

The supported application statuses are:

Saved
Applied
Assessment
Interview
Offer
Rejected
Withdrawn

### Gmail Integration

The dashboard can connect to Gmail using Google OAuth through the Chrome Identity API.

Gmail integration supports:

Connecting a Gmail account
Restoring an existing authenticated connection
Checking recent emails manually
Identifying likely job-application emails
Reading the currently reviewed email
Classifying recruiting emails
Matching emails with tracked applications
Suggesting application status changes
Adding unmatched applications
Ignoring emails
Skipping emails temporarily
Undoing the most recent queue action
Opening the original conversation in Gmail

Emails are reviewed one at a time so the dashboard does not become crowded with multiple email results.

Application statuses are never changed automatically. The user must confirm an update before the tracked application is modified.

## Job Extraction

Job extraction follows a confidence-based strategy.

### 1. Structured JobPosting Data

The extension first checks the page for Schema.org JobPosting JSON-LD.

When valid JobPosting structured data is found, it is treated as high-confidence evidence that the webpage is a job posting.

### 2. LinkedIn Job Extraction

LinkedIn uses a specialized extraction path.

The extractor verifies that the user is viewing a real LinkedIn job and extracts information from the selected job-detail pane rather than unrelated content elsewhere on the page.

### 3. Generic Job-Page Detection

For other websites, the extension uses stricter generic validation.

A generic webpage must provide strong evidence of an actual hiring workflow before it can be treated as a job posting.

Validation considers:

A believable job title
A substantial job-content region
Strong hiring or application signals
Multiple distinct job-content groups
Structured-data evidence

The extractor attempts to identify a meaningful job-content region instead of treating all visible webpage text as the job description.

This helps prevent unrelated webpages from being interpreted as job postings simply because they contain words such as location, experience, benefits, or application.

Structured data can also provide negative evidence. For example, a page identified as a Product, SoftwareApplication, Article, or other clearly non-job type will not pass generic validation when no JobPosting data exists.

If the page does not appear to be a job posting, the popup displays a simple message instead of fake job information or a Save Application button.

## Gmail Email Processing

Gmail processing is intentionally user-controlled.

The extension first retrieves a small number of recent messages and uses metadata to identify emails that may be related to job applications.

Relevant metadata includes:

Sender
Subject
Date
Message ID
Thread ID

The extension does not immediately retrieve the body of every recent email.

Instead, the body of the currently displayed email is loaded only when that email reaches the review queue.

This keeps Gmail access focused on the information currently being reviewed.

### Email Classification

Recruiting emails are classified using deterministic rules rather than an AI model.

Possible classifications include:

Application Received
Assessment
Interview
Offer
Rejected
Unknown

Classification uses information from the subject, sender, and email body.

More specific signals are prioritized over generic language to reduce incorrect classifications.

The classification is presented as a likely update rather than a guaranteed conclusion.

### Application Matching

After classification, the extension attempts to match the email to an existing tracked application.

Matching can use evidence such as:

Company name
Sender information
Sender domain
Role or job-title words
Email subject
Email body

Matching is intentionally conservative.

When multiple applications could match the same email, the extension does not arbitrarily choose one. The user can select the correct application.

If no existing application matches an application-confirmation email, the user can add it as a new Applied application.

### Email Review Queue

Likely recruiting emails are presented one at a time.

Depending on the email, the user can:

Confirm Update
Add Application
Ignore
Skip for now
Undo

Confirm Update changes the selected application's status only after user confirmation.

Ignore removes the email from the current workflow.

Skip for now moves to the next email without permanently processing the skipped email.

Undo is available during the current dashboard session so an accidental action can be reversed.

Processed emails are tracked so repeatedly checking Gmail does not continuously display the same handled messages.

### Open in Gmail

The current email can also be opened directly in Gmail.

The extension uses the existing Gmail thread ID to open the corresponding Gmail conversation in a new browser tab.

Opening Gmail does not modify the message, queue, or application.

## Privacy and Gmail Access

The Gmail integration was designed around least privilege and explicit user control.

The extension uses Gmail read-only access.

OAuth access tokens are not stored in chrome.storage.local.

Chrome Identity manages OAuth authentication and cached access tokens.

Gmail passwords are never collected or stored.

Email bodies are kept in React memory while they are being reviewed and are not persisted to application storage.

The extension stores processed Gmail message IDs so previously handled messages do not repeatedly appear in the review queue.

Gmail is checked only when the user requests it.

Application statuses are never automatically changed based on an email.

## Storage

Application data is stored locally using chrome.storage.local.

Stored application information includes fields such as:

Company
Role
Location
Status
Date applied
Job URL
Notes
Job description

The application does not require a backend for its current functionality.

A fresh installation starts with zero applications.

The extension does not seed sample jobs or overwrite existing stored applications.

## Tech Stack

React

Vite

JavaScript

Chrome Extensions Manifest V3

Chrome Storage API

Chrome Scripting API

Chrome Identity API

Gmail API

Google OAuth 2.0

## Project Structure

```text
public/
  manifest.json

src/
  App.jsx
  App.css
  main.jsx

  Dashboard.jsx
  dashboard.css
  dashboard-main.jsx

  extractJobFromPage.js
  gmail.js
  jobStorage.js

index.html
dashboard.html
vite.config.js
```

## Running Locally

Install the project dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

The production extension will be generated in the dist directory.

Open Chrome and navigate to:

```text
chrome://extensions
```

Enable Developer mode.

Select Load unpacked.

Choose the generated dist folder.

The Job Application Assistant extension should now appear in Chrome.

After making source-code changes, rebuild the project:

```bash
npm run build
```

Then return to chrome://extensions and reload the extension.

## Gmail Setup

Gmail integration requires a Google Cloud project and OAuth configuration.

### Google Cloud

Create or select a Google Cloud project.

Enable the Gmail API.

Configure the OAuth consent screen.

Create an OAuth client with the application type Chrome Extension.

Set the OAuth client's Item ID to the Chrome extension ID.

While the OAuth application is in Testing mode, add the Gmail accounts used for development as test users.

### OAuth Scope

The extension currently uses:

```text
https://www.googleapis.com/auth/gmail.readonly
```

This allows the extension to read Gmail information while preventing it from modifying or sending email.

### Chrome Extension Configuration

The OAuth client ID is configured in manifest.json.

The extension also uses the Chrome identity permission so authentication can be handled through chrome.identity.

The OAuth client ID is public application configuration and is not a client secret.

No Google client secret is stored in the extension.

## Development Validation

Before completing major changes, the project is checked using:

```bash
npm run lint
```

```bash
npm run build
```

```bash
git diff --check
```

Manual regression testing is also used because the project currently does not include an automated test framework.

Manual testing includes:

JobPosting structured-data extraction
LinkedIn extraction
Generic job-page extraction
Non-job webpage rejection
Adding applications
Inline application editing
Deleting applications
Search and filtering
Application-date handling
Gmail authentication
Gmail connection restoration
Gmail scanning
Email-body loading
Email classification
Application matching
Ambiguous matches
Unmatched applications
Confirm Update
Ignore
Skip for now
Undo
Open in Gmail
Long-text handling
Narrow dashboard widths

## AI-Assisted Development

AI was used as a development assistant throughout the project.

AI helped with:

Planning features
Reviewing implementation approaches
Debugging
Identifying edge cases
Suggesting architecture
Reviewing UI behavior
Designing Gmail integration
Improving extraction reliability

The development workflow intentionally kept human review between AI planning and implementation.

The general workflow was:

Define a narrowly scoped feature.

Ask AI to inspect the existing implementation and propose a plan.

Review the proposed plan before allowing code changes.

Question or modify recommendations when necessary.

Implement the approved approach.

Manually test the behavior.

Investigate failures rather than immediately accepting additional generated changes.

Document significant AI usage and decisions.

Commit completed milestones with meaningful Git messages.

Several AI-generated recommendations were changed or refined during development.

Examples include improving the handling of application dates, preventing sample data from returning after storage changes, avoiding unnecessary abstractions, tightening LinkedIn extraction using observed page behavior, redesigning generic job-page validation after false positives, keeping Gmail email bodies transient, requiring explicit confirmation before status changes, and tracing the Gmail body-loading pipeline to find runtime failures.

Detailed development notes are available in AI_NOTES.md.

## Key Engineering Decisions

### Local-First Storage

The current application uses chrome.storage.local instead of introducing a backend.

This keeps the architecture small and appropriate for the current feature set.

### Confirmation Before Email Updates

Gmail classifications only produce suggestions.

The user remains responsible for confirming changes to tracked applications.

### Conservative Job Detection

Generic webpage extraction intentionally favors rejecting uncertain pages rather than saving unrelated webpages as job applications.

### Lazy Email Body Loading

The extension does not retrieve every recent email body.

Bodies are loaded only for the email currently being reviewed.

### No AI Email Classification

Recruiting-email classification currently uses deterministic rules.

This keeps the behavior explainable and avoids sending email contents to an external AI service.

### Minimal OAuth Access

The Gmail integration uses read-only access and does not request permission to send, modify, or delete Gmail messages.

## Current Limitations

Generic job-page extraction cannot guarantee support for every careers website.

Some websites use unusual page structures that may require additional extraction logic.

LinkedIn may change its page structure, which could require updates to its specialized extraction logic.

Gmail email classification uses deterministic rules and may not correctly understand every recruiting email.

Gmail scanning is user-triggered rather than running automatically in the background.

Application data is stored locally and is not synchronized across devices.

When multiple Google accounts are signed into Gmail, Open in Gmail may open the first active Gmail web account rather than the account authenticated through the extension.

The project currently relies on manual regression testing rather than an automated test suite.

## Future Improvements

Possible future improvements include:

Application status history

More job-site-specific extraction adapters

Improved generic job-page detection

Optional cross-device synchronization

Automated testing

Additional Gmail matching improvements

Optional background synchronization

More advanced email classification

These features are intentionally outside the current project scope.

## Project Goal

The goal of Job Application Assistant is to reduce the manual work involved in tracking job applications while keeping important decisions under the user's control.

The project combines browser-page extraction, persistent application tracking, Gmail integration, deterministic classification, and user-confirmed updates into a single Chrome extension workflow.