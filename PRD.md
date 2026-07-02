# PRD: Client Meeting Calendar & Smart Follow-Up Tool

## 1. Product Overview

This tool is a smart client meeting calendar that helps the team keep track of when they last met each client, what was discussed, and when they should next meet them. It will be part of a larger business app and should feel like a clean, visual calendar/CRM hybrid.

The core idea is simple: users record or log meetings with clients, the app stores the meeting date and details, and over time the app learns the normal meeting rhythm for each client. If a client is usually met once a month, the app should remind the team roughly one month later. If the pattern changes and the client starts being met every two months, the app should gradually adjust the expected interval and remind the team every two months instead.

The app should centralize client meeting history, make it easy to record what happened in meetings, and automatically help the team avoid forgetting important client check-ins.

## 2. Problem

Teams often manage client relationships through scattered notes, memory, calendar events, emails, WhatsApp messages, and informal reminders. This creates several problems.

People forget when they last met a client. Some clients get over-contacted while others are forgotten. Meeting notes are not stored centrally. There is no automatic system that understands how frequently each client should be visited. Existing calendar tools can show scheduled events, but they do not learn client-specific meeting patterns or suggest future follow-ups based on actual behaviour.

This tool solves that by combining a calendar, client database, meeting recorder, and intelligent reminder system.

## 3. Goals

The goal is to create a simple and reliable calendar tool that lets users:

Record meetings with clients.

Attach voice recordings, transcripts, notes, and key details to each meeting.

Track the date of each meeting.

View all past client meetings in one place.

Automatically estimate how often each client is usually met.

Receive reminders when a client is due for another meeting.

Adjust the suggested meeting interval when the real meeting pattern changes.

Keep the interface clean, visual, and easy to use.

The tool should not feel like a complicated CRM. It should feel like a smart calendar that quietly learns how the business actually works.

## 4. Target Users

The primary users are team members who meet clients regularly. These could include salespeople, account managers, delivery drivers, business development staff, or managers responsible for maintaining client relationships.

The users may not be highly technical, so the product must be extremely easy to use. The main actions should be obvious: record meeting, add note, view client, see next recommended meeting, and mark meeting as completed.

## 5. Core User Stories

As a user, I want to record a meeting with a client so that I do not need to write everything manually afterwards.

As a user, I want the app to transcribe my voice recording so that I can quickly review what was said.

As a user, I want to add the date, client name, and short notes for each meeting so that the meeting history is clear.

As a user, I want to see when I last met each client so that I know who has been contacted recently.

As a user, I want the app to remind me when I should meet a client again so that I do not forget them.

As a user, I want the reminder timing to adjust automatically when the client’s normal meeting frequency changes.

As a manager, I want to see which clients are overdue, upcoming, or recently contacted so that I can make sure the team is keeping relationships warm.

As a user, I want a clean visual calendar and client dashboard so that I can understand everything quickly.

## 6. Key Features

### 6.1 Client Profiles

Each client should have a profile page containing:

Client name.

Business name.

Contact person.

Phone number.

Email address.

Address/location if relevant.

Assigned team member.

Last meeting date.

Suggested next meeting date.

Current estimated meeting interval.

Meeting history.

Notes and tags.

Status, such as active, warm, cold, overdue, high-priority, or paused.

The client profile should be the central place where all information about that client is stored.

### 6.2 Meeting Logging

Users should be able to log a meeting manually or through voice recording.

A meeting entry should include:

Client.

Date and time.

Meeting type, such as in-person, phone, video, or site visit.

Voice recording.

Transcript.

Manual notes.

Summary.

Action points.

Follow-up tasks.

Photos or attachments if needed.

User who logged the meeting.

The user should be able to create a meeting quickly from the calendar, from a client profile, or from a “Record Meeting” button.

### 6.3 Voice Recording and Transcription

The app should allow users to record meetings directly inside the app.

After recording, the app should automatically transcribe the audio. The AI should then generate a short meeting summary and extract useful details, including:

Main topics discussed.

Client concerns.

Promised follow-ups.

Product interest.

Possible next steps.

Important dates.

Any mention of needing another meeting.

The user should be able to edit the transcript and summary before saving.

The voice recording feature should be designed for speed. After a meeting, the user should be able to tap one button, record or upload the audio, and have the app produce a usable meeting note.

### 6.4 Smart Interval Detection

The app should learn how often each client is normally met.

For each client, the app should calculate the time gaps between completed meetings. For example:

Meeting 1: January 1.

Meeting 2: February 1.

Meeting 3: March 1.

The app learns that this client is usually met about every 30 days.

If later the meetings happen every 60 days, the app should slowly adjust the suggested interval from 30 days toward 60 days.

