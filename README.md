> 🧩 This repo is part of **NovaProject**, the full stack behind [thenovadetailing.ca](https://www.thenovadetailing.ca).  
> High-level overview: https://github.com/liamkeats/NovaProjectMeta


# ✨ Nova Detailing – Modern Auto Detailing Website

> A clean, fast, mobile-first website for **Nova Detailing** – a professional mobile detailing service based in Nova Scotia. Built to convert visitors into booked details with slick visuals, live chat, and real Google Reviews.

---

<div align="center">

🚗 **Mobile Detailing** • 📍 Nova Scotia • 🌐 Live at **[thenovadetailing.ca](https://www.thenovadetailing.ca)**

[![Status](https://img.shields.io/badge/status-live-brightgreen.svg)](#-deployment)
[![Built with](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange.svg)](#-tech-stack)
[![Astro](https://img.shields.io/badge/framework-Astro-5a45ff.svg)](#-tech-stack)
[![Netlify](https://img.shields.io/badge/hosted_on-Netlify-00c7b7.svg)](#-deployment)

</div>

---

## 🧩 Overview

This repo contains the source code for the **Nova Detailing** website, including:

- A high-impact **hero section** with branding & CTA
- A fully responsive **services showcase** (Bronze / Silver / Gold, etc.)
- A **custom Google Reviews widget** (no paid embed widget, fully custom)
- A **“Chat Now” SMS widget** powered by a Netlify Function + Twilio
- A detailed **contact form** with all the fields a real client would need
- A **gallery** for before/after shots and featured work
- A **service area** page targeting local SEO around Nova Scotia

The goal: _this isn’t just a school project site_ – it’s a **real, production-usable business website** for Nova Detailing.

---

## 🚀 Features

### 💬 Live “Chat Now” SMS Widget
- Floating button on every page
- Opens a mini chat panel
- Sends messages via **Netlify Function → Twilio → your phone**
- Great for quick quotes and instant questions from potential clients

### ⭐ Custom Google Reviews Integration
- Serverless function hits a reviews API / backend and returns:
  - Average rating (e.g., `5.0`)
  - Total number of Google reviews
  - Individual review cards (name, date, rating, text, profile link)
- Frontend renders:
  - **Rating summary** (“5.0 · 27 Google reviews” style)
  - **AI-style summary blurb** of what people love about Nova Detailing
  - **“Review us on Google”** button
- Fully customizable UI to match Nova Detailing’s branding  
  (no Elfsight or 3rd-party iframes)

### 🧼 Services & Pricing
- Clear breakdown of detailing packages (e.g. interior, exterior, full, add-ons)
- Emphasis on value, trust, and quality over “cheap wash”

### 🖼️ Gallery & Visuals
- Space for **before/after** photos and transformation shots
- Focus on mobile-first layout so it looks good on a phone right away

### 📍 Service Area
- Describes where Nova Detailing operates (e.g. Kentville + surrounding areas)
- Content structured for local SEO (towns/regions, mobile service, etc.)

### 📨 Contact Page
- Custom form fields:
  - Service type
  - Name (first, last)
  - Phone
  - Email
  - Vehicle make / model / year / color
  - Preferred date
  - Notes / comments
- Form submission handled by **Netlify Function** for notifications  
  (e.g. email, Discord, SMS – depending on how you wire it up)

---

## 🛠 Tech Stack

- **Frontend**
  - HTML5
  - Modern CSS (responsive, mobile-first)  
    – including `global.css`, `home.css`, `contact.css`, etc.
  - Vanilla JavaScript for widgets and DOM updates

- **Framework / Meta**
  - [Astro](https://astro.build/) for pages & components
  - Netlify for hosting, builds, and serverless functions

- **Serverless / Backend**
  - Netlify Functions (Node.js)
    - `getReviews` – fetch Google Reviews data
    - `send-chat` / `send-sms` – handle “Chat Now” messages
    - `send-form-notification` – notify you on new contact form submissions

- **(Optional) CMS**
  - Sanity (for blog/gallery content & future expansion)

---

## 📁 Project Structure (High-Level)

> This is a simplified view – the actual structure may have a few more pieces.

```bash
nova-detailing/
├─ public/
│  ├─ assets/
│  │  ├─ images/
│  │  ├─ videos/
│  │  ├─ icons/
│  │  └─ aftereffects/
├─ src/
│  ├─ pages/
│  │  ├─ index.astro          # Home
│  │  ├─ about.astro          # About Nova Detailing
│  │  ├─ services.astro
│  │  ├─ service-area.astro
│  │  ├─ gallery.astro
│  │  ├─ reviews.astro
│  │  └─ contact.astro
│  ├─ components/
│  │  ├─ ChatNowWidget.jsx
│  │  ├─ GoogleReviewsWidget.jsx
│  │  └─ Navbar/Footer/etc.
│  └─ styles/
│     ├─ global.css
│     ├─ home.css
│     ├─ contact.css
│     └─ reviews.css
├─ netlify/
│  └─ functions/
│     ├─ getReviews.js
│     ├─ send-chat.js
│     └─ send-form-notification.js
├─ package.json
├─ netlify.toml
└─ README.md
```