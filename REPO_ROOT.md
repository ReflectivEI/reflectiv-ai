# Repository Root Information

## Repository Root Location

The repository root is the directory where you cloned this repository. It contains files like `package.json`, `wrangler.toml`, `worker.js`, and the `.git` directory.

**For CI/CD environments (GitHub Actions):**
```
/home/runner/work/reflectiv-ai/reflectiv-ai
```

**For local development:**
The path depends on where you cloned the repository (e.g., `~/projects/reflectiv-ai` or `/Users/yourname/reflectiv-ai`)

## Quick Reference Commands

### Navigate to Repository Root
```bash
# Using git to find the root
cd $(git rev-parse --show-toplevel)

# Or navigate to where you cloned the repository
cd ~/path/to/reflectiv-ai
```

### Verify Current Location
```bash
pwd
# Should output the absolute path to your repository clone

# Verify you're in the right place
ls package.json wrangler.toml worker.js
# Should show these files exist
```

### View Repository Structure
```bash
ls -la
```

### Check Git Status
```bash
git status
```

## Common Commands from Root

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm test
```

### Build the Project
```bash
npm run build
```

### Deploy Worker
```bash
npx wrangler deploy
```

### Run Development Server
```bash
npm run dev
```

## Environment Variables

Make sure you're in the repository root before setting or checking environment variables:
```bash
echo $PWD  # Should show the repo root path
```

## Notes

- This directory contains all project files including `package.json`, `wrangler.toml`, and source code
- All npm, git, and deployment commands should be run from this directory
- The `.git` directory is located here, making this the git repository root
