# 📅 CrewMate Development Roadmap

**Launch Date:** June 2026  
**Development Period:** 24 weeks (December 2025 - June 2026)  
**Team:** Zach (Developer) + Johnny (Designer)

---

## Phase 1: Foundation (Weeks 1-4)
**Goal:** Set up infrastructure and basic authentication

### Week 1: Project Setup
- [x] Initialize Expo React Native project
- [ ] Set up GitHub repository
- [ ] Configure Firebase project
- [ ] Set up development environment
- [ ] Create initial app screens (wireframes)

### Week 2: Design System
- [ ] Design app color scheme and branding
- [ ] Create component library (buttons, cards, inputs)
- [ ] Design icons and logo
- [ ] Establish typography and spacing

### Week 3: Authentication (Part 1)
- [ ] Firebase Authentication integration
- [ ] Email/password signup flow
- [ ] Login screen UI
- [ ] Password reset functionality

### Week 4: Authentication (Part 2)
- [ ] Airline email verification system
- [ ] Email domain validation
- [ ] Verification code flow
- [ ] Error handling and user feedback

**Milestone:** Users can sign up and verify airline email

---

## Phase 2: Core Profile & Discovery (Weeks 5-8)
**Goal:** Build user profiles and basic discovery

### Week 5: Profile Creation
- [ ] Profile setup wizard
- [ ] Basic info form (name, airline, base)
- [ ] Bio text input
- [ ] Profile photo upload (Firebase Storage)
- [ ] Profile preview screen

### Week 6: Location Services
- [ ] Location permission handling
- [ ] Area-based location detection
- [ ] Manual area selection
- [ ] Privacy notice and consent
- [ ] Location zone calculation (geohashing)

### Week 7: Crew Discovery (Part 1)
- [ ] Firestore data structure for users
- [ ] Query nearby crew members
- [ ] Proximity calculation (star rating system)
- [ ] Crew card component design
- [ ] List view of nearby crew

### Week 8: Crew Discovery (Part 2)
- [ ] Availability time window system
- [ ] Filter options (by airline, proximity, etc.)
- [ ] Pull-to-refresh functionality
- [ ] Empty states and loading indicators

**Milestone:** Users can create profiles and see other crew nearby

---

## Phase 3: Connections & Messaging (Weeks 9-12)
**Goal:** Enable crew-to-crew connections and communication

### Week 9: Connection Request System
- [ ] Connection request data structure
- [ ] "Send Connection Request" functionality
- [ ] Request inbox screen
- [ ] Accept/Decline actions
- [ ] Connection status indicators

### Week 10: Direct Messaging (Part 1)
- [ ] Chat screen UI
- [ ] Message input and send
- [ ] Real-time message sync (Firestore)
- [ ] Message list rendering
- [ ] Timestamp formatting

### Week 11: Direct Messaging (Part 2)
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Image sharing
- [ ] Message deletion
- [ ] Chat list screen (all conversations)

### Week 12: Notifications
- [ ] Firebase Cloud Messaging setup
- [ ] Push notification permissions
- [ ] Connection request notifications
- [ ] New message notifications
- [ ] Notification preferences screen

**Milestone:** Users can connect and message each other

---

## Phase 4: Recommendations & Community (Weeks 13-16)
**Goal:** Build local recommendations and city browsing

### Week 13: Local Spots (Part 1)
- [ ] Spots data structure
- [ ] Spot card UI design
- [ ] Category system (Food, Coffee, Gym, etc.)
- [ ] Display spots near user's area
- [ ] Hours and distance information

### Week 14: Local Spots (Part 2)
- [ ] Voting system (upvote spots)
- [ ] Add new spot functionality
- [ ] Spot details screen
- [ ] Filter by category
- [ ] "Open now" indicator

### Week 15: City Browsing
- [ ] Cities database
- [ ] City list screen
- [ ] City detail view (spots and crew in city)
- [ ] Search cities
- [ ] Popular cities ranking

### Week 16: All Layovers Tab
- [ ] View all active layovers
- [ ] Filter by city
- [ ] Sort by recent/proximity
- [ ] Enhanced crew cards
- [ ] Quick connection from layover list

**Milestone:** Full discovery and recommendation features working

---

## Phase 5: Safety & Polish (Weeks 17-20)
**Goal:** Implement safety features and refine UI/UX

### Week 17: Safety Features (Part 1)
- [ ] Report user functionality
- [ ] Block user functionality
- [ ] Report reasons and submission
- [ ] Admin dashboard for reviewing reports (basic)
- [ ] Safety guidelines screen

### Week 18: Safety Features (Part 2)
- [ ] Meeting safety tips
- [ ] Public place suggestions
- [ ] Safety checklist modal
- [ ] In-app safety reminders
- [ ] Privacy settings screen

### Week 19: UI/UX Polish
- [ ] Animation improvements
- [ ] Loading states refinement
- [ ] Error message improvements
- [ ] Accessibility enhancements
- [ ] Dark mode (optional)

### Week 20: Testing & Bug Fixes
- [ ] Internal beta testing
- [ ] Bug tracking and fixes
- [ ] Performance optimization
- [ ] Crash reporting setup (Sentry)
- [ ] User feedback incorporation

**Milestone:** App is safe, polished, and ready for beta

---

## Phase 6: Launch Preparation (Weeks 21-24)
**Goal:** Prepare for App Store launch

### Week 21: App Store Prep (Part 1)
- [ ] App store listing copy
- [ ] Screenshots and preview videos
- [ ] Privacy policy
- [ ] Terms of service
- [ ] App icon finalization

### Week 22: App Store Prep (Part 2)
- [ ] iOS App Store submission
- [ ] Google Play Store submission
- [ ] Build signing and certificates
- [ ] TestFlight beta (iOS)
- [ ] Closed beta testing

### Week 23: Marketing & Community
- [ ] Landing page website
- [ ] Social media accounts setup
- [ ] Beta user feedback collection
- [ ] Final bug fixes
- [ ] Help/FAQ section in app

### Week 24: Launch Week
- [ ] App store approvals
- [ ] Launch announcement
- [ ] Monitor for issues
- [ ] Community management
- [ ] Celebrate! 🎉

**Milestone:** CrewMate launches publicly!

---

## Post-Launch (Future Phases)

### Phase 7: Enhancements
- Group meetups
- Event creation
- Calendar integration
- Enhanced verification (crew badges)
- Travel guides

### Phase 8: Scale & Grow
- International crew support
- Multi-language support
- Airline partnerships
- Premium features (optional)

---

## Key Metrics to Track

**Pre-Launch:**
- Development velocity (features/week)
- Bug count
- Test coverage

**Post-Launch:**
- User signups
- Daily active users
- Connections made
- Messages sent
- Spots recommended
- Safety reports (should be low!)

---

## Risk Management

**Potential Risks:**
1. **Timeline Delays**
   - Mitigation: Focus on MVP, cut non-essential features
   
2. **Technical Challenges**
   - Mitigation: Zach learning resources, community support, pair programming sessions

3. **Safety Issues**
   - Mitigation: Priority on safety features, clear guidelines, moderation

4. **Low Adoption**
   - Mitigation: Beta testing with real crew, word-of-mouth marketing

---

## Resources Needed

**Development:**
- Firebase (Spark plan → Blaze plan as needed)
- Expo account
- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)

**Design:**
- Figma (free tier)
- Stock photos/icons as needed

**Optional:**
- Domain name for landing page
- Email service for transactional emails
- Analytics (Firebase Analytics - free)

---

**Last Updated:** December 20, 2025  
**Next Review:** Weekly during development
