# Rebound Capital Group CRM

Professional lead management system for tax deed properties.

## Quick Deploy to Vercel (5 minutes)

### Option 1: GitHub (Recommended)
1. Create a GitHub account (if you don't have one): https://github.com/signup
2. Create a new repository (name it `rcg-crm`)
3. Upload all files from this folder to the repository
4. Go to https://vercel.com and sign up with your GitHub account
5. Click "Import Project" and select your `rcg-crm` repository
6. Click "Deploy" (no configuration needed!)
7. Your CRM will be live at `your-name-rcg-crm.vercel.app`

### Option 2: Vercel CLI (Fastest)
1. Install Node.js from https://nodejs.org (if not installed)
2. Open terminal in this folder
3. Run: `npx vercel`
4. Follow the prompts (all defaults are fine)
5. Your CRM will be deployed!

## Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:5173

## Login Credentials

**Admin:** admin / admin123  
**Agent:** agent1 / agent123

## Loading Your Leads

1. Login as admin
2. Go to Admin Panel
3. Upload the `crm_leads_612_records.json` file
4. Done! All 612 leads are now loaded

## Features

- ✅ Multi-user access with role-based permissions
- ✅ Lead management (Future Auctions & Surplus Deals)
- ✅ Status tracking & notes
- ✅ Search & filtering
- ✅ Persistent storage (data survives refresh)
- ✅ Mobile responsive
- ✅ Export blocked for regular users (security)

## Free Hosting Options

- **Vercel** (recommended): Free forever, custom domains
- **Netlify**: Free tier available
- **Render**: Free tier available

## Support

For issues or questions, refer to the Vercel documentation: https://vercel.com/docs
