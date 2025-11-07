# Security and Password Protection Notes

## Architecture Overview

ReflectivAI uses a hybrid hosting architecture that separates static assets from dynamic compute:

- **Static Site Hosting**: GitHub Pages hosts the HTML, CSS, JavaScript, and other static assets
- **Dynamic Compute**: Cloudflare Workers handle all API requests and AI model interactions
- **CDN/Proxy**: Cloudflare sits in front of the site providing TLS, caching, and security features

This separation ensures that sensitive operations (API keys, model calls, data processing) occur in a controlled server environment, not in the browser.

## Security Practices

### Cloudflare Worker Security

The Cloudflare Worker follows security best practices:

1. **Secret Management**: API keys, provider URLs, and other secrets are stored in Cloudflare Worker environment bindings, never in the repository or client code
2. **No Secret Logging**: The worker does not log sensitive information to avoid leakage
3. **Input Validation**: All incoming requests are validated for method, content-type, JSON structure, and required fields
4. **Error Sanitization**: Error messages are sanitized before returning to clients to avoid information disclosure
5. **CORS Protection**: Cross-Origin Resource Sharing (CORS) is configured with an allowlist to restrict which domains can access the API
6. **Content-Type Enforcement**: The `/chat` endpoint requires `application/json` content-type
7. **Timeout Protection**: Model calls include 8-second timeouts with AbortController to prevent hanging requests

### Static Site Security

The GitHub Pages site includes:

1. **Content Security Policy (CSP)**: Restricts which resources can be loaded and executed
2. **HTTPS Only**: All traffic is encrypted via TLS
3. **No PII/PHI Storage**: The site does not store any personally identifiable information or protected health information
4. **Session-Only Memory**: Conversation history is stored only in browser memory and cleared on page refresh

## Password Protection Options

### GitHub Pages Limitations

**GitHub Pages does NOT support native password protection** for static sites. The hosting is public by default.

### Available Options

If you need to restrict access to the ReflectivAI platform, consider these approaches:

#### Option 1: Cloudflare Access (Recommended)

**Cloudflare Access** provides enterprise-grade authentication in front of your site:

- **How it works**: Users must log in via SSO (Google, Microsoft, GitHub, etc.) before accessing the site
- **Setup**: Configure Cloudflare Access in your Cloudflare dashboard to protect the entire domain or specific paths
- **Benefits**: 
  - No code changes required
  - Supports multiple identity providers
  - Audit logging included
  - MFA support
- **Tradeoffs**:
  - Requires Cloudflare paid plan
  - Adds login step for all users
  - May impact caching

**Setup Steps**:
1. Go to Cloudflare Dashboard → Zero Trust → Access
2. Create an Application for your domain
3. Define access policies (who can access)
4. Choose identity providers (Google Workspace, Okta, etc.)

#### Option 2: Basic Auth via Worker

You can implement HTTP Basic Authentication using a Cloudflare Worker:

- **How it works**: Add a Worker in front of your static site that checks for Authorization header
- **Setup**: Deploy a separate Worker that validates credentials before serving content
- **Benefits**:
  - Simple to implement
  - Works with all browsers
  - No external dependencies
- **Tradeoffs**:
  - Shared password model (not per-user)
  - Credentials can be intercepted if not careful
  - Impacts caching performance
  - Requires managing the Worker separately

**Example Pattern** (Optional, not implemented by default):

```javascript
// basic-auth-worker.js (separate from chat worker)
export default {
  async fetch(request, env) {
    const CREDENTIALS = env.BASIC_AUTH_CREDENTIALS; // "username:password" in base64
    const authHeader = request.headers.get("Authorization");
    
    if (!authHeader || authHeader !== `Basic ${CREDENTIALS}`) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="ReflectivAI"'
        }
      });
    }
    
    return fetch(request);
  }
};
```

#### Option 3: Private GitHub Repository

If the entire project should be private:

- **How it works**: Make the GitHub repository private, which prevents GitHub Pages from being publicly accessible
- **Benefits**: Simple, built-in
- **Tradeoffs**: 
  - Only GitHub users you invite can access
  - Not suitable for external users
  - No granular access control

### Recommendation

For production deployments requiring authentication:

1. **Internal/Enterprise Use**: Use Cloudflare Access with your SSO provider
2. **Demo/Staging**: Use Basic Auth Worker with temporary credentials
3. **Public Platform**: Keep current architecture with no authentication

## Compliance Notes

### HIPAA Compliance

The current architecture **does not meet HIPAA requirements** out of the box because:

- Conversations are not encrypted at rest (stored only in browser memory)
- No audit logging of access to PHI
- No Business Associate Agreement (BAA) with Cloudflare/GitHub

To achieve HIPAA compliance, you would need:

- Cloudflare Enterprise plan with BAA
- Encrypted data storage (not browser memory)
- Complete audit trail
- Access controls and authentication
- Regular security assessments

### Pharmaceutical Compliance (PhRMA, FDA)

The system includes guardrails for pharmaceutical compliance:

- Off-label language detection
- Absolute claim detection
- Citation requirement for clinical statements
- Risk flag surfacing for sales simulation and role play modes

However, **human review is still required** before using any generated content in actual HCP interactions.

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. Email security concerns to the repository maintainers
3. Include steps to reproduce if applicable
4. Allow time for remediation before public disclosure

## Security Checklist for Deployment

Before deploying to production:

- [ ] Verify all secrets are in Cloudflare Worker environment bindings
- [ ] Confirm CORS_ORIGINS includes only allowed domains
- [ ] Test CSP headers don't block required resources
- [ ] Enable Cloudflare Access if authentication is required
- [ ] Review and update rate limiting if needed
- [ ] Set up monitoring and alerting for the Worker
- [ ] Document who has access to Cloudflare/GitHub accounts
- [ ] Establish process for rotating API keys
- [ ] Configure backup procedures for any data storage

## Additional Resources

- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/)
- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/applications/)
- [GitHub Pages Security](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Content Security Policy Reference](https://content-security-policy.com/)

---

**Last Updated**: 2025-11-07  
**Version**: 1.0  
**Maintainer**: ReflectivAI Team
