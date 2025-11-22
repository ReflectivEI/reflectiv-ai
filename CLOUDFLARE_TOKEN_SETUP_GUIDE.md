# Cloudflare API Token Setup Guide

## Quick Start

This guide helps you create a properly configured Cloudflare API Token for deploying the ReflectivAI Worker.

## Prerequisites

- Access to Cloudflare account: `59fea97fab54fbd4d4168ccaa1fa3410`
- Account owner or admin permissions

## Step-by-Step Token Creation

### 1. Navigate to API Tokens Page

Go to: [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

### 2. Create Custom Token

Click **"Create Token"** button, then select **"Create Custom Token"**

### 3. Configure Token Settings

#### Token Name
```
reflectivai-worker-deploy
```

#### Permissions

Select these three permission sets:

| Resource Type | Permission | Access Level |
|---------------|------------|--------------|
| Account → Workers Scripts | | Read, Edit |
| Account → Workers KV Storage | | Read, Edit |
| Account → R2 Storage (optional) | | Read, Edit |

#### Account Resources

- **Include**: Specific account
- **Select**: `59fea97fab54fbd4d4168ccaa1fa3410`

#### Zone Resources

- **Include**: All zones from account
  
  OR (for better security):
  
- **Include**: Specific zone → `tonyabdelmalak.com`

#### Client IP Address Filtering (Optional but Recommended)

For additional security, you can restrict the token to specific IP addresses:

- **Is in**: `[your office/home IP]`
- **Is not in**: Leave empty

#### TTL (Time to Live)

- **Start Date**: Today
- **End Date**: 1 year from now (or according to your security policy)

### 4. Review and Create

1. Click **"Continue to summary"**
2. Review all permissions carefully
3. Click **"Create Token"**

### 5. Save Your Token

⚠️ **CRITICAL**: Copy the token immediately - you won't be able to see it again!

```bash
# Example token format (yours will be different)
CF_API_TOKEN_EXAMPLE_1234567890abcdefghijklmnopqrstuvwxyz
```

## Verification

After creating your token, verify it works:

```bash
# Export the token
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

# Verify token
curl -s "https://api.cloudflare.com/client/v4/accounts/59fea97fab54fbd4d4168ccaa1fa3410/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "errors": [],
  "messages": [
    {
      "code": 10000,
      "message": "This API Token is valid and active",
      "type": null
    }
  ],
  "result": {
    "id": "...",
    "status": "active"
  }
}
```

## Using the Token

### For Deployment Script

```bash
# Export environment variables
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

# Run deployment
./deploy-with-verification.sh
```

### For Direct Wrangler Commands

```bash
# Export the token
export CLOUDFLARE_API_TOKEN="your-token-here"

# Deploy
npx wrangler deploy

# View logs
npx wrangler tail

# Check worker status
npx wrangler deployments list
```

## Troubleshooting

### Error: "Authentication error"

**Cause**: Token not set or invalid

**Solution**:
1. Verify token is exported: `echo $CLOUDFLARE_API_TOKEN`
2. Re-verify token using curl command above
3. If verification fails, create a new token

### Error: "Insufficient permissions"

**Cause**: Token doesn't have required scopes

**Solution**:
1. Check token permissions in Cloudflare dashboard
2. Ensure these permissions are enabled:
   - Workers Scripts: Read + Edit
   - Workers KV Storage: Read + Edit
3. Create a new token if needed

### Error: "Account not found" or "Wrong account"

**Cause**: Token not scoped to correct account

**Solution**:
1. Verify account ID in token settings
2. Must be: `59fea97fab54fbd4d4168ccaa1fa3410`
3. Create new token with correct account scope

### Error: "Token expired"

**Cause**: Token TTL has passed

**Solution**:
1. Create a new token with extended TTL
2. Update your environment variables
3. Re-run deployment

## Security Best Practices

1. **Never commit tokens to git**
   - Add `.env` to `.gitignore`
   - Use environment variables only

2. **Rotate tokens regularly**
   - Recommended: Every 90 days
   - After team member changes
   - If token may have been exposed

3. **Use minimal permissions**
   - Only grant what's needed
   - Account-specific, not global

4. **Set IP restrictions**
   - Limit to known IPs when possible
   - Use CI/CD service IPs for automation

5. **Monitor token usage**
   - Check Cloudflare audit logs
   - Review token activity in dashboard

## Token Template (JSON)

For programmatic token creation via API:

```json
{
  "name": "reflectivai-worker-deploy",
  "policies": [
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.59fea97fab54fbd4d4168ccaa1fa3410": "*"
      },
      "permission_groups": [
        {
          "id": "c8fed203ed3043cba015a93ad1616f1f",
          "name": "Workers Scripts Write"
        },
        {
          "id": "b8f4f9cd38f5406b8e0b3b6d8e7f8c9a",
          "name": "Workers KV Storage Write"
        }
      ]
    }
  ]
}
```

## Additional Resources

- [Cloudflare API Token Docs](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Workers Deploy Docs](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
- [Wrangler Authentication](https://developers.cloudflare.com/workers/wrangler/commands/#authentication)

## Support

If you continue to have issues:

1. Run the automated deployment script: `./deploy-with-verification.sh`
2. Follow the Backup Token Remediation Protocol if it triggers
3. Check the Final Engineering Report for specific error details
4. Review Cloudflare Workers logs: `wrangler tail`

---

**Last Updated**: 2025-11-21
**Account ID**: `59fea97fab54fbd4d4168ccaa1fa3410`
**Worker Name**: `my-chat-agent-v2`
