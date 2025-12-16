# Twilio Email Integration Plan
## Making ROL Mail Service Work Publicly

**Goal**: Enable sending and receiving emails to/from external email addresses using Twilio SendGrid Email API.

---

## 📋 Overview

Currently, the mail system only works internally between users with `@ramn.online` addresses. This plan outlines how to integrate Twilio SendGrid to enable:
- **Sending emails** to any external email address (Gmail, Yahoo, etc.)
- **Receiving emails** from external addresses via webhooks
- **Domain verification** for `ramn.online`
- **Proper email formatting** (HTML/text, attachments, headers)

---

## 🎯 Phase 1: Setup & Configuration (Week 1)

### 1.1 Twilio SendGrid Account Setup
- [ ] Create Twilio SendGrid account
- [ ] Verify domain `ramn.online` (add DNS records)
- [ ] Create API key with "Mail Send" permissions
- [ ] Set up sender authentication (SPF, DKIM, DMARC)
- [ ] Configure webhook URL for incoming emails

### 1.2 Environment Configuration
- [ ] Add `SENDGRID_API_KEY` to `.env.local` (and production)
- [ ] Add `SENDGRID_WEBHOOK_SECRET` for webhook verification
- [ ] Add `SENDGRID_FROM_EMAIL` (e.g., `noreply@ramn.online`)
- [ ] Update `.env.local.example` with placeholders

### 1.3 Dependencies
- [ ] Install `@sendgrid/mail` package
- [ ] Install `@sendgrid/eventwebhook` for webhook verification (optional)

```bash
npm install @sendgrid/mail
npm install --save-dev @types/node
```

---

## 🚀 Phase 2: Outbound Email (Sending) - Week 1-2

### 2.1 Create Email Service Module
**File**: `src/lib/email/sendgridService.ts`

```typescript
import sgMail from '@sendgrid/mail';

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    content: string; // base64 encoded
    filename: string;
    type: string;
    disposition?: string;
  }>;
  from?: string; // Defaults to noreply@ramn.online
}

export async function sendEmailViaSendGrid(options: SendEmailOptions): Promise<void> {
  // Implementation
}

export async function sendBulkEmailsViaSendGrid(emails: SendEmailOptions[]): Promise<void> {
  // For multiple recipients
}
```

### 2.2 Update Mail Send Route
**File**: `src/app/api/mail/send/route.ts`

**Changes**:
- Separate internal vs external recipients
- For internal recipients: Use existing MongoDB flow
- For external recipients: Send via SendGrid API
- Handle attachments for external emails (convert to base64)
- Track sent status for external emails

**Implementation Steps**:
1. Split recipients into `internalRecipients` and `externalRecipients`
2. Process internal recipients as before
3. For external recipients:
   - Convert attachments to base64 if present
   - Call `sendEmailViaSendGrid()`
   - Create "Sent" message in sender's Sent folder
   - Log delivery status

### 2.3 Attachment Handling
- Convert FileAttachment documents to base64
- Include in SendGrid email as attachments
- Respect SendGrid limits (25MB total per email)
- Handle attachment size limits per tier (1MB free, 5MB Plus, 10MB Premium)

### 2.4 Error Handling
- Handle SendGrid API errors gracefully
- Retry logic for transient failures
- Rate limiting (SendGrid: 100 emails/second on free tier)
- Queue system for bulk sends (future enhancement)

---

## 📥 Phase 3: Inbound Email (Receiving) - Week 2-3

### 3.1 Webhook Endpoint
**File**: `src/app/api/mail/inbound/route.ts`

**Purpose**: Receive emails from external senders via SendGrid Inbound Parse

**Setup**:
1. Configure SendGrid Inbound Parse webhook
2. Point to: `https://ramn.online/api/mail/inbound`
3. Parse incoming email data

**Implementation**:
```typescript
export async function POST(request: NextRequest) {
  // Parse SendGrid webhook payload
  // Extract: from, to, subject, body, attachments
  // Find recipient user by email address
  // Create MailMessage in recipient's Inbox
  // Apply filters
  // Send notification
}
```

### 3.2 Email Parsing
- Parse multipart emails (text/html)
- Extract attachments
- Handle inline images
- Parse email headers (Reply-To, References, etc.)
- Handle email encoding (UTF-8, quoted-printable, base64)

### 3.3 User Matching
- Match incoming email `to` address to user:
  - Check `username@ramn.online` format
  - Check user's registered external email
  - Handle email aliases (future Premium feature)
- Create "catch-all" handling for unknown addresses

### 3.4 Security
- Verify webhook signature (SendGrid provides this)
- Rate limit webhook endpoint
- Validate email content (prevent injection)
- Sanitize HTML content
- Scan attachments for malware (future enhancement)

---

## 🔒 Phase 4: Security & Validation - Week 3

### 4.1 Domain Verification
- [ ] Add SPF record: `v=spf1 include:sendgrid.net ~all`
- [ ] Add DKIM record (provided by SendGrid)
- [ ] Add DMARC record: `v=DMARC1; p=quarantine; rua=mailto:dmarc@ramn.online`
- [ ] Verify domain in SendGrid dashboard

### 4.2 Rate Limiting
- Implement per-user rate limits:
  - Free tier: 10 emails/day
  - Plus tier: 100 emails/day
  - Premium tier: 1000 emails/day
- Track email counts per user per day
- Return appropriate error messages

### 4.3 Spam Prevention
- Implement basic spam filtering:
  - Check sender reputation
  - Validate email format
  - Rate limit incoming emails per sender
- Integrate with SendGrid's spam filtering
- User-configurable spam filters (Plus/Premium)

