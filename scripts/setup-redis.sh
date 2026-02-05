#!/bin/bash

# Redis Quick Start Guide for Development

echo "======================================"
echo "Redis Setup for Socket.io Scaling"
echo "======================================"
echo ""

# Check if Redis is already running
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✓ Redis is already running!"
        redis-cli ping
        echo ""
    else
        echo "✗ Redis CLI found but service not running"
        echo "Starting Redis..."
        redis-server --daemonize yes
        sleep 1
        redis-cli ping
    fi
else
    echo "Redis CLI not found. Checking Docker..."
    
    if command -v docker &> /dev/null; then
        echo "✓ Docker found! Starting Redis container..."
        
        # Check if container exists
        if docker ps -a --format '{{.Names}}' | grep -q "realtime_chat_redis"; then
            echo "Starting existing Redis container..."
            docker start realtime_chat_redis
        else
            echo "Creating new Redis container..."
            docker run -d \
                --name realtime_chat_redis \
                -p 6379:6379 \
                redis:7-alpine
        fi
        
        sleep 2
        
        # Test connection
        if docker exec realtime_chat_redis redis-cli ping &> /dev/null; then
            echo "✓ Redis container is running!"
            docker exec realtime_chat_redis redis-cli ping
        fi
    else
        echo "✗ Neither Redis nor Docker found!"
        echo ""
        echo "Install one of the following:"
        echo "1. Redis: https://redis.io/download"
        echo "2. Docker: https://docker.com"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
fi

echo ""
echo "======================================"
echo "Configuring Backend for Redis"
echo "======================================"
echo ""

cd backend

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Update .env to enable Redis
echo "Updating .env to enable Redis adapter..."
sed -i 's/ENABLE_REDIS_ADAPTER=false/ENABLE_REDIS_ADAPTER=true/' .env

echo "✓ Updated ENABLE_REDIS_ADAPTER=true"
echo ""

echo "======================================"
echo "Starting Backend with Redis"
echo "======================================"
echo ""

npm run dev

echo ""
echo "✓ Backend started with Redis adapter enabled!"
echo "✓ All Socket.io events now broadcast through Redis"
echo ""
echo "To test Redis connectivity:"
echo "  redis-cli ping"
echo ""
echo "To disable Redis (fallback to in-memory):"
echo "  Set ENABLE_REDIS_ADAPTER=false in .env and restart"
