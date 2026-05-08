# GitHub Actions Continuous Deployment

This repository uses GitHub Actions to automatically deploy to Fly.io when changes are pushed to the `main` branch.

## Workflow

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `main` branch

**Steps:**
1. Checkout code
2. Set up Node.js 20 with npm caching
3. Install dependencies (`npm ci`)
4. Build application (`npm run build`)
5. Run tests (`npm test`)
6. Deploy to Fly.io using `flyctl`

## Setup Instructions

### 1. Generate Fly.io API Token

```bash
# Install flyctl if not already installed
curl -L https://fly.io/install.sh | sh

# Authenticate with Fly.io
flyctl auth login

# Generate an API token
flyctl auth token
```

### 2. Add Token to GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FLY_API_TOKEN`
5. Value: Paste the token from step 1
6. Click **Add secret**

### 3. Deploy

The workflow will automatically trigger on any push to the `main` branch.

To manually trigger a deployment:
```bash
git checkout main
git push origin main
```

## Viewing Deployment Status

### GitHub Actions UI

1. Go to the **Actions** tab in your repository
2. Click on the latest workflow run
3. Monitor the deployment progress

### Fly.io Dashboard

1. Visit [fly.io/dashboard](https://fly.io/dashboard)
2. Select your app: `bakeoff-1`
3. View logs and deployment status

### CLI

```bash
# View app status
flyctl status -a bakeoff-1

# View logs
flyctl logs -a bakeoff-1

# Open app in browser
flyctl open -a bakeoff-1
```

## Deployment Configuration

**App Name:** `bakeoff-1` (configured in `fly.toml`)

**Region:** `iad` (US East)

**Environment:**
- `NODE_ENV=production`
- `PORT=8080`

**Resources:**
- Memory: 256 MB
- CPU: 1 shared vCPU
- Auto-scaling: Off (stateful runtime persistence)

## Troubleshooting

### Build Failures

If the build fails, check:
- TypeScript compilation errors
- Missing dependencies
- Test failures

Fix locally and push again:
```bash
npm run build
npm test
git add .
git commit -m "Fix build issues"
git push origin main
```

### Deployment Failures

If deployment fails, check:
- Fly.io API token is valid
- App `bakeoff-1` exists in your Fly.io account
- `fly.toml` configuration is correct

Debug with:
```bash
flyctl status -a bakeoff-1
flyctl logs -a bakeoff-1
```

### Test Failures

Tests run with `continue-on-error: true`, so they won't block deployment.
However, you should still fix failing tests:
```bash
npm test
```

## Manual Deployment

To deploy manually without GitHub Actions:

```bash
# Build locally
npm run build

# Deploy to Fly.io
flyctl deploy --remote-only
```

## Monitoring

After deployment, verify the app is running:

```bash
# Check health
curl https://bakeoff-1.fly.dev/health

# Should return: {"ok": true, "service": "bakeoff-runtime-core"}
```

## Rollback

To rollback to a previous version:

```bash
# List releases
flyctl releases -a bakeoff-1

# Rollback to specific version
flyctl releases rollback <version> -a bakeoff-1
```

## Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [flyctl CLI Reference](https://fly.io/docs/flyctl/)
