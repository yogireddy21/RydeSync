const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    type: {
      type: String,
      enum: ['RIDE_PAYMENT', 'DRIVER_PAYOUT', 'PLATFORM_FEE'],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ledgerSchema.index({ ride: 1 });
ledgerSchema.index({ fromUser: 1 });
ledgerSchema.index({ toUser: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

module.exports = Ledger;