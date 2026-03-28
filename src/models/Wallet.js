const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

walletSchema.index({ user: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;