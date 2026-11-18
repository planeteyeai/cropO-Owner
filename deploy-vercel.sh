#!/bin/bash

# Vercel Deployment Script
# This script helps deploy the Cropo Owner frontend to Vercel

set -e

echo "🚀 Starting Vercel Deployment Process..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found!"
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

echo "✅ Vercel CLI is installed"
echo ""

# Check if user is logged in
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "🔑 Please login to Vercel:"
    vercel login
else
    echo "✅ Already logged in to Vercel as: $(vercel whoami)"
fi

echo ""
echo "📋 Deployment Options:"
echo "1. Deploy to Preview (development)"
echo "2. Deploy to Production"
echo ""
read -p "Select option (1 or 2): " option

case $option in
    1)
        echo "🔨 Deploying to preview..."
        vercel
        ;;
    2)
        echo "🔨 Deploying to production..."
        vercel --prod
        ;;
    *)
        echo "❌ Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✨ Deployment complete!"
echo "📱 Your app should be live now."
echo "🌐 Visit the URL shown above to view your deployment."
