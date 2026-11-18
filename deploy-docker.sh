#!/bin/bash

# Docker Deployment Script
# This script builds and runs the Cropo Owner frontend in Docker

set -e

echo "🐳 Starting Docker Deployment Process..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Load environment variables
if [ -f .env.production.local ]; then
    echo "📦 Loading environment variables from .env.production.local..."
    export $(cat .env.production.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
    echo "📦 Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No environment file found. Using default values..."
    export VITE_API_BASE_URL="http://127.0.0.1:8001"
    export VITE_FASTAPI_BASE_URL="https://cropoappapis.up.railway.app"
    export VITE_FASTAPI_BEARER_TOKEN="your-token-here"
fi

echo ""
echo "🔨 Building Docker image..."
docker build -t cropo-owner:latest \
    --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    --build-arg VITE_FASTAPI_BASE_URL="$VITE_FASTAPI_BASE_URL" \
    --build-arg VITE_FASTAPI_BEARER_TOKEN="$VITE_FASTAPI_BEARER_TOKEN" \
    .

echo ""
echo "🛑 Stopping existing container (if any)..."
docker stop cropo-owner-app 2>/dev/null || true
docker rm cropo-owner-app 2>/dev/null || true

echo ""
echo "🚀 Starting container..."
docker run -d \
    -p 3000:80 \
    --name cropo-owner-app \
    --restart unless-stopped \
    cropo-owner:latest

echo ""
echo "✨ Deployment complete!"
echo "🌐 Your app is running at: http://localhost:3000"
echo ""
echo "📊 Container status:"
docker ps | grep cropo-owner-app

echo ""
echo "💡 Useful commands:"
echo "   View logs: docker logs cropo-owner-app"
echo "   Stop app:  docker stop cropo-owner-app"
echo "   Start app: docker start cropo-owner-app"
echo "   Remove:    docker stop cropo-owner-app && docker rm cropo-owner-app"
