const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const Notification = require('../models/Notification');

const getWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id, balance: 0 });
    }

    res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        balanceFormatted: `₹${(wallet.balance / 100).toFixed(2)}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getLedger = async (req, res, next) => {
  try {
    const entries = await Ledger.find({
      $or: [{ fromUser: req.user._id }, { toUser: req.user._id }],
    })
      .populate('ride', 'pickup destination status')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      const error = new Error('Notification not found.');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWallet,
  getLedger,
  getNotifications,
  markNotificationRead,
};