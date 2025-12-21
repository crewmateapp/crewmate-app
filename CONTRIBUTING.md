# 🤝 Contributing to CrewMate

Welcome to the CrewMate development team! This guide will help Zach and Johnny work together effectively.

## Team Roles

**Zach - Developer**
- Writes code (React Native, Firebase)
- Reviews technical feasibility of designs
- Implements features
- Fixes bugs
- Manages GitHub repository

**Johnny - Designer**
- Creates UI/UX designs in Figma
- Provides design assets (icons, images)
- Reviews implemented designs
- Ensures brand consistency

## Communication Channels

- **Mission Control Chat:** Daily check-ins and routing
- **Development Chat:** Coding questions and technical help
- **Design Review Chat:** Review Johnny's designs
- **Planning & Features Chat:** Product decisions
- **Bug Fixes Chat:** Troubleshooting
- **GitHub Issues:** Formal feature and bug tracking
- **Notion:** Major decisions and documentation

## Workflow

### 1. Planning a Feature

1. Discuss idea in **Planning & Features** chat
2. Johnny creates designs in Figma
3. Johnny creates **Design Review** issue on GitHub
4. Zach reviews for technical feasibility
5. Agreement reached → Move to development

### 2. Design Phase (Johnny)

1. Create designs in Figma
2. Export assets (icons, images) at appropriate sizes
3. Document:
   - Colors (hex codes)
   - Font sizes
   - Spacing
   - Component states (default, hover, disabled)
4. Share in **Design Review** chat
5. Create GitHub issue with Figma link

### 3. Development Phase (Zach)

1. Pick issue from "Ready" column in project board
2. Move to "In Progress"
3. Create feature branch: `git checkout -b feature/feature-name`
4. Code the feature
5. Test on both iOS and Android (if possible)
6. Commit: `git commit -m "Clear description of what you did"`
7. Push: `git push origin feature/feature-name`
8. Move to "Review" column

### 4. Review Phase

1. Zach shares screenshot/video in **Design Review** chat
2. Johnny reviews against original design
3. Feedback provided
4. Adjustments made if needed
5. Both approve → Merge to main

### 5. Testing & Completion

1. Test feature together
2. Update documentation if needed
3. Close GitHub issue
4. Move to "Done" column
5. Celebrate! 🎉

## Design Handoff Checklist

When Johnny hands off designs, include:

- [ ] Figma link with viewing permissions
- [ ] All screens/states designed
- [ ] Color palette (hex codes)
- [ ] Typography specs (font family, sizes, weights)
- [ ] Spacing/padding measurements
- [ ] Icon files (SVG or PNG at multiple sizes)
- [ ] Image assets
- [ ] Interaction notes (animations, transitions)
- [ ] Component variants (buttons, cards, etc.)

## Code Review Guidelines

### What Zach Should Check

- [ ] Does it work on both iOS and Android?
- [ ] Is the code clean and commented?
- [ ] Does it match Johnny's design?
- [ ] Are there any console errors/warnings?
- [ ] Is it performant (no lag)?
- [ ] Are user inputs validated?
- [ ] Is data properly saved to Firebase?

### What Johnny Should Check

- [ ] Colors match design exactly
- [ ] Fonts and sizes correct
- [ ] Spacing/padding accurate
- [ ] Icons look good
- [ ] Animations smooth
- [ ] Overall polish and feel

## Git Commit Message Guidelines

Good commit messages help track changes:

### Format
```
[TYPE] Brief description

Optional longer description if needed
```

### Types
- `[FEAT]` - New feature
- `[FIX]` - Bug fix
- `[DESIGN]` - UI/styling changes
- `[REFACTOR]` - Code cleanup
- `[DOCS]` - Documentation
- `[TEST]` - Testing

### Examples

✅ **Good:**
```
[FEAT] Add email verification flow

- Created verification code screen
- Integrated Firebase email verification
- Added error handling for invalid codes
```

❌ **Bad:**
```
fixed stuff
```

## Issue Labeling System

Use these labels to organize issues:

- `enhancement` - New feature
- `bug` - Something broken
- `design` - Design review needed
- `documentation` - Docs update
- `question` - Discussion needed
- `high-priority` - Urgent
- `low-priority` - Nice to have
- `Phase 1` through `Phase 6` - Which roadmap phase

## Pull Request Template

When creating PRs, include:

```markdown
## What does this PR do?
Brief description

## Related Issue
Closes #123

## Screenshots
[Add before/after screenshots]

## Testing
- [ ] Tested on iOS
- [ ] Tested on Android
- [ ] No console errors
- [ ] Matches design

## Notes
Any special notes for reviewer
```

## Meetings & Check-ins

### Daily Stand-up (in Mission Control chat)
Each person shares:
1. What I did yesterday
2. What I'm doing today
3. Any blockers

### Weekly Design Review
- Johnny presents new designs
- Zach gives technical feedback
- Prioritize upcoming work

### Bi-weekly Sprint Planning
- Review roadmap
- Pick next features to build
- Adjust timeline if needed

## Decision Making

### Quick Decisions
- Discuss in chat
- Agree and move forward

### Major Decisions
- Discuss thoroughly
- Document in Notion
- Create GitHub issue if needed
- Both must agree

### Disagreements
- Listen to each other's perspectives
- Consider user benefit
- Compromise if possible
- If stuck, table for 24 hours and revisit

## Safety & Privacy

**Always prioritize:**
1. User safety
2. Privacy protection
3. Security

If ever in doubt about whether something is safe, don't ship it. Discuss and find a safer solution.

## Learning & Growth

**Zach's Learning:**
- Ask questions in **Learning** chat
- Share discoveries with Johnny
- Document solutions for future reference

**Celebrating Wins:**
- Share milestones in **Mission Control**
- Screenshot progress
- Keep each other motivated

## Code of Conduct

- 🤝 Be respectful and kind
- 💬 Communicate clearly
- 🎯 Focus on the mission (great app for crew)
- 🧘 Be patient (we're both learning)
- 🎉 Celebrate each other's contributions

## Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Firebase Docs](https://firebase.google.com/docs)
- [Figma](https://www.figma.com)

## Questions?

If something in this guide is unclear:
1. Ask in appropriate chat
2. Update this guide with the answer
3. Help future you!

---

**Remember: We're building something that will help thousands of crew members connect safely. Every contribution matters!**
