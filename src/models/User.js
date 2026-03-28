const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true, // normalize on write — prevents "User@gmail.com" vs "user@gmail.com" duplicates
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default — must explicitly request with .select('+password')
    },

    role: {
      type: String,
      enum: ['rider', 'driver', 'admin'],
      default: 'rider',
    },

    isActive: {
      type: Boolean,
      default: true, // admin can set this to false to deactivate a user without deleting them
    },

    // ── Driver only fields ──────────────────────────────────────────────────
    // These fields are only populated when role === 'driver'
    // Riders and admins will simply have these as undefined

    isOnline: {
      type: Boolean,
      default: false, // driver must explicitly go online — not online by default
    },

    currentLocation: {
      // GeoJSON Point format — required by MongoDB 2dsphere index
      // CRITICAL: coordinates are [longitude, latitude] — NOT [latitude, longitude]
      // Mix them up and your drivers appear in the ocean
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },

    vehicleDetails: {
      make: { type: String, trim: true },        // e.g. Toyota
      model: { type: String, trim: true },       // e.g. Innova
      year: { type: Number },                    // e.g. 2022
      licensePlate: { type: String, trim: true}, // e.g. TS09AB1234
      color: { type: String, trim: true },       // e.g. White
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt fields
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// 2dsphere index on currentLocation — enables MongoDB geospatial queries
// This is what makes "find 5 nearest drivers within 5km" work in under 5ms
// Without this index: MongoDB scans every driver document — database melts at scale
userSchema.index({ currentLocation: '2dsphere' });

// ── Pre-save hook — password hashing ─────────────────────────────────────────
// GoF Observer Pattern: this hook watches for the save event and reacts automatically
// Fires before every User.save() call
// Only runs if password was actually modified — prevents re-hashing on profile updates
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // saltRounds: 12 means bcrypt runs 2^12 = 4096 iterations
  // Higher = harder to brute force, but slower
  // 12 is the production standard — good balance of security and speed
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method — password comparison ─────────────────────────────────────
// Added directly on the schema so every User document has this method
// Usage: const isMatch = await user.comparePassword(candidatePassword)
// We put this here because password comparison belongs to the User — not the service
//
// GoF Observer Pattern: comparePassword is attached to the model instance
// it has direct access to 'this' (the user document) including the hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  // bcrypt.compare handles the hashing internally — never compare plain strings
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;