The interval should not change instantly after one unusual meeting. It should adjust based on recent patterns. A simple MVP approach is to use a weighted average, where recent meeting intervals matter more than older ones.

Example:

Old expected interval: 30 days.

New observed interval: 60 days.

Updated interval: partly adjusted, perhaps 40–45 days at first.

If the next observed interval is also around 60 days, the app moves closer to 60 days.

This prevents one delayed meeting from incorrectly changing the whole schedule.

### 6.5 Suggested Next Meeting Date

After each meeting is completed, the app should calculate a suggested next meeting date.

The basic formula is:

Next suggested meeting date = last meeting date + estimated client interval.

For example:

If Client A is usually met every 30 days and was last met on June 1, the app suggests July 1.

If Client B is usually met every 60 days and was last met on June 1, the app suggests July 31.

The app should display the next suggested meeting date clearly on the client profile, calendar, and dashboard.

### 6.6 Reminder System

The app should remind users when clients are due or overdue.

Reminder states should include:

Upcoming: client is due soon.

Due today: client should be contacted or met today.

Overdue: client has passed the expected meeting date.

Recently met: no action needed.

The user should be able to receive reminders inside the app, by email, or through push notification if the app is used on mobile.

Reminder examples:

“Client A is due for a meeting next week.”

“Client B has not been met for 65 days. Usual interval: 45 days.”

“Client C is overdue. Last meeting: April 12.”

The reminder should not force a meeting into the calendar automatically unless the user chooses to schedule it. The app should recommend and prompt, but the user should stay in control.

### 6.7 Calendar View

The product should include a clean calendar interface.

The calendar should show:

Past meetings.

Upcoming scheduled meetings.

Suggested future follow-ups.

Overdue clients.

Different colours should make the calendar easy to read.

Example visual states:

Green: recently met.

Blue: scheduled meeting.

Amber: due soon.

Red: overdue.

Grey: paused or inactive client.

The calendar should support daily, weekly, and monthly views. The monthly view is especially important because the main purpose is to see which clients need attention over time.

### 6.8 Client Dashboard

The dashboard should give the user a quick overview of client relationship health.

It should show:

Number of clients due this week.

Number of overdue clients.

Upcoming meetings.

Recently completed meetings.

Clients with no meeting history.

Clients whose meeting interval has recently changed.

High-priority clients needing attention.

The dashboard should be visual and simple. It should not look like a spreadsheet. Cards, coloured status badges, timeline views, and clear date labels should be used.

### 6.9 Manual Overrides

The app should allow users to manually override the suggested interval.

For example, a user may know that one client should be visited every month even if the recent pattern suggests every two months.

Each client should have an interval mode:

Automatic: app learns from meeting history.

Manual: user sets the meeting frequency.

Paused: no reminders are sent.

Custom date: user sets a specific next follow-up date.

The app should make it clear when a client is using automatic interval detection versus a manually set schedule.

### 6.10 Meeting Notes and Details

Each meeting should store both structured and unstructured information.

Structured fields:

Meeting date.

Client.

Meeting type.

User.

Follow-up required: yes/no.

Next suggested meeting.

Action items.

Unstructured fields:

Notes.

Transcript.

AI-generated summary.

General comments.

This makes it easy to search, review, and report on meetings later.

### 6.11 Search and Filters

Users should be able to search clients and meetings.

Useful filters:

Client name.

Assigned team member.

Last meeting date.

Overdue status.

Due this week.

High-priority clients.

Meeting type.

Client tag.

Clients with no recent meeting.

This is important because once the number of clients grows, the tool needs to remain easy to navigate.

## 7. Smart Interval Logic

The app should start simple and become more intelligent over time.

### 7.1 First Meeting

After the first meeting, the app does not yet know the true interval. It should either:

Use a default follow-up interval, such as 30 days.

Ask the user to choose an initial interval.

Or use a client category default.

For MVP, the default should be 30 days unless manually changed.

### 7.2 Second Meeting

After the second meeting, the app can calculate the first real observed interval.

Example:

First meeting: January 1.

Second meeting: February 1.

Observed interval: 31 days.

The app can now suggest that this client is probably monthly.

### 7.3 Third Meeting Onward

After at least three meetings, the app should become more confident.

It should calculate recent intervals and produce an estimated normal interval.

Example:

Meeting intervals: 30 days, 32 days, 29 days.

Estimated interval: about 30 days.

The app should round intervals into human-readable categories where possible:

Weekly.

Every 2 weeks.

Monthly.

Every 6 weeks.

Every 2 months.

Quarterly.

Custom.

The app can still store the exact number of days internally, but the user-facing label should be understandable.

