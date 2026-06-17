const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 5000;

// --- 1. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files (This allows the frontend to see the uploaded images)
app.use(express.static('public'));

// --- 2. Database Connection ---
mongoose.connect('mongodb://127.0.0.1:27017/nextgen_cricket')
    .then(() => console.log("✅ MongoDB Connected: nextgen_cricket"))
    .catch(err => console.log("❌ DB Connection Error:", err));

// --- 3. Robust Storage Engine & Fixes ---
// CRITICAL FIX: Ensure the upload directory exists before Multer tries to save files to it.
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 Created public/uploads directory");
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Creates a clean, unique filename: e.g., photo-1678901234.jpg
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// SECURITY FIX: File Filter to ensure only Images are uploaded
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Only JPEG and PNG images are allowed!'));
    }
};

// Initialize Multer with a 2MB file size limit
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: fileFilter
});

// --- 4. Database Schema ---
const StudentSchema = new mongoose.Schema({
    studentId: String,  // E.g., NG-2026-001
    fullName: String,
    dob: String,
    fatherName: String,
    motherName: String,
    email: String,
    phone: String,
    address: String,
    role: String,           // Maps to playingRole
    batting: String,        // Maps to battingStyle
    bowling: String,        // Maps to bowlingStyle
    experience: String,
    medical: String,        // Maps to medicalInfo
    emergency: String,      // Maps to emergencyContact
    photo: String,          // URL path to photo
    signature: String,      // URL path to signature
    regDate: { type: Date, default: Date.now }
});
// --- 4.5 Website Content Schema (CMS) ---
const ContentSchema = new mongoose.Schema({
    heroTitle: { type: String, default: 'DOMINATE THE PITCH.' },
    heroDesc: { type: String, default: 'State-of-the-art facilities and professional coaching based in Baner & Mahalunge, Pune. Your legacy starts here.' },
    coach1Name: { type: String, default: 'PRAVIN KALYANKAR' },
    coach1Bio: { type: String, default: 'Specializing in elite strength and conditioning. Architect of the NextGen performance culture.' },
    coach2Name: { type: String, default: 'ABHIJEET JOGDAND' },
    coach2Bio: { type: String, default: 'Master of functional fitness, mobility, and technical refinement. Maximizing athletic output on the field.' },
    payPlayTitle: { type: String, default: 'LOCKED OUT? GET IN THE NETS.' },
    payPlayDetails: { type: String, default: 'Exclusive Pay & Play access now open at our Mahalunge facility. Standard nets or Sidearm Specialists available.' },
    payPlayPhone: { type: String, default: '919325786808' }
});

const Content = mongoose.model('Content', ContentSchema);

// Auto-initialize default content if the database is empty
async function initCMS() {
    const count = await Content.countDocuments();
    if (count === 0) {
        await new Content({}).save();
        console.log("📝 Initialized default CMS content in database.");
    }
}
initCMS();

// --- CMS ROUTES ---

// GET: Fetch current website content (Public)
app.get('/api/content', async (req, res) => {
    try {
        const content = await Content.findOne();
        res.status(200).json(content);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// PUT: Update website content (Admin Only)
app.put('/api/content', async (req, res) => {
    try {
        if (req.headers['x-admin-key'] !== 'nextgen123') {
            return res.status(403).json({ success: false, message: "Access Denied" });
        }
        
        const content = await Content.findOne();
        Object.assign(content, req.body); // Overwrite old text with new text
        await content.save();
        
        res.status(200).json({ success: true, message: "Site Updated!" });
    } catch (err) {
        console.error("CMS Error:", err);
        res.status(500).json({ success: false });
    }
});
const Student = mongoose.model('Student', StudentSchema);

// --- 5. Routes ---

// A. ENROLLMENT ROUTE (Accepts form data + 2 files)
// Note: Changed endpoint to match your HTML's fetch request '/api/enroll'
app.post('/api/enroll', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
    try {
        // Generate Professional ID (e.g., NG-2026-001)
        const count = await Student.countDocuments();
        const currentYear = new Date().getFullYear();
        const studentId = `NG-${currentYear}-${(count + 1).toString().padStart(3, '0')}`;

        // Create new student record mapping the request body
        const newStudent = new Student({
            studentId: studentId,
            fullName: req.body.fullName,
            dob: req.body.dob,
            fatherName: req.body.fatherName,
            motherName: req.body.motherName,
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address,
            role: req.body.role || req.body.playingRole, // Fallbacks in case HTML name changes
            batting: req.body.batting || req.body.battingStyle,
            bowling: req.body.bowling || req.body.bowlingStyle,
            experience: req.body.experience,
            medical: req.body.medical || req.body.medicalInfo,
            emergency: req.body.emergency || req.body.emergencyContact,
            // Check if files exist, then save path
            photo: req.files['photo'] ? `/uploads/${req.files['photo'][0].filename}` : '',
            signature: req.files['signature'] ? `/uploads/${req.files['signature'][0].filename}` : ''
        });

        await newStudent.save();
        res.status(201).json({ success: true, message: "Player Dossier Accepted. ID: " + studentId });

    } catch (err) {
        console.error("Enrollment Error:", err);
        res.status(500).json({ success: false, message: "Server encountered an error processing the draft." });
    }
});

// B. ADMIN ROSTER ROUTE (Secured with simple API Key check)
app.get('/api/students', async (req, res) => {
    try {
        // SECURITY FIX: Check for admin access key in headers
        const adminKey = req.headers['x-admin-key'];
        
        if (adminKey !== 'nextgen123') {
            return res.status(403).json({ success: false, message: "Access Denied: Invalid Admin Credentials" });
        }

        // Fetch all students, newest first
        const students = await Student.find().sort({ regDate: -1 });
        res.status(200).json(students);

    } catch (err) {
        console.error("Fetch Roster Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// --- 6. Error Handling Middleware (For Multer Size/Type Errors) ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File is too large. Maximum size is 2MB.' });
        }
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
});

// --- 7. Start Server ---
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 NEXTGEN SERVER ONLINE `);
    console.log(`📡 Port: http://localhost:${PORT}`);
    console.log(`=================================`);
});