### 4.4 Email Validation
- Validate email addresses before sending
- Check for disposable email addresses (optional)
- Verify recipient domains exist (MX record check)
- Handle bounce notifications from SendGrid

---

## 💰 Phase 5: Cost Management & Limits - Week 3-4

### 5.1 SendGrid Pricing
- **Free Tier**: 100 emails/day forever
- **Essentials**: $19.95/month for 50,000 emails
- **Pro**: $89.95/month for 100,000 emails

### 5.2 User Limits by Tier
| Tier | Daily Limit | Monthly Limit | Cost per Email |
|------|-------------|---------------|----------------|
| Free | 10 emails | 300 emails | Included |
| Plus | 100 emails | 3,000 emails | $0.0006/email |
| Premium | 1,000 emails | 30,000 emails | $0.0003/email |

### 5.3 Implementation
- Track email usage per user
- Enforce daily/monthly limits
- Show usage dashboard
- Upgrade prompts when limits reached
- Queue emails if limit exceeded (optional)

### 5.4 Cost Tracking
- Log all SendGrid API calls
- Track costs per user
- Monthly cost reports
- Alert when approaching SendGrid limits

---

## 🧪 Phase 6: Testing - Week 4

### 6.1 Unit Tests
- Test email parsing
- Test recipient splitting (internal vs external)
- Test attachment conversion
- Test error handling

### 6.2 Integration Tests
- Test sending to external email (Gmail, Yahoo)
- Test receiving from external email
- Test attachment delivery
- Test webhook processing

### 6.3 End-to-End Tests
- Send email from ROL to Gmail
- Reply from Gmail to ROL
- Verify email appears in ROL inbox
- Test filters work on external emails

### 6.4 Load Testing
- Test rate limiting
- Test bulk email sending
- Test webhook handling under load

---

## 📊 Phase 7: Monitoring & Analytics - Week 4-5

### 7.1 Email Tracking
- Track delivery status (sent, delivered, bounced, opened)
- Store SendGrid event webhooks
- Display delivery status in UI
- Show "read receipts" (if enabled)

### 7.2 Logging
- Log all external email sends
- Log webhook receives
- Log errors and failures
- Log cost per email

### 7.3 Analytics Dashboard
- Emails sent/received per day
- Delivery rates
- Bounce rates
- Cost tracking
- Top senders/recipients

---

## 🎨 Phase 8: UI Enhancements - Week 5

### 8.1 Compose View Updates
- Show indicator for external recipients
- Display email limits remaining
- Show delivery status after sending
- Better error messages for external sends

### 8.2 Message View Updates
- Show "External Email" badge
- Display full email headers (optional)
- Show delivery status for sent emails
- Reply-to external emails functionality

### 8.3 Settings Page
- Email preferences
- Auto-reply settings
- Spam filter settings
- Email forwarding (future)

---

## 🔄 Phase 9: Advanced Features (Future) - Week 6+

### 9.1 Email Threading
- Group replies by thread
- Show conversation view
- Track In-Reply-To headers

### 9.2 Email Aliases (Premium)
- Multiple email addresses per user
- `username+tag@ramn.online` support
- Custom domain support

### 9.3 Email Templates
- Pre-built templates
- Custom templates (Plus/Premium)
- Signature management

### 9.4 Email Scheduling
- Schedule emails to send later
- Timezone support
- Recurring emails

---

## 📝 Implementation Checklist

### Week 1: Setup & Outbound
- [ ] Create SendGrid account and verify domain
- [ ] Install dependencies
- [ ] Create `sendgridService.ts`
- [ ] Update mail send route for external recipients
- [ ] Test sending to external email

### Week 2: Inbound & Security
- [ ] Create webhook endpoint
- [ ] Implement email parsing
- [ ] Add security verification
- [ ] Test receiving from external email
- [ ] Add rate limiting

### Week 3: Limits & Testing
- [ ] Implement user email limits
- [ ] Add cost tracking
- [ ] Write tests
- [ ] Load testing
- [ ] Fix bugs

### Week 4: Monitoring & UI
- [ ] Add email tracking
- [ ] Create analytics dashboard
- [ ] Update UI components
- [ ] User documentation

---

## 🚨 Important Considerations

### Security
1. **Never expose API keys** - Use environment variables
2. **Verify webhook signatures** - Prevent spoofing
3. **Sanitize email content** - Prevent XSS
4. **Rate limit aggressively** - Prevent abuse
5. **Validate all inputs** - Prevent injection attacks

### Costs
1. **Monitor SendGrid usage** - Set up alerts
2. **Implement user limits** - Prevent abuse
3. **Track costs per user** - For billing
4. **Consider SendGrid pricing tiers** - Scale appropriately

### Performance
1. **Queue large sends** - Don't block API
2. **Cache user lookups** - Reduce DB queries
3. **Async processing** - Use background jobs
4. **CDN for attachments** - Faster delivery

### Compliance
1. **CAN-SPAM Act** - Include unsubscribe links
2. **GDPR** - Handle user data properly
3. **Email retention** - Respect user deletion
4. **Privacy** - Don't share email addresses

---

## 📚 Resources

- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference)
- [SendGrid Inbound Parse](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [Email Best Practices](https://sendgrid.com/resource/email-deliverability-best-practices-guide/)

---

## 🎯 Success Metrics

- ✅ Can send emails to Gmail/Yahoo/Outlook
- ✅ Can receive emails from external senders
- ✅ Attachments work for external emails
- ✅ Rate limiting prevents abuse
- ✅ Costs stay within budget
- ✅ Delivery rate > 95%
- ✅ Bounce rate < 5%

---

**Next Steps**: Start with Phase 1 - Setup & Configuration
