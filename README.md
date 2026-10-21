# 🚀 CloudDrop - Client File Upload & Auto-Drive Sync System

Yeh aik mukammal system hai jo aapki **Google Drive** k sath connect hota hai. Aap client k liye aik unique link generate krte hain, client us link pr jo bhi file upload kre ga, wo direct aapki Google Drive me save ho jaye gi. Aur aap jb chaho gay, us link ko **1-Click** me **Expire** kr skte hain taake client mazeed kuch upload na kr ske.

---

## 🌟 Main Features

1. **Client Upload Links**:
   - Har client k liye alag custom link (maslan: "Ali Website Project", "Designs from Client B").
   - Link copy kr k direct WhatsApp, Email ya Slack pr bhejein.
2. **Instant Expiration (Jb chaho expire kr do)**:
   - Dashboard me har link k samne **"Expire Link Now"** ka button hai.
   - Jaise hi aap click karein gay, link foran expire ho jaye ga.
   - Client agar link open kre ga ya file upload krne ki koshish kre ga to usko foran *"Upload Link Expired"* ka notice show hoga aur upload block ho jaye gi.
   - Aap kisi bhi waqt us link ko dobara **"Reactivate Link"** bhi kr skte hain.
   - Optional: Auto-expire time bhi set kr skte hain (jaise 1 ghanta, 24 ghante, 7 din baad khud expire ho jaye).
3. **Google Drive Integration**:
   - Files direct aapki Google Drive k folder me save hoti hain.
   - Har client ka alag subfolder bhi khud ba khud ban skta hai.
   - Agar Google Drive abhi connect nahi bhi ki, tab bhi system files ko locally `uploads/` me mehfooz rkhta hai aur jb aap Drive connect karein to 1-click me sari files Drive pr sync ho jati hain.
4. **Client Upload Portal**:
   - Modern Drag & Drop interface.
   - Real-time progress bar (0% se 100%).
   - Multi-file support.
   - Mobile aur desktop responsive.

---

## 🖥️ How to Run the System (Chalanay ka Tareeqa)

1. Server start krne k liye terminal me command chalayein:
   ```bash
   npm start
   ```

2. Browser me open karein:
   - **Admin Dashboard**: [http://localhost:3000](http://localhost:3000)
   - Yahan se aap naye links banayein gay aur unko manage ya expire karein gay.

---

## 🔑 Google Drive Connect Krne Ka Tareeqa (Step-by-Step)

Aapko sirf 2-3 minute lagenge:

1. **Google Cloud Console Open Karein**:
   - [Google Cloud Console](https://console.cloud.google.com/) pr jayein aur new project banayein.
   - **APIs & Services** > **Library** me ja kr **"Google Drive API"** search karein aur **Enable** kr dein.

2. **Service Account Banayein**:
   - **APIs & Services** > **Credentials** pr click karein.
   - **Create Credentials** > **Service Account** select karein.
   - Naam likhein (jaise `drive-uploader`) aur **Done** kr dein.
   - Service account banne k baad us pr click karein, **Keys** tab me jayein > **Add Key** > **Create new key** > **JSON** select kr k download kr lein.

3. **Google Drive Folder Share Karein**:
   - Apni Google Drive me jayein aur aik folder banayein (maslan: `Client Uploads`).
   - Us folder pr right-click kr k **Share** pr click karein.
   - Jo Service Account ki email thi (e.g. `drive-uploader@project.iam.gserviceaccount.com`), usko paste karein aur role **Editor** select kr k share kr dein.
   - Folder ka URL dekhein, browser me URL is tarah hoga:
     `https://drive.google.com/drive/folders/1A2b3C4d5E6f_xyz789`
     Aakhri hissa (`1A2b3C4d5E6f_xyz789`) aapka **Folder ID** hai.

4. **Dashboard me Save Karein**:
   - Admin Dashboard ([http://localhost:3000](http://localhost:3000)) pr jayein.
   - Top right pr **Drive Settings** (⚙️) pr click karein.
   - Apni downloaded JSON file ka text paste karein aur apna Folder ID daal kr **Save & Connect** pr click karein.
   - Green color ka *"Connected & Ready"* status aa jaye ga!

---

## 📁 Project Structure

```
Cloud/
├── data/
│   └── db.json                # Database (Links, Uploads, Settings)
├── public/
│   ├── css/
│   │   ├── style.css          # Dashboard styling (Glassmorphism & animations)
│   │   └── upload.css         # Client upload portal styling
│   ├── js/
│   │   ├── admin.js           # Admin Dashboard interactions
│   │   └── upload.js          # Client upload & progress handling
│   ├── index.html             # Admin Dashboard UI
│   └── upload.html            # Client File Upload Portal
├── src/
│   ├── config.js              # Environment & paths config
│   ├── driveService.js        # Google Drive API integration
│   ├── storage.js             # Local JSON DB operations
│   └── server.js              # Express Backend & APIs
├── uploads/                   # Temporary / Local storage buffer
├── .env                       # Environment variables
├── package.json
└── README.md
```

---

## 💡 Quick Tips
- Aap multiple links create kr skte hain har client k liye.
- Har link k samne **"Expire Link Now"** ka button dabane se client ka link foran band ho jaye ga.
- Jb bhi client upload kre ga, Dashboard me "Uploaded Files History" me foran entry show hogi aur aap wahin se "Open in Drive" pr click kr k Google Drive me file dekh skte hain!
