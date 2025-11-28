# 🔐 Admin Setup & Customer Support Configuration Guide

## Part 1: Create Your Admin Account

### Step 1: Register a New Account
1. Open your Globance application in the browser
2. Click **"Register"** in the top navigation or go to `/register`
3. Fill in the registration form:
   - **Full Name**: Your name (e.g., "Admin User")
   - **Email**: Your admin email (e.g., "admin@globance.app")
   - **Password**: Choose a strong password
   - **Referral Code**: Leave blank
4. Click **"Create Account"**
5. **IMPORTANT**: Copy and save your email address - you'll need it in the next step

### Step 2: Upgrade to Admin Role
After registering, tell me the email address you used, and I'll run this command to upgrade your account:

```sql
UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
```

This gives your account administrator privileges.

---

## Part 2: Login as Admin

### Step 3: Login to Your Account
1. Go to the login page (`/login`)
2. Enter your email and password
3. Click **"Sign In"**
4. You'll be redirected to the Dashboard

### Step 4: Access Admin Panel
1. Look at the navigation menu at the top
2. You should see an **"Admin"** link (only visible to admin users)
3. Click **"Admin"** to open the Admin Panel

---

## Part 3: Configure Customer Support Settings

### Step 5: Open Settings Modal
1. In the Admin Panel, scroll down to find the **"Customer Support Settings"** card
2. It should show:
   - 📱 Telegram support link
   - 💬 WhatsApp support link
3. Click anywhere on this card or click **"Manage Support Links"** button

### Step 6: Configure Your Contact Links

#### For Telegram:
1. In the **Telegram Support Link** field, enter your Telegram contact URL
2. Format options:
   - Direct message: `https://t.me/yourusername`
   - Group chat: `https://t.me/yourgroup`
   - Bot: `https://t.me/yourbot`
3. Example: `https://t.me/globancesupport`

#### For WhatsApp:
1. In the **WhatsApp Support Link** field, enter your WhatsApp contact URL
2. Format: `https://wa.me/PHONENUMBER`
   - Replace PHONENUMBER with your number (include country code, no + or spaces)
3. Example: `https://wa.me/1234567890` (for +1-234-567-8900)

**Note**: You can leave either field empty if you don't want to show that contact option.

### Step 7: Save Your Settings
1. Click the **"Save Settings"** button
2. You'll see a success notification: "Customer support settings updated successfully"
3. Click **"Cancel"** or anywhere outside the modal to close it

---

## Part 4: Verify Your Settings

### Step 8: Check Customer Support Page
1. Click **"Customer Support"** in the navigation menu
2. You should now see:
   - Your configured Telegram button (if you added a Telegram link)
   - Your configured WhatsApp button (if you added a WhatsApp link)
3. Click the buttons to test - they should open your Telegram/WhatsApp links

---

## ✅ You're All Set!

Your users can now:
- Visit the **Customer Support** page
- See the contact buttons you configured
- Click to reach you on Telegram or WhatsApp

## 🔧 To Update Settings Later:
1. Login as admin
2. Go to Admin Panel
3. Click "Customer Support Settings"
4. Update the links
5. Click "Save Settings"

---

## 📝 Quick Reference

### Valid Link Formats:
- **Telegram**: `https://t.me/username` or `https://t.me/groupname`
- **WhatsApp**: `https://wa.me/COUNTRYCODEPHONENUMBER`
- **Empty**: Leave blank to hide that button

### Example Links:
- Telegram: `https://t.me/johndoe`
- WhatsApp: `https://wa.me/14155551234` (for +1-415-555-1234)

### Need Help?
If you encounter any issues, let me know and I'll assist you!
