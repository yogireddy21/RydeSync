const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    pickup: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },

    destination: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },

    status: {
      type: String,
      enum: [
        'REQUESTED',
        'MATCHED',
        'ACCEPTED',
        'DRIVER_ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
    },

    fare: {
      baseFare: { type: Number, default: 0 },
      perKmRate: { type: Number, default: 0 },
      perMinRate: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      durationMin: { type: Number, default: 0 },
      surgeMultiplier: { type: Number, default: 1 },
      totalFare: { type: Number, default: 0 },
    },

    matchedDrivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    currentDriverIndex: {
      type: Number,
      default: 0,
    },

    cancelledBy: {
      type: String,
      enum: ['rider', 'driver', null],
      default: null,
    },

    cancelReason: {
      type: String,
      trim: true,
    },

    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

rideSchema.index({ pickup: '2dsphere' });
rideSchema.index({ destination: '2dsphere' });
rideSchema.index({ rider: 1, status: 1 });
rideSchema.index({ driver: 1, status: 1 });

const VALID_TRANSITIONS = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

rideSchema.methods.canTransitionTo = function (newStatus) {
  return VALID_TRANSITIONS[this.status].includes(newStatus);
};

rideSchema.methods.transitionTo = function (newStatus) {
  if (!this.canTransitionTo(newStatus)) {
    const error = new Error(
      `Invalid transition: ${this.status} → ${newStatus}`
    );
    error.statusCode = 400;
    throw error;
  }
  this.status = newStatus;
};

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;