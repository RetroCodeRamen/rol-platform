# RamenOnline Development Roadmap

## 🎨 **Design Philosophy**

**Core Principle**: AOL wasn't a tool — it was a world. A digital theme park wrapped around the internet.

**Key Pillars**:
- 🔵 **Ritual & Ceremony** (Dial-up sequence, connection flow)
- 📨 **Emotional Rewards** ("You've Got Mail" sound, notifications)
- 🧭 **World Inside a Window** (Floating OS-within-an-OS)
- 🎨 **Keywords** (Proto-URL navigation system)
- 💬 **Social Architecture** (Chat rooms, buddy lists)
- 🧙‍♂️ **Personal Expression** (Fonts, colors, profiles)
- 🛒 **Theme Park Channels** (Curated destinations)
- 💾 **Personality & Quirks** (Alive, not sterile)

*See PROJECT_PLAN.md for full design principles.*

---

## 🎯 Quick Reference

### ✅ **COMPLETED** (Phase 0)
- Core infrastructure (React, Next.js, MongoDB, Socket.io)
- Authentication & security
- AOL-style UI with floating windows
- Mail system (full server-side)
- Instant Messaging (AIM-style)
- Buddy List with groups (block/unblock functionality)
- Weather & Web Browser (with iframe fallback support)
- Sound system
- **Favorites System** - Save and reopen windows/pages
- **Theme-Aware Windows** - Win95-style buttons for AOL 5.0 theme
- **IM Auto-Open Settings** - User preference for auto-opening IM windows
- **Unread IM Indicators** - Bold with asterisk for unread messages
- **Centralized Message Handler** - AppMessageHandler for all app events
- **Production Login Fix** - Flexible cookie configuration for production environments

---

## 🚀 **UPCOMING PHASES**

### **Phase 1: Core Enhancements** (Weeks 1-4)
**Goal**: Polish existing features and add essential functionality

- Mail search & filters
- Mail attachments
- Enhanced profile editor
- Away messages
- Chat rooms & channels

**Deliverables**: 
- Searchable mail inbox
- File attachments in mail
- Full profile customization
- Public chat room system

---

### **Phase 2: Storage Limits & Payments** (Weeks 5-8)
**Goal**: Implement storage limits and payment infrastructure

- Storage limits (25MB mail, 5MB file storage, etc.)
- All users have unlimited buddies and groups
- Stripe/PayPal integration
- Subscription management
- Upgrade prompts

**Deliverables**:
- Working payment system
- Subscription tiers
- Graceful storage limits

---

### **Phase 3: ROL Plus Features** (Weeks 9-12)
**Goal**: First paid tier features ($3-5/month)

- 1GB mailbox
- Mail search & filters
- Advanced profiles
- Custom group icons
- Custom notification sounds
- Private chat rooms

**Deliverables**:
- Complete Plus tier feature set
- Upgrade flow from free to Plus

---

### **Phase 4: ROL Premium Features** (Weeks 13-16)
**Goal**: Premium tier features ($7-10/month)

- 5GB mailbox
- Unlimited buddies
- Cloud file storage (1-10GB)
- Email aliases
- All theme packs
- Signature banners

**Deliverables**:
- Complete Premium tier
- File storage system
- Theme system foundation

---

### **Phase 5: Community Features** (Weeks 17-20)
**Goal**: Social and entertainment features

- Private chat rooms (Plus/Premium)
- Retro game center
- Premium games & leaderboards
- Enhanced channels

**Deliverables**:
- Working game center
- Private room system
- Community engagement tools

---

### **Phase 6: Customization** (Weeks 21-24)
**Goal**: Themes and visual customization

- Theme engine
- Premium theme packs
- Custom skins
- Seasonal themes

**Deliverables**:
- Theme store
- Multiple theme options
- Skin customization system

---

### **Phase 7: Security & Advanced** (Weeks 25-28)
**Goal**: Premium security and verification

- End-to-end encryption (Premium)
- Verified accounts
- Advanced spam filters
- Secure folders

