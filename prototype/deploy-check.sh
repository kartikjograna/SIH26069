#!/usr/bin/env bash
# Quick deployment checklist script

set -e

echo "🚀 SIH 2026 Deployment Checklist"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "render.yaml" ] || [ ! -f "vercel.json" ]; then
    echo "❌ Error: Run this script from the prototype/ directory"
    exit 1
fi

echo "✅ Found deployment configs"
echo ""

# Check git status
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "📦 Git Repository Status:"
    if [[ -n $(git status -s) ]]; then
        echo "⚠️  Uncommitted changes detected. You should commit before deploying."
        git status -s
    else
        echo "✅ Working tree is clean"
    fi
else
    echo "❌ Not a git repository. Initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit: Weather Analytics Platform'"
fi
echo ""

# Check if required files exist
echo "📋 Checking required files:"
files=("requirements.txt" "backend/main.py" "frontend/package.json" "vercel.json" "render.yaml" "DEPLOYMENT.md")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing)"
    fi
done
echo ""

# Check environment example
echo "🔐 Environment Configuration:"
if [ -f ".env.example" ]; then
    echo "  ✅ .env.example exists"
    echo "  📝 Make sure to set these in Render:"
    grep -E "^[A-Z_]+=" .env.example | sed 's/=.*//' | sed 's/^/     - /'
else
    echo "  ⚠️  No .env.example found"
fi
echo ""

echo "📍 Next Steps:"
echo ""
echo "1️⃣  Commit and push to GitHub:"
echo "   git add ."
echo "   git commit -m 'Add deployment configs'"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/YOUR_USERNAME/SIH26069.git"
echo "   git push -u origin main"
echo ""
echo "2️⃣  Deploy Backend (Render):"
echo "   • Go to https://dashboard.render.com/"
echo "   • New + → Blueprint"
echo "   • Connect your repo"
echo "   • Click 'Apply'"
echo ""
echo "3️⃣  Deploy Frontend (Vercel):"
echo "   • Go to https://vercel.com/new"
echo "   • Import your repo"
echo "   • Set Root Directory: prototype/frontend"
echo "   • Add env var: VITE_API_BASE=<your-render-url>"
echo "   • Deploy"
echo ""
echo "4️⃣  Update CORS in Render:"
echo "   • Set CORS_ORIGINS=<your-vercel-url>"
echo "   • Save and redeploy"
echo ""
echo "📖 Full guide: See DEPLOYMENT.md"
echo ""
