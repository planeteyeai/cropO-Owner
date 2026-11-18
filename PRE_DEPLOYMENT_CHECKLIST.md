# ✅ Pre-Deployment Checklist

Before deploying your Cropo Owner application, complete this checklist:

## 📋 Essential Steps

### 1. Environment Variables
- [ ] I have my Django API production URL
- [ ] I have my FastAPI bearer token from https://cropoappapis.up.railway.app/docs
- [ ] I know which environment I'm deploying to (staging/production)

### 2. Backend Configuration
- [ ] My Django API is deployed and accessible
- [ ] CORS is configured on backend to allow my frontend domain
- [ ] API endpoints are tested and working
- [ ] Database migrations are up to date

### 3. Code Preparation
- [ ] All features are tested locally
- [ ] No console errors in browser dev tools
- [ ] Build command runs successfully: `npm run build`
- [ ] Latest code is committed to Git

### 4. Deployment Method Selected

Choose ONE:

#### Option A: Vercel (Recommended)
- [ ] I have a Vercel account (https://vercel.com)
- [ ] My code is pushed to GitHub/GitLab/Bitbucket
- [ ] I have Vercel CLI installed: `npm i -g vercel`

#### Option B: Docker
- [ ] Docker is installed on my system
- [ ] I have access to a server/VPS (if deploying remotely)
- [ ] I have created `.env` file with production values

## 🚀 Ready to Deploy?

If all boxes are checked, proceed with deployment:

### For Vercel:
```bash
cd /home/sid/Cropo_owner/cropO-Owner
./deploy-vercel.sh
```

### For Docker:
```bash
cd /home/sid/Cropo_owner/cropO-Owner
cp .env.example .env
nano .env  # Add your production values
./deploy-docker.sh
```

## 📝 Environment Variables Reference

You will need these values:

```bash
# Django API (Owner Backend)
VITE_API_BASE_URL=https://your-production-api.com

# FastAPI (Manager Dashboard)
VITE_FASTAPI_BASE_URL=https://cropoappapis.up.railway.app

# FastAPI Authentication
VITE_FASTAPI_BEARER_TOKEN=your-actual-bearer-token-from-swagger
```

### How to get FastAPI Bearer Token:
1. Go to https://cropoappapis.up.railway.app/docs
2. Click "Authorize" button (🔒)
3. Enter your credentials
4. Copy the token shown

## ⚠️ Important Notes

- **Never commit `.env` files** with real tokens to Git
- **Test API connectivity** before deploying frontend
- **Update CORS settings** on backend after deployment
- **Use HTTPS** for production APIs
- **Different tokens** for dev and production environments

## 🆘 Having Issues?

### Backend Not Accessible
- Check if API URL is correct
- Verify API is actually running
- Test with: `curl YOUR_API_URL/health`

### CORS Errors
- Add your Vercel domain to backend CORS allowed origins
- Example: `https://your-app.vercel.app`

### Build Fails
- Check Node version: `node --version` (need 18+)
- Clear and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`

### Environment Variables Not Working
- In Vercel: Must start with `VITE_`
- In Docker: Check `.env` file syntax (no spaces around `=`)
- Restart/redeploy after changing env vars

## ✨ Post-Deployment

After successful deployment:

- [ ] Test the deployed app URL
- [ ] Check browser console for errors
- [ ] Test API connectivity
- [ ] Test all major features
- [ ] Verify map displays correctly
- [ ] Test routing (navigation between pages)
- [ ] Check on mobile devices

## 📞 Support Resources

- **Full Guide**: See `DEPLOYMENT.md`
- **Quick Reference**: See `QUICKSTART.md`
- **Commands**: See `DEPLOYMENT_COMMANDS.txt`
- **Troubleshooting**: See `DEPLOYMENT_SUMMARY.md`

---

**Good luck with your deployment! 🚀**