**Deliverables**:
- E2EE messaging
- Verification system
- Enhanced security

---

### **Phase 8: Performance** (Weeks 29-30)
**Goal**: Speed and "Dial-Up+" mode

- Performance optimizations
- "Dial-Up+ Mode" (Premium satire feature)
- Faster loading
- Custom sound themes

**Deliverables**:
- Optimized performance
- Fun premium speed feature

---

### **Phase 9: Analytics** (Weeks 31-32)
**Goal**: Monitoring and backups

- Telemetry & logging
- Backup system
- Monitoring dashboard
- Error tracking

**Deliverables**:
- Production-ready monitoring
- Automated backups

---

## 📊 **Feature Matrix**

| Feature | Free | Plus ($3-5/mo) | Premium ($7-10/mo) |
|---------|------|----------------|-------------------|
| **Mail** |
| Inbox Size | 25MB | 1GB | 5GB |
| Attachments | 1MB | 5MB | 10MB |
| Retention | 7 days | 30 days | Unlimited |
| Search | ❌ | ✅ | ✅ |
| Filters | ❌ | ✅ | ✅ |
| Aliases | ❌ | ❌ | ✅ |
| **Buddies** |
| Max Buddies | Unlimited | Unlimited | Unlimited |
| Max Groups | Unlimited | Unlimited | Unlimited |
| Custom Icons | ❌ | ✅ | ✅ |
| Custom Sounds | ❌ | ✅ | ✅ |
| **Profiles** |
| Profile Images | 1 | 5 | Unlimited |
| Bio Length | Basic | Extended | Extended |
| Custom Themes | ❌ | Select | All |
| HTML Customization | ❌ | ✅ | ✅ |
| **Storage** |
| File Storage | 5MB | ❌ | 1-10GB |
| **Chat** |
| Public Rooms | ✅ | ✅ | ✅ |
| Private Rooms | ❌ | ✅ | ✅ |
| **Games** |
| Basic Games | ✅ | ✅ | ✅ |
| Premium Games | ❌ | ❌ | ✅ |
| Leaderboards | ❌ | ❌ | ✅ |
| **Security** |
| E2EE Messaging | ❌ | ❌ | ✅ |
| Verified Account | ❌ | ❌ | ✅ |
| Spam Filters | Basic | Basic | Advanced |
| **Extras** |
| Themes | Default | Select | All |
| "Dial-Up+ Mode" | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |

---

## 🎯 **Current Status**

**Phase**: 0 Complete → Phase 1 Starting

**Next Sprint** (Weeks 1-2):
1. Mail search functionality
2. Mail attachments (upload/download)
3. Enhanced profile editor UI

**Blockers**: None

**Dependencies**: None

---

## 💡 **Key Principles**

### **Design Principles** (from Deep Lore)
1. **Ritual over function** - Every action should feel like a ceremony
2. **Sound is emotional** - Notifications reward, not just inform
3. **World, not app** - AOL is an ecosystem, not a tool
4. **Personality matters** - Quirks and character are features
5. **Social architecture** - Features enable community, not just communication
6. **Personal expression** - Customization is core to identity
7. **90s energy** - Capture the era's optimism and whimsy

### **Business Principles**
1. **Never lock basic functionality** - Core AOL experience remains free
2. **Premium feels premium** - Paid features enhance, don't restrict
3. **Retro aesthetic** - All features maintain 90s AOL vibe
4. **User experience first** - Smooth, nostalgic, fun
5. **Sustainable growth** - Features justify costs (storage, bandwidth)

### **Implementation Checklist**
Every feature must pass: *"Does this feel like AOL?"*
- [ ] Ritual/ceremony?
- [ ] Personality/quirks?
- [ ] Sound design?
- [ ] Part of AOL world?
- [ ] Supports personalization?
- [ ] Feels social/alive?
- [ ] Maintains 90s energy?

---

*For detailed implementation plans, see PROJECT_PLAN.md*

