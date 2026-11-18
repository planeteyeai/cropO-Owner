# 🚀 Quick Deployment Guide

## Vercel Deployment (Easiest - Recommended)

### Option 1: One-Click Deploy
1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables:
   - `VITE_API_BASE_URL`
   - `VITE_FASTAPI_BASE_URL`
   - `VITE_FASTAPI_BEARER_TOKEN`
5. Click Deploy

### Option 2: CLI Deploy
```bash
# Run the deployment script
./deploy-vercel.sh
```

---

## Docker Deployment

### Quick Start
```bash
# Run the deployment script
./deploy-docker.sh
```

### Or manually:
```bash
# Build
docker build -t cropo-owner \
  --build-arg VITE_API_BASE_URL=http://127.0.0.1:8001 \
  --build-arg VITE_FASTAPI_BASE_URL=https://cropoappapis.up.railway.app \
  --build-arg VITE_FASTAPI_BEARER_TOKEN=your-token \
  .

# Run
docker run -d -p 3000:80 --name cropo-owner-app cropo-owner

# Access at http://localhost:3000
```

### Using Docker Compose
```bash
# Create .env file first
cp .env.example .env
# Edit .env with your values

# Run
docker-compose up -d

# Stop
docker-compose down
```

---

## 📝 Important Notes

1. **Environment Variables**: Always set production values before deploying
2. **CORS**: Update your backend CORS settings to allow your Vercel domain
3. **API URLs**: Change from localhost to production URLs
4. **Tokens**: Use different tokens for dev and production

---

## 🆘 Need Help?

Check the full [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions and troubleshooting.
