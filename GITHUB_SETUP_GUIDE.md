# 🚀 GitHub Setup Guide for CrewMate

This guide will walk you through setting up your CrewMate repository on GitHub.

## Step 1: Create GitHub Account (if needed)

1. Go to https://github.com
2. Click "Sign up"
3. Use your crewmateapphq@gmail.com email
4. Choose a username (suggestion: `crewmate-app` or `zachcrewmate`)
5. Verify your email

## Step 2: Create New Repository

1. Log into GitHub
2. Click the **"+"** icon in top right → **"New repository"**
3. Fill in details:
   - **Repository name:** `crewmate-app`
   - **Description:** "Airline crew social discovery app - React Native"
   - **Visibility:** Choose **Private** (recommended for now)
   - **DO NOT** check "Initialize with README" (we have our own)
   - Click **"Create repository"**

## Step 3: Upload Files to GitHub

You have two options:

### Option A: Using GitHub Web Interface (Easier for beginners)

1. On your new empty repository page, click **"uploading an existing file"**
2. Drag and drop ALL the files from the `crewmate-github-setup` folder
3. Add commit message: "Initial commit - Project setup"
4. Click **"Commit changes"**

### Option B: Using Git Command Line

If you're comfortable with terminal/command line:

```bash
# Navigate to your CrewMate project folder
cd /path/to/your/crewmate-project

# Initialize git
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit - Project setup"

# Add GitHub as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/crewmate-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Organize Your Repository

### Create Project Board (for task tracking)

1. In your repository, go to **"Projects"** tab
2. Click **"New project"**
3. Choose **"Board"** template
4. Name it: "CrewMate Development"
5. Create columns:
   - 📋 Backlog
   - 🎯 Ready
   - 🚧 In Progress
   - 👀 Review
   - ✅ Done

### Add Issues from Roadmap

Create issues for each feature in your roadmap:

1. Go to **"Issues"** tab
2. Click **"New issue"**
3. Use the templates we created
4. Example first issue:

```
Title: [FEATURE] Firebase Setup
Labels: enhancement, Phase 1

## Feature Description
Set up Firebase project for CrewMate backend

## User Story
As a developer, I want Firebase configured so that we can use authentication and database.

## Technical Considerations
- Create Firebase project
- Add to Expo app
- Configure Authentication
- Configure Firestore
- Set up security rules

## Priority
- [x] High (MVP - needed for June 2026 launch)

## Acceptance Criteria
- [ ] Firebase project created
- [ ] Firebase SDK added to project
- [ ] Authentication enabled
- [ ] Firestore database created
- [ ] Basic security rules in place
```

### Assign Issues to Project Board

1. Open each issue
2. On right sidebar, click **"Projects"**
3. Add to "CrewMate Development"
4. It will appear in "📋 Backlog" column
5. Move to appropriate column as you work

## Step 5: Set Up Branch Protection (Optional but Recommended)

1. Go to **Settings** → **Branches**
2. Click **"Add rule"**
3. Branch name pattern: `main`
4. Check:
   - ✅ Require pull request before merging
   - This prevents accidental commits to main
5. Click **"Create"**

## Step 6: Invite Collaborator (Johnny)

1. Go to **Settings** → **Collaborators**
2. Click **"Add people"**
3. Enter Johnny's GitHub username or email
4. Johnny will receive invitation

## Daily Workflow

### Starting Work on a Feature

```bash
# Make sure you're on main
git checkout main

# Pull latest changes
git pull

# Create a new branch for your feature
git checkout -b feature/user-authentication

# Work on your code...
# When done:

# Stage your changes
git add .

# Commit with clear message
git commit -m "Add email verification for user signup"

# Push to GitHub
git push origin feature/user-authentication

# Then create Pull Request on GitHub
```

### Creating a Pull Request

1. Go to your repository on GitHub
2. Click **"Pull requests"** → **"New pull request"**
3. Choose your feature branch
4. Add description of changes
5. Click **"Create pull request"**
6. Review code
7. Click **"Merge pull request"** when ready
8. Delete the branch

## GitHub Desktop (Alternative to Command Line)

If command line feels overwhelming:

1. Download GitHub Desktop: https://desktop.github.com
2. Sign in with your GitHub account
3. Clone your repository
4. Make changes in your code editor
5. GitHub Desktop will show changes
6. Write commit message and click "Commit to main"
7. Click "Push origin" to upload to GitHub

Much more visual and beginner-friendly!

## Helpful GitHub Features

### Issues
- Track bugs and features
- Assign to yourself or Johnny
- Add labels (bug, enhancement, design)
- Close when complete

### Projects
- Visual board for tracking progress
- Drag issues between columns
- See what's in progress

### Wiki (Optional)
- Document how things work
- Design decisions
- Setup instructions
- Troubleshooting

### Discussions (Optional)
- Have conversations about features
- Q&A with community (if you go public later)

## Tips for Success

1. **Commit Often:** Small, frequent commits are better than giant ones
2. **Clear Messages:** Write what you did, not what you're going to do
3. **Branch Strategy:** Use branches for features, keeps main stable
4. **Review Before Merge:** Always check your code before merging
5. **Update Issues:** Close issues when features are done
6. **Document:** Add comments in code, update README as needed

## Need Help?

- GitHub Docs: https://docs.github.com
- GitHub Desktop Guide: https://docs.github.com/en/desktop
- Git Tutorial: https://www.atlassian.com/git/tutorials

## What's Next?

After GitHub is set up:
1. ✅ Repository created
2. ✅ Files uploaded
3. ✅ Project board created
4. ✅ First issues added
5. → Start coding! Begin with Week 1 tasks from ROADMAP.md

---

**You've got this! GitHub might feel overwhelming at first, but you'll get the hang of it quickly. Start simple, and add complexity as you learn.**
