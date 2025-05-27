# 🚀 Complete CLI Deployment (GitHub + Heroku)

Deploy your financial dashboard entirely through command line!

## Prerequisites
- [Git](https://git-scm.com/) installed ✅
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- GitHub account (free)
- Heroku account (free)

## Option A: Full CLI with GitHub CLI (Recommended)

### 1. Install GitHub CLI
```bash
# Windows (if you have winget)
winget install --id GitHub.cli

# Or download from: https://cli.github.com/
```

### 2. Login to GitHub
```bash
gh auth login
# Follow the prompts to authenticate
```

### 3. Create Repository and Push (One Command!)
```bash
# Commit your current work
git add .
git commit -m "Initial commit: Financial dashboard with enhanced oscillators"

# Create GitHub repo and push in one go
gh repo create financial-screener-dashboard --public --source=. --remote=origin --push
```

### 4. Deploy to Heroku
```bash
# Login to Heroku
heroku login

# Create and deploy app
heroku create your-financial-dashboard
git push heroku main

# Open your live dashboard
heroku open
```

## Option B: Pure Git CLI (No GitHub CLI needed)

### 1. Create Empty GitHub Repository
Since you can't create repos through pure git, you have two choices:

**Quick Web Method** (30 seconds):
- Go to [github.com/new](https://github.com/new)
- Repository name: `financial-screener-dashboard`
- Make it **Public**
- **Don't** check any initialization boxes
- Click "Create repository"

**Or Ask Someone**: If you really want to avoid the web, ask a friend to create it for you! 😄

### 2. Connect and Push
```bash
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/financial-screener-dashboard.git

# Commit and push
git add .
git commit -m "Initial commit: Financial dashboard with enhanced oscillators"
git branch -M main
git push -u origin main
```

### 3. Deploy to Heroku
```bash
heroku login
heroku create your-financial-dashboard
git push heroku main
heroku open
```

## Option C: Heroku Only (Skip GitHub)

If you just want to deploy quickly:

```bash
# Login and create app
heroku login
heroku create your-financial-dashboard

# Add Heroku as remote and deploy
heroku git:remote -a your-financial-dashboard
git add .
git commit -m "Deploy financial dashboard"
git push heroku main

# Open dashboard
heroku open
```

## Recommended: Option A (GitHub CLI)

**Why GitHub CLI is awesome:**
- ✅ One command to create repo + push
- ✅ Can set up auto-deployment to Heroku
- ✅ Manage everything from terminal
- ✅ Professional workflow

## Complete One-Liner Deployment

After installing GitHub CLI and logging in:

```bash
git add . && git commit -m "Deploy dashboard" && gh repo create financial-screener-dashboard --public --source=. --remote=origin --push && heroku create your-dashboard && git push heroku main && heroku open
```

That's it! **One command** = Live dashboard! 🚀

## Your App URLs

After deployment:
- **GitHub**: `https://github.com/YOUR_USERNAME/financial-screener-dashboard`
- **Live App**: `https://your-dashboard.herokuapp.com`
- **API**: `https://your-dashboard.herokuapp.com/api/analyzer-b`

## Environment Variables (Optional)

For EOD API instead of Yahoo Finance:
```bash
heroku config:set USE_EOD_API=true
heroku config:set EOD_API_KEY=your_key_here
```

## Future Updates

```bash
git add .
git commit -m "Your update"
git push origin main  # Updates GitHub
git push heroku main  # Updates live app
```

## Cost: $0/month! 💰

## Benefits of GitHub + Heroku Setup ✅

- ✅ **Version control** - All changes tracked on GitHub
- ✅ **Automatic deployments** - Push to GitHub = auto-deploy to Heroku
- ✅ **Backup** - Your code is safely stored on GitHub
- ✅ **Collaboration** - Others can contribute to your project
- ✅ **Portfolio** - Showcase your work publicly

## Your Complete Setup

```
Local Code → GitHub Repository → Heroku App
    ↓              ↓               ↓
 Development    Source Control   Live Website
```

## What's Already Configured ✅

- ✅ **Procfile** - Tells Heroku how to run your Flask app
- ✅ **requirements.txt** - All Python dependencies listed  
- ✅ **Flask CORS** - Frontend can communicate with backend
- ✅ **Static file serving** - HTML/CSS/JS files served automatically
- ✅ **Environment variables** - EOD API support ready

## Your App Structure on Heroku

```
Frontend: https://your-app.herokuapp.com/
API:      https://your-app.herokuapp.com/api/analyzer-b
          https://your-app.herokuapp.com/api/multi-ticker
```

## Troubleshooting

### Check Logs
```bash
heroku logs --tail
```

### Restart App
```bash
heroku restart
```

### Update Code (after initial setup)
```bash
git add .
git commit -m "Your update message"
git push origin main
# Heroku will auto-deploy if you connected via web interface
```

## Free Tier Limits
- ✅ 550-1000 free dyno hours/month (Heroku)
- ✅ Unlimited public repositories (GitHub)
- ✅ Sleeps after 30 min of inactivity (wakes up automatically)
- ✅ Perfect for personal use and demos

## Cost: $0/month for basic usage! 💰 