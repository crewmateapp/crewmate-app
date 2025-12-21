# 🔒 CrewMate Safety & Privacy Design

## Core Principles

CrewMate is built with airline crew safety as the absolute top priority. Every feature is designed with privacy protection and user safety in mind.

## Privacy Protection

### Location Privacy

**Problem:** Crew members stay at hotels and exact addresses should never be public.

**Solution:**
- Users set their location to a **general area** (e.g., "JFK Airport Area", "Manhattan Midtown")
- Exact hotel name and address are NEVER visible publicly
- Location is shown as approximate zones, not precise coordinates
- Hotel details are only revealed after BOTH users accept connection request

**Implementation Notes:**
- Use geohashing to create area zones
- Round coordinates to ~1-2 mile radius
- Store exact location separately (encrypted) for matching purposes only
- Display location as named areas (airport vicinity, neighborhoods)

### Profile Privacy

**What's Public:**
- First name + Last initial only (e.g., "Sarah M.")
- Airline (optional - some crew may want to keep private)
- General area during layover
- Availability time window
- Bio/interests
- Profile photo (optional)

**What's Private (until connection):**
- Last name
- Exact hotel location
- Phone number
- Email address
- Specific flight information

## Two-Way Connection System

### How It Works

1. **User A** sees **User B** in their area
2. **User A** sends a connection request (with optional message)
3. **User B** receives notification and can:
   - **Accept** - Both can now message and see hotel details
   - **Decline** - User A is notified (kindly)
   - **Block** - User A cannot request again
4. Both must accept before ANY direct communication

### Why Two-Way?

- Prevents unwanted contact
- Ensures mutual interest
- Protects from spam/harassment
- Gives both parties control

## Verification System

### Airline Email Verification

**Required at signup:**
- Users must verify with airline email (@delta.com, @united.com, etc.)
- Prevents non-crew from accessing the platform
- Builds trust in the community

**Accepted Email Domains:**
- Major US carriers (Delta, United, American, Southwest, etc.)
- International carriers (can be added)
- Contract carriers (with manual verification)

**Process:**
1. User signs up with airline email
2. Verification code sent to email
3. User enters code to activate account
4. Email stored (private) for account recovery

### Future: Crew Badge Verification

- Optional enhanced verification (employee ID photo)
- Verified badge shown on profile
- Increases trust for connections

## Safety Features

### 1. Report & Block

**Report Options:**
- Inappropriate messages
- Fake profile
- Safety concern
- Harassment
- Other (with description)

**Actions:**
- Reports reviewed by moderators
- Pattern detection for repeat offenders
- Temporary/permanent bans
- Law enforcement contact if needed

**Block:**
- Immediate - takes effect instantly
- Bidirectional - both users can't see each other
- Permanent (unless user unblocks)

### 2. Meeting Safety Guidelines

**Built into app:**
- "Always meet in public places" reminder
- Suggested meeting spots (coffee shops, restaurants, gyms)
- Safety checklist before first meetup:
  - ✅ Meet in public place
  - ✅ Tell someone where you're going
  - ✅ Have your phone charged
  - ✅ Trust your instincts

**In-app Prompts:**
- When scheduling a meetup, show safety tips
- Encourage sharing location with friend during meetup
- Quick "I'm safe" check-in option

### 3. Public Meeting Place Suggestions

**Feature:**
- App suggests public venues based on location
- Filters: Coffee shops, restaurants, gyms, parks
- Crew-voted recommendations (trusted spots)
- Hours of operation shown
- "Popular for crew meetups" badge

**Benefits:**
- Removes awkward "where should we meet?" conversation
- Ensures public setting
- Leverages crew community knowledge

## Data Security

### What We Store

**User Data:**
- Name (encrypted)
- Email (encrypted)
- Airline affiliation
- Profile photo (optional)
- Location (encrypted, temporary - deleted after layover ends)
- Connections
- Messages (encrypted end-to-end)

**What We DON'T Store:**
- Credit card info (not needed for MVP)
- Precise GPS coordinates (only area zones)
- Flight schedules (user manually sets availability)
- Personal address

### Data Retention

- **Active layover data:** Deleted 48 hours after layover window ends
- **Messages:** Retained unless user deletes
- **Connections:** Retained unless user removes
- **Account data:** Deleted upon account deletion request

### Encryption

- All sensitive data encrypted at rest (Firebase encryption)
- Messages encrypted in transit (HTTPS)
- Future: End-to-end message encryption

## Content Moderation

### Automated Filters

- Profanity filter on messages (optional - can disable)
- Spam detection
- Link/phone number sharing warnings (first connection)

### Manual Review

- Reported profiles reviewed within 24 hours
- Reported messages reviewed immediately for safety concerns

### Community Guidelines

**Prohibited:**
- Harassment or bullying
- Hate speech
- Solicitation or spam
- Impersonation
- Sharing others' private info
- Illegal activity

**Encouraged:**
- Respectful conversation
- Community building
- Safety-conscious behavior
- Reporting violations

## Emergency Features

### Planned for Future

- **Panic Button:** Quick contact to emergency services
- **Safety Timer:** Check-in requirement during meetup
- **Location Sharing:** Share real-time location with trusted friend
- **Emergency Contacts:** Pre-set contacts to alert

## Trust & Safety Team (Future)

As app grows:
- Dedicated safety team
- 24/7 response for urgent reports
- Partnerships with airlines for verification
- Regular safety audits

## User Education

### Onboarding

New users see:
1. Welcome to CrewMate
2. How we protect your privacy
3. Safety guidelines
4. How connections work
5. Reporting & blocking

### In-App Reminders

- Privacy notice when setting location
- Safety tips before accepting first connection
- Meeting safety guidelines before scheduling meetup
- Periodic safety reminders

## Red Flags to Watch For

**App should warn users about:**
- Requests to meet at private locations
- Pressure to share personal contact info immediately
- Users asking for money/favors
- Inconsistent profile information
- Users with multiple reports

## Continuous Improvement

- Regular user feedback surveys on safety
- Analysis of report trends
- Updates to safety features based on community needs
- Transparency reports (quarterly)

---

**Bottom Line:** If we're ever uncertain whether a feature compromises safety, we don't ship it until it's safe. No exceptions.
