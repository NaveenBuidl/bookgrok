# Apps Script — Way of Excellence registration email (Stage B.5)

Reference copy only. This script does not live in the BookGrok repo at
runtime — it is bound to the "BookGrok Registration — The Way of
Excellence" Google Form (Extensions → Apps Script inside that Form's
editor) and runs entirely under the Form owner's Google authorization.
The static site never calls it and has no dependency on it.

Sends a thank-you email with the permanent access-page link to whatever
address the respondent typed into the Form's "Email" question. That
question is plain free-text (not Google's built-in verified-email
collection), so there is no guarantee the typed address is well-formed —
a typo means the email silently goes nowhere.

Google's native "send respondents a copy" (Settings → Responses) has
been turned off for this Form to avoid sending two emails per
registrant — this script is now the only automatic email a registrant
gets.

## Script

```javascript
function onFormSubmit(e) {
  var ACCESS_URL = "https://bookgrok.mandava.in/access/?track=way-of-excellence";

  var values = e.namedValues;
  var name = (values["Name"] && values["Name"][0]) || "";
  var email = (values["Email"] && values["Email"][0]) || "";

  if (!email) return;

  var subject = "You're registered — The Way of Excellence";
  var body =
    "Hi " + name + ",\n\n" +
    "Thanks for registering for The Way of Excellence on BookGrok.\n\n" +
    "Bookmark this link — it's your permanent access page with session times, " +
    "the Meet link, calendar buttons, and cohort discussion details:\n\n" +
    ACCESS_URL + "\n\n" +
    "See you at the first session.";

  MailApp.sendEmail(email, subject, body);
}
```

## Binding steps (owner-identity — do this yourself, not automatable)

1. Open the Form (edit view, not the public `forms.gle` link) as the
   Form owner.
2. Extensions → Apps Script. This opens a script project bound to the
   Form.
3. Delete any placeholder `myFunction() {}` and paste the script above.
4. Save (Ctrl+S / File → Save), name the project (e.g.
   "way-of-excellence-registration-email").
5. In the left sidebar, click Triggers (clock icon).
6. Add Trigger:
   - Function: `onFormSubmit`
   - Deployment: Head
   - Event source: From form
   - Event type: On form submit
   - Save.
7. Google will prompt an OAuth consent screen for the script to send
   email as you and read form responses — this is your own account
   authorizing your own script, not a new external API key. Approve it.
8. Submit one test response to confirm the email arrives (see main
   conversation for the test pass/fail).

## Known limitation

No inline unsubscribe / no suppression list — if the same email
registers for the Form twice, they get two thank-you emails. Not a
concern at cohort scale but worth knowing if this pattern is reused
elsewhere.
