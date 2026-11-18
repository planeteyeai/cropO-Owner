# Deployment Guide

## 📦 Deploy to Vercel

### Prerequisites
- Vercel account (sign up at https://vercel.com)
- Vercel CLI installed: `npm i -g vercel`
- Git repository pushed to GitHub/GitLab/Bitbucket

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to Git repository**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import project to Vercel**
   - Go to https://vercel.com/new
   - Click "Import Project"
   - Select your Git repository
   - Vercel will auto-detect it's a Vite project

3. **Configure Environment Variables**
   In the Vercel dashboard, add these environment variables:
   - `VITE_API_BASE_URL` = Your Django API URL (production)
   - `VITE_FASTAPI_BASE_URL` = https://cropoappapis.up.railway.app
   - `VITE_FASTAPI_BEARER_TOKEN` = Your FastAPI token

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Your app will be live at `https://your-project.vercel.app`

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from project directory**
   ```bash
   cd /home/sid/Cropo_owner/cropO-Owner
   vercel
   ```

4. **Follow the prompts:**
   - Set up and deploy? `Y`
   - Which scope? Select your account
   - Link to existing project? `N` (first time) or `Y` (subsequent)
   - What's your project's name? `cropo-owner` (or your choice)
   - In which directory is your code located? `./`
   - Want to override the settings? `N`

5. **Set environment variables**
   ```bash
   vercel env add VITE_API_BASE_URL
   # Enter value when prompted
   
   vercel env add VITE_FASTAPI_BASE_URL
   # Enter: https://cropoappapis.up.railway.app
   
   vercel env add VITE_FASTAPI_BEARER_TOKEN
   # Enter your token
   ```

6. **Deploy to production**
   ```bash
   vercel --prod
   ```

### Automatic Deployments

Once connected to Git:
- Every push to `main` branch → Production deployment
- Every pull request → Preview deployment
- Access deployments at Vercel dashboard

---

## 🐳 Docker Deployment

### Build and Run Locally

1. **Build the Docker image**
   ```bash
   docker build -t cropo-owner \
     --build-arg VITE_API_BASE_URL=http://127.0.0.1:8001 \
     --build-arg VITE_FASTAPI_BASE_URL=https://cropoappapis.up.railway.app \
     --build-arg VITE_FASTAPI_BEARER_TOKEN=your-token-here \
     .
   ```

2. **Run the container**
   ```bash
   docker run -d -p 3000:80 --name cropo-owner-app cropo-owner
   ```

3. **Access the app**
   - Open http://localhost:3000

4. **Stop the container**
   ```bash
   docker stop cropo-owner-app
   docker rm cropo-owner-app
   ```

### Docker Compose (Optional)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://127.0.0.1:8001}
        VITE_FASTAPI_BASE_URL: ${VITE_FASTAPI_BASE_URL:-https://cropoappapis.up.railway.app}
        VITE_FASTAPI_BEARER_TOKEN: ${VITE_FASTAPI_BEARER_TOKEN}
    ports:
      - "3000:80"
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

### Deploy to Cloud Platforms

#### Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set VITE_API_BASE_URL=your-api-url
railway variables set VITE_FASTAPI_BASE_URL=https://cropoappapis.up.railway.app
railway variables set VITE_FASTAPI_BEARER_TOKEN=your-token

# Deploy
railway up
```

#### Deploy to Render
1. Connect your GitHub repository
2. Select "Docker" as environment
3. Add environment variables
4. Deploy automatically

#### Deploy to DigitalOcean App Platform
1. Connect your GitHub repository
2. Select Dockerfile deployment
3. Add environment variables in dashboard
4. Deploy

---

## 🔧 Environment Variables

### Production Values

Make sure to set these in your deployment platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Django owner API endpoint | `https://your-api.com` |
| `VITE_FASTAPI_BASE_URL` | FastAPI dashboard URL | `https://cropoappapis.up.railway.app` |
| `VITE_FASTAPI_BEARER_TOKEN` | FastAPI authentication token | `your-secret-token` |

### Important Notes

- Never commit `.env` files with real values
- Use different tokens for development and production
- Update API URLs to production endpoints
- Vercel automatically prefixes variables with `VITE_`

---

## 🚀 Quick Start Checklist

- [ ] Push code to Git repository
- [ ] Create Vercel account
- [ ] Import project to Vercel
- [ ] Add environment variables
- [ ] Deploy
- [ ] Test production URL
- [ ] Update API CORS settings to allow your Vercel domain

---

## 🔍 Troubleshooting

### Build Fails
- Check Node version (use Node 18+)
- Verify all dependencies are in package.json
- Check build logs in Vercel dashboard

### Blank Page After Deploy
- Check browser console for errors
- Verify environment variables are set correctly
- Check API CORS settings

### API Connection Issues
- Verify API URLs are correct
- Check CORS headers on backend
- Verify bearer token is valid

### Docker Issues
- Ensure Docker is installed: `docker --version`
- Check port 3000 is not in use
- Verify build args are passed correctly

---

## 📱 Custom Domain (Optional)

1. Go to Vercel project dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. SSL certificate auto-generated

---

## 🔄 CI/CD

Vercel provides automatic CI/CD:
- Automatic builds on every push
- Preview deployments for PRs
- Instant rollbacks
- Production branch protection

No additional setup needed!