### 7.4 Adjusting When Patterns Change

If a client used to be monthly but then starts being met every two months, the app should gradually adapt.

Example:

Old pattern: 30 days.

New meetings: 58 days, 63 days, 61 days.

The app should detect that the interval is shifting and update the suggested frequency to around 60 days.

The system should avoid overreacting to a single missed or delayed meeting. One late meeting should be treated as a possible outlier. Repeated late meetings should be treated as a new pattern.

### 7.5 Suggested Algorithm for MVP

For each client:

Store all meeting dates.

Calculate the number of days between each completed meeting.

Use the most recent 3–5 intervals.

Apply a weighted average where newer intervals count more.

Ignore extreme outliers if they are clearly unusual.

Set the estimated interval based on the weighted average.

Round to a sensible human label.

Example weighting:

Most recent interval: 50%.

Previous interval: 30%.

Older interval: 20%.

If the weighted average is 58 days, the app labels it as “Every 2 months”.

### 7.6 Confidence Score

The app should have a confidence score for each client’s suggested interval.

Low confidence:

Only one or two meetings recorded.

Irregular pattern.

Long gaps.

Manual overrides.

High confidence:

Several meetings recorded.

Consistent interval.

Recent meeting data.

This confidence score does not need to be shown prominently in the MVP, but it can help the app decide how strongly to recommend follow-ups.

## 8. User Flow

### 8.1 Recording a Meeting

The user opens the app.

The user taps “Record Meeting”.

The user selects or searches for the client.

The user records audio or uploads a recording.

The app transcribes the recording.

The app generates a summary and suggested action points.

The user edits the notes if needed.

The user saves the meeting.

The app updates the client’s last meeting date.

The app recalculates the client’s expected meeting interval.

The app creates a suggested next meeting reminder.

### 8.2 Viewing Clients Due Soon

The user opens the dashboard.

The dashboard shows clients due this week and overdue clients.

The user clicks a client.

The client profile shows the last meeting, notes, and suggested next meeting.

The user chooses to schedule a meeting, mark as contacted, pause reminders, or update the interval manually.

### 8.3 Calendar Use

The user opens the calendar.

The calendar shows scheduled meetings, past meetings, and suggested follow-ups.

The user clicks a suggested follow-up.

The user can convert it into a real calendar event.

The user can dismiss it, reschedule it, or mark the client as paused.

## 9. Visual Design Requirements

The design should be clean, modern, and simple.

The app should feel like a polished business tool, not a technical database. The main interface should be visual and easy to understand.

Important visual components:

Calendar view.

Client cards.

Status badges.

Timeline of past meetings.

Overdue client panel.

Upcoming meeting list.

Simple charts showing meeting activity.

Client relationship health indicators.

The design should use clear spacing, readable typography, and a calm colour palette. Colours should be used mainly to communicate status, not for decoration.

Suggested layout:

Left sidebar: Dashboard, Calendar, Clients, Record Meeting, Settings.

Main dashboard: cards for due clients, overdue clients, upcoming meetings, recent activity.

Calendar page: monthly/weekly calendar with coloured meeting markers.

Client page: profile info at top, meeting timeline below, suggested next meeting clearly displayed.

Record meeting page: large recording button, client selector, transcript area, summary area, save button.

## 10. MVP Scope

The MVP should include:

User login.

Client database.

Add/edit client.

Manual meeting logging.

Voice recording upload or in-app recording.

Audio transcription.

AI-generated meeting summary.

Calendar view.

Client profile pages.

Automatic interval estimation.

Suggested next meeting date.

Due and overdue reminders inside the app.

Manual interval override.

Basic dashboard.

Search and filters.

The MVP does not need to include advanced CRM features, complex analytics, email automation, or deep integrations at first.

## 11. Future Features

Future versions could include:

Email reminders.

Push notifications.

Google Calendar or Outlook Calendar sync.

Automatic email follow-up drafts.

Team assignment and manager overview.

Map view for client visits.

AI suggestions for which clients to prioritize.

Sales opportunity tracking.

Client value scoring.

Meeting sentiment analysis.

Recurring route planning.

Integration with WhatsApp, Gmail, or CRM tools.

Mobile app version.

Offline meeting recording.

## 12. Data Model

### Client

client_id

client_name

business_name

contact_name

phone

email

address

assigned_user_id

status

priority

created_at

updated_at

manual_interval_days

auto_interval_days

interval_mode

last_meeting_date

next_suggested_meeting_date

notes

tags

### Meeting

meeting_id

client_id

user_id

meeting_date

meeting_type

audio_file_url

transcript

ai_summary

manual_notes

action_items

follow_up_required

created_at

updated_at

### Reminder

reminder_id

client_id

meeting_id_optional

due_date

status

reminder_type

assigned_user_id

created_at

updated_at

### User

user_id

name

email

role

permissions

created_at

updated_at

## 13. Permissions

There should be basic permission levels.

Standard user:

Can view assigned clients.

Can log meetings.

Can record audio.

Can edit their own meeting notes.

Can view reminders.

Manager:

Can view all clients.

Can view all meetings.

Can assign clients to users.

Can edit client intervals.

Can view dashboard analytics.

Admin:

Can manage users.

Can change global settings.

Can manage integrations.

Can access audit logs.

## 14. Privacy and Security

Because the app records client meetings, privacy and security are extremely important.

The app should:

Store audio recordings securely.

Allow recordings to be deleted.

Make it clear when recording is active.

Require user login.

Restrict client data based on permissions.

Encrypt sensitive data where possible.

Keep an audit log of important changes.

Follow applicable data protection rules.

Show a warning reminding users to get appropriate consent before recording meetings.

The app should not automatically record anything in the background. Recording should always be started deliberately by the user.

## 15. Notifications

Notifications should be useful but not annoying.

The app should notify users when:

A client is due soon.

A client is overdue.

A suggested meeting interval changes significantly.

A meeting has action points that are not completed.

A client has not been contacted for an unusually long time.

Users should be able to choose how far in advance they receive reminders. For example:

1 day before.

3 days before.

1 week before.

On the due date.

After the due date.

## 16. Success Metrics

The success of the product should be measured by:

Number of meetings logged.

Percentage of clients with up-to-date meeting history.

Reduction in overdue clients.

Number of reminders acted upon.

Number of voice recordings successfully transcribed.

User engagement with the calendar.

Accuracy of suggested meeting intervals.

Manager satisfaction with visibility over client relationships.

A strong sign of success is that users stop relying on memory or scattered notes and start using this tool as the main place for client meeting history.

## 17. Edge Cases

The app should handle these situations:

A client has only one meeting recorded.

A client has irregular meetings.

A meeting is logged on the wrong date.

A user forgets to log a meeting until weeks later.

A client is paused or no longer active.

A meeting interval changes suddenly.

A client has multiple team members meeting them.

A voice recording fails.

A transcription is inaccurate.

A user manually overrides the AI suggestion.

A client has seasonal patterns, such as more meetings during certain months.

## 18. Non-Goals for MVP

The MVP should not try to become a full CRM.

It should not automatically send emails to clients.

It should not automatically schedule meetings without user approval.

It should not rely entirely on AI without user control.

It should not require users to fill in too many fields before saving a meeting.

The main value is simple: record meetings, centralize notes, learn meeting rhythms, and remind users who needs attention.

## 19. Recommended Build Approach

The product should be built as a web app first, with a mobile-friendly responsive design. This allows the team to access it from computers and phones without needing to download anything.

Recommended frontend:

React or Next.js.

Clean calendar component.

Mobile-responsive layout.

Recommended backend:

Node.js/Express, Python/FastAPI, or similar.

PostgreSQL database.

File storage for audio recordings.

Authentication system.

Recommended AI services:

Speech-to-text transcription.

Meeting summarization.

Action point extraction.

Interval prediction logic can start as simple backend code rather than a complex AI model.

The interval prediction should not be overcomplicated at first. A clear weighted-average algorithm will be easier to build, easier to debug, and more reliable than a black-box model.

## 20. Example User Scenario

A team member meets Client A on January 1 and records the meeting. The app stores the transcript, summary, and meeting date. Since this is the first meeting, the app suggests a default follow-up in 30 days.

The user meets the same client again on February 1. The app sees that the gap was about 31 days and keeps the client as a monthly client.

The user meets the client again on March 2. The app sees another roughly monthly gap and becomes more confident that the client should be contacted every month.

Later, the business relationship changes. The user meets Client A on May 1, then July 1. The app sees that the latest gaps are closer to 60 days. It does not instantly change the interval after one delay, but after repeated two-month gaps, it adjusts the client’s suggested meeting rhythm from monthly to every two months.

The next time the user opens the app, Client A is no longer shown as overdue after one month. Instead, the app recommends a meeting around the two-month mark.

## 21. Final Product Vision

This tool should become the team’s memory for client relationships.

Instead of asking “When did we last meet them?” or “Should we contact them again?”, the app should already know. It should show which clients are fresh, which are due soon, and which are being neglected.

The product should be simple enough that team members actually use it after meetings, but intelligent enough that it becomes more useful the more it is used. Over time, it should learn the natural rhythm of each client relationship and help the team maintain consistent, professional contact without relying on memory.
