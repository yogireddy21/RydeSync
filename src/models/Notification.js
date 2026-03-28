const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
    },

    type: {
      type: String,
      enum: ['RIDE_ACCEPTED', 'DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED', 'PAYMENT_RECEIVED'],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;