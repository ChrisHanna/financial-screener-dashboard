# 🚀 Easy GitHub + Heroku Deployment

Your financial dashboard is ready to deploy! First we'll push to GitHub, then to Heroku.

## Prerequisites
- [Git](https://git-scm.com/) installed
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- GitHub account (free)
- Heroku account (free tier available)

## Step 1: Push to GitHub (2 minutes)

### 1. Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and click "New repository"
2. Name it: `financial-screener-dashboard`
3. Make it **Public** (so Heroku can access it)
4. **Don't** initialize with README (you already have files)
5. Click "Create repository"

### 2. Connect Local Git to GitHub
Replace `YOUR_USERNAME` with your actual GitHub username:
```bash
git remote add origin https://github.com/YOUR_USERNAME/financial-screener-dashboard.git
```

### 3. Push Your Code to GitHub
```bash
git add .
git commit -m "Initial commit: Financial dashboard with enhanced oscillators"
git branch -M main
git push -u origin main
```

### 4. Verify on GitHub
Your code should now be visible at: `https://github.com/YOUR_USERNAME/financial-screener-dashboard`

## Step 2: Deploy to Heroku (3 minutes)

### 1. Login to Heroku
```bash
heroku login
```

### 2. Create Heroku App
```bash
heroku create your-financial-dashboard
# Replace 'your-financial-dashboard' with your preferred name
```

### 3. Connect Heroku to GitHub (Recommended)
Option A - **Easy Web Interface**:
1. Go to [Heroku Dashboard](https://dashboard.heroku.com/)
2. Click your app → "Deploy" tab
3. Connect to GitHub and select your repository
4. Enable "Automatic deploys" from main branch
5. Click "Deploy Branch"

Option B - **Command Line**:
```bash
git push heroku main
```

### 4. Add Environment Variables (Optional)
If you want to use EOD API instead of Yahoo Finance:
```bash
heroku config:set USE_EOD_API=true
heroku config:set EOD_API_KEY=your_eod_api_key_here
```

### 5. Open Your Dashboard
```bash
heroku open
```

## That's it! 🎉

Your dashboard will be live at: `https://your-app-name.herokuapp.com`

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