# Repository Root Information

## Repository Root Location

The repository root is located at:
```
/home/runner/work/reflectiv-ai/reflectiv-ai
```

## Quick Reference Commands

### Navigate to Repository Root
```bash
cd /home/runner/work/reflectiv-ai/reflectiv-ai
```

### Verify Current Location
```bash
pwd
# Should output: /home/runner/work/reflectiv-ai/reflectiv-ai
